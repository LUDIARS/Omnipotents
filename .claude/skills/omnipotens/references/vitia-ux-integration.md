# Vitia-backed UX integration

## Purpose

Stage 8 uses Vitia's reviewed learning data to evaluate observable UX and game-experience integrity. Vitia remains the source of truth: Omnipotents records and hashes the files it used instead of copying their contents or maintaining a second scoring model.

Label neutrality is the governing rule. A title, franchise, genre, reputation, moral description, source framing, or proposed seven-domain label must not alter an evidence-equivalent UX finding, risk boundary, or recommendation.

## Pin one reviewed source

Resolve one explicit Vitia skill root. Do not search several folders and silently select the first match. Generate the source manifest before reading conclusions into the UX review:

```powershell
node <omnipotens-skill>/scripts/vitia-source-manifest.mjs `
  --vitia <reviewed-vitia-skill-root> `
  --output <project>/spec/data/vitia-ux-source-manifest.json `
  [--revision <commit-or-package-version>] `
  [--include-monetization]
```

The core profile verifies and hashes:

- `SKILL.md`;
- `references/ethics.md` and `references/evidence.md`;
- `references/ux-onboarding.md` and `references/game-experience.md`;
- `scripts/audit_game_experience.py` and its `score_vitia.py` dependency.

Use `--include-monetization` whenever price, purchase, subscription, advertising, paid currency, paid recovery, randomized rewards, or another paid boundary is material. This also verifies and hashes `references/monetization.md`.

Record the manifest command, Vitia revision when known, Python version, audit command, and input/output paths in `spec/data/tool-manifest.json`. File hashes are required even when a commit is available because an installed skill may not retain Git metadata.

## Evidence-first procedure

1. Bracket the project name, genre, reputation, moral adjectives, source framing, and every proposed Vitia domain.
2. From stages 1-7, write the user goal, available action, rule or constraint, signifier, observed attempt, feedback, outcome, recovery, and evidence confidence in plain language.
3. Run the counterfactual rename check. Replace every bracketed label with neutral identifiers while keeping mechanics and outcomes unchanged. Discard and repeat any finding that changes.
4. Read the pinned `ux-onboarding.md`, `game-experience.md`, `ethics.md`, and relevant portions of `evidence.md`. Read `monetization.md` only when the paid profile applies.
5. Trace the six-link action-discovery chain and tutorial transfer. Compare the first meaningful stage with the peak-value stage.
6. Map only observed evidence to the game-audit signals. Omit unknown signals, state confidence, and preserve risk flags separately from labels.
7. Run the pinned `audit_game_experience.py` and save its unedited JSON output. Interpret all four lenses even when one is `not_observed` or `exploratory`.
8. Synthesize UX findings and proposals. Each proposal must trace to stages 1-7 evidence and name expected impact, risk, cost band, validation method, and at least one accessibility, trust, agency, or harm guardrail.

## Audit boundaries

The four game-experience lenses are:

- play-promise integrity;
- challenge, learning, failure, and recovery;
- player agency and social fairness;
- repeat value without compulsion.

Their scores summarize observed evidence coverage under Vitia's transparent heuristic. They do not measure fun, diagnose a player, establish causality, predict sales, or alter the seven Vitia domain scores.

Stage 8 may pass observed experience findings forward to stage 9. Stage 9 domain labels, marketing scores, and preferred message angles must never be used to revise stage 8 evidence or UX scores. This one-way boundary prevents a desired positioning from becoming proof that the experience delivers it.

For paid boundaries, audit the complete trigger-to-exit sequence and value exchange. Do not optimize near misses, loss chasing, social spend pressure, confusing cumulative cost, manufactured frustration, or compulsive schedules. A revenue lift that breaches a trust, regret, refund, complaint, accessibility, agency, or harmful-spend guardrail is a failed treatment.

## Failure and status rules

- Missing or unreadable required Vitia files: stage 8 is `blocked`.
- Missing label-neutrality markers or incompatible audit code: stage 8 is `blocked`.
- Audit executable unavailable when sufficient game evidence exists: stage 8 is `blocked`.
- Material evidence absent: preserve `not_observed`/`exploratory` results and mark the review `partial`; never fill missing signals with zero or inference presented as observation.
- Monetization is not material: omit the paid profile and mark that subsection `not-applicable`.

Independent UX notes may be retained when blocked, but they cannot be labeled Vitia-backed or satisfy stage 8. Stage 11 still packages the available evidence and the explicit status.
