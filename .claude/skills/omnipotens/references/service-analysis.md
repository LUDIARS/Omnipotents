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

## Fourteen optional domains

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

Use `service.legal-region` for release-gate routing even when territory, storefront/platform, or release form is not yet known. Record each missing routing input as missing evidence and a blocker for the conclusions that depend on it; do not silently narrow scope to the known markets. Keep mandatory law, contractual policy, self-regulatory rating, standards, and best practices in separate layers. Completion requires a routing matrix that maps every in-scope territory, storefront/platform, and release form to applicable law, store policy, rating authority, accessibility, localization, and an explicitly owned unresolved decision. Route detailed rating work to `service.regional-ratings`. This analysis is issue spotting and evidence organization, not legal advice.

### Regional age ratings

Use `service.regional-ratings` for an external release, DLC, UGC, live-content change, or rating renewal. Keep PEGI, USK, GRAC, IARC, ESRB, CERO, and other authority decisions separate: do not translate their age bands into one numeric score. Build a territory/storefront/product-form matrix; disclose content, interaction, UGC, monetization, engagement, localization, and highest-risk build evidence; and distinguish internal prediction from the authority's certificate. Missing UGC scope, an incomplete highest-risk build, an adult/restricted route mismatch, cash-out or strong speculative mechanics, or an unfiled material change is a blocker rather than a low score.

### Console certification readiness

Use `service.console-certification` only for PlayStation, Nintendo, Xbox, or another platform with authorized certification requirements. Public onboarding pages establish the process boundary, not the current requirement set or a pass. In the authorized environment, pin platform, generation, territory, feature, product/submission type, requirement version, candidate build, test evidence, listing/assets, exceptions, external decisions, and resubmission scope. Keep NDA text, requirement/test IDs, SDK details, portal captures, build/submission IDs, waivers, and contacts in a private annex that is never copied into the reusable cache or sent to an external AI.

### SBOM quality and operations

Use `service.sbom` when shipped or operated artifacts include first-party, open-source, commercial, engine/SDK, binary, container, or service dependencies. Evaluate minimum data elements, direct/transitive scope, known unknowns, schema/profile validation, build provenance, artifact binding, freshness, distribution, correction, VEX, and downstream vulnerability/license use separately. An SBOM's existence, schema pass, or low CVE count is not proof of completeness or security. Record the selected format and consumer-supported version rather than forcing the newest schema universally.

### External vendor and supply-chain risk

Use `service.vendor-risk` for material outsourcing, middleware, cloud, payment, moderation, analytics, AI, build, or distribution dependencies. Separate supplier maturity, inherent impact, likelihood, residual risk, and evidence confidence. Cover identity and ownership, provenance, resilience, foundational cyber practices, sub-tier concentration, product lifecycle, contract flow-down, incident collaboration, continued monitoring, and exit. Do not average away an unknown critical vendor, unsupported component, missing incident notice, unverified provenance, or sole-source dependency with no exit plan.

### Child safety and age assurance

Use `service.child-safety` when children are targeted or are likely to access an online game or service with data collection, chat/contact, UGC, recommendation, advertising, monetization, or another harm path. Route by territory, age band, service role, and feature. Evaluate privacy and consent, protective defaults, content/contact/recommender risk, age-assurance error and privacy costs, moderation/reporting/appeal, parental tools, monetization/nudges, risk assessments, records, and significant-change review. An adult-facing label, self-declared age, or age rating alone does not establish that child-safety duties are out of scope or satisfied.

### Generative-AI governance

Use `service.generative-ai-governance` when generative AI affects player-facing content, NPC/chat, UGC or moderation, support, marketing, or production output that ships. Inventory provider/deployer roles, use cases, model/vendor/version, intended and prohibited uses, affected people, training/fine-tuning/RAG/input/output rights, personal and confidential data, evaluations, human controls, disclosure/provenance, monitoring, incident, rollback, and change triggers. Route legal duties by territory, actor, use case, decision date, and affected population. A framework checklist, base-model benchmark, model card, or vendor assurance does not replace product-specific evaluation.

## Keep public cache and private overlays separate

The bundled catalog may contain public source metadata and versioned public facts. Store project-specific telemetry, revenue, user acquisition, incidents, fraud labels, support messages, contracts, legal advice, console requirements/results, SBOM/component inventory, vendor findings, child-safety records, AI prompts/evaluations, and model/data contracts only in a project-private overlay. Do not commit or send that overlay unless the user explicitly authorizes its destination and the outbound gate passes. Platform NDA material must remain inside its authorized environment even when a generic summary would otherwise be useful.

Record the catalog version, SHA-256, selected analysis IDs, cache receipt, stale source metadata and reference facts, omitted recommended dependencies, and every local overlay path in `spec/plan/00-source-manifest.md`.
