/**
 * 음력 ↔ 양력 변환 (Calendar Engine).
 *
 * 기준
 * ----
 * - 음력월의 1일 = 그레고리력 날짜(UTC+8 기준일)의 첫 날.
 * - 변환 결과는 반드시 "양력 날짜"로 되돌려서 사주 계산에 넘긴다.
 *   절기 기준 월주·년주 계산은 음력 월이 아니라 양력(그레고리력) 날짜를 본다.
 * - 지원 범위: 1900-01-31 ~ 2100-12-31 (표준 1900-2100 음력표 기준).
 *
 * 윤달 처리는 "윤몇이 있는 달의 다음 달"에 삽입되는 규칙(표 자체가 이 정보를
 * 담고 있다)을 그대로 따른다. 2033년처럼 시간대 기준에 따라 윤월이 달라지는
 * 사례는 docs/calculation-rules.md 에 명시한다.
 */

import {
  addDays,
  compareCivilDate,
  differenceInDays,
  formatIsoDate,
  isValidSolarDate,
  type CivilDate,
} from "../calendar/civilDate";
import {
  LUNAR_INFO_END_YEAR,
  LUNAR_INFO_START_YEAR,
  isLeapLunarYear,
  leapMonthDaysOf,
  leapMonthOfLunarYear,
  lunarMonthDaysOf,
  lunarYearDays,
} from "../../data/lunar/lunarInfo";

export interface LunarDate {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-30 */
  day: number;
  isLeapMonth: boolean;
}

/** 음력 1900년 1월 1일의 양력 날짜. 테이블의 기준점. */
const LUNAR_EPOCH: CivilDate = { year: 1900, month: 1, day: 31 };

export const LUNAR_SUPPORT_START: CivilDate = LUNAR_EPOCH;

/** 지원 범위 끝. 표는 2100년까지지만 2100년 12월 일부가 2101년으로 넘어가므로 잘라낸다. */
export const LUNAR_SUPPORT_END: CivilDate = { year: 2100, month: 12, day: 31 };

/** 양력 -> 음력 결과 범위 밖일 때 사용되는 오류 코드. */
export class LunarConversionError extends Error {
  constructor(
    message: string,
    readonly code: "OUT_OF_RANGE" | "INVALID_SOLAR_DATE" | "INVALID_LUNAR_DATE",
  ) {
    super(message);
    this.name = "LunarConversionError";
  }
}

/**
 * 음력 달의 순서. 윤달이 있으면 해당 번호 뒤에 삽입된다.
 * 예: 윤달이 8월이면 [1..7, 8, 8(윤), 9, 10, 11, 12]
 */
function monthSequenceOf(lunarYear: number): { month: number; isLeapMonth: boolean }[] {
  const leap = leapMonthOfLunarYear(lunarYear);
  const seq: { month: number; isLeapMonth: boolean }[] = [];
  for (let m = 1; m <= 12; m += 1) {
    seq.push({ month: m, isLeapMonth: false });
    if (leap === m) seq.push({ month: m, isLeapMonth: true });
  }
  return seq;
}

/** 음력 날짜 -> 양력 날짜. */
export function lunarToSolar(lunar: LunarDate): CivilDate {
  const { year, month, day, isLeapMonth } = lunar;
  if (!Number.isInteger(year) || year < LUNAR_INFO_START_YEAR || year > LUNAR_INFO_END_YEAR) {
    throw new LunarConversionError(
      `음력 연도가 지원 범위(1900-2100)를 벗어났습니다: ${year}`,
      "OUT_OF_RANGE",
    );
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new LunarConversionError(`잘못된 음력 월입니다: ${month}`, "INVALID_LUNAR_DATE");
  }
  if (!Number.isInteger(day) || day < 1) {
    throw new LunarConversionError(`잘못된 음력 일입니다: ${day}`, "INVALID_LUNAR_DATE");
  }
  const leap = leapMonthOfLunarYear(year);
  if (isLeapMonth && leap !== month) {
    throw new LunarConversionError(
      leap === 0 ? `${year}년은 윤달이 없는 해입니다.` : `${year}년은 ${leap}월이 윤달인 해입니다.`,
      "INVALID_LUNAR_DATE",
    );
  }
  const monthDays = lunarMonthDaysOf(year, month, isLeapMonth);
  if (day > monthDays) {
    throw new LunarConversionError(
      `${year}년 ${isLeapMonth ? "윤" : ""}${month}월은 ${monthDays}일까지입니다.`,
      "INVALID_LUNAR_DATE",
    );
  }

  let offset = day - 1;
  for (let y = LUNAR_INFO_START_YEAR; y < year; y += 1) offset += lunarYearDays(y);
  for (const item of monthSequenceOf(year)) {
    if (item.month === month && item.isLeapMonth === isLeapMonth) break;
    offset += lunarMonthDaysOf(year, item.month, item.isLeapMonth);
  }
  const solar = addDays(LUNAR_EPOCH, offset);
  if (compareCivilDate(solar, LUNAR_SUPPORT_END) > 0) {
    throw new LunarConversionError(
      `음력 ${year}년 ${month}월${isLeapMonth ? "(윤달) " : " "}${day}일은 지원 범위(1900-01-31 ~ 2100-12-31)를 벗어납니다.`,
      "OUT_OF_RANGE",
    );
  }
  return solar;
}

/** 양력 날짜 -> 음력 날짜. */
export function solarToLunar(date: CivilDate): LunarDate {
  if (!isValidSolarDate(date.year, date.month, date.day)) {
    throw new LunarConversionError(
      `잘못된 양력 날짜입니다: ${formatIsoDate(date)}`,
      "INVALID_SOLAR_DATE",
    );
  }
  if (
    compareCivilDate(date, LUNAR_SUPPORT_START) < 0 ||
    compareCivilDate(date, LUNAR_SUPPORT_END) > 0
  ) {
    throw new LunarConversionError(
      `지원 범위(1900-01-31 ~ 2100-12-31) 밖의 날짜입니다: ${formatIsoDate(date)}`,
      "OUT_OF_RANGE",
    );
  }

  let remaining = differenceInDays(date, LUNAR_EPOCH);
  let year = LUNAR_INFO_START_YEAR;
  while (year <= LUNAR_INFO_END_YEAR) {
    const yearLength = lunarYearDays(year);
    if (remaining < yearLength) break;
    remaining -= yearLength;
    year += 1;
  }
  if (year > LUNAR_INFO_END_YEAR) {
    throw new LunarConversionError(
      `음력 변환에 실패했습니다: ${formatIsoDate(date)}`,
      "OUT_OF_RANGE",
    );
  }

  for (const item of monthSequenceOf(year)) {
    const length = lunarMonthDaysOf(year, item.month, item.isLeapMonth);
    if (remaining < length) {
      return { year, month: item.month, day: remaining + 1, isLeapMonth: item.isLeapMonth };
    }
    remaining -= length;
  }
  throw new LunarConversionError(
    `음력 변환에 실패했습니다: ${formatIsoDate(date)}`,
    "OUT_OF_RANGE",
  );
}

/** 해당 음력 연도의 윤달 번호 (없으면 0) 및 관련 표 함수 재수출. */
export {
  isLeapLunarYear,
  leapMonthDaysOf,
  leapMonthOfLunarYear,
  lunarMonthDaysOf,
  lunarYearDays,
  LUNAR_INFO_END_YEAR,
  LUNAR_INFO_START_YEAR,
};

/** 음력 날짜 표시용 문자열. */
export function formatLunarDate(lunar: LunarDate): string {
  return `${lunar.year}년 ${lunar.isLeapMonth ? "윤" : ""}${lunar.month}월 ${lunar.day}일`;
}
