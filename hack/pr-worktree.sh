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
PR_NUMBER_PATTERN='^([pP][rR]-?)?0*([1-9][0-9]*)$'
PR_URL_PATTERN='^(https?://[a-zA-Z0-9.-]+/[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+)/pull/0*([1-9][0-9]*)/?([?#].*)?$'

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
  if [[ "$1" =~ $PR_NUMBER_PATTERN || "$1" =~ $PR_URL_PATTERN ]]; then
    printf '%s\n' "${BASH_REMATCH[2]}"
  else
    echo "Error: Expected a PR number or GitHub PR URL, got '$1'." >&2
    return 1
  fi
}

# Normalize HTTPS, SSH, and SCP-style URLs to host/owner/repo for comparisons.
repo_identity() {
  local url="${1%/}"
  local pattern='^((https?|ssh|git)://)?([^/@]+@)?([a-zA-Z0-9.-]+)[:/]([a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+)$'
  if [[ "$url" =~ $pattern ]]; then
    printf '%s/%s\n' "${BASH_REMATCH[4]}" "${BASH_REMATCH[5]%.git}"
  else
    return 1
  fi
}

remote_repo() {
  local url
  url="$(git remote get-url "$1" 2>/dev/null)" && repo_identity "$url"
}

# Set the caller's base_remote and pr_json only after resolving a unique PR.
resolve_pr() {
  local pr_input="$1" pr_num="$2" prefer_upstream="$3"
  local target_repo="" remote repo previous_repo="" result
  if [[ "$pr_input" =~ $PR_URL_PATTERN ]]; then
    target_repo="$(repo_identity "${BASH_REMATCH[1]}")"
  fi

  for remote in origin upstream; do
    if ! repo="$(remote_repo "$remote")"; then
      if [[ -z "$target_repo" ]] && git config --get "remote.$remote.url" >/dev/null; then
        echo "Error: Cannot identify the GitHub repository for '$remote'. Use a full PR URL." >&2
        return 1
      fi
      continue
    fi
    if [[ -n "$target_repo" && "${repo,,}" != "${target_repo,,}" ]]; then
      continue
    fi
    if [[ "${repo,,}" == "${previous_repo,,}" ]]; then
      continue
    fi
    previous_repo="$repo"

    if result="$(gh api --hostname "${repo%%/*}" "repos/${repo#*/}/pulls/$pr_num" 2>&1)"; then
      if [[ -n "$base_remote" ]]; then
        if [[ "$prefer_upstream" != true ]]; then
          local choice
          echo "PR #$pr_num exists on both remotes:" >&2
          jq -r '"  origin:   " + .html_url' <<< "$pr_json" >&2
          jq -r '"  upstream: " + .html_url' <<< "$result" >&2
          while true; do
            printf 'Use origin or upstream? [upstream] ' >&2
            if ! IFS= read -r choice; then
              printf '\nError: No selection received. Use --upstream or a full PR URL.\n' >&2
              return 1
            fi
            case "$choice" in
              origin) return 0 ;;
              upstream|"") break ;;
              *) echo "Enter 'origin' or 'upstream'." >&2 ;;
            esac
          done
        fi
      fi
      base_remote="$remote"
      pr_json="$result"
    elif [[ "$result" != *"(HTTP 404)" ]]; then
      printf "Error: Could not look up PR #%s on '%s' (%s):\n%s\n" "$pr_num" "$remote" "$repo" "$result" >&2
      return 1
    fi
  done

  if [[ -z "$base_remote" ]]; then
    if [[ -z "$previous_repo" ]]; then
      echo "Error: No origin or upstream remote matches the requested GitHub repository." >&2
    else
      echo "Error: PR #$pr_num was not found on the selected origin/upstream repositories." >&2
    fi
    return 1
  fi
}

check_worktree_pr_url() {
  local input="$1" wt_path="$2" expected actual
  if [[ "$input" =~ $PR_URL_PATTERN ]]; then
    expected="${BASH_REMATCH[1]}/pull/${BASH_REMATCH[2]}"
    if [[ ! -f "$wt_path/.worktree-info" ]]; then
      echo "Error: No PR metadata at '$wt_path' to verify '$expected'." >&2
      return 1
    fi
    actual="$(awk '/^PR_URL=/ {print substr($0, 8); exit}' "$wt_path/.worktree-info")"
    actual="${actual#*://}"
    expected="${expected#*://}"
    if [[ "${actual,,}" != "${expected,,}" ]]; then
      echo "Error: '$wt_path' belongs to '${actual:-unknown PR}', not '$expected'." >&2
      return 1
    fi
  fi
}

usage() {
  cat << EOF
Usage: $(basename "$0") <command> [options]

Commands:
  checkout <pr> [--upstream]
                    Check out a PR into a dedicated worktree in \$WT_ROOT/pr-<number>,
                    add fork remote if applicable, and run yarn install --immutable.
                    If both remotes match, prompt (default: upstream).
                    Use --upstream to skip the prompt, or a full PR URL to select a repository.
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
  local pr_input="" prefer_upstream=false arg
  for arg in "$@"; do
    case "$arg" in
      --upstream) prefer_upstream=true ;;
      -*)
        echo "Error: Unknown checkout option '$arg'." >&2
        return 1
        ;;
      *)
        if [[ -n "$pr_input" ]]; then
          echo "Error: Expected one PR number or URL." >&2
          return 1
        fi
        pr_input="$arg"
        ;;
    esac
  done
  if [[ -z "$pr_input" ]]; then
    echo "Error: Missing PR number or URL." >&2
    usage
    exit 1
  fi

  check_prerequisites
  local pr_num base_remote="" pr_json=""
  pr_num="$(extract_pr_number "$pr_input")"

  echo "==> Resolving PR #${pr_num} via gh..."
  resolve_pr "$pr_input" "$pr_num" "$prefer_upstream"

  local title is_fork head_owner head_repo head_branch base_branch pr_url
  title="$(jq -r '.title' <<< "$pr_json")"
  head_owner="$(jq -r '.head.repo.owner.login // empty' <<< "$pr_json")"
  head_repo="$(jq -r '.head.repo.full_name // empty' <<< "$pr_json")"
  head_branch="$(jq -r '.head.ref' <<< "$pr_json")"
  base_branch="$(jq -r '.base.ref' <<< "$pr_json")"
  pr_url="$(jq -r '.html_url' <<< "$pr_json")"
  if [[ -z "$head_repo" ]]; then
    echo "Error: The head repository for $pr_url is unavailable." >&2
    return 1
  fi
  is_fork="$(jq -r '.head.repo.id != .base.repo.id' <<< "$pr_json")"

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

  # The PR's base and head may live on different remotes.
  local remote_name remote_url
  local head_url head_identity remote repo push_urls push_url
  local base_url
  base_url="$(git remote get-url "$base_remote")"
  if [[ "$base_url" == ssh://* || "$base_url" == *@*:* && "$base_url" != *://* ]]; then
    head_url="$(jq -r '.head.repo.ssh_url' <<< "$pr_json")"
  else
    head_url="$(jq -r '.head.repo.clone_url' <<< "$pr_json")"
  fi
  head_identity="$(repo_identity "$head_url")"
  remote_name=""
  for remote in "$base_remote" $(git remote); do
    repo="$(remote_repo "$remote")" && [[ "${repo,,}" == "${head_identity,,}" ]] || continue
    push_urls="$(git remote get-url --push --all "$remote")" || continue
    while IFS= read -r push_url; do
      repo="$(repo_identity "$push_url")" && [[ "${repo,,}" == "${head_identity,,}" ]] || continue 2
    done <<< "$push_urls"
    remote_name="$remote"
    break
  done
  if [[ -z "$remote_name" ]]; then
    remote_name="$head_owner"
    if git remote get-url "$remote_name" &>/dev/null; then
      remote_name="pr-${head_owner}-${head_repo##*/}"
    fi
    echo "==> Adding head remote '$remote_name' for '$head_repo'..."
    git remote add "$remote_name" "$head_url"
  fi
  push_urls="$(git remote get-url --push --all "$remote_name")"
  while IFS= read -r push_url; do
    if ! repo="$(repo_identity "$push_url")" || [[ "${repo,,}" != "${head_identity,,}" ]]; then
      echo "Error: Remote '$remote_name' pushes outside '$head_identity'." >&2
      return 1
    fi
  done <<< "$push_urls"
  remote_url="$(git remote get-url "$remote_name")"

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

  local fetch_ref="refs/pr-worktree/fetch/$$"
  (
    trap 'git update-ref -d "$fetch_ref"' EXIT
    git fetch --no-write-fetch-head "$remote_name" "+refs/heads/$head_branch:$fetch_ref"
    if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
      git branch -f "$branch_name" "$fetch_ref"
    else
      git branch "$branch_name" "$fetch_ref"
    fi
  )

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
BASE_REMOTE=$base_remote
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
