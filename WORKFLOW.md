# workhub会議室予約 ワークフロー定義

## 概要

このドキュメントは、workhubの会議室予約を自動化するためのワークフローを定義します。
AI Agentはこのワークフローに従って、agent-browserコマンドを実行します。

---

## 1. 前提条件

- agent-browserがインストール済み
- workhubアカウントの認証情報が利用可能
- 認証状態ファイル: `auth/workhub-auth.json`（初回ログイン後に保存）

---

## 2. URL一覧

| 画面 | URL |
|------|-----|
| ログイン | https://admin.workhub.site/ |
| エリア予約 | https://admin.workhub.site/reservation-calendar |

---

## 3. 初回ログインワークフロー

初回または認証状態が無効な場合に実行します。

### Step 1: ログイン画面を開く

```bash
agent-browser open "https://admin.workhub.site/" --headed
```

### Step 2: 画面要素を確認

```bash
agent-browser snapshot -i
```

**期待される要素:**
- textbox "メールアドレス"
- textbox "パスワード"
- button "ログイン" [disabled]

### Step 3: 認証情報を入力

```bash
agent-browser fill "@e1" "${WORKHUB_EMAIL}"
agent-browser fill "@e2" "${WORKHUB_PASSWORD}"
```

※ ref番号はsnapshotで確認すること

### Step 4: ログインボタンをクリック

```bash
agent-browser snapshot -i
```

入力後、ログインボタンが有効化されていることを確認:
- button "ログイン" （[disabled]が消えている）

```bash
agent-browser click "@e5"
```

### Step 5: ログイン成功を確認

```bash
agent-browser snapshot -i
```

**成功条件:**
- button "予約する" が表示されている

### Step 6: 認証状態を保存

```bash
agent-browser state save "auth/workhub-auth.json"
```

---

## 4. 会議室予約ワークフロー

### Step 1: 認証状態を復元

```bash
agent-browser state load "auth/workhub-auth.json"
```

**失敗した場合:** 初回ログインワークフローを実行

### Step 2: エリア予約画面を開く

```bash
agent-browser open "https://admin.workhub.site/reservation-calendar" --headed
```

### Step 3: 画面要素を確認

```bash
agent-browser snapshot -i
```

**期待される要素:**
- tab "会議室" [selected]
- button "前日"
- button "翌日"
- button "今日"
- 多数のbutton（カレンダースロット）

### Step 4: 日付を移動（必要な場合）

目的の日付に移動します。

**翌日に移動:**
```bash
agent-browser click "@翌日ボタンのref"
```

**前日に移動:**
```bash
agent-browser click "@前日ボタンのref"
```

**今日に戻る:**
```bash
agent-browser click "@今日ボタンのref"
```

移動後は必ずsnapshotで状態を確認:
```bash
agent-browser snapshot -i
```

### Step 5: 空き時間スロットを特定

snapshotの結果から空き時間を特定します。

**判別方法:**
- **空き時間:** ラベルなしのbutton（例: `button [ref=e640] [nth=585]`）
- **予約済み:** ラベル付きのbutton（例: `button "2026年2月4日10時30分から..., 予約済み" [ref=e201]`）

### Step 6: 空き時間スロットをクリック

```bash
agent-browser click "@空きスロットのref"
```

### Step 7: 予約フォームの表示を確認

```bash
agent-browser snapshot -i
```

**期待される要素:**
- textbox "タイトルを追加"
- combobox（開始時間）
- combobox（終了時間）
- button "キャンセル"
- button "作成"

### Step 8: タイトルを入力

```bash
agent-browser fill "@タイトルtextboxのref" "${予約タイトル}"
```

### Step 9: 開始時間を選択

```bash
agent-browser click "@開始時間comboboxのref"
agent-browser snapshot -i
```

**期待される要素:**
- listbox
- option "01:30"
- option "02:30"
- ... （30分刻み）
- option "24:30"

目的の時間をクリック:
```bash
agent-browser click "@目的時間optionのref"
```

### Step 10: 終了時間を選択

```bash
agent-browser click "@終了時間comboboxのref"
agent-browser snapshot -i
```

**注意:** 終了時間は開始時間以降のみ選択可能

目的の時間をクリック:
```bash
agent-browser click "@目的時間optionのref"
```

### Step 11: 作成ボタンをクリック

```bash
agent-browser snapshot -i
```

フォームの状態を確認後:
```bash
agent-browser click "@作成ボタンのref"
```

### Step 12: 確認ダイアログで登録

```bash
agent-browser snapshot -i
```

**期待される要素:**
- button "キャンセル"
- button "登録"

登録ボタンをクリック:
```bash
agent-browser click "@登録ボタンのref"
```

### Step 13: 予約完了を確認

```bash
agent-browser snapshot -i
```

**成功条件:**
- カレンダー画面に戻っている
- 新しい予約がラベル付きbuttonとして表示されている
- 例: `button "テスト予約, 2026年2月4日14時30分から15時30分, 03_4F_PhoneBooth_4A, 予約済み"`

### Step 14: スクリーンショットを保存

```bash
agent-browser screenshot "screenshots/booking-result-$(date +%Y%m%d-%H%M%S).png"
```

### Step 15: 完了

```bash
agent-browser close
```

---

## 5. 会議室一覧

### 5F（02ビル）

| 会議室名 | 収容人数 | 最少利用人数 | 用途 |
|----------|----------|--------------|------|
| 02_5A会議室 | 4名 | 2名 | 小規模ミーティング |
| 02_5B会議室 | 8名 | 4名 | 中規模ミーティング |
| 02_5C会議室 | 4名 | 2名 | 小規模ミーティング |
| 02_5F_PhoneBooth_5D | 1名 | 1名 | 電話・Web会議 |
| 02_5F_PhoneBooth_5E | 1名 | 1名 | 電話・Web会議 |
| 02_5F_PhoneBooth_5F | 1名 | 1名 | 電話・Web会議 |
| 02_5F_PhoneBooth_5G | 1名 | 1名 | 電話・Web会議 |

### 4F（03ビル）

| 会議室名 | 収容人数 | 最少利用人数 | 用途 |
|----------|----------|--------------|------|
| 03_4F_PhoneBooth_4A | 1名 | 1名 | 電話・Web会議 |
| 03_4F_PhoneBooth_4B | 1名 | 1名 | 電話・Web会議 |

---

## 6. 時間選択オプション

開始時間・終了時間は30分刻みで選択可能:

```
01:30, 02:30, 03:30, 04:30, 05:30, 06:30, 07:30, 08:30, 09:30, 10:30,
11:30, 12:30, 13:30, 14:30, 15:30, 16:30, 17:30, 18:30, 19:30, 20:30,
21:30, 22:30, 23:30, 24:30
```

**注意:** 終了時間は開始時間より後の時間のみ選択可能

---

## 7. エラーハンドリング

### エラー1: 要素が見つからない

**症状:** `click`や`fill`で要素が見つからない

**対処:**
1. `agent-browser snapshot -i` で現在の画面状態を再取得
2. 正しいref番号を確認して再実行

### エラー2: 認証状態が無効

**症状:** エリア予約画面を開くとログイン画面にリダイレクトされる

**対処:**
1. 初回ログインワークフローを実行
2. 認証状態を再保存

### エラー3: 予約フォームが開かない

**症状:** 空きスロットをクリックしても何も起きない

**対処:**
1. snapshotで現在の画面状態を確認
2. 別の空きスロットを試す
3. ページをリロードして再試行

### エラー4: 指定時間に空きがない

**症状:** 目的の時間帯にすべて予約が入っている

**対処:**
1. 別の時間帯を提案
2. 別の会議室を提案
3. 別の日付を提案

### エラー5: 予約の競合

**症状:** 登録ボタンクリック後にエラーメッセージ

**対処:**
1. snapshotでエラーメッセージを確認
2. キャンセルして別の時間帯/会議室で再試行

---

## 8. ベストプラクティス

### 8.1 ref番号の扱い

- ref番号は画面遷移や更新で変わる可能性がある
- **必ず操作前にsnapshotで最新のref番号を確認する**
- ref番号は常に引用符で括る: `"@e1"`

### 8.2 操作の順序

1. snapshot → 状態確認
2. 操作実行
3. snapshot → 結果確認
4. 次の操作へ

### 8.3 待機時間

- 画面遷移後は少し待ってからsnapshotを取得
- 必要に応じて `sleep 1` などを挟む

### 8.4 スクリーンショット

- 重要なポイントでスクリーンショットを保存
- エラー発生時は必ずスクリーンショットを保存
- ファイル名にタイムスタンプを含める

---

## 9. サンプルシナリオ

### シナリオ: 明日の14:30-15:30にPhoneBoothを予約

```bash
# 1. 認証状態を復元
agent-browser state load "auth/workhub-auth.json"

# 2. エリア予約画面を開く
agent-browser open "https://admin.workhub.site/reservation-calendar" --headed

# 3. 画面状態を確認
agent-browser snapshot -i

# 4. 翌日に移動（例: @e22が翌日ボタン）
agent-browser click "@e22"

# 5. 画面状態を再確認
agent-browser snapshot -i

# 6. 空きスロットをクリック（例: @e520がPhoneBooth 4Aの14:30の空き）
agent-browser click "@e520"

# 7. 予約フォームを確認
agent-browser snapshot -i

# 8. タイトルを入力
agent-browser fill "@e1" "Web会議"

# 9. 開始時間を選択（すでに14:30が選択されていれば不要）
agent-browser click "@e4"
agent-browser snapshot -i
agent-browser click "@e15"  # 14:30

# 10. 終了時間を選択
agent-browser click "@e7"
agent-browser snapshot -i
agent-browser click "@e2"  # 15:30

# 11. 作成ボタンをクリック
agent-browser snapshot -i
agent-browser click "@e15"

# 12. 確認ダイアログで登録
agent-browser snapshot -i
agent-browser click "@e17"

# 13. 予約完了を確認
agent-browser snapshot -i

# 14. スクリーンショット保存
agent-browser screenshot "screenshots/booking-phonebooth-20260204.png"

# 15. 完了
agent-browser close
```

---

## 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| 1.0 | 2026-02-03 | 初版作成（実際の画面調査結果に基づく） |
