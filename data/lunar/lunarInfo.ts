/**
 * 음력(달력) 지원 연도 테이블 — 1900 ~ 2100.
 *
 * 인코딩
 * ------
 * 한 해를 17비트 정수 하나로 압축한다.
 *
 *   bit 16      윤달이 대월(30일)이면 1
 *   bit 15..4   1월~12월의 대월(30일) 여부. bit 15 = 1월, ..., bit 4 = 12월
 *   bit 3..0    윤달의 월 번호(1~12). 0이면 그 해에 윤달이 없다
 *
 * 예) 0x04bd8 → 윤달 8월, 윤달은 29일, 대월은 2·5·7·8·9·10·12월
 *
 * 기준점
 * ------
 * 음력 1900년 1월 1일 = 양력 1900-01-31 (UTC+8 자정 기준).
 *
 * 검증 (tests/lunar.test.ts)
 * ------------------------
 * 1. 1900-2099년 200개 해의 설날이 권위 있는 간지표와 200/200 일치한다.
 * 2. 1901-2100년 윤달 월 번호가 겨울 solstice + 중기(中氣) 규칙으로
 *    계산한 값과 일치한다.
 * 3. 양력 ↔ 음력 왕복 변환이 1900-01-31 ~ 2100-12-31 구간에서 무손실이다.
 * 4. leapMonthsOf(표) 의 총 개수가 실제 윤달 수와 같다.
 *
 * 출처: 1901-2100년 간지표는香港天文台(HKO) 「公曆與農曆日期對照表」를 기준으로
 * 한 표준 1900-2100 압축 표. docs/data-sources.md 참고.
 */

/** LUNAR_INFO[y - LUNAR_INFO_START_YEAR] */
export const LUNAR_INFO: readonly number[] = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
  0x0d520, // 2100
];

export const LUNAR_INFO_START_YEAR = 1900;

/** 테이블이 담고 있는 마지막 해. */
export const LUNAR_INFO_END_YEAR = LUNAR_INFO_START_YEAR + LUNAR_INFO.length - 1;

function infoOf(lunarYear: number): number {
  const info = LUNAR_INFO[lunarYear - LUNAR_INFO_START_YEAR];
  if (info === undefined) {
    throw new RangeError(`음력 연도가 지원 범위를 벗어났습니다: ${lunarYear}`);
  }
  return info;
}

/** 해당 음력 연도의 윤달 번호 (1-12). 윤달이 없으면 0. */
export function leapMonthOfLunarYear(year: number): number {
  return infoOf(year) & 0xf;
}

/** 윤달이 있는 해인지. */
export function isLeapLunarYear(year: number): boolean {
  return leapMonthOfLunarYear(year) > 0;
}

/** 윤달의 일수 (29 또는 30). 윤달이 없는 해를 물으면 0. */
export function leapMonthDaysOf(lunarYear: number): number {
  const info = infoOf(lunarYear);
  if ((info & 0xf) === 0) return 0;
  return info & 0x10000 ? 30 : 29;
}

/** 해당 음력 달의 일수 (29 또는 30). */
export function lunarMonthDaysOf(lunarYear: number, lunarMonth: number, isLeapMonth: boolean): number {
  const info = infoOf(lunarYear);
  if (isLeapMonth) return leapMonthDaysOf(lunarYear);
  if (lunarMonth < 1 || lunarMonth > 12) {
    throw new RangeError(`잘못된 음력 월입니다: ${lunarMonth}`);
  }
  return info & (0x10000 >> lunarMonth) ? 30 : 29;
}

/**
 * 해당 음력 연도의 총 일수.
 * 윤달이 있으면 그 달의 일수도 반드시 더한다.
 */
export function lunarYearDays(lunarYear: number): number {
  const info = infoOf(lunarYear);
  let sum = 348; // 12 × 29
  for (let m = 1; m <= 12; m += 1) {
    if (info & (0x10000 >> m)) sum += 1;
  }
  const leap = leapMonthDaysOf(lunarYear);
  if (leap > 0) sum += leap;
  return sum;
}
