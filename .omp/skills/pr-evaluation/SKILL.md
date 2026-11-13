---
name: pr-evaluation
description: 'Rebase the current PR branch onto origin/main (or upstream/main if available), resolve any conflicts, verify the build, and summarize changes against the PR description and commit history for human review.'
---

# PR Evaluation and Rebase Skill

## Keywords

pr evaluation, review pr, evaluate pr, rebase pr, summarize pr, pr review, rebase to main, resolve conflicts, pull request review, pr changes, pr worktree, pr summary

## Overview

Automates the evaluation, rebase, conflict resolution, and change summarization workflow for a checked-out GitHub Pull Request in a git worktree or local branch.

**Use this skill when:** A PR branch has been checked out (for example via `hack/pr-worktree.sh checkout <pr>`) and needs to be rebased onto `origin/main` (or `upstream/main`), verified, and summarized against the PR description for human review.

---

## Workflow

Follow this 6-step process to evaluate and update the PR:

### Step 1: Detect PR Context and Metadata

1. Check for `.worktree-info` in the current working directory or git worktree root.

   - If present, parse:
     - `PR_NUMBER`: GitHub PR number
     - `PR_URL`: Link to PR
     - `BASE_BRANCH`: Target base branch (usually `main`)
     - `BRANCH_NAME`: Local tracking branch
     - `REMOTE_NAME`: Remote name for the PR head
     - `HEAD_BRANCH`: PR head branch name
   - If `.worktree-info` is not present, determine current branch via `git branch --show-current` and query `gh`:
     ```bash
     gh pr view --json number,title,baseRefName,headRefName,url
     ```

2. Retrieve the complete PR specification via GitHub CLI:
   ```bash
   gh pr view <PR_NUMBER> --json number,title,body,baseRefName,headRefName,headRepositoryOwner,url,author,commits
   ```
   Extract the PR description (`body`), title, author, and target base branch.

---

### Step 2: Determine Base Remote and Fetch Target

1. Inspect available remotes:

   ```bash
   git remote -v
   ```

2. Determine base remote and branch:

   - If `upstream` remote exists: base target is `upstream/<BASE_BRANCH>` (e.g. `upstream/main`).
   - Otherwise: base target is `origin/<BASE_BRANCH>` (e.g. `origin/main`).

3. Fetch the latest commits for the target base:
   ```bash
   git fetch <BASE_REMOTE> <BASE_BRANCH>
   ```

---

### Step 3: Check Divergence and Rebase onto Base

1. Inspect commit divergence:

   ```bash
   # Commits on PR ahead of base
   git log --oneline <BASE_REMOTE>/<BASE_BRANCH>..HEAD

   # Commits on base ahead of PR
   git log --oneline HEAD..<BASE_REMOTE>/<BASE_BRANCH>
   ```

2. Execute the rebase:

   ```bash
   git rebase <BASE_REMOTE>/<BASE_BRANCH>
   ```

3. Evaluation:
   - **If rebase succeeds cleanly with no conflicts:** Proceed to **Step 5: Post-Rebase Verification**.
   - **If rebase stops with conflicts:** Proceed to **Step 4: Conflict Resolution**.

---

### Step 4: Conflict Resolution

When `git rebase` pauses due to merge conflicts:

1. List all unmerged/conflicting files:

   ```bash
   git diff --name-only --diff-filter=U
   ```

2. For each conflicting file:

   - Read the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
   - Analyze both sides:
     - `HEAD` (base branch): incoming changes from `origin/main` or `upstream/main`.
     - Incoming commit: changes introduced by the PR.
   - Adhere strictly to project conventions documented in `AGENTS.md`:
     - **Backstage Blueprint patterns:** Use standard blueprints (`EntityContentBlueprint`, `HomePageWidgetBlueprint`, `PageBlueprint`, etc.).
     - **Frontend UI:** Use `@backstage/ui` (BUI) components, tokens, and CSS modules next to components. Avoid Material-UI v4 for new/updated code.
     - **Copy:** Maintain sentence case for user-visible copy and use the term "Hub".
     - **Clean removals:** Remove obsolete imports and declarations.
   - Edit each file to resolve conflicts, removing all conflict markers.
   - Stage the resolved file:
     ```bash
     git add <file>
     ```

3. Continue the rebase:

   ```bash
   git rebase --continue
   ```

4. Repeat for any subsequent commits until the rebase completes.
5. If a conflict involves ambiguous architectural changes or contradictory upstream removals, pause, explain the exact tradeoff, and ask the human reviewer.

---

### Step 5: Post-Rebase Verification

After the rebase completes cleanly:

1. Verify monorepo integrity (typecheck, lint, formatting, knip reports):

   ```bash
   yarn check
   ```

2. Run tests for affected plugins:

   ```bash
   yarn backstage-cli repo test plugins/<plugin-name>
   ```

3. If dependencies or exports changed, regenerate knip reports as required by `AGENTS.md`:

   ```bash
   yarn build:knip-reports
   ```

4. If verification uncovered any breakage directly caused by rebase incompatibilities, apply surgical fixes and amend or create a clean commit.

---

### Step 6: Summarize Changes and Deliver Evaluation Report

1. Analyze full diff and commit history against base:

   ```bash
   git log --oneline <BASE_REMOTE>/<BASE_BRANCH>..HEAD
   git diff --stat <BASE_REMOTE>/<BASE_BRANCH>...HEAD
   ```

2. Compare actual implementation against the PR description:

   - Does the implementation match what was described?
   - Are there unintended side effects or undeclared changes?
   - Does it adhere to monorepo rules in `AGENTS.md`?

3. Deliver the final evaluation report using this format:

````markdown
# PR Evaluation Report: PR #<NUMBER> - <TITLE>

**PR URL:** <URL>
**Author:** @<AUTHOR>
**Branch:** `<BRANCH_NAME>`
**Rebased onto:** `<BASE_REMOTE>/<BASE_BRANCH>` (`<BASE_COMMIT_HASH>`)

---

### 1. Rebase & Conflict Summary

- **Status:** [Clean rebase / Resolved merge conflicts]
- **Conflicts Resolved:** [None / List of files and brief resolution notes]

---

### 2. PR Intent vs. Actual Changes

- **Stated Intent (from PR description):**
  > <Quote or concise summary of author's PR description>
- **Commit History (<N> commits):**
  - `<hash>` <subject>
- **Key Changes:**
  - `<file-or-component>`: <summary of modification>

---

### 3. Architecture & Code Quality

- **Backstage Conventions:** [Compliant with BUI / Blueprint / CSS modules]
- **Verification:** [`yarn check` passed / unit tests passed]
- **Observations & Risks:**
  - <Any behavioral changes, edge cases, or follow-up items>

---

### 4. Human Decision & Next Steps

- **To approve/merge:** Proceed through GitHub Web UI or `gh pr merge <NUMBER>`.
- **To request changes:** Suggested review comment:
  > <Draft comment ready for PR review>
- **To push rebased branch:**
  ```bash
  git push --force-with-lease <REMOTE_NAME> <BRANCH_NAME>
  ```
````

- **To tear down worktree when finished:**
  ```bash
  hack/pr-worktree.sh teardown <NUMBER>
  ```

```
EOF
```
