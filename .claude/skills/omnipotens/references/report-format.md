# Stable report format

`spec/data/omnipotens-summary.json` is the authoring contract for the final summary. The report generator rejects a missing or malformed file rather than silently producing an inconsistent summary.

## Required content

- `schemaVersion`: `2`
- `project`: displayed project title
- `executiveSummary`: exactly `play-logic`, `code`, `ux`, and `market`
- `additionalAnalyses`: one item for every additional analysis requested by the user; otherwise `[]`
- `aiFormatScores`: one or more score rows
- `vitiaScores`: one or more score rows; the generator sorts by `score / maxScore`
- `uxEvaluation`: exactly `core-implementation-alignment` and `expression-conviction-performance`, plus the simulated public-response audience model, assumptions, and limitations
- `playStructureScores`: exactly `idea`, `structure`, and `scalability`
- `ludus.novelty`: novelty score and rationale
- `ludus.recommendedImplementations`: one or more play-dictionary proposals with an explicit `uxConnection`

Every narrative, score row, novelty item, and implementation proposal has both `missingInformation` and `missingImplementation`. Use `[]` only when no gap is known in the evidence scope. Every score row also records `rationale` and `sourceRefs`. Set `marketAdvantage: true` only when evidence supports an actual market advantage; the renderer bolds those Vitia rows.

Every score row and `ludus.novelty` also has `averageImprovement`: `decision` is `improve` only when the score and evidence show a material issue, otherwise `hold`; `proposal` is one proportionate change or an explicit current-design hold; and `rationale` explains why the score, uncertainty, and change risk justify that decision. There is no universal score threshold that forces improvement. Review honestly and never score missing evidence as zero.

The UX public response is an AI average-reaction simulation, not measured user, review, sales, or telemetry data. Record the simulated audience, assumptions, and limitations beside the scores.

For each executive-summary direction, `beginner` explains the conclusion for a student or first-time reader, while `highResolution` preserves precise evidence, mechanism, confidence, and decision consequence. Use Japanese prose as the default and explain necessary English terms in Japanese on first appearance.

The deterministic packager publishes `report/omnipotens-summary.json` and renders both reading levels, play-structure, UX, AI Format, and Vitia score tables, score-aware improvement decisions, Ludus novelty, UX-linked implementation proposals, and the two gap lists.

Start from [omnipotens-summary.example.json](omnipotens-summary.example.json) and replace every example statement and reference with project evidence.
