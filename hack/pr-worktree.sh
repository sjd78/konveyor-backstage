#!/usr/bin/env bash
#
# hack/pr-worktree.sh
# Manage pure-environment git worktrees for GitHub PR evaluation, updates, and teardown.
#

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration and Environment
# -----------------------------------------------------------------------------

get_main_repo_root() {
  local root
  root="$(git worktree list --porcelain 2>/dev/null | head -n1 | sed -e 's/^worktree //')"
  if [[ -z "$root" || ! -d "$root" ]]; then
    echo "Error: Not inside a git repository." >&2
    exit 1
  fi
  echo "$root"
}

MAIN_REPO_ROOT="$(get_main_repo_root)"
REPO_NAME="$(basename "$MAIN_REPO_ROOT")"

# Base worktree root defaults to ~/projects/wt_<repo_name> and can be overridden via WT_ROOT
WT_ROOT="${WT_ROOT:-$HOME/projects/wt_${REPO_NAME}}"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

check_prerequisites() {
  local missing=()
  for cmd in git gh jq yarn; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "Error: Missing required commands: ${missing[*]}" >&2
    exit 1
  fi
}

extract_pr_number() {
  local input="$1"
  local num
  num="$(echo "$input" | grep -o '[0-9]\+' | tail -n1 || true)"
  if [[ -z "$num" ]]; then
    echo "Error: Could not parse a valid PR number from '$input'." >&2
    exit 1
  fi
  echo "$num"
}

usage() {
  cat << EOF
Usage: $(basename "$0") <command> [options]

Commands:
  checkout <pr>     Check out a PR into a dedicated worktree in \$WT_ROOT/pr-<number>,
                    add fork remote if applicable, and run yarn install --immutable.
                    (Aliases: co, add)

  teardown [<pr>]   Tear down the worktree and remove the local PR branch.
                    If run inside a PR worktree, <pr> is optional.
                    Options: --force / -f to discard uncommitted changes.
                    (Aliases: clean, rm, delete, down)

  list              List all active PR worktrees under \$WT_ROOT.
                    (Alias: ls)

  info [<pr>]       Show metadata and git status for a PR worktree.

Environment:
  WT_ROOT           Base directory for PR worktrees.
                    Default: ~/projects/wt_${REPO_NAME}
                    Current: ${WT_ROOT}

Examples:
  $(basename "$0") checkout 6
  $(basename "$0") checkout https://github.com/sjd78/konveyor-backstage/pull/6
  $(basename "$0") list
  $(basename "$0") teardown 6
  $(basename "$0") teardown --force
EOF
}

# -----------------------------------------------------------------------------
# Command: checkout
# -----------------------------------------------------------------------------

cmd_checkout() {
  local pr_input="${1:-}"
  if [[ -z "$pr_input" ]]; then
    echo "Error: Missing PR number or URL." >&2
    usage
    exit 1
  fi

  check_prerequisites
  local pr_num
  pr_num="$(extract_pr_number "$pr_input")"

  echo "==> Fetching details for PR #${pr_num} via gh..."
  local pr_json
  if ! pr_json="$(gh pr view "$pr_num" --json number,title,headRepository,headRepositoryOwner,headRefName,baseRefName,isCrossRepository,url 2>/dev/null)"; then
    echo "Error: Failed to fetch PR #${pr_num}. Check that the PR exists and 'gh auth status' is valid." >&2
    exit 1
  fi

  local title is_fork head_owner head_repo head_branch base_branch pr_url
  title="$(echo "$pr_json" | jq -r '.title')"
  is_fork="$(echo "$pr_json" | jq -r '.isCrossRepository')"
  head_owner="$(echo "$pr_json" | jq -r '.headRepositoryOwner.login')"
  head_repo="$(echo "$pr_json" | jq -r '.headRepository.nameWithOwner')"
  head_branch="$(echo "$pr_json" | jq -r '.headRefName')"
  base_branch="$(echo "$pr_json" | jq -r '.baseRefName')"
  pr_url="$(echo "$pr_json" | jq -r '.url')"

  local wt_path="${WT_ROOT}/pr-${pr_num}"

  # Check if worktree directory or registration already exists
  if [[ -d "$wt_path" ]]; then
    echo "Error: Directory '$wt_path' already exists." >&2
    echo "Run '$(basename "$0") teardown $pr_num' first or remove the directory." >&2
    exit 1
  fi

  if git worktree list --porcelain | grep -q "^worktree ${wt_path}$"; then
    echo "Error: Worktree '$wt_path' is already registered in git worktree list." >&2
    echo "Run '$(basename "$0") teardown $pr_num' to clean it up." >&2
    exit 1
  fi

  # Remote handling: if PR is from a fork, ensure the fork remote is added
  local remote_name="origin"
  local remote_url
  remote_url="$(git remote get-url origin 2>/dev/null || echo "origin")"

  if [[ "$is_fork" == "true" ]]; then
    remote_name="$head_owner"
    if ! git remote get-url "$remote_name" &>/dev/null; then
      echo "==> PR originates from fork ($head_repo). Adding remote '$remote_name'..."
      local repo_info
      repo_info="$(gh repo view "$head_repo" --json sshUrl,url 2>/dev/null || true)"
      if git remote get-url origin 2>/dev/null | grep -q '^git@'; then
        remote_url="$(echo "$repo_info" | jq -r '.sshUrl // empty')"
      else
        remote_url="$(echo "$repo_info" | jq -r '.url // empty')"
      fi
      if [[ -z "$remote_url" ]]; then
        remote_url="git@github.com:${head_repo}.git"
      fi
      git remote add "$remote_name" "$remote_url"
      echo "    Added remote '$remote_name' -> $remote_url"
    else
      remote_url="$(git remote get-url "$remote_name")"
      echo "==> Remote '$remote_name' already present ($remote_url)."
    fi
  fi

  echo "==> Fetching branch '$head_branch' from remote '$remote_name'..."
  git fetch "$remote_name" "$head_branch"

  # Branch naming: pr/<owner>/<pr_num> for forks, pr/<pr_num> for local branches
  local branch_name
  if [[ "$is_fork" == "true" ]]; then
    branch_name="pr/${head_owner}/${pr_num}"
  else
    branch_name="pr/${pr_num}"
  fi

  # Ensure branch is not checked out in another worktree
  if git worktree list --porcelain | grep -q "^branch refs/heads/${branch_name}$"; then
    echo "Error: Branch '$branch_name' is already checked out in another worktree." >&2
    exit 1
  fi

  # Create or update local branch pointer
  if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
    echo "==> Updating local branch '$branch_name' to point to '$remote_name/$head_branch'..."
    git branch -f "$branch_name" "$remote_name/$head_branch"
  else
    echo "==> Creating local branch '$branch_name' from '$remote_name/$head_branch'..."
    git branch "$branch_name" "$remote_name/$head_branch"
  fi

  # Create worktree
  mkdir -p "$(dirname "$wt_path")"
  echo "==> Creating git worktree at '$wt_path'..."
  git worktree add "$wt_path" "$branch_name"
  git -C "$wt_path" branch --set-upstream-to="$remote_name/$head_branch" "$branch_name" 2>/dev/null || true

  # Write .worktree-info metadata file
  cat << EOF > "$wt_path/.worktree-info"
# PR Worktree Metadata
PR_NUMBER=$pr_num
PR_URL=$pr_url
PR_TITLE=$title
BRANCH_NAME=$branch_name
REMOTE_NAME=$remote_name
REMOTE_URL=$remote_url
HEAD_OWNER=$head_owner
HEAD_REPO=$head_repo
HEAD_BRANCH=$head_branch
BASE_BRANCH=$base_branch
WORKTREE_PATH=$wt_path
IS_FORK=$is_fork
CREATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

  # Ensure .worktree-info is excluded from git in this worktree
  local git_info_exclude
  git_info_exclude="$(git -C "$wt_path" rev-parse --git-path info/exclude 2>/dev/null || true)"
  if [[ -n "$git_info_exclude" && -f "$git_info_exclude" ]]; then
    if ! grep -q '^\.worktree-info$' "$git_info_exclude" 2>/dev/null; then
      echo ".worktree-info" >> "$git_info_exclude"
    fi
  fi

  # Run dependency install: yarn install --immutable with skip-build (peer to npm ci --ignore-scripts)
  echo "==> Running 'yarn install --immutable --mode=skip-build' in worktree..."
  (
    cd "$wt_path"
    yarn install --immutable --mode=skip-build
  )

  echo ""
  echo "================================================================="
  echo "PR Worktree Ready!"
  echo "  Location: $wt_path"
  echo "  Branch:   $branch_name"
  echo "  PR #${pr_num}:  $title"
  echo "  URL:      $pr_url"
  echo ""
  echo "Next steps:"
  echo "  1. Switch to worktree:"
  echo "       cd $wt_path"
  echo "  2. Evaluate and rebase with agent skill:"
  echo "       /skill:pr-evaluation"
  echo "  3. When review/updates are complete, teardown:"
  echo "       $(basename "$0") teardown $pr_num"
  echo "================================================================="
}

# -----------------------------------------------------------------------------
# Command: teardown
# -----------------------------------------------------------------------------

cmd_teardown() {
  local pr_input=""
  local force=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -f|--force)
        force=true
        shift
        ;;
      *)
        if [[ -z "$pr_input" ]]; then
          pr_input="$1"
        fi
        shift
        ;;
    esac
  done

  local wt_path=""
  local pr_num=""
  local branch_name=""

  # If no PR argument provided, check if we are currently inside a PR worktree
  if [[ -z "$pr_input" ]]; then
    local current_top
    current_top="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    if [[ -n "$current_top" && -f "$current_top/.worktree-info" ]]; then
      wt_path="$current_top"
      pr_num="$(grep '^PR_NUMBER=' "$current_top/.worktree-info" | cut -d'=' -f2- || true)"
      branch_name="$(grep '^BRANCH_NAME=' "$current_top/.worktree-info" | cut -d'=' -f2- || true)"
    else
      echo "Error: No PR identifier specified and current directory is not a PR worktree." >&2
      echo "Usage: $(basename "$0") teardown <pr-number> [--force]" >&2
      exit 1
    fi
  else
    pr_num="$(extract_pr_number "$pr_input")"
    wt_path="${WT_ROOT}/pr-${pr_num}"
    if [[ -f "$wt_path/.worktree-info" ]]; then
      branch_name="$(grep '^BRANCH_NAME=' "$wt_path/.worktree-info" | cut -d'=' -f2- || true)"
    fi
  fi

  # Fallback to deduce branch_name from git worktree list if missing
  if [[ -z "$branch_name" ]]; then
    local branch_ref
    branch_ref="$(git worktree list --porcelain | awk -v p="$wt_path" '$1=="worktree" && $2==p {found=1} found && $1=="branch" {print $2; exit}')"
    if [[ -n "$branch_ref" ]]; then
      branch_name="${branch_ref#refs/heads/}"
    fi
  fi

  # Check uncommitted changes in worktree
  if [[ -d "$wt_path" ]]; then
    local dirty
    dirty="$(git -C "$wt_path" status --porcelain 2>/dev/null || true)"
    if [[ -n "$dirty" && "$force" != "true" ]]; then
      echo "Error: Worktree at '$wt_path' has uncommitted changes:" >&2
      echo "$dirty" >&2
      echo "" >&2
      echo "Commit, stash, or run with --force to discard changes and tear down." >&2
      exit 1
    fi
  fi

  # If current working directory is inside the worktree to be deleted, move to main repo root
  if [[ "$PWD" == "$wt_path"* ]]; then
    echo "==> Moving out of '$wt_path' to main repo root: $MAIN_REPO_ROOT"
    cd "$MAIN_REPO_ROOT"
  fi

  # Remove worktree
  if git worktree list --porcelain | grep -q "^worktree ${wt_path}$"; then
    echo "==> Removing git worktree at '$wt_path'..."
    if [[ "$force" == "true" ]]; then
      git worktree remove --force "$wt_path" 2>/dev/null || rm -rf "$wt_path"
    else
      git worktree remove "$wt_path"
    fi
    git worktree prune
  elif [[ -d "$wt_path" ]]; then
    echo "==> Removing dangling directory '$wt_path'..."
    rm -rf "$wt_path"
  else
    echo "==> Worktree directory '$wt_path' does not exist."
  fi

  # Delete local branch
  if [[ -n "$branch_name" ]] && git show-ref --verify --quiet "refs/heads/${branch_name}"; then
    echo "==> Deleting local branch '$branch_name'..."
    git branch -D "$branch_name"
  fi

  echo "==> Teardown complete for PR #${pr_num:-unknown}."
}

# -----------------------------------------------------------------------------
# Command: list
# -----------------------------------------------------------------------------

cmd_list() {
  echo "Active PR worktrees in $WT_ROOT:"
  echo "-----------------------------------------------------------------"

  local count=0
  local current_wt=""
  local current_branch=""

  while IFS= read -r line; do
    if [[ "$line" =~ ^worktree\ (.*)$ ]]; then
      current_wt="${BASH_REMATCH[1]}"
      current_branch=""
    elif [[ "$line" =~ ^branch\ refs/heads/(.*)$ ]]; then
      current_branch="${BASH_REMATCH[1]}"
      if [[ "$current_wt" == "$WT_ROOT"/pr-* ]]; then
        count=$((count + 1))
        local pr_num="?"
        local title=""
        local status="clean"

        if [[ -f "$current_wt/.worktree-info" ]]; then
          pr_num="$(grep '^PR_NUMBER=' "$current_wt/.worktree-info" | cut -d'=' -f2- || echo "?")"
          title="$(grep '^PR_TITLE=' "$current_wt/.worktree-info" | cut -d'=' -f2- || true)"
        fi

        if [[ -n "$(git -C "$current_wt" status --porcelain 2>/dev/null || true)" ]]; then
          status="dirty"
        fi

        printf "  PR #%-4s  Branch: %-25s Status: %-6s\n" "$pr_num" "$current_branch" "$status"
        if [[ -n "$title" ]]; then
          printf "            Title:  %s\n" "$title"
        fi
        printf "            Path:   %s\n\n" "$current_wt"
      fi
    fi
  done < <(git worktree list --porcelain)

  if [[ $count -eq 0 ]]; then
    echo "  (No active PR worktrees found)"
  fi
}

# -----------------------------------------------------------------------------
# Command: info
# -----------------------------------------------------------------------------

cmd_info() {
  local pr_input="${1:-}"
  local wt_path=""

  if [[ -z "$pr_input" ]]; then
    local current_top
    current_top="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    if [[ -n "$current_top" && -f "$current_top/.worktree-info" ]]; then
      wt_path="$current_top"
    else
      echo "Error: Specify a PR number or run inside a PR worktree." >&2
      exit 1
    fi
  else
    local pr_num
    pr_num="$(extract_pr_number "$pr_input")"
    wt_path="${WT_ROOT}/pr-${pr_num}"
  fi

  if [[ ! -d "$wt_path" ]]; then
    echo "Error: Worktree path '$wt_path' not found." >&2
    exit 1
  fi

  echo "Worktree Information for $wt_path:"
  echo "-----------------------------------------------------------------"
  if [[ -f "$wt_path/.worktree-info" ]]; then
    cat "$wt_path/.worktree-info"
  else
    echo "No .worktree-info metadata file found."
  fi
  echo ""
  echo "Git Status:"
  git -C "$wt_path" status -s || true
}

# -----------------------------------------------------------------------------
# Main Dispatcher
# -----------------------------------------------------------------------------

main() {
  if [[ $# -eq 0 ]]; then
    usage
    exit 0
  fi

  local action="$1"
  shift

  case "$action" in
    checkout|co|add)
      cmd_checkout "$@"
      ;;
    teardown|rm|clean|delete|down)
      cmd_teardown "$@"
      ;;
    list|ls)
      cmd_list "$@"
      ;;
    info)
      cmd_info "$@"
      ;;
    help|--help|-h)
      usage
      exit 0
      ;;
    *)
      # If argument is a number, URL, or pr-X, treat as checkout
      if [[ "$action" =~ ^[0-9]+$ || "$action" =~ ^pr-[0-9]+$ || "$action" =~ ^PR[0-9]+$ || "$action" =~ pull/[0-9]+ ]]; then
        cmd_checkout "$action" "$@"
      else
        echo "Error: Unknown command '$action'." >&2
        usage
        exit 1
      fi
      ;;
  esac
}

main "$@"
