# PR #5 Closed When Its Stacked Base Was Deleted

- Date: 2026-07-18
- Status: fixed in working tree
- Area: GitHub pull request and worktree lifecycle
- Severity: planner implementation was committed and pushed but omitted from `main`

## Summary

PR #5 (`feat: add selectable service analysis planner`) was closed without being merged after its stacked base branch was deleted. The planner source remained on `feat/service-analysis-planner`, but users inspecting `main` could not find `omnipotens-analysis-planner`.

## Evidence

- PR #5 head: `b1fc34c264be4d2f0821f855bf7600425187e22f`.
- PR #5 base: `docs/claude-code-readme`.
- GitHub `BaseRefDeletedEvent`: 2026-07-18T05:08:36Z, actor `nyangame`.
- GitHub `ClosedEvent`: 2026-07-18T05:08:37Z, actor `nyangame`.
- PR #5 reports `state=CLOSED`, `mergedAt=null`, and `mergeCommit=null`.
- The existing `.wt-Omnipotents-pr5-merge` worktree retained an unfinished merge of `8ebaa00bd24fa79f758d0af0f8f4c8e26325c24a`, with conflicts in the skill, workflow, README, and repository verifier.

## Regression Context

The stacked-PR cleanup rule requires downstream PRs to be retargeted before deleting their base branch. PR #1 was squash-merged with base-branch deletion while PR #5 still targeted that branch.

## Cause

The merge flow deleted `docs/claude-code-readme` without first detecting and retargeting PR #5. GitHub then closed PR #5 because its base ref no longer existed.

## Fix Requirements

- Reapply the two planner commits onto the current `origin/main`.
- Preserve both PR #4 hardening requirements and PR #5 planner/service-analysis requirements when resolving overlaps.
- Retarget and reopen PR #5 against `main`.
- Require green CI before squash-merging PR #5.
- Remove the obsolete conflicted and recovery worktrees after the merge.
- Check for downstream PRs before using base-branch deletion in future merge flows.

## Verification

- Node report, input-gate, Vitia, and service-analysis suites passed on 2026-07-18.
- PowerShell repository fixtures passed 9/9; company-input fixtures passed 4/4; the real recovery worktree prerequisite check passed.
- The planner console harness passed 8/8 and published the self-contained `win-x64` executable.
- Pending operational verification: confirm PR #5 is merged, `main` contains `tools/Omnipotens.AnalysisPlanner`, and no task worktree remains.

## Follow-up

Use the stacked-PR preflight (`base:<head-branch>`) before every merge that deletes a branch.
