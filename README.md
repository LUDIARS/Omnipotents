# Omnipotents

会社管理の環境でOmnipotensのゲーム分析スキルを配布・検証するためのリポジトリです。スキル本体、依存リポジトリ、検証済みのセットアップスクリプト、最小セキュリティポリシーを一緒に管理します。

## 内容

- `skills/omnipotens/`: 分析パイプラインとレポート生成スクリプト
- `dependencies/Anatomia/`: コード・ドメイン分析（Git submodule）
- `dependencies/Ludus/`: プレイ分類・OKF辞書（Git submodule）
- `config/`: 企業利用時の安全な既定ポリシー
- `scripts/`: 依存関係の初期化、リポジトリ検査、スキル配布パッケージの作成・導入

依存関係の詳細は [DEPENDENCIES.md](DEPENDENCIES.md) を参照してください。

## クローンと初期化

新しい環境では、サブモジュールを含めてクローンします。

```powershell
git clone --recurse-submodules https://github.com/LUDIARS/Omnipotents.git
Set-Location Omnipotents
./scripts/Test-OmnipotensRepository.ps1
```

既存のクローンでは、次を実行します。

```powershell
./scripts/Initialize-OmnipotensDependencies.ps1
./scripts/Test-OmnipotensRepository.ps1
```

## 配布担当者: スキルパッケージを作る

依存するスキルを明示的に指定して、ハッシュ検証付きパッケージを作成します。不要な個人スキルを自動収集しない設計です。

```powershell
./scripts/New-OmnipotensCompanyPackage.ps1 `
  -SourceSkillsRoot './skills' `
  -SkillNames omnipotens `
  -OutputRoot 'C:\release\omnipotens-company-2026.07'
```

複数のスキルを配布する場合は、レビュー済みの名前だけを `-SkillNames` に列挙します。パッケージは各スキル全体をSHA-256で検証し、既存出力の上書き時は削除せずバックアップします。

## 利用者: パッケージを検証して導入する

```powershell
./scripts/Install-OmnipotensCompany.ps1 `
  -PackageRoot 'C:\release\omnipotens-company-2026.07' `
  -ValidateOnly

./scripts/Install-OmnipotensCompany.ps1 `
  -PackageRoot 'C:\release\omnipotens-company-2026.07'
```

既存スキルの置換は `-Force` を明示したときだけ実行され、元のスキルは `$CODEX_HOME\omnipotens-company-backups`（未設定時は `$HOME\.codex\omnipotens-company-backups`）へ退避します。

## 実行前: 分析入力を検査する

分析対象を分類し、秘密情報の典型的なファイル名が含まれないかをローカルで検査します。この検査は内容を外部送信しません。

```powershell
./scripts/Test-OmnipotensCompanyInput.ps1 `
  -WorkspaceRoot 'C:\work\sanitized-game' `
  -Classification internal
```

標準ポリシーは `confidential` と `restricted` を拒否します。例外は、セキュリティ責任者の承認、別ポリシー、閉域構成をそろえた場合にだけ扱います。

## 管理者が先に確定すること

インストーラーはLLMテナントやネットワークを直接変更しません。利用開始前に以下を完了してください。

1. 企業管理のLLMアカウント、SSO、MFA、入退社連携を有効化する。
2. モデル学習への共有をオフにし、保存期間・リージョンを契約と管理画面で確定する。
3. 個人アカウント、未承認MCP、外部アプリ、ブラウザ自動操作、外部アップロードを初期状態で無効化する。
4. `.env`、秘密鍵、トークン、本番データ、個人情報、顧客の持出禁止情報を分析対象から除外する。
5. 生成レポートを案件権限付きの社内ストレージへ保管する。

最初の検証には実案件ではなく、匿名化・ダミーのプロジェクトを使ってください。
