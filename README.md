# Omnipotents

Omnipotentsは、ゲームプロジェクトの企画意図・ルール・実装・プレイ体験・市場性から、サービス提供に必要な領域までを、根拠と不確実性を明示しながら一つのレポートへ接続する「全方位分析スキル」です。

ここでいう「全方位」は、毎回すべてを分析するという意味ではありません。GUIまたはJSON run planで、今回の判断に必要なcore段階とservice領域だけを選びます。未選択項目は`not-requested`として残し、取得できない根拠を推測やzero scoreで補いません。最終reportも選択項目であり、未選択なら既存artifactを保持したままplaceholder reportは作りません。Diを実行前から除外した場合も`accepted-omission`ではなく`not-requested`です。

## 分析する領域

| 領域 | 主な分析内容 |
| --- | --- |
| 仕様とプレイ構造 | 企画資料・ゲーム仕様の基準化、Ludusによるプレイ分類、ルールと目標の追跡 |
| ドメインと実装 | ドメインモデル、Anatomiaによるコード構造、仕様・ドメイン・コード・テストの対応関係 |
| メカニクスとゲーム内経済 | コアループ、資源の生成と消費、進行、報酬、リスク、失敗からの回復 |
| 形式・アーキテクチャ健全性 | AI Format、複雑度、凝集度、結合、循環、重複、God Classやドメイン貧血の兆候 |
| UXとオンボーディング | 行動発見、学習、フィードバック、エラー回復、公平性、アクセシビリティ、長時間プレイの負荷 |
| 収益化と市場性 | 対象プレイヤー、欲求、差別化、訴求根拠、競合上の位置づけ、価格・課金境界、主張のリスク |
| 統合判断とレポート | Diによる論点整理と、各分析の状態・根拠・優先提案を結ぶ最終HTMLレポート |

Diによる議論とレポート生成は、分析結果を統合・出力する工程です。独立した分析領域として「全方位」の数を増やすための項目ではありません。

## 分析の原則

- 事実、分析者の推論、実装からのみ確認できた事項、未解決事項を区別します。
- 参照元、取得方法、取得時刻、対象コミット、ツール版、分析状態を記録します。
- 仕様からドメイン、コード、UX、提案まで根拠を追跡できる形にします。
- 複合スコアは優先順位づけの手掛かりとして扱い、品質の証明とは見なしません。
- 必須の資料やサービスが利用できない場合は、その段階を明示的に停止または省略し、空の結果や代用品で成功扱いにしません。
- hard dependencyだけを自動追加し、recommended analysisは証拠不足の警告として示します。
- 学術資料、標準、platform policy、法令は、版、取得日、利用条件、適用範囲、既知の限界を固定します。

UXと市場性の分析では、レビュー済みのVitiaスキルを明示的に指定します。使用した学習資料と監査コードを `spec/data/vitia-ux-source-manifest.json` にSHA-256で固定し、プロジェクト名や評判などの先入観を除いたラベル中立な証拠評価を行います。Vitiaを検証できない場合、Vitia準拠の分析を一般知識へ黙って置き換えません。

## 11段階のパイプライン

1. 企画・仕様の基準化
2. Ludusによるプレイ分析
3. ゲームドメインのモデル化
4. Anatomiaによるコード分析
5. 仕様・ドメイン・コードの対応づけ
6. メカニクスとゲーム内経済の分析
7. 形式・アーキテクチャ健全性レビュー
8. VitiaによるUX・オンボーディング分析
9. Vitiaによる市場性分析
10. Diディスカッションペーパーの作成
11. 最終HTMLレポートの生成

各段階の入力、出力、停止条件は [SKILL.md](.claude/skills/omnipotens/SKILL.md) と [artifact-contract.md](.claude/skills/omnipotens/references/artifact-contract.md) を参照してください。

## 選択式のservice分析

次の8領域は、必要な証拠がある場合だけ選択します。

| ID | 領域 | 主な評価内容 |
| --- | --- | --- |
| `service.feasibility` | 開発実現性 | 予算、工数、人員、外注、technology risk、不確実性 |
| `service.qa-release` | QA・release | device matrix、regression、性能、store review、release gate |
| `service.operations` | service運用 | SLI/SLO、監視、incident、capacity、deploy、DR |
| `service.data-experiments` | data活用 | KPI、telemetry品質、cohort、実験設計、A/B test、guardrail |
| `service.security` | security・privacy | trust boundary、cheat、fraud、payment、privacy、response |
| `service.liveops` | LiveOps | event、community、CS、moderation、end-of-service |
| `service.business` | 事業性 | net LTV、incremental CAC、payback、platform fee、scenario |
| `service.legal-region` | 法務・地域対応 | rating、accessibility、localization、territory/storefront routing |

評価rubricと一次資料metadataは [service-analysis-catalog.json](.claude/skills/omnipotens/references/service-analysis-catalog.json) に固定しています。公開情報だけから「LTV/CACは3以上」「platform feeは30%」などの普遍的な合格値は作りません。自社の売上、UA、incident、fraud、support dataは共有catalogではなくproject-private overlayで較正します。

## GUIで分析範囲を選ぶ

Windows用plannerをbuildすると、core 11段階とservice 8領域をcheckbox、preset、工数、必要証拠、dependency warning付きで選択できます。単一exeに選択catalogを同梱するため、分析対象projectへOmnipotents一式をコピーする必要はありません。

```powershell
./scripts/Publish-OmnipotensPlanner.ps1
./release/omnipotens-analysis-planner/Omnipotens.AnalysisPlanner.exe
```

plannerで分析対象project本体を指定すると、保存先は`<project>/spec/data/omnipotens-run-plan.json`になります。実行依頼用promptはclipboardへコピーできます。planner自身は分析toolやserviceを起動せず、外部送信もしません。Diはpresetから除外され、明示選択が必要です。

service分析を選択したら、使用するrubric、source metadata、versioned factをprojectへmaterializeします。

```powershell
node ./.claude/skills/omnipotens/scripts/omnipotens-service-cache.mjs `
  --project <project-root> `
  --classification <public|internal> `
  --analysis service.operations `
  --output <project-root>/spec/data/omnipotens-service-evidence-cache.json `
  --require-current
```

source本文は同梱しません。再配布が明示的に許諾されていない資料はURLと独自rubricだけを保存し、期限切れのfee・policy・rating dataは公式sourceを再確認するまで判断に使いません。

## Claude Codeで使う

サブモジュールを含めてクローンし、このリポジトリをプロジェクトとしてClaude Codeで開きます。スキルは `.claude/skills/omnipotens` にあるため、追加の導入操作は不要です。

```powershell
git clone --recurse-submodules https://github.com/LUDIARS/Omnipotents.git
Set-Location Omnipotents
claude
```

起動後、たとえば次のように依頼します。

```text
OmnipotensでXXXを解析して
```

既存のクローンでは、サブモジュールを初期化してから開始してください。

```powershell
./scripts/Initialize-OmnipotensDependencies.ps1
```

## 主な出力

- `spec/feature/`: プロダクト概要とゲーム仕様
- `spec/plan/`: 分析結果、根拠、ギャップ、提案
- `spec/data/`: ツール入力、監査結果、マニフェスト
- `report/stages/`: 段階別HTMLレポート
- `report/omnipotens-final.html`: 利用可能な分析結果を統合した最終レポート

## リポジトリの内容

- `.claude/skills/omnipotens/`: 分析パイプラインとレポート生成スクリプト
- `tools/Omnipotens.AnalysisPlanner/`: 分析範囲を選択してrun planを保存するWindows GUI
- `dependencies/Anatomia/`: コード・ドメイン分析（Git submodule）
- `dependencies/Ludus/`: プレイ分類・OKF辞書（Git submodule）
- `scripts/`: 依存関係の初期化とリポジトリ検査

依存関係の詳細は [DEPENDENCIES.md](DEPENDENCIES.md) を参照してください。

## 確認

クローン後、必要なスキルと依存関係がそろっていることを確認できます。

```powershell
./scripts/Test-OmnipotensRepository.ps1
node ./.claude/skills/omnipotens/scripts/test.mjs
node ./.claude/skills/omnipotens/scripts/test-vitia-source.mjs
node ./.claude/skills/omnipotens/scripts/test-service-analysis.mjs
```
