/**
 * workhub会議室予約自動化システム エントリーポイント
 */

import "dotenv/config";
import { createSlackApp } from "./slack-bot";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  // 必須環境変数のチェック
  const required = [
    "SLACK_BOT_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_APP_TOKEN",
    "ANTHROPIC_API_KEY",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.error(`環境変数が未設定です: ${missing.join(", ")}`);
    logger.error(".env.example を参照して .env ファイルを作成してください");
    process.exit(1);
  }

  const app = createSlackApp();
  const port = parseInt(process.env.PORT || "3000", 10);

  await app.start(port);
  logger.info(`workhub予約Botが起動しました (port: ${port})`);
}

main().catch((err) => {
  logger.error("起動に失敗しました:", err);
  process.exit(1);
});
