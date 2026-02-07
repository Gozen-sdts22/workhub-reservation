/**
 * agent-browser CLI ラッパー
 *
 * agent-browserコマンドをNode.jsから実行し、結果を返す。
 */

import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { logger } from "./utils/logger";

const exec = promisify(execFile);

const COMMAND = "agent-browser";
const DEFAULT_TIMEOUT = 30_000; // 30秒

export interface BrowserResult {
  success: boolean;
  output: string;
  error?: string;
}

async function run(args: string[], timeout = DEFAULT_TIMEOUT): Promise<BrowserResult> {
  logger.debug(`agent-browser ${args.join(" ")}`);
  try {
    const { stdout, stderr } = await exec(COMMAND, args, { timeout });
    const output = stdout.trim();
    if (stderr && stderr.trim()) {
      logger.warn("agent-browser stderr:", stderr.trim());
    }
    logger.debug("agent-browser output:", output.slice(0, 500));
    return { success: true, output };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("agent-browser failed:", message);
    return { success: false, output: "", error: message };
  }
}

// ---- 公開API ----

/**
 * URLを開く
 */
export async function open(url: string, headed = true): Promise<BrowserResult> {
  const args = ["open", url];
  if (headed) args.push("--headed");
  return run(args);
}

/**
 * 画面要素のスナップショットを取得する
 */
export async function snapshot(): Promise<BrowserResult> {
  return run(["snapshot", "-i"]);
}

/**
 * 要素をクリックする
 */
export async function click(ref: string): Promise<BrowserResult> {
  return run(["click", ref]);
}

/**
 * テキストを入力する
 */
export async function fill(ref: string, text: string): Promise<BrowserResult> {
  return run(["fill", ref, text]);
}

/**
 * スクリーンショットを保存する
 */
export async function screenshot(filename: string): Promise<BrowserResult> {
  const dir = path.dirname(filename);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return run(["screenshot", filename]);
}

/**
 * 認証状態を読み込む
 */
export async function stateLoad(filepath: string): Promise<BrowserResult> {
  return run(["state", "load", filepath]);
}

/**
 * 認証状態を保存する
 */
export async function stateSave(filepath: string): Promise<BrowserResult> {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return run(["state", "save", filepath]);
}

/**
 * ブラウザを閉じる
 */
export async function close(): Promise<BrowserResult> {
  return run(["close"]);
}
