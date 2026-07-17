# Selective service analysis

Use this reference when the run includes any `service.*` option or when analysis scope must be reduced. The source of truth for selectable options, presets, rubrics, source rights, and versioned facts is [service-analysis-catalog.json](service-analysis-catalog.json).

## Select scope before reading deeply

1. Create or load `spec/data/omnipotens-run-plan.json`. Preserve the canonical selected, resolved, required-dependency, omitted-recommendation, external-service, and not-requested ID lists instead of collapsing them into one selection.
2. Record one explicit `public` or `internal` classification.
3. Select only analyses that answer the user's decision. Treat every unselected option as `not-requested`, not as failed or zero-scored.
4. Add only hard dependencies from `requiredAnalysisIds`. Missing `recommendedAnalysisIds` lower evidence coverage but do not silently expand the run.
5. Confirm every option marked `usesExternalService` separately. A local preset never authorizes an outbound send.
6. Materialize the evidence cache for the selected `service.*` analyses before making service-level findings.

Selection examples follow the same scope contract. Run `core.report` only when it appears in `resolvedAnalysisIds`; otherwise preserve the selected-stage artifacts and leave the report `not-requested` without a placeholder. A `core.discussion` excluded before execution is also `not-requested`. Reserve `accepted-omission` for a selected, reached stage that the user later explicitly agrees to omit.

The Windows planner under `tools/Omnipotens.AnalysisPlanner` provides the same catalog as a checkbox GUI. It defaults the run-plan destination to `<project>/spec/data/omnipotens-run-plan.json` and can copy a ready-to-paste prompt; it does not start services, execute analysis tools, or send project data.

## Materialize the pinned evidence cache

Run the standard-library-only cache tool from the trusted skill directory:

```powershell
node <skill>/scripts/omnipotens-service-cache.mjs `
  --project <project-root> `
  --classification <public|internal> `
  --analysis <service.analysis-id> `
  --output <project-root>/spec/data/omnipotens-service-evidence-cache.json `
  --require-current
```

Repeat `--analysis` for every selected service domain. The output contains only pinned source metadata, independently authored rubrics, and small versioned reference facts. It does not download or reproduce source documents. A source marked `metadata-only` or `redistribution: prohibited` may still be cited by URL, but its text must not be copied into the shared cache.

`--require-current` rejects stale source metadata as well as expired reference facts. Compute each source-metadata recheck deadline from the catalog `retrievedAt` plus that source's `cachePolicy.refreshDays`; compute fact expiry from its recorded expiry. Without `--require-current`, preserve both stale states and block any dependent conclusion until the official source is rechecked. Platform fees, store policies, rating rules, and laws must be refreshed at the release gate even when the bundled cache has not yet expired.

## Evaluate without universal thresholds

For every rubric dimension, record these fields separately:

- applicability: `applicable`, `not-applicable`, or `unknown`;
- evidence strength: `observed`, `measured`, `documented`, `inferred`, or `missing`;
- risk: consequence, likelihood, affected population, and reversibility;
- metric: numerator, denominator, time window, segment, uncertainty, and data quality;
- decision: owner, due date, validation method, and rollback or harm guardrail.

Do not average `not-applicable` into a score. Do not convert unknown values to zero. Do not invent generic gates such as “LTV/CAC must exceed 3,” “30% is the platform fee,” or “99.9% is the correct SLO.” Thresholds must come from a current contract, legal requirement, product objective, error budget, or a project-specific baseline.

## Eight optional domains

### Development feasibility

Use `service.feasibility` only when there is a budget, schedule, staffing, outsourcing, or technology decision. Evaluate scope coverage, estimate basis, uncertainty, critical path, capacity, supplier acceptance, and mitigation evidence. Calibrate public methods with the project's own estimate-versus-actual history; government and aerospace data are not game benchmarks.

### QA and release readiness

Use `service.qa-release` after target platforms or release candidates exist. Separate device coverage, regression prioritization, performance, store submission, known defects, and release exceptions. Android compatibility or a pre-review checklist is not proof that the game will pass store review or work on every device.

### Service operations

Use `service.operations` only for online backends, shared services, meaningful concurrency, or explicit SLOs. Trace user-visible SLI/SLOs, error budgets, observability, incident response, dependency saturation, backup restore, RTO, and RPO. Tool installation without operational evidence is not completion.

### Data and experiments

Use `service.data-experiments` when decisions depend on telemetry, KPI, cohorts, or experiments. Trace goal to signal to metric, validate event quality, and distinguish randomized incrementality from attribution or correlation. Always include guardrails for trust, fairness, refunds, complaints, economy health, and long-term reversals.

### Security, fraud, and privacy

Use `service.security` when the project has networking, valuable virtual goods, payments, personal data, competitive play, or user-generated content. Cover trust boundaries, server authority, cheat and bot error costs, transaction verification, privacy lifecycle, detection, appeal, incident response, and recovery. Compliance and invasive anti-cheat are not automatically high-quality controls.

### LiveOps, community, and support

Use `service.liveops` when post-release events, updates, communities, support, moderation, or sunset obligations exist. Require exposure denominators and observation windows. Treat event participation as self-selected unless a valid control exists, and never use a generic toxicity dataset as automatic-ban ground truth.

### Business viability

Use `service.business` for paid acquisition, monetization, store distribution, or revenue forecasts. Compute net cohort LTV after fees, taxes, refunds, payment costs, and variable operations. Compute incremental CAC using incremental activated or paying users, not attributed installs. Preserve base, bear, and bull scenarios with confidence and payback.

### Legal and regional readiness

Use `service.legal-region` for release-gate routing even when territory, storefront/platform, or release form is not yet known. Record each missing routing input as missing evidence and a blocker for the conclusions that depend on it; do not silently narrow scope to the known markets. Keep mandatory law, contractual policy, self-regulatory rating, standards, and best practices in separate layers. Completion requires a routing matrix that maps every in-scope territory, storefront/platform, and release form to its applicable rating, policy, accessibility, localization, and legal sources or an explicitly owned unresolved decision. This analysis is issue spotting and evidence organization, not legal advice.

## Keep public cache and private overlays separate

The bundled catalog may contain public source metadata and versioned public facts. Store project-specific telemetry, revenue, user acquisition, incidents, fraud labels, support messages, contracts, and legal advice only in a project-private overlay. Do not commit or send that overlay unless the user explicitly authorizes its destination and the outbound gate passes.

Record the catalog version, SHA-256, selected analysis IDs, cache receipt, stale source metadata and reference facts, omitted recommended dependencies, and every local overlay path in `spec/plan/00-source-manifest.md`.
