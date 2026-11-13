### Worktree PR Review Process Usage Cheat Sheet

```bash
# Check out PR 6 into ~/projects/wt_konveyor-backstage/pr-6
hack/pr-worktree.sh checkout 6

# List active PR worktrees
hack/pr-worktree.sh list

# Inspect PR metadata
hack/pr-worktree.sh info 6

# Evaluate inside the worktree
cd ~/projects/wt_konveyor-backstage/pr-6
# In agent: run /skill:pr-evaluation

# Tear down when done (from inside worktree or from main repo)
hack/pr-worktree.sh teardown 6

```
