### Worktree PR Review Process Usage Cheat Sheet

`checkout pr30` looks for PR #30 in the GitHub repositories configured as
`origin` and `upstream`. If only one matches, checkout continues without asking.
If both match, choose a remote at the prompt; Enter selects `upstream`.
Use `--upstream` to skip the prompt on a conflict, or pass the full PR URL to
select its repository directly. Only one worktree per PR number can be active
at a time.

`pr-worktree.sh info` shows `BASE_REMOTE` (where the PR targets) and
`REMOTE_NAME` (where the head branch lives and where `pr-push.sh` pushes).

```bash
# Check out PR 6 into ~/projects/wt_konveyor-backstage/pr-6
hack/pr-worktree.sh checkout pr6

# Prefer upstream on a conflict without prompting
hack/pr-worktree.sh checkout pr30 --upstream

# Select the repository directly by URL
hack/pr-worktree.sh checkout https://github.com/migtools/mta-rhdh-plugin/pull/30

# List active PR worktrees
hack/pr-worktree.sh list

# Inspect PR metadata
hack/pr-worktree.sh info 6

# Evaluate inside the worktree
cd ~/projects/wt_konveyor-backstage/pr-6
# In agent: run /skill:pr-evaluation

# Push changes back to the PR remote branch (from inside the worktree)
hack/pr-push.sh
# Or test with a dry run:
hack/pr-push.sh --dry-run

# Tear down when done (from inside worktree or from main repo)
hack/pr-worktree.sh teardown 6

```
