# Stable report format

`spec/data/omnipotens-summary.json` is the authoring contract for the final summary. The report generator rejects a missing or malformed file rather than silently producing an inconsistent summary.

## Required content

- `schemaVersion`: `3`
- `project`: displayed project title
- `executiveAudience`: fixes the intended reader at academic deviation value `50`, describes general readers and high-school students, and lists the plain-language writing policy
- `overallAssessment`: the first displayed conclusion, with label, score, summary, strengths, priority issues, confidence, sources, missing information, and missing implementation
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

Each executive-summary direction and additional analysis has one `summary`. Write it for a reader with no specialist background and a high-school student, assuming an academic deviation value of 50. Lead with the conclusion, keep sentences short, and explain necessary English or technical terms in ordinary Japanese. Do not add `beginner` or `highResolution` variants.

The deterministic packager publishes `report/omnipotens-summary.json`. It renders the overall assessment and item summaries once, then inserts `各レイヤでの解析データは以下` before play-structure, UX, AI Format, Vitia, Ludus, evidence, and stage data. Only the integrated executive summary is beginner-friendly; the following material is technical raw analysis data.

Do not include a separate `00. エグゼクティブサマリ` section in `omnipotens-report-layout.json`. The packager ignores that exact legacy section during migration so the summary is never duplicated.

Start from [omnipotens-summary.example.json](omnipotens-summary.example.json) and replace every example statement and reference with project evidence.
