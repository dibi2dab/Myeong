/**
 * 달력(그레고리력) 저수준 유틸리티.
 *
 * - 시간대는 일절에 전혀 의존하지 않는다. 모든 연산은 "양력 날짜" 또는
 *   "UTC 기준순간(epoch ms)" 두 가지 표현만 사용한다.
 * - 지역 시간(KST 등) 변환은 `core/calendar/koreaTime.ts` 가 담당한다.
 */

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export interface CivilDateTime extends CivilDate {
  hour: number;
  minute: number;
  /** 0-59 */
  second: number;
}

export const MS_PER_DAY = 86_400_000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;

export function isLeapSolarYear(year: number): boolean {
  if (!Number.isInteger(year)) return false;
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function daysInSolarMonth(year: number, month: number): number {
  if (month < 1 || month > 12 || !Number.isInteger(month)) {
    throw new Error(`잘못된 월입니다: ${month}`);
  }
  if (month === 2 && isLeapSolarYear(year)) return 29;
  return MONTH_LENGTHS[month - 1];
}

export function isValidSolarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  return day <= daysInSolarMonth(year, month);
}

/** 두 양력 날짜 사이의 일수 (a - b). */
export function differenceInDays(a: CivilDate, b: CivilDate): number {
  return Math.round((epochMsOfCivilDate(a) - epochMsOfCivilDate(b)) / MS_PER_DAY);
}

/** 양력 날짜 00:00 UTC 를 epoch ms 로. */
export function epochMsOfCivilDate(date: CivilDate): number {
  return Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0, 0);
}

export function addDays(date: CivilDate, days: number): CivilDate {
  const ms = epochMsOfCivilDate(date) + days * MS_PER_DAY;
  return civilDateFromEpochMs(ms);
}

export function addMonths(date: CivilDate, months: number): CivilDate {
  const totalMonths = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12 + 12) % 12 + 1;
  // 목표 월에 같은 일자가 없을 경우(예: 1/31 + 1개월) 그 달의 마지막 날로 맞춘다.
  const day = Math.min(date.day, daysInSolarMonth(year, month));
  return { year, month, day };
}

export function addYears(date: CivilDate, years: number): CivilDate {
  return addMonths(date, years * 12);
}

export function civilDateFromEpochMs(epochMs: number): CivilDate {
  const d = new Date(epochMs);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function civilDateTimeFromEpochMs(epochMs: number): CivilDateTime {
  const d = new Date(epochMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

export function compareCivilDate(a: CivilDate, b: CivilDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function isSameCivilDate(a: CivilDate, b: CivilDate): boolean {
  return compareCivilDate(a, b) === 0;
}

/** ISO `YYYY-MM-DD` 형태 파싱. */
export function parseIsoDate(text: string): CivilDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!isValidSolarDate(year, month, day)) return null;
  return { year, month, day };
}

export function formatIsoDate(date: CivilDate): string {
  const y = String(date.year).padStart(4, "0");
  const m = String(date.month).padStart(2, "0");
  const d = String(date.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 0 = 일요일, 6 = 토요일 */
export function weekdayOf(date: CivilDate): number {
  return new Date(epochMsOfCivilDate(date)).getUTCDay();
}

export function weekdayLabel(date: CivilDate): string {
  return WEEKDAY_LABELS[weekdayOf(date)];
}

export function formatKoreanDate(date: CivilDate): string {
  return `${date.year}년 ${date.month}월 ${date.day}일`;
}
