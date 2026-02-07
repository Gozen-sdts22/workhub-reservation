# workhub会議室予約自動化システム 要件定義書

## 1. プロジェクト概要

### 1.1 目的

レンタルオフィスの共用会議室予約アプリ「workhub」の予約作業を自動化し、Slackからの自然言語入力で会議室予約を完了できるシステムを構築する。

### 1.2 背景

- workhubには外部連携APIが提供されていない
- Googleカレンダー/Slack連携はコスト的に困難
- 毎回アプリで会議室を探すのが手間

### 1.3 解決方針

AI Agentによるブラウザ自動操作（agent-browser）を用いて、画面操作ベースで予約を自動化する。

---

## 2. システムアーキテクチャ

### 2.1 全体構成図

```
┌─────────────────────────────────────────────────────────────────────┐
│                      クラウド VM (Azure/AWS/GCP)                     │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  Slack Bot   │───▶│   AI Agent   │───▶│agent-browser │          │
│  │  (入力受付)  │    │ (Claude API) │    │ (画面操作)   │          │
│  └──────────────┘    └──────┬───────┘    └──────────────┘          │
│                             │                                        │
│                      ┌──────▼───────┐                               │
│                      │  CLAUDE.md   │                               │
│                      │ (学習記録)   │                               │
│                      └──────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │     workhub      │
                    │   (会議室予約)    │
                    └──────────────────┘
```

### 2.2 コンポーネント一覧

| コンポーネント | 役割 | 技術スタック |
|---------------|------|-------------|
| Slack Bot | ユーザー入力の受付・結果通知 | Slack Bolt (Node.js) |
| AI Agent | 自然言語解析・操作指示生成 | Claude API (Anthropic) |
| agent-browser | ブラウザ自動操作 | agent-browser CLI |
| CLAUDE.md | エラー記録・学習内容蓄積 | Markdown |
| WORKFLOW.md | 予約ワークフロー定義 | Markdown |
| クラウドVM | システム実行環境 | AWS EC2 / Azure VM / GCP |

---

## 3. 機能要件

### 3.1 ユーザーストーリー

```
ユーザーとして、
Slackで「明日の14時から15時まで会議室予約して」とメッセージを送ると、
自動的にworkhubで会議室が予約され、
予約結果がSlackに通知されることを期待する。
```

### 3.2 機能一覧

#### F-001: 自然言語による予約リクエスト受付

| 項目 | 内容 |
|------|------|
| 概要 | Slackメッセージから予約情報を抽出 |
| 入力例 | 「明日の14時から15時まで会議室予約して」 |
| 抽出情報 | 日付、開始時間、終了時間、希望会議室（任意） |

#### F-002: AI Agentによる操作指示生成

| 項目 | 内容 |
|------|------|
| 概要 | 予約情報をagent-browserコマンドに変換 |
| 処理 | snapshotで画面要素取得→適切な操作コマンド生成 |
| 特徴 | 画面変更に柔軟に対応（ref番号を都度取得） |

#### F-003: ブラウザ自動操作による予約実行

| 項目 | 内容 |
|------|------|
| 概要 | agent-browserでworkhub画面を操作 |
| 操作フロー | ログイン→日時選択→会議室選択→予約確定 |
| 認証 | 事前保存した認証状態を復元 |

#### F-004: 予約結果の通知

| 項目 | 内容 |
|------|------|
| 概要 | 予約完了/失敗をSlackに通知 |
| 成功時 | 予約情報 + 確認スクリーンショット |
| 失敗時 | エラー内容 + 再試行の案内 |

#### F-005: エラー学習・記録

| 項目 | 内容 |
|------|------|
| 概要 | 発生したエラーをCLAUDE.mdに記録 |
| 記録内容 | エラー内容、発生コマンド、対処法 |
| 活用 | 次回実行時にAI Agentが参照して回避 |

---

## 4. 非機能要件

### 4.1 実行環境

| 項目 | 要件 |
|------|------|
| 実行場所 | クラウドVM（ローカルPCでは実行しない） |
| OS | Ubuntu 22.04 LTS 推奨 |
| Node.js | v18以上 |
| メモリ | 2GB以上 |
| ストレージ | 10GB以上（ブラウザ含む） |

### 4.2 可用性

| 項目 | 要件 |
|------|------|
| 稼働時間 | 24時間365日 |
| 応答時間 | リクエストから予約完了まで60秒以内（目標） |

### 4.3 セキュリティ

| 項目 | 要件 |
|------|------|
| 認証情報 | 環境変数または暗号化ファイルで管理 |
| workhubログイン | 認証状態ファイルで管理（定期更新） |
| API キー | Slack/Claude APIキーは環境変数で管理 |

---

## 5. 技術仕様

### 5.1 ディレクトリ構成

```
workhub-booking-agent/
├── src/
│   ├── index.ts              # エントリーポイント
│   ├── slack-bot.ts          # Slack Bot
│   ├── agent.ts              # AI Agent コア
│   ├── browser.ts            # agent-browser ラッパー
│   └── utils/
│       ├── parser.ts         # 自然言語パーサー
│       └── logger.ts         # ロガー
├── docs/
│   ├── WORKFLOW.md           # 予約ワークフロー定義
│   └── CLAUDE.md             # 学習記録
├── auth/
│   └── workhub-auth.json     # 認証状態（gitignore対象）
├── screenshots/              # 予約確認スクリーンショット
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### 5.2 使用ライブラリ

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "@slack/bolt": "^3.17.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

### 5.3 環境変数

```bash
# .env
SLACK_BOT_TOKEN=xoxb-xxxx
SLACK_SIGNING_SECRET=xxxx
SLACK_APP_TOKEN=xapp-xxxx
ANTHROPIC_API_KEY=sk-ant-xxxx
WORKHUB_URL=https://admin.workhub.site
AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome
```

---

## 6. ワークフロー定義

### 6.1 予約ワークフロー（WORKFLOW.md）

```markdown
# 会議室予約ワークフロー

## 前提条件
- workhubにログイン済み（認証状態を保存済み）
- agent-browserがインストール済み

## ステップ

### Step 1: 認証状態の復元
agent-browser state load auth/workhub-auth.json

### Step 2: 予約画面を開く
agent-browser open ${WORKHUB_URL}/booking --headed

### Step 3: スナップショット取得
agent-browser snapshot -i --json

### Step 4: 日時を選択
- カレンダーから対象日付をクリック
- 開始時間を選択
- 終了時間を選択
※ 具体的なref番号はスナップショットから取得

### Step 5: 会議室を選択
- 空いている会議室一覧を確認
- 適切な会議室を選択

### Step 6: 予約確定
- 確定ボタンをクリック

### Step 7: 結果確認
agent-browser screenshot screenshots/booking-result-{timestamp}.png

### Step 8: 完了
agent-browser close

## 成功条件
- 「予約が完了しました」等のメッセージが表示される
- スクリーンショットに予約情報が含まれる

## エラー時の対応
- 要素が見つからない場合: 再度snapshotを取得
- ログインセッション切れ: 認証状態を再保存して再試行
- 会議室が埋まっている場合: 別の会議室を提案
```

---

## 7. AI Agent 仕様

### 7.1 システムプロンプト

```markdown
あなたはworkhubの会議室予約を自動化するAI Agentです。

## 利用可能なコマンド
- agent-browser open <url> [--headed]  # URLを開く
- agent-browser snapshot -i [--json]   # 画面要素を取得
- agent-browser click @<ref>           # 要素をクリック
- agent-browser fill @<ref> "<text>"   # テキスト入力
- agent-browser screenshot <filename>  # スクリーンショット
- agent-browser state load <file>      # 認証状態を復元
- agent-browser state save <file>      # 認証状態を保存
- agent-browser close                  # ブラウザを閉じる

## ルール
1. 操作前に必ずsnapshotを取得してref番号を確認する
2. 操作後は再度snapshotで結果を確認する
3. エラー発生時は別のアプローチを試す
4. 最終的に予約完了のスクリーンショットを撮る
5. 1つずつコマンドを実行し、結果を確認してから次に進む

## 出力形式
実行するコマンドは以下の形式で出力:
```bash
agent-browser <command>
```
```

### 7.2 エージェントループ

```typescript
// 疑似コード
async function agentLoop(request: BookingRequest): Promise<string> {
  const messages = [initialMessage(request)];
  
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 1. Claude APIにメッセージを送信
    const response = await claude.messages.create({...});
    
    // 2. レスポンスからコマンドを抽出
    const command = extractCommand(response);
    
    // 3. コマンドを実行
    if (command) {
      const result = await executeCommand(command);
      messages.push({ role: "user", content: result });
    }
    
    // 4. 完了判定
    if (isCompleted(response)) {
      return response;
    }
  }
}
```

---

## 8. エラー学習仕様

### 8.1 CLAUDE.md 構造

```markdown
# workhub会議室予約 AI Agent 学習記録

## 基本情報
- workhub URL: https://admin.workhub.site
- 認証状態ファイル: ./auth/workhub-auth.json

## 画面要素マッピング（学習済み）
※ ref番号は画面状態により変動するため、必ずsnapshotで確認

## 過去のエラーと対処法

### エラーパターン1: [エラー名]
- 状況: [発生状況]
- 原因: [原因]
- 対処: [対処法]

## 成功パターン
[成功した操作手順を記録]
```

### 8.2 エラー記録フォーマット

```typescript
interface ErrorLog {
  timestamp: string;
  command: string;
  error: string;
  context: string;      // スナップショットの状態など
  resolution?: string;  // 解決方法（判明した場合）
}
```

---

## 9. Slack Bot 仕様

### 9.1 対応メッセージパターン

| パターン | 例 |
|----------|-----|
| 日時指定 | 「明日の14時から15時まで会議室予約して」 |
| 相対日時 | 「来週月曜の10時から」 |
| 会議室指定 | 「会議室Aを14時から予約」 |

### 9.2 応答メッセージ

#### 処理中
```
🔄 会議室予約を処理中...
- 日付: 2024-02-05
- 時間: 14:00-15:00
```

#### 成功
```
✅ 会議室を予約しました！
- 会議室: 会議室A
- 日付: 2024-02-05
- 時間: 14:00-15:00

[予約確認スクリーンショット]
```

#### 失敗
```
❌ 予約に失敗しました
- 理由: 指定時間帯に空いている会議室がありません

別の時間帯を指定してください。
```

---

## 10. クラウドVM 環境構築

### 10.1 推奨スペック

| 項目 | 推奨値 |
|------|--------|
| インスタンスタイプ | AWS: t3.small / Azure: B1ms / GCP: e2-small |
| vCPU | 2 |
| メモリ | 2GB |
| ストレージ | 20GB SSD |
| OS | Ubuntu 22.04 LTS |

### 10.2 セットアップ手順

```bash
# 1. システム更新
sudo apt update && sudo apt upgrade -y

# 2. Node.js インストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Chrome インストール
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb

# 4. agent-browser インストール
npm install -g agent-browser
agent-browser install --with-deps

# 5. プロジェクトセットアップ
git clone <repository-url>
cd workhub-booking-agent
npm install

# 6. 環境変数設定
cp .env.example .env
# .env を編集

# 7. 起動
npm run start
```

### 10.3 プロセス管理（PM2）

```bash
# PM2 インストール
npm install -g pm2

# 起動
pm2 start npm --name "workhub-agent" -- run start

# 自動起動設定
pm2 startup
pm2 save
```

---

## 11. 実装ステップ

### Phase 1: 画面調査（1日）
- [ ] workhubにログインしてスナップショット取得
- [ ] 予約フローの画面遷移を記録
- [ ] 各画面の要素（ref番号）をドキュメント化

### Phase 2: 基本機能実装（2-3日）
- [ ] agent-browserラッパー関数の実装
- [ ] AI Agentコアの実装
- [ ] WORKFLOW.mdの作成
- [ ] ローカルでの動作確認

### Phase 3: Slack Bot連携（1-2日）
- [ ] Slack Appの作成・設定
- [ ] Slack Botの実装
- [ ] 自然言語パーサーの実装

### Phase 4: クラウド環境構築（1日）
- [ ] VMインスタンス作成
- [ ] 環境セットアップ
- [ ] デプロイ・動作確認

### Phase 5: テスト・改善（1-2日）
- [ ] エンドツーエンドテスト
- [ ] エラーパターンの収集・対処
- [ ] CLAUDE.mdへの学習内容追記

---

## 12. 制約事項・リスク

### 12.1 制約事項

| 項目 | 内容 |
|------|------|
| workhub画面変更 | 画面構造が変わると操作が失敗する可能性 |
| 認証有効期限 | ログインセッションが切れると再認証が必要 |
| 処理速度 | ブラウザ操作のため、API連携より遅い |

### 12.2 リスク対策

| リスク | 対策 |
|--------|------|
| 画面変更による操作失敗 | AI Agentがsnapshotから動的に判断 |
| セッション切れ | 定期的な認証状態の更新処理 |
| エラー頻発 | CLAUDE.mdへの学習蓄積で改善 |

---

## 13. 用語集

| 用語 | 説明 |
|------|------|
| agent-browser | Vercel Labsが開発したAIエージェント向けブラウザ自動化CLIツール |
| ref番号 | agent-browserのsnapshotで割り当てられる画面要素の識別子（例: @e1, @e2） |
| snapshot | agent-browserで画面要素をアクセシビリティツリーとして取得するコマンド |
| CLAUDE.md | AI Agentの学習内容・エラー記録を蓄積するファイル |

---

## 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| 1.0 | 2026-02-03 | 初版作成 |
