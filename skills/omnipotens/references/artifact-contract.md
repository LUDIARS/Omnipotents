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
- Pin dictionary and tool outputs to version or commit plus invocation parameters.
- Mark claims as `source`, `code`, `analysis`, `hypothesis`, or `question` when provenance is otherwise ambiguous.
- Do not commit secrets, signed attachment URLs, personal data, private telemetry, or raw private discussions.
- Keep generated HTML self-contained; keep raw outputs separate from the human-readable interpretation.
- Preserve specification domain names and descriptions byte-for-byte in the Anatomia baseline input. Keep code membership, inferred additions, and tool-built generic domains in separate fields so they cannot redefine the specification.
- Keep the pre-Di discussion paper as a durable Markdown artifact. When Di runs, record its auto-start session ID and import only the resulting discussion summary; never replace the source paper with generated debate output.
- Generate one stage HTML for each configured section that has usable source data. Do not fabricate findings for missing data.
- The final report must include only available artifacts and link specialized interactive HTML without rewriting it.
- Record every included source path and SHA-256 hash in `omnipotens-final.manifest.json`.

## Status rules

Give every stage one status: `complete`, `partial`, `blocked`, `not-applicable`, or `accepted-omission`. State the reason and downstream impact for every status except `complete`.

Stage 11 runs even when one or more prior stages are missing or incomplete. Missing data is omitted from the rendered report. If no usable artifact exists, fail explicitly instead of producing an empty report.
