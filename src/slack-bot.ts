/**
 * Slack Bot
 *
 * Slackからの自然言語メッセージを受け取り、
 * 予約情報を抽出してAI Agentに処理を委譲する。
 */

import { App, LogLevel } from "@slack/bolt";
import * as fs from "fs";
import { parseBookingRequest, formatBookingConfirmation } from "./utils/parser";
import { executeBooking, BookingResult } from "./agent";
import { logger } from "./utils/logger";

export function createSlackApp(): App {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
    logLevel: LogLevel.INFO,
  });

  // 予約リクエスト: メンションまたはDMで反応
  app.event("app_mention", async ({ event, say }) => {
    await handleBookingMessage(event.text, event.channel, event.ts, say);
  });

  app.event("message", async ({ event, say }) => {
    // DMのみ処理（channel_type === "im"）
    if ("channel_type" in event && event.channel_type === "im" && "text" in event && event.text) {
      await handleBookingMessage(event.text, event.channel, event.ts, say);
    }
  });

  return app;
}

async function handleBookingMessage(
  text: string,
  channel: string,
  ts: string,
  say: (msg: string | { text: string; thread_ts?: string }) => Promise<unknown>,
): Promise<void> {
  logger.info(`メッセージ受信: ${text}`);

  // メンションのテキストからBot IDを除去
  const cleanText = text.replace(/<@[A-Z0-9]+>/g, "").trim();

  if (!cleanText) {
    await say({
      text: "予約したい日時を教えてください。\n例: 「明日の14時から15時まで会議室予約して」",
      thread_ts: ts,
    });
    return;
  }

  // 予約情報の抽出
  const request = parseBookingRequest(cleanText);
  if (!request) {
    await say({
      text: [
        "予約情報を読み取れませんでした。以下の形式で入力してください:",
        "",
        "- 「明日の14時から15時まで会議室予約して」",
        "- 「来週月曜の10時から11時までPhoneBooth予約」",
        "- 「2/10の13:30から14:30まで5A会議室」",
      ].join("\n"),
      thread_ts: ts,
    });
    return;
  }

  // タイトルが指定されていなければデフォルト値を設定
  if (!request.title) {
    request.title = "会議";
  }

  // 処理中メッセージ
  const confirmation = formatBookingConfirmation(request);
  await say({
    text: `予約を処理中...\n${confirmation}`,
    thread_ts: ts,
  });

  // AI Agent で予約を実行
  let result: BookingResult;
  try {
    result = await executeBooking(request);
  } catch (err) {
    logger.error("予約実行中にエラー:", err);
    await say({
      text: `予約処理中にエラーが発生しました。\n${err instanceof Error ? err.message : String(err)}`,
      thread_ts: ts,
    });
    return;
  }

  // 結果を通知
  if (result.success) {
    const lines = [
      "会議室を予約しました！",
      "",
      `- 日付: ${request.date}`,
      `- 時間: ${request.startTime}-${request.endTime}`,
    ];
    if (result.room) lines.push(`- 会議室: ${result.room}`);
    lines.push("", result.message);

    await say({ text: lines.join("\n"), thread_ts: ts });

    // スクリーンショットがあればアップロード（将来対応）
    if (result.screenshotPath && fs.existsSync(result.screenshotPath)) {
      logger.info(`スクリーンショット保存済み: ${result.screenshotPath}`);
    }
  } else {
    await say({
      text: `予約に失敗しました\n- 理由: ${result.message}\n\n別の時間帯や会議室で再度お試しください。`,
      thread_ts: ts,
    });
  }
}
