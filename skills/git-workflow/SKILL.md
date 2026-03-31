---
name: git-workflow
description: "Smart git operations with worktree isolation and PR workflow"
triggers:
  - "/git"
  - "git workflow"
  - "create branch"
  - "commit"
bins:
  - git
  - gh
---

# Git Workflow Skill

Intelligent git operations with safety rails.

## Features

- **Worktree Isolation**: Work on multiple features safely
- **Smart Commits**: Conventional commit format
- **PR Workflow**: Create, review, merge PRs
- **Branch Management**: Auto-naming, cleanup stale

## Commands

```bash
# Branch operations
/git branch <feature-name>    # Create worktree branch
/git switch <branch>          # Switch branches
/git cleanup                  # Remove merged branches

# Commit workflow
/git commit "message"         # Stage & commit
/git amend                    # Amend last commit
/git squash                   # Squash commits

# PR workflow
/git pr create               # Create PR from branch
/git pr review               # Review open PRs
/git pr merge               # Merge approved PR
```

## Commit Format

```
<type>(<scope>): <subject>

<optional body>

<optional footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
