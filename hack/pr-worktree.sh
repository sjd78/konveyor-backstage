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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_REPO_ROOT="$(get_main_repo_root)"
REPO_NAME="$(basename "$MAIN_REPO_ROOT")"

# Base worktree root defaults to ~/projects/wt_<repo_name> and can be overridden via WT_ROOT
WT_ROOT="${WT_ROOT:-$HOME/projects/wt_${REPO_NAME}}"
PR_NUMBER_PATTERN='^([pP][rR]-?)?0*([1-9][0-9]*)$'
PR_URL_PATTERN='^(https?://[^/]+/([^/]+/[^/]+))/pull/0*([1-9][0-9]*)([/?#].*)?$'

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
  if [[ "$1" =~ $PR_NUMBER_PATTERN ]]; then
    printf '%s\n' "${BASH_REMATCH[2]}"
  elif [[ "$1" =~ $PR_URL_PATTERN ]]; then
    printf '%s\n' "${BASH_REMATCH[3]}"
  else
    echo "Error: Expected a PR number or GitHub PR URL, got '$1'." >&2
    return 1
  fi
}

remote_slug() {
  local url
  url="$(git remote get-url "$1" 2>/dev/null)" || return 1
  url="${url%.git}"
  url="${url%/}"
  if [[ "$url" =~ [:/]([^/:]+/[^/]+)$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  else
    return 1
  fi
}

find_remote_for_repo() {
  local target="$1" remote slug
  for remote in upstream origin $(git remote); do
    slug="$(remote_slug "$remote" || true)"
    if [[ -n "$slug" && "${slug,,}" == "${target,,}" ]]; then
      printf '%s\n' "$remote"
      return 0
    fi
  done
  return 1
}

# Resolve PR metadata with priority: explicit URL > upstream > origin.
# Populates caller's base_remote, base_repo, and pr_json.
resolve_pr() {
  local pr_input="$1" pr_num="$2"
  local fields="number,title,headRepository,headRepositoryOwner,headRefName,baseRefName,isCrossRepository,url"

  if [[ "$pr_input" =~ $PR_URL_PATTERN ]]; then
    local canonical_url="${BASH_REMATCH[1]}/pull/${BASH_REMATCH[3]}"
    base_repo="${BASH_REMATCH[2]}"
    if ! pr_json="$(gh pr view "$canonical_url" --json "$fields")"; then
      return 1
    fi
    base_remote="$(find_remote_for_repo "$base_repo" || true)"
    if [[ -z "$base_remote" ]]; then
      echo "Error: No configured remote matches target repository '$base_repo'." >&2
      return 1
    fi
    return 0
  fi

  local remote repo result
  for remote in upstream origin; do
    repo="$(remote_slug "$remote" || true)"
    [[ -n "$repo" ]] || continue
    if result="$(gh pr view -R "$repo" "$pr_num" --json "$fields" 2>&1)"; then
      base_remote="$remote"
      base_repo="$repo"
      pr_json="$result"
      return 0
    elif [[ "$result" != *"Could not resolve to a PullRequest"* ]]; then
      echo "Error: Failed to look up PR #${pr_num} on '${remote}' (${repo}):" >&2
      echo "$result" >&2
      return 1
    fi
  done

  echo "Error: PR #${pr_num} was not found on upstream or origin." >&2
  return 1
}

check_worktree_pr_url() {
  local input="$1" wt_path="$2" expected actual
  if [[ "$input" =~ $PR_URL_PATTERN ]]; then
    expected="${BASH_REMATCH[1]}/pull/${BASH_REMATCH[3]}"
    if [[ ! -f "$wt_path/.worktree-info" ]]; then
      echo "Error: No PR metadata at '$wt_path' to verify '$expected'." >&2
      return 1
    fi
    actual="$(grep '^PR_URL=' "$wt_path/.worktree-info" | head -n1 | cut -d'=' -f2- || true)"
    local actual_norm="${actual#*://}" expected_norm="${expected#*://}"
    if [[ "${actual_norm,,}" != "${expected_norm,,}" ]]; then
      echo "Error: '$wt_path' belongs to '${actual:-unknown PR}', not '$expected'." >&2
      return 1
    fi
  fi
}

usage() {
  cat << EOF
Usage: $(basename "$0") <command> [options]

Commands:
  checkout <pr>     Check out a PR into a dedicated worktree in \$WT_ROOT/pr-<number>
                    via 'gh pr checkout' (checking upstream first, then origin, or
                    pass a full PR URL), and run yarn install --immutable.
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
  $(basename "$0") checkout https://github.com/sjd78/mta-rhdh-plugin/pull/6
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
  if [[ -z "$pr_input" || "$pr_input" == -* ]]; then
    echo "Error: Missing PR number or URL." >&2
    usage
    exit 1
  fi
  if [[ $# -gt 1 ]]; then
    echo "Error: Expected one PR number or URL." >&2
    return 1
  fi

  check_prerequisites
  local pr_num base_remote="" base_repo="" pr_json=""
  pr_num="$(extract_pr_number "$pr_input")"

  echo "==> Resolving PR #${pr_num} via gh..."
  resolve_pr "$pr_input" "$pr_num"

  local title is_fork head_owner head_repo head_branch base_branch pr_url
  title="$(jq -r '.title' <<< "$pr_json")"
  is_fork="$(jq -r '.isCrossRepository' <<< "$pr_json")"
  head_owner="$(jq -r '.headRepositoryOwner.login // empty' <<< "$pr_json")"
  head_repo="$(jq -r '.headRepository.nameWithOwner // empty' <<< "$pr_json")"
  head_branch="$(jq -r '.headRefName' <<< "$pr_json")"
  base_branch="$(jq -r '.baseRefName' <<< "$pr_json")"
  pr_url="$(jq -r '.url' <<< "$pr_json")"

  if [[ -z "$head_repo" ]]; then
    echo "Error: The head repository for $pr_url is unavailable." >&2
    return 1
  fi

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

  # Branch naming: pr/<owner>/<pr_num> for forks, pr/<pr_num> for same-repo branches
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

  if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
    echo "Warning: Local branch '$branch_name' already exists. Delete it or run '$(basename "$0") teardown $pr_num' first." >&2
    exit 1
  fi

  # Create detached worktree and let `gh pr checkout` handle remotes, fetch, and branch tracking
  mkdir -p "$(dirname "$wt_path")"
  echo "==> Creating git worktree at '$wt_path'..."
  git worktree add --detach "$wt_path"

  echo "==> Checking out PR #${pr_num} via gh..."
  if ! (cd "$wt_path" && gh pr checkout "$pr_url" -b "$branch_name" -f); then
    git worktree remove --force "$wt_path" 2>/dev/null || rm -rf "$wt_path"
    return 1
  fi

  local remote_name remote_url
  remote_name="$(git -C "$wt_path" config --get "branch.${branch_name}.pushRemote" 2>/dev/null \
    || git -C "$wt_path" config --get "branch.${branch_name}.remote" 2>/dev/null \
    || echo "$base_remote")"
  remote_url="$(git -C "$wt_path" remote get-url --push "$remote_name" 2>/dev/null || echo "$remote_name")"

  # Write .worktree-info metadata file
  cat << EOF > "$wt_path/.worktree-info"
# PR Worktree Metadata
PR_NUMBER=$pr_num
PR_URL=$pr_url
PR_TITLE=$title
BASE_REPO=$base_repo
BASE_REMOTE=$base_remote
BASE_BRANCH=$base_branch
HEAD_OWNER=$head_owner
HEAD_REPO=$head_repo
HEAD_BRANCH=$head_branch
REMOTE_NAME=$remote_name
REMOTE_URL=$remote_url
BRANCH_NAME=$branch_name
WORKTREE_PATH=$wt_path
IS_FORK=$is_fork
CREATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

  # Ensure .worktree-info is excluded from git in this worktree
  local git_info_exclude
  git_info_exclude="$(git -C "$wt_path" rev-parse --path-format=absolute --git-path info/exclude 2>/dev/null || true)"
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
  if [[ -x "$SCRIPT_DIR/pr-push.sh" ]]; then
    echo ""
    (cd "$wt_path" && "$SCRIPT_DIR/pr-push.sh" --show)
  fi
  echo ""
  echo "Next steps:"
  echo "  1. Switch to worktree:"
  echo "       cd $wt_path"
  echo "  2. Evaluate and rebase with agent skill:"
  echo "       /skill:pr-evaluation"
  echo "  3. Push updates to the PR branch:"
  echo "       hack/pr-push.sh"
  echo "  4. When review/updates are complete, teardown:"
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
    check_worktree_pr_url "$pr_input" "$wt_path"
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
    check_worktree_pr_url "$pr_input" "$wt_path"
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
      if [[ "$action" =~ $PR_NUMBER_PATTERN || "$action" =~ $PR_URL_PATTERN ]]; then
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
