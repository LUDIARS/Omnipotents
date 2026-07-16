# Omnipotents

ゲームプロジェクトの仕様、プレイ、ドメイン、コード、UX、マーケティングを横断して解析し、根拠付きのレポートを生成するClaude Codeスキルです。

## Claude Codeで使う

サブモジュールを含めてクローンし、このリポジトリをプロジェクトとしてClaude Codeで開きます。スキルは `.claude/skills/omnipotens` にあるため、追加のセットアップは必要ありません。

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

## 内容

- `.claude/skills/omnipotens/`: 分析パイプラインとレポート生成スクリプト
- `dependencies/Anatomia/`: コード・ドメイン分析（Git submodule）
- `dependencies/Ludus/`: プレイ分類・OKF辞書（Git submodule）
- `scripts/`: 依存関係の初期化とリポジトリ検査

依存関係の詳細は [DEPENDENCIES.md](DEPENDENCIES.md) を参照してください。

## 確認

クローン後、必要なスキルと依存関係がそろっていることを確認できます。

```powershell
./scripts/Test-OmnipotensRepository.ps1
node ./.claude/skills/omnipotens/scripts/test.mjs
```
