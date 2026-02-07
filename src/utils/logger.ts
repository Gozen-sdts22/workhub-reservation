import * as fs from "fs";
import * as path from "path";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m",  // green
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
};

const RESET = "\x1b[0m";

export class Logger {
  private minLevel: LogLevel;
  private logFile: string | null;

  constructor(minLevel: LogLevel = "info", logFile?: string) {
    this.minLevel = minLevel;
    this.logFile = logFile ?? null;

    if (this.logFile) {
      const dir = path.dirname(this.logFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) return;

    const timestamp = this.formatTimestamp();
    const color = LOG_COLORS[level];
    const tag = level.toUpperCase().padEnd(5);

    const consoleMsg = `${color}[${timestamp}] [${tag}]${RESET} ${message}`;
    const fileMsg = `[${timestamp}] [${tag}] ${message}`;

    if (data !== undefined) {
      const dataStr = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      console.log(consoleMsg, dataStr);
      if (this.logFile) {
        fs.appendFileSync(this.logFile, `${fileMsg} ${dataStr}\n`);
      }
    } else {
      console.log(consoleMsg);
      if (this.logFile) {
        fs.appendFileSync(this.logFile, `${fileMsg}\n`);
      }
    }
  }

  debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: unknown): void {
    this.log("error", message, data);
  }
}

export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || "info",
  process.env.LOG_FILE
);
