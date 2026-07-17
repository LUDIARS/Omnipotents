# Artifact contract

Use this AI Format-compatible layout unless the target repository has a stricter documented convention:

```text
spec/
  feature/
    product-brief.md
    game-spec.md
  plan/
    00-source-manifest.md
    03-ludus-analysis.md
    04-domain-model.md
    05-anatomia-analysis.md
    06-spec-domain-code-map.md
    07-spec-gaps.md
    08-mechanics-economy.md
    09-aiformat-architecture-review.md
    10-ux-review.md
    11-vitia-marketability.md
    12-di-discussion-paper.md
  data/
    game-data-contracts.md
    anatomia-architecture-review.json
    vitia-ux-source-manifest.json
    vitia-game-experience-input.json
    vitia-game-experience-audit.json
    anatomia-domains/
      project.domain.json
    omnipotens-report-layout.json
    tool-manifest.json
  interface/
    runtime-boundaries.md
  setup/
    reproducible-build.md
  test/
    review-test-plan.md
report/
  omnipotens-final.html
  omnipotens-final.manifest.json
  ludus-analysis.html
  architecture-review.html
  stages/
    00-executive-summary.html
    ...
```

`omnipotens-report-layout.json` is optional. When present, it is the ordered table of contents for the rendered material. Each section must have a stable `id`, a display `title`, and one or more project-relative Markdown `sources`. Sources must stay inside the project root. A typical review uses sections `00` through `10`; an omitted service result is represented by a short, evidence-linked status source rather than fabricated findings.

## Evidence rules

- Pin every repository observation to a commit SHA and `file:line` where possible.
- Pin external references to URL, retrieval timestamp with timezone, and page or attachment title.
- Record the explicit input classification and source-read gate receipt before target content is consumed. For every outbound send, record the approved destination, exact payload path and SHA-256, gate receipt, and send result.
- Pin dictionary and tool outputs to version or commit plus invocation parameters.
- Pin every Vitia UX input to its reviewed skill root, optional revision, Vitia-root-relative source path, and SHA-256 hash in `vitia-ux-source-manifest.json`. Record the exact Python invocation and input path in `tool-manifest.json`.
- Mark claims as `source`, `code`, `analysis`, `hypothesis`, or `question` when provenance is otherwise ambiguous.
- Do not commit secrets, signed attachment URLs, personal data, private telemetry, or raw private discussions.
- Keep generated HTML self-contained; keep raw outputs separate from the human-readable interpretation.
- Preserve specification domain names and descriptions byte-for-byte in the Anatomia baseline input. Keep code membership, inferred additions, and tool-built generic domains in separate fields so they cannot redefine the specification.
- Keep the pre-Di discussion paper as a durable Markdown artifact. When Di runs, record its auto-start session ID and import only the resulting discussion summary; never replace the source paper with generated debate output.
- Generate one stage HTML for each configured section that has usable source data. Do not fabricate findings for missing data.
- The final report must include only available artifacts and link specialized interactive HTML without rewriting it.
- Record every included source path and SHA-256 hash in `omnipotens-final.manifest.json`.

## Stage 8 Vitia-backed UX contract

Stage 8 is not complete until its review uses a verified Vitia source manifest. Generate it with the explicit Vitia skill root; do not auto-discover an arbitrary checkout:

```powershell
node <omnipotens-skill>/scripts/vitia-source-manifest.mjs `
  --vitia <reviewed-vitia-skill-root> `
  --output <project>/spec/data/vitia-ux-source-manifest.json `
  [--revision <commit-or-package-version>] `
  [--include-monetization]
```

When there is enough observed game evidence, create a label-neutral input and run the pinned Vitia audit:

```powershell
python <reviewed-vitia-skill-root>/scripts/audit_game_experience.py `
  <project>/spec/data/vitia-game-experience-input.json
```

Store stdout as `spec/data/vitia-game-experience-audit.json`. Omit unobserved signals; never convert unknowns to zero. The raw audit is a coverage heuristic, not a measurement of fun, player psychology, sales, or revenue.

`spec/plan/10-ux-review.md` must contain:

1. stage status and Vitia source-manifest link;
2. bracketed labels and the counterfactual rename result;
3. verified observations, inferences, confidence, and material unknowns;
4. action-discovery and onboarding/transfer findings;
5. first-stage to peak-stage continuity;
6. play-promise, challenge-learning, agency-fairness, and non-compulsive repeat-value findings;
7. paid-boundary and revenue-quality findings when monetization is material;
8. accessibility, information-density, fatigue, and recovery findings;
9. evidence-linked proposals with impact, risk, cost band, validation method, and harm guardrail.

Do not use stage 9 Vitia domain names or domain scores as evidence for stage 8. Stage 8 may supply observed experience evidence to stage 9, never the reverse. If the Vitia source, neutrality contract, or required audit code cannot be verified, mark stage 8 `blocked` and state the downstream impact. A non-Vitia UX draft may be retained as independent work but cannot satisfy this contract.

## Status rules

Give every stage one status: `complete`, `partial`, `blocked`, `not-applicable`, or `accepted-omission`. State the reason and downstream impact for every status except `complete`.

Stage 11 runs even when one or more prior stages are missing or incomplete. Missing data is omitted from the rendered report. If no usable artifact exists, fail explicitly instead of producing an empty report.
