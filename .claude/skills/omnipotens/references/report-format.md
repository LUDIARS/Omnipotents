# Stable report format

`spec/data/omnipotens-summary.json` is the authoring contract for the final summary. The report generator rejects a missing or malformed file rather than silently producing an inconsistent summary.

## Required content

- `schemaVersion`: `1`
- `project`: displayed project title
- `executiveSummary`: exactly `play-logic`, `code`, `ux`, and `market`
- `additionalAnalyses`: one item for every additional analysis requested by the user; otherwise `[]`
- `aiFormatScores`: one or more score rows
- `vitiaScores`: one or more score rows; the generator sorts by `score / maxScore`
- `ludus.novelty`: novelty score and rationale
- `ludus.recommendedImplementations`: one or more play-dictionary proposals with an explicit `uxConnection`

Every narrative, score row, novelty item, and implementation proposal has both `missingInformation` and `missingImplementation`. Use `[]` only when no gap is known in the evidence scope. Every score row also records `rationale` and `sourceRefs`. Set `marketAdvantage: true` only when evidence supports an actual market advantage; the renderer bolds those Vitia rows.

For each executive-summary direction, `beginner` explains the conclusion for a student or first-time reader, while `highResolution` preserves precise evidence, mechanism, confidence, and decision consequence. Use Japanese prose as the default and explain necessary English terms in Japanese on first appearance.

The deterministic packager publishes `report/omnipotens-summary.json` and renders both reading levels, both score tables, Ludus novelty, UX-linked implementation proposals, and the two gap lists.

Start from [omnipotens-summary.example.json](omnipotens-summary.example.json) and replace every example statement and reference with project evidence.
