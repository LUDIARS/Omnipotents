---
name: omnipotens
description: Run an end-to-end game project analysis from planning and specification through Ludus play-taxonomy mapping, domain modeling, Anatomia code graphs, spec-code wiring, mechanics and economy analysis, AI Format and architecture-health review, Vitia-backed UX and onboarding review, label-neutral Vitia marketability analysis, Di discussion papers, and a consolidated final HTML report. Use for comprehensive game reviews, design-code alignment audits, marketability assessments, or the reusable eleven-stage analysis pipeline.
---

# Omnipotens

Produce an evidence-linked review that connects game intent, rules, implementation, UX, and commercial promise. Keep source facts, analyst inferences, and unresolved questions visibly separate.

## Start the run

1. Read [references/artifact-contract.md](references/artifact-contract.md) and [references/vitia-ux-integration.md](references/vitia-ux-integration.md).
2. Inspect repository instructions, dirty state, active sessions, and existing reports before editing.
3. Create an isolated task branch or worktree when the shared checkout is dirty or concurrently used.
4. Create or update `<project>/spec`; never overwrite unrelated or uncommitted work.
5. Record source URL, retrieval method, retrieval time, repository commit, tool versions, and analysis status in `spec/plan/00-source-manifest.md`.
6. Treat unavailable required services as explicit blockers. Do not substitute mocks or empty reports. Finish all independent earlier stages, then ask the user whether to start, repair, wait for, or skip the unavailable service.

When retrieving a public planning page, use the user's requested access method. If they request ordinary Web access, open or fetch the public page and its browser-loaded resources rather than switching to a workspace connector.

## Run the eleven stages

### 1. Establish the specification baseline

- Read the planning document, game specification, linked subpages, and attached files.
- Create `spec/feature/product-brief.md` and `spec/feature/game-spec.md` as the initial product and specification baseline.
- Label every statement as source-backed, inferred, implemented-only, or unresolved when its status is not obvious.
- Preserve a trace from each rule and goal to its source and, later, its implementation evidence.

### 2. Analyze play with Ludus

- Use the public Ludus OKF bundle as the taxonomy source of truth.
- Store only the referenced Ludus version or commit, selected stable IDs, applicability rationale, local overrides, and findings in the game repository.
- Keep project-specific knowledge as a local overlay. Never copy the entire dictionary or write findings back to Ludus automatically.
- Generate a self-contained HTML play analysis under the project-root `report/` directory.

### 3. Model the game domains

- Derive bounded contexts, aggregates, entities, value objects, policies, commands, events, invariants, and ubiquitous language from stages 1-2.
- Distinguish player-facing concepts from technical infrastructure and presentation objects.
- Mark speculative boundaries and contradictions instead of presenting them as established facts.

### 4. Analyze code with Anatomia

- Treat the stage 3 domain model as the human-approved domain baseline. Pass its exact domain names and descriptions to Anatomia without summarizing, renaming, merging, or replacing them with inferred generic domains.
- Store Anatomia project-specific DomainDefs under `spec/data/anatomia-domains/` as manual and fully locked. Add code membership evidence separately so the specification remains the authority for meaning and Anatomia remains the authority for measured implementation membership.
- Use automatic domain discovery only to propose unmapped additions and orphan groups. Never let it silently override the specification baseline. Report built-in/generic domains separately from the specification domains.
- Run Anatomia against the pinned repository commit.
- Preserve raw results and generate dependency, module, cycle, coupling, and domain graphs.
- Record unsupported languages, excluded paths, parse errors, and coverage limits.

### 5. Wire specification, domain, and code

- Map each important rule and domain concept to files, types, functions, data assets, UI surfaces, and tests.
- Classify mappings as implemented, partial, contradictory, orphaned-code, specification-only, or unknown.
- Produce the specification gap and contradiction register with evidence and proposed decisions.

### 6. Analyze mechanics and internal economy

- Model sources, sinks, converters, stores, gates, feedback loops, progression, risk, rewards, and failure recovery.
- Summarize economy health, loop cleanliness, dominant or dead loops, inflation or starvation risks, and rule complexity.
- Separate measured values from qualitative heuristics and state each heuristic formula.

### 7. Run formal and architecture-health reviews

- Run AI Format using evidence from stages 1-6.
- Run the detailed Anatomia-domain review tool for orphan functions, code complexity, design strength, domain anemia, God Class risk, cycles, coupling, duplication, and specification gaps.
- Calculate domain health against the exact specification-domain baseline as well as Anatomia built-ins. Do not present aggregate coverage or cohesion dominated by a generic built-in domain as proof of domain strength.
- Preserve file-and-line evidence, counts, formulas, tool version, and limitations. Treat composite scores as prioritization signals, not proof.
- Make this a required gate. If the detailed review tool is still under development or unavailable, stop the dependent stages after completing independent work and ask the user how to proceed.

### 8. Produce the UX review

- Resolve one explicit, reviewed Vitia skill root and generate `spec/data/vitia-ux-source-manifest.json` before drawing UX conclusions. The manifest must hash the Vitia learning references and audit code actually used; never claim a Vitia-backed review from memory or a generic substitute.
- Apply Vitia's label-neutral evidence pass as the governing rule for this stage. Bracket the project name, genre, reputation, moral framing, and proposed Vitia domains, then run the counterfactual rename check. If the evidence-equivalent renamed version changes a finding, discard that finding and repeat the pass.
- Use the pinned Vitia `ux-onboarding.md`, `game-experience.md`, evidence, and ethics guidance. Add `monetization.md` whenever a price, purchase, subscription, ad, paid boundary, or spend pressure is material.
- Derive game-experience signals only from evidence produced in stages 1-7. Omit unknown signals rather than scoring them as zero, state confidence, preserve the label-neutral input as `spec/data/vitia-game-experience-input.json`, run Vitia's `audit_game_experience.py`, and preserve its raw JSON as `spec/data/vitia-game-experience-audit.json`.
- Trace onboarding, core loop, decisions, feedback, error recovery, accessibility, information density, and long-session fatigue. Include the action-discovery chain, first-stage/peak-stage continuity, and the four game-experience lenses: play promise, challenge and learning, player agency and fairness, and repeat value without compulsion.
- Connect every proposal to a finding from stages 1-7 and state expected impact, risk, cost band, and validation method.
- Follow the exact source, command, failure, and stage-boundary rules in [references/vitia-ux-integration.md](references/vitia-ux-integration.md). If the reviewed Vitia source or required audit code cannot be verified, mark stage 8 `blocked`; do not silently downgrade it to a generic UX review.

### 9. Analyze marketability with Vitia

- Reuse the same pinned Vitia source recorded for stage 8. Stage 8 experience evidence may inform stage 9, but stage 9 domain names and scores must never be fed back into stage 8 findings.
- Evaluate audience, problem or desire, differentiators, proof, competitive framing, trailer or store-page moments, and claim risk.
- Separate verified selling points from hypotheses and propose tests for unverified claims.

### 10. Create the Di discussion paper

- Supply Di with concise evidence summaries from stages 1-9, not raw unbounded dumps.
- Ask it to debate: `Is it fun and deep?`, `Can it sell?`, and `What changes improve it most?`.
- Preserve disagreements, assumptions, confidence, evidence links, and prioritized recommendations.
- Save the completed Markdown paper before attempting to start Di. When Di is included in the run, discover its service URL from the approved service catalog and `POST /api/flow/start-from-paper` with the Markdown as `paperMd`; record the returned `sessionId` and collect the concluded discussion into the stage artifact.
- Never hard-code a Di port or silently start a stopped service. If Di or its auto-start endpoint is unavailable, keep the paper, mark the stage `blocked`, and ask the user whether to start Di through the approved service controller or accept an omission.
- If the run explicitly excludes Di, do not call the endpoint. Mark the stage `accepted-omission` and continue final report generation without placeholder discussion results.

### 11. Generate the final report

- Run this stage after the last reachable analysis stage, including runs where an earlier stage is partial, blocked, not applicable, or accepted as omitted.
- Collect only artifacts that actually exist. Omit missing stage data; never create placeholder findings or an empty substitute report.
- Keep analysis Markdown under `spec/plan/`, product rules under `spec/feature/`, and data/setup/test contracts in their AI Format categories. Write every rendered HTML output under the project-root `report/` directory.
- When `spec/data/omnipotens-report-layout.json` exists, render its ordered section definitions exactly; otherwise render every available Markdown source as its own self-contained HTML under `<project>/report/stages/`.
- Consolidate all available stage narratives, statuses, evidence summaries, and links to specialized interactive HTML into `<project>/report/omnipotens-final.html`.
- Write `<project>/report/omnipotens-final.manifest.json` with included source paths and SHA-256 hashes.
- Fail only when no usable artifacts exist at all or an existing input artifact is malformed. A missing optional stage is not an error.

Run the deterministic packager:

```powershell
node <skill>/scripts/omnipotens-report.mjs --project <project-root> [--spec <spec-dir>] [--output <final.html>] [--layout <layout.json>] [--title <project-name>] [--include <extra.md|html|json>]
```

Repeat `--include` for review artifacts stored outside the standard `spec/` layout. Report generation packages evidence; it does not change a partial run into a completed analysis.

The packager uses only Node.js standard modules. It recursively discovers AI Format categories, renders the configured sections or each Markdown source, links specialized HTML/JSON, and writes a hash manifest. The default layout path is `spec/data/omnipotens-report-layout.json`. Mermaid blocks remain readable source in the generic renderer; use the specialized Anatomia HTML for interactive graphs.

## Package and verify

- Create the files defined by the artifact contract and always run stage 11 after the last reachable stage.
- Use deterministic renderers for Markdown and Anatomia reports when available; do not edit source review Markdown merely to improve rendering.
- Verify links, Japanese UTF-8 rendering, graphs, search and tabs, responsive layout, and print layout.
- Report completed stages, blocked stages, source and commit pins, top findings, and exact artifact paths.
- Declare completion only when all required stages pass or the user explicitly accepts recorded omissions.
