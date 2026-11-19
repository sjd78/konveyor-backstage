### Worktree PR Review Process Usage Cheat Sheet

`checkout <pr>` looks up the PR in `upstream` first and falls back to `origin`
(or pass a full PR URL to target a specific repository directly). Only one
worktree per PR number can be active at a time.

`.worktree-info` records the PR identity (`PR_NUMBER`, `PR_URL`, `PR_TITLE`),
target (`BASE_REPO`, `BASE_REMOTE`, `BASE_BRANCH`), and source
(`HEAD_REPO`, `HEAD_BRANCH`, `REMOTE_NAME`, `REMOTE_URL`). `gh pr checkout`
handles remote/branch setup, and `pr-push.sh --show` prints where updates
will push when the worktree is created.

```bash
# Check out PR 30 (checks upstream first, then origin)
hack/pr-worktree.sh checkout pr30

# Select a specific repository directly by URL
hack/pr-worktree.sh checkout https://github.com/sjd78/mta-rhdh-plugin/pull/30

# List active PR worktrees
hack/pr-worktree.sh list

# Inspect PR metadata
hack/pr-worktree.sh info 30

# Evaluate inside the worktree
cd ~/projects/wt_mta-rhdh-plugin/pr-30
# In agent: run /skill:pr-evaluation

# Push changes back to the PR remote branch (from inside the worktree)
hack/pr-push.sh
# Or test with a dry run:
hack/pr-push.sh --dry-run

# Tear down when done (from inside worktree or from main repo)
hack/pr-worktree.sh teardown 30

```
