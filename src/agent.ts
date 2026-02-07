/**
 * AI Agent コア
 *
 * Claude APIを使ってagent-browserコマンドを生成・実行し、
 * workhubの会議室予約を自動で行う。
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as browser from "./browser";
import { BookingRequest } from "./utils/parser";
import { logger } from "./utils/logger";

const MAX_ITERATIONS = 30;
const AUTH_FILE = "auth/workhub-auth.json";
const SCREENSHOTS_DIR = "screenshots";
const WORKHUB_URL = process.env.WORKHUB_URL || "https://admin.workhub.site";

export interface BookingResult {
  success: boolean;
  message: string;
  screenshotPath?: string;
  room?: string;
}

/**
 * CLAUDE.mdとWORKFLOW.mdの内容を読み込んでシステムプロンプトに含める
 */
function loadKnowledgeBase(): string {
  const parts: string[] = [];

  const claudeMdPath = path.resolve("CLAUDE.md");
  if (fs.existsSync(claudeMdPath)) {
    parts.push("## 学習記録 (CLAUDE.md)\n" + fs.readFileSync(claudeMdPath, "utf-8"));
  }

  const workflowPath = path.resolve("WORKFLOW.md");
  if (fs.existsSync(workflowPath)) {
    parts.push("## ワークフロー定義 (WORKFLOW.md)\n" + fs.readFileSync(workflowPath, "utf-8"));
  }

  return parts.join("\n\n---\n\n");
}

function buildSystemPrompt(): string {
  const knowledgeBase = loadKnowledgeBase();

  return `あなたはworkhubの会議室予約を自動化するAI Agentです。

## 利用可能なコマンド
以下のコマンドを1つずつ実行できます。コマンドは必ずコードブロック内に記述してください。

- agent-browser open <url> [--headed]  # URLを開く
- agent-browser snapshot -i            # 画面要素を取得
- agent-browser click "@<ref>"         # 要素をクリック（引用符必須）
- agent-browser fill "@<ref>" "<text>" # テキスト入力（引用符必須）
- agent-browser screenshot <filename>  # スクリーンショット
- agent-browser state load <file>      # 認証状態を復元
- agent-browser state save <file>      # 認証状態を保存
- agent-browser close                  # ブラウザを閉じる

## ルール
1. 操作前に必ずsnapshotを取得してref番号を確認する
2. 操作後は再度snapshotで結果を確認する
3. ref番号は必ず引用符で括る（例: "@e1"）
4. エラー発生時は別のアプローチを試す
5. 最終的に予約完了のスクリーンショットを撮る
6. 1つずつコマンドを実行し、結果を確認してから次に進む

## 出力形式
実行するコマンドは以下の形式で出力してください:
\`\`\`bash
agent-browser <command>
\`\`\`

予約が完了したら、以下の形式で結果を出力してください:
[BOOKING_COMPLETE]
- room: <会議室名>
- message: <結果メッセージ>
- screenshot: <スクリーンショットパス>

予約に失敗した場合:
[BOOKING_FAILED]
- reason: <失敗理由>

## 参照情報
${knowledgeBase}`;
}

/**
 * Claudeのレスポンスからagent-browserコマンドを抽出する
 */
function extractCommand(text: string): string | null {
  const codeBlockMatch = text.match(/```(?:bash)?\s*\n(agent-browser .+?)\n```/s);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return null;
}

/**
 * コマンド文字列をパースして実行する
 */
async function executeCommand(command: string): Promise<string> {
  logger.info(`実行: ${command}`);

  const parts = parseCommandArgs(command.replace(/^agent-browser\s+/, ""));
  const subCommand = parts[0];

  switch (subCommand) {
    case "open":
      return resultToString(await browser.open(parts[1], parts.includes("--headed")));
    case "snapshot":
      return resultToString(await browser.snapshot());
    case "click":
      return resultToString(await browser.click(parts[1]));
    case "fill":
      return resultToString(await browser.fill(parts[1], parts[2]));
    case "screenshot":
      return resultToString(await browser.screenshot(parts[1]));
    case "state":
      if (parts[1] === "load") return resultToString(await browser.stateLoad(parts[2]));
      if (parts[1] === "save") return resultToString(await browser.stateSave(parts[2]));
      return `Unknown state sub-command: ${parts[1]}`;
    case "close":
      return resultToString(await browser.close());
    default:
      return `Unknown command: ${subCommand}`;
  }
}

/**
 * コマンド文字列を引用符を考慮してパースする
 */
function parseCommandArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (const ch of input) {
    if (inQuotes) {
      if (ch === quoteChar) {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuotes = true;
      quoteChar = ch;
    } else if (ch === " ") {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);

  return args;
}

function resultToString(result: browser.BrowserResult): string {
  if (result.success) {
    return result.output || "(no output)";
  }
  return `ERROR: ${result.error || "unknown error"}`;
}

/**
 * 予約完了判定
 */
function parseCompletion(text: string): BookingResult | null {
  if (text.includes("[BOOKING_COMPLETE]")) {
    const roomMatch = text.match(/- room:\s*(.+)/);
    const messageMatch = text.match(/- message:\s*(.+)/);
    const screenshotMatch = text.match(/- screenshot:\s*(.+)/);
    return {
      success: true,
      message: messageMatch?.[1]?.trim() || "予約が完了しました",
      room: roomMatch?.[1]?.trim(),
      screenshotPath: screenshotMatch?.[1]?.trim(),
    };
  }

  if (text.includes("[BOOKING_FAILED]")) {
    const reasonMatch = text.match(/- reason:\s*(.+)/);
    return {
      success: false,
      message: reasonMatch?.[1]?.trim() || "予約に失敗しました",
    };
  }

  return null;
}

/**
 * 予約を実行するエージェントループ
 */
export async function executeBooking(request: BookingRequest): Promise<BookingResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { success: false, message: "ANTHROPIC_API_KEY が設定されていません" };
  }

  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt();

  const userMessage = `以下の予約を実行してください。

- 日付: ${request.date}
- 開始時間: ${request.startTime}
- 終了時間: ${request.endTime}
${request.room ? `- 希望会議室: ${request.room}` : "- 会議室: 空いている会議室を自動選択"}
${request.title ? `- タイトル: ${request.title}` : "- タイトル: 会議"}

認証状態ファイル: ${AUTH_FILE}
workhub URL: ${WORKHUB_URL}
スクリーンショット保存先: ${SCREENSHOTS_DIR}/

まず認証状態を復元してから、予約フローを開始してください。`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  logger.info("予約エージェント開始", {
    date: request.date,
    startTime: request.startTime,
    endTime: request.endTime,
    room: request.room,
  });

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    logger.info(`--- イテレーション ${i + 1}/${MAX_ITERATIONS} ---`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    const assistantText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    logger.debug("Claude応答:", assistantText.slice(0, 300));

    // 完了判定
    const completion = parseCompletion(assistantText);
    if (completion) {
      logger.info("予約処理完了:", completion);
      await browser.close();
      return completion;
    }

    // コマンド抽出・実行
    const command = extractCommand(assistantText);
    if (command) {
      const result = await executeCommand(command);
      messages.push(
        { role: "assistant", content: assistantText },
        { role: "user", content: `コマンド実行結果:\n${result}` },
      );
    } else {
      // コマンドがない場合は再度指示を促す
      messages.push(
        { role: "assistant", content: assistantText },
        {
          role: "user",
          content: "次に実行するagent-browserコマンドをコードブロック内に記述してください。",
        },
      );
    }

    // 停止理由が end_turn で完了マーカーがない場合は継続
    if (response.stop_reason === "end_turn" && !command) {
      logger.warn("コマンドなしでend_turn - エージェントに再指示します");
    }
  }

  logger.error("最大イテレーション到達");
  await browser.close();
  return {
    success: false,
    message: `最大試行回数（${MAX_ITERATIONS}回）に達しました。予約を完了できませんでした。`,
  };
}
