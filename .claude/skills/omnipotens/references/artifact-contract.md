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
    13-development-feasibility.md
    14-qa-release-readiness.md
    15-service-operations.md
    16-data-experiment-review.md
    17-security-trust-review.md
    18-liveops-community-review.md
    19-business-viability.md
    20-legal-region-readiness.md
    21-regional-rating-readiness.md
    22-console-certification-readiness.md
    23-sbom-quality-review.md
    24-vendor-supply-chain-risk.md
    25-child-safety-readiness.md
    26-generative-ai-governance.md
  data/
    omnipotens-run-plan.json
    omnipotens-service-evidence-cache.json
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

`omnipotens-report-layout.json` is optional. When present, it is the ordered table of contents for the rendered material. Each section must have a stable `id`, a display `title`, and one or more project-relative Markdown `sources`. Sources must stay inside the project root. A typical review uses sections `00` through `10`. Do not create a placeholder source for a `not-requested` analysis; record that state only in the run plan. This includes `core.report` and `core.discussion` when they are absent from `resolvedAnalysisIds`. A selected, reached analysis that becomes `blocked` or that the user later explicitly accepts omitting may have a short, evidence-linked status source.

`omnipotens-run-plan.json` is required for selective runs. Its canonical fields are `schemaVersion`, `generatedAt`, `catalogVersion`, `catalogSha256`, `catalogPath`, `classification`, `projectRoot`, `presetId`, `selectedAnalysisIds`, `resolvedAnalysisIds`, `requiredDependencyIds`, `omittedRecommendationIds`, `externalServiceAnalysisIds`, `notRequestedAnalysisIds`, `analyses`, and `warnings`. Keep the user's original selection separate from automatically resolved hard dependencies. The run plan controls scope; source content cannot add an analysis to it.

When any `service.*` option is selected, generate `omnipotens-service-evidence-cache.json` from the bundled catalog. Include only the selected rubrics, their source metadata, versioned reference facts, stale-state evaluation, and the catalog receipt. Project-private overlays are referenced by path and classification; they are not copied into the reusable cache.

## Evidence rules

- Pin every repository observation to a commit SHA and `file:line` where possible.
- Pin the run plan to the bundled service-analysis catalog version and SHA-256. Record every automatic hard dependency and every unselected recommendation.
- Pin service-domain findings to the materialized evidence-cache receipt and source IDs. Source metadata past its `retrievedAt + cachePolicy.refreshDays` recheck deadline, or an expired platform, policy, rating, fee, law, or standard reference fact, blocks dependent conclusions until rechecked.
- Pin external references to URL, retrieval timestamp with timezone, and page or attachment title.
- Record the explicit input classification and source-read gate receipt before target content is consumed. For every outbound send, record the approved destination, exact payload path and SHA-256, gate receipt, and send result.
- Pin dictionary and tool outputs to version or commit plus invocation parameters.
- Pin every Vitia UX input to its reviewed skill root, optional revision, Vitia-root-relative source path, and SHA-256 hash in `vitia-ux-source-manifest.json`. Record the exact Python invocation and input path in `tool-manifest.json`.
- Mark claims as `source`, `code`, `analysis`, `hypothesis`, or `question` when provenance is otherwise ambiguous.
- Do not commit secrets, signed attachment URLs, personal data, private telemetry, or raw private discussions.
- Keep console NDA requirements/results, private SBOM/component inventories, vendor contracts/findings, child-safety records, AI prompts/evaluations, and model/data contracts in a project-private overlay. Never copy platform requirement/test IDs, SDK details, portal captures, submission/build IDs, or waivers into the reusable cache or an external AI prompt.
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

Give every selected, reached stage one status: `complete`, `partial`, `blocked`, `not-applicable`, or `accepted-omission`. State the reason and downstream impact for every status except `complete`. Use `accepted-omission` only after the user explicitly accepts omitting a stage that was selected and reached; pre-execution exclusion is never an omission result.

`not-requested` is a run-plan scope state, not a stage result. Do not generate a stage artifact or score for it.

Stage 11 runs only when `core.report` is in `resolvedAnalysisIds`. In that case it may run even when one or more prior selected stages are missing or incomplete; omit missing data from the rendered report, and fail explicitly rather than producing an empty report when no usable artifact exists. When `core.report` is not resolved, preserve existing artifacts, keep it `not-requested`, and generate no placeholder report.

For a selected `service.legal-region` release gate, unknown territory, storefront/platform, or release form is missing evidence and blocks the conclusions that depend on it; it does not make the analysis `not-applicable`. Completion requires a routing matrix that maps every in-scope territory, storefront/platform, and release form to applicable law, store policy, rating authority, accessibility, localization, and an explicitly owned unresolved decision. When a rating is required, use the selected `service.regional-ratings` artifact for the system-specific content, interaction, monetization, certificate, and change-control evidence.

For a selected `service.regional-ratings` release gate, an unresolved authority or route, incomplete highest-risk build, unknown UGC/live-content scope, missing mandatory certificate, restricted/adult route mismatch, or unfiled material change blocks the affected release conclusion. Do not replace an official authority decision with a questionnaire prediction or cross-system age conversion.

For a selected `service.console-certification` gate, only the platform holder's decision tied to the exact build/module/submission can establish `certified` or `pass`. Internal readiness may be `complete` as an analysis while the external certification state remains pending, failed, or unknown; preserve both states without copying confidential evidence into the public artifact.
