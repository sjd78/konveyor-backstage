#!/usr/bin/env bash
#
# hack/pr-push.sh
# Force-push current worktree HEAD to target PR remote and branch using .worktree-info.
#

set -euo pipefail

usage() {
  cat << EOF
Usage: $(basename "$0") [options] [-- additional-git-push-options]

Force-pushes the current worktree HEAD to the PR tracking remote and branch
specified in .worktree-info (\$wt_remote HEAD:\$wt_remote_branch).

Must be run from within a PR worktree folder containing a .worktree-info file.

Options:
  -n, --dry-run   Perform a dry-run push without updating remote references
  -h, --help      Show this help message
EOF
}

# Parse options
extra_args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    -n|--dry-run)
      extra_args+=("--dry-run")
      shift
      ;;
    --)
      shift
      extra_args+=("$@")
      break
      ;;
    *)
      extra_args+=("$1")
      shift
      ;;
  esac
done

# Locate worktree root
wt_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
info_file="${wt_root}/.worktree-info"

if [[ -z "$wt_root" || ! -f "$info_file" ]]; then
  echo "Error: This script must be run from a worktree folder with a .worktree-info file." >&2
  exit 1
fi

get_meta() {
  local key="$1"
  grep "^${key}=" "$info_file" | head -n1 | cut -d'=' -f2- || true
}

wt_remote="$(get_meta "REMOTE_NAME")"
wt_remote_branch="$(get_meta "HEAD_BRANCH")"
wt_remote_url="$(get_meta "REMOTE_URL")"
wt_head_repo="$(get_meta "HEAD_REPO")"
pr_number="$(get_meta "PR_NUMBER")"
pr_title="$(get_meta "PR_TITLE")"

if [[ -z "$wt_remote" ]]; then
  echo "Error: REMOTE_NAME is missing or empty in $info_file" >&2
  exit 1
fi

if [[ -z "$wt_remote_branch" ]]; then
  echo "Error: HEAD_BRANCH is missing or empty in $info_file" >&2
  exit 1
fi

pr_url="$(get_meta PR_URL)"
host="${pr_url#*://}"
expected="${host%%/*}/$wt_head_repo"
push_urls="$(git -C "$wt_root" remote get-url --push --all "$wt_remote")"
url_pattern='^((https?|ssh|git)://)?([^/@]+@)?([a-zA-Z0-9.-]+)[:/]([a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+)$'
while IFS= read -r push_url; do
  if [[ -z "$wt_head_repo" || "$pr_url" != https://* || ! "${push_url%/}" =~ $url_pattern ]]; then
    echo "Error: Cannot verify push destination for '$wt_remote'." >&2
    exit 1
  fi
  destination="${BASH_REMATCH[4]}/${BASH_REMATCH[5]%.git}"
  if [[ "${destination,,}" != "${expected,,}" ]]; then
    echo "Error: Remote '$wt_remote' pushes to '$destination', not '$expected'." >&2
    exit 1
  fi
done <<< "$push_urls"

target_repo="${wt_head_repo:-${wt_remote_url:-$wt_remote}}"

echo "Target repository: ${target_repo} (remote: ${wt_remote})"
echo "Target branch:     ${wt_remote_branch}"
if [[ -n "$pr_number" ]]; then
  echo "PR:                #${pr_number}${pr_title:+ (${pr_title})}"
fi
echo "Local commit:      $(git -C "$wt_root" rev-parse --short HEAD) - $(git -C "$wt_root" log -1 --pretty=format:'%s')"
echo ""

if [[ ${#extra_args[@]} -gt 0 ]]; then
  git -C "$wt_root" push -f "${extra_args[@]}" "$wt_remote" "HEAD:$wt_remote_branch"
else
  git -C "$wt_root" push -f "$wt_remote" "HEAD:$wt_remote_branch"
fi
