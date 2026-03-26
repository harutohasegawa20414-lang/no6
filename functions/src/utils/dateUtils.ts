import { format, parse, addHours, isValid } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { Defaults } from "../config/constants";

const TIMEZONE = Defaults.TIMEZONE;

export function nowJST(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

export function formatDateJST(date: Date, fmt: string = "yyyy-MM-dd"): string {
  const jst = toZonedTime(date, TIMEZONE);
  return format(jst, fmt);
}

export function formatDateTimeJST(
  date: Date,
  fmt: string = "yyyy-MM-dd HH:mm"
): string {
  const jst = toZonedTime(date, TIMEZONE);
  return format(jst, fmt);
}

export function parseDate(dateStr: string): Date | null {
  // yyyy-MM-dd 形式
  const parsed = parse(dateStr, "yyyy-MM-dd", new Date());
  if (isValid(parsed)) return parsed;

  // yyyy/MM/dd 形式
  const parsed2 = parse(dateStr, "yyyy/MM/dd", new Date());
  if (isValid(parsed2)) return parsed2;

  return null;
}

export function toISOStringJST(dateStr: string, timeStr?: string): string {
  // ISO形式（2026-04-14T00:00:00Z）から日付部分だけ抽出
  const datePart = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const dateTimeStr = timeStr ? `${datePart} ${timeStr}` : `${datePart} ${Defaults.CONSTRUCTION_START_TIME}`;
  const parsed = parse(dateTimeStr, "yyyy-MM-dd HH:mm", new Date());
  const utcDate = fromZonedTime(parsed, TIMEZONE);
  return utcDate.toISOString();
}

export function getEndDateTime(
  startISOString: string,
  durationHours: number = 2
): string {
  const start = new Date(startISOString);
  return addHours(start, durationHours).toISOString();
}

export function formatForDisplay(dateStr: string): string {
  const parsed = parseDate(dateStr);
  if (!parsed) return dateStr;
  return format(parsed, "M月d日(E)", { locale: undefined });
}

/**
 * Kintone DATETIME (UTC ISO) を JST の日付と時刻に分解する
 * 例: "2026-04-14T00:00:00Z" → { date: "2026-04-14", time: "09:00" }
 * DATE形式 "2026-04-14" の場合はそのまま返す（time は null）
 */
export function parseKintoneDateTime(
  isoStr: string
): { date: string; time: string | null } {
  if (!isoStr.includes("T")) {
    // DATE型（時刻なし）
    return { date: isoStr, time: null };
  }
  const utcDate = new Date(isoStr);
  if (!isValid(utcDate)) {
    return { date: isoStr, time: null };
  }
  const jst = toZonedTime(utcDate, TIMEZONE);
  return {
    date: format(jst, "yyyy-MM-dd"),
    time: format(jst, "HH:mm"),
  };
}

/**
 * 日付 + 時刻 を表示用フォーマットに変換
 * 例: ("2026-04-14", "09:00") → "4月14日 9:00"
 */
export function formatDateTimeForDisplay(
  dateStr: string,
  time?: string | null
): string {
  const parsed = parseDate(dateStr);
  if (!parsed) return time ? `${dateStr} ${time}` : dateStr;
  const dateFormatted = format(parsed, "M月d日");
  return time ? `${dateFormatted} ${time}` : dateFormatted;
}
