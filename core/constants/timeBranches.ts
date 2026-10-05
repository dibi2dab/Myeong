/**
 * 12시진 (十二時辰) 상수.
 *
 * 출생 입력은 "시진" 단위이므로 정밀 시각을 알 수 없다. 본 프로젝트는
 * 시진마다 하나의 **대표 순간**(중시각)을 정해 모든 계산을 진행한다.
 * (docs/calculation-rules.md "자시 구분" 참조)
 */

import type { EarthlyBranch } from "./stems";

export interface TimeBranchInfo {
  /** 0-11, 자 = 0 */
  index: number;
  branch: EarthlyBranch;
  /** 한국어 이름 (子時 → 자시) */
  korean: string;
  hanja: string;
  /** 시작 시각 (KST 벽시계, 0-23) */
  startHour: number;
  /** 끝 시각 (KST 벽시계, 미포함) */
  endHour: number;
  /** 범위 표기용, 예: "23:00 – 01:00" */
  range: string;
}

/** 12시진. 자시(子時)는 23:00 ~ 01:00 으로 자정을 가로지른다. */
export const TIME_BRANCHES: readonly TimeBranchInfo[] = [
  { index: 0, branch: "子", korean: "자시", hanja: "子時", startHour: 23, endHour: 1, range: "23:00 – 01:00" },
  { index: 1, branch: "丑", korean: "축시", hanja: "丑時", startHour: 1, endHour: 3, range: "01:00 – 03:00" },
  { index: 2, branch: "寅", korean: "인시", hanja: "寅時", startHour: 3, endHour: 5, range: "03:00 – 05:00" },
  { index: 3, branch: "卯", korean: "묘시", hanja: "卯時", startHour: 5, endHour: 7, range: "05:00 – 07:00" },
  { index: 4, branch: "辰", korean: "진시", hanja: "辰時", startHour: 7, endHour: 9, range: "07:00 – 09:00" },
  { index: 5, branch: "巳", korean: "사시", hanja: "巳時", startHour: 9, endHour: 11, range: "09:00 – 11:00" },
  { index: 6, branch: "午", korean: "오시", hanja: "午時", startHour: 11, endHour: 13, range: "11:00 – 13:00" },
  { index: 7, branch: "未", korean: "미시", hanja: "未時", startHour: 13, endHour: 15, range: "13:00 – 15:00" },
  { index: 8, branch: "申", korean: "신시", hanja: "申時", startHour: 15, endHour: 17, range: "15:00 – 17:00" },
  { index: 9, branch: "酉", korean: "유시", hanja: "酉時", startHour: 17, endHour: 19, range: "17:00 – 19:00" },
  { index: 10, branch: "戌", korean: "술시", hanja: "戌時", startHour: 19, endHour: 21, range: "19:00 – 21:00" },
  { index: 11, branch: "亥", korean: "해시", hanja: "亥時", startHour: 21, endHour: 23, range: "21:00 – 23:00" },
] as const;

/** "출생시간 모름" 을 나타내는 별도 값. */
export const UNKNOWN_TIME_LABEL = "출생시간 모름";

/** KST 벽시계 시각(시) → 시진 인덱스. 23시와 0시 모두 자시다. */
export function timeBranchFromHour(hour: number): number {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`잘못된 시각입니다: ${hour}`);
  }
  return Math.floor(((hour + 1) % 24) / 2);
}

export function timeBranchInfo(index: number): TimeBranchInfo {
  const t = TIME_BRANCHES[index];
  if (!t) throw new Error(`잘못된 시진입니다: ${index}`);
  return t;
}

/** 시진의 대표 시각(중시각, 0-23). 자시는 0시(만자시)를 대표로 삼는다. */
export function representativeHour(index: number): number {
  const t = timeBranchInfo(index);
  if (t.index === 0) return 0;
  return t.startHour + 1;
}

/**
 * 자시 구분 방식.
 * - "자정": 일주가 자정 00:00에 바뀐다. 자시를 00:00–01:00(만자시)으로 본다.
 * - "조자시": 일주가 23:00에 바뀐다. 자시를 23:00–24:00(조자시)으로 본다.
 */
export type ZiHourMode = "자정" | "조자시";

export const ZI_HOUR_MODES: readonly ZiHourMode[] = ["자정", "조자시"] as const;

export const ZI_HOUR_MODE_LABELS: Readonly<Record<ZiHourMode, string>> = Object.freeze({
  자정: "자정 (00:00–01:00, 만자시)",
  조자시: "조자시 (23:00–24:00)",
});

export const ZI_HOUR_MODE_DESCRIPTIONS: Readonly<Record<ZiHourMode, string>> = Object.freeze({
  자정: "자정을 지나서 01:00 이전에 태어난 경우로 계산합니다.",
  조자시: "23:00을 지나서 자정 이전에 태어난 경우로 계산합니다. 자정 전에 태어난 경우 일주가 다음 날로 넘어갑니다.",
});
