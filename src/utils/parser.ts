/**
 * 自然言語から予約情報を抽出するパーサー
 */

export interface BookingRequest {
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  room?: string;      // 希望会議室名（任意）
  title?: string;     // 予約タイトル（任意）
}

/**
 * 相対的な日付表現を解決する
 */
function resolveDate(text: string): string | null {
  const now = new Date();

  if (text.includes("今日")) {
    return formatDate(now);
  }

  if (text.includes("明日")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }

  if (text.includes("明後日")) {
    const dayAfterTomorrow = new Date(now);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    return formatDate(dayAfterTomorrow);
  }

  // 「来週月曜」などのパターン
  const weekdayMatch = text.match(/来週(月|火|水|木|金|土|日)曜/);
  if (weekdayMatch) {
    const weekdayMap: Record<string, number> = {
      日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6,
    };
    const targetDay = weekdayMap[weekdayMatch[1]];
    const currentDay = now.getDay();
    const daysUntilNextWeek = (7 - currentDay) + targetDay;
    const target = new Date(now);
    target.setDate(target.getDate() + daysUntilNextWeek);
    return formatDate(target);
  }

  // 「今週金曜」などのパターン
  const thisWeekMatch = text.match(/今週(月|火|水|木|金|土|日)曜/);
  if (thisWeekMatch) {
    const weekdayMap: Record<string, number> = {
      日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6,
    };
    const targetDay = weekdayMap[thisWeekMatch[1]];
    const currentDay = now.getDay();
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    const target = new Date(now);
    target.setDate(target.getDate() + diff);
    return formatDate(target);
  }

  // 「2/10」「2月10日」のような日付指定
  const dateMatch = text.match(/(\d{1,2})[月/](\d{1,2})日?/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);
    const year = now.getFullYear();
    const target = new Date(year, month - 1, day);
    // 過去の日付なら来年
    if (target < now) {
      target.setFullYear(year + 1);
    }
    return formatDate(target);
  }

  return null;
}

/**
 * 時刻を抽出する
 */
function extractTimes(text: string): { startTime: string | null; endTime: string | null } {
  let startTime: string | null = null;
  let endTime: string | null = null;

  // 「14時から15時まで」パターン
  const rangeMatch = text.match(/(\d{1,2})[:時](\d{0,2})分?(?:から|〜|-)(\d{1,2})[:時](\d{0,2})分?/);
  if (rangeMatch) {
    const startHour = rangeMatch[1].padStart(2, "0");
    const startMin = (rangeMatch[2] || "00").padStart(2, "0");
    const endHour = rangeMatch[3].padStart(2, "0");
    const endMin = (rangeMatch[4] || "00").padStart(2, "0");
    startTime = `${startHour}:${startMin}`;
    endTime = `${endHour}:${endMin}`;
    return { startTime, endTime };
  }

  // 「14:30から」のような開始時刻のみ
  const startMatch = text.match(/(\d{1,2})[:時](\d{0,2})分?から/);
  if (startMatch) {
    const hour = startMatch[1].padStart(2, "0");
    const min = (startMatch[2] || "00").padStart(2, "0");
    startTime = `${hour}:${min}`;
  }

  // 「15時まで」のような終了時刻のみ
  const endMatch = text.match(/(\d{1,2})[:時](\d{0,2})分?まで/);
  if (endMatch) {
    const hour = endMatch[1].padStart(2, "0");
    const min = (endMatch[2] || "00").padStart(2, "0");
    endTime = `${hour}:${min}`;
  }

  // 開始のみ指定の場合、1時間後を終了に設定
  if (startTime && !endTime) {
    const [h, m] = startTime.split(":").map(Number);
    const endHour = (h + 1).toString().padStart(2, "0");
    endTime = `${endHour}:${m.toString().padStart(2, "0")}`;
  }

  return { startTime, endTime };
}

/**
 * 会議室名を抽出する
 */
function extractRoom(text: string): string | null {
  const roomPatterns = [
    /(?:PhoneBooth|フォンブース)[_\s]?([45][A-G])/i,
    /(5[ABC])会議室/,
    /会議室[_\s]?(5[ABC])/,
    /会議室([ABC])/i,
  ];

  for (const pattern of roomPatterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  if (text.includes("PhoneBooth") || text.includes("フォンブース") || text.includes("電話ブース")) {
    return "PhoneBooth";
  }

  return null;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 自然言語テキストから予約情報を抽出する
 */
export function parseBookingRequest(text: string): BookingRequest | null {
  const date = resolveDate(text);
  const { startTime, endTime } = extractTimes(text);

  if (!date || !startTime || !endTime) {
    return null;
  }

  const room = extractRoom(text) ?? undefined;

  return {
    date,
    startTime,
    endTime,
    room,
  };
}

/**
 * BookingRequestを日本語の確認メッセージに変換する
 */
export function formatBookingConfirmation(req: BookingRequest): string {
  const lines = [
    `- 日付: ${req.date}`,
    `- 時間: ${req.startTime}-${req.endTime}`,
  ];
  if (req.room) {
    lines.push(`- 会議室: ${req.room}`);
  }
  if (req.title) {
    lines.push(`- タイトル: ${req.title}`);
  }
  return lines.join("\n");
}
