/**
 * 율리우스 날짜(Julian Day Number) 계산.
 *
 * 일주(日柱) 계산의 근간이다. 기준일 1900-01-01 = JDN 2415020.5(0시) 계열을
 * 정수 JDN(그레고리력 날짜 midday 규약)으로 환산한다.
 *
 * 검증 기준(외부 역서/레퍼런스 대조값):
 *   - 1949-10-01 → JDN 2433191 → 간지 甲子 (index 0)
 *   - 2000-01-01 → JDN 2451545 → 간지 戊午 (index 54)
 *   - 2024-01-01 → JDN 2460311 → 간지 甲子 (index 0)
 *   - 2024-02-10 → JDN 2460351 → 간지 甲辰 (index 40)
 */

import type { CivilDate } from "./civilDate";

/**
 * 그레고리력 날짜의 정수 JDN.
 * 1582-10-15 이후 그레고리력(=양력)에 대해서만 유효하다.
 */
export function julianDayNumber(year: number, month: number, day: number): number {
  if (month < 1 || month > 12) throw new Error(`잘못된 월입니다: ${month}`);
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

export function julianDayNumberOf(date: CivilDate): number {
  return julianDayNumber(date.year, date.month, date.day);
}

/** epoch ms (UTC) → JDN (정수, UTC 자정 기준). */
export function julianDayNumberFromEpochMs(epochMs: number): number {
  return Math.floor(epochMs / 86_400_000) + 2440588;
}

/** JDN → 그레고리력 날짜. */
export function civilDateFromJulianDayNumber(jdn: number): CivilDate {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}
