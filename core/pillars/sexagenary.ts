/**
 * 간지(干支) 60 조합 유틸리티.
 *
 * 60간지 = 천간 10 × 지지 12 의 최소공배수(60). 인덱스는 甲子 = 0.
 * 이 프로젝트의 모든 간지 계산은 이 인덱스를 공통으로 쓴다.
 */

import { BRANCHES, STEMS, type EarthlyBranch, type HeavenlyStem } from "../constants/stems";

export const SEXAGENARY_COUNT = 60;

export type GanZhi = {
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  /** 甲子 = 0 … 癸亥 = 59 */
  index: number;
};

/** 인덱스 → 간지 */
export function ganZhiFromIndex(index: number): GanZhi {
  const i = ((index % SEXAGENARY_COUNT) + SEXAGENARY_COUNT) % SEXAGENARY_COUNT;
  return { stem: STEMS[i % 10].char, branch: BRANCHES[i % 12].char, index: i };
}

/** 60간지 인덱스의 천간 문자. */
export function stemOfIndex(index: number): HeavenlyStem {
  return STEMS[((index % 10) + 10) % 10].char;
}

/** 60간지 인덱스의 지지 문자. */
export function branchOfIndex(index: number): EarthlyBranch {
  return BRANCHES[((index % 12) + 12) % 12].char;
}

/** 천간·지지의 음양이 같은 간지만 true. */
export function isYangGanZhi(stem: HeavenlyStem, branch: EarthlyBranch): boolean {
  const sameStem = STEMS.findIndex((s) => s.char === stem);
  const sameBranch = BRANCHES.findIndex((b) => b.char === branch);
  return sameStem % 2 === sameBranch % 2;
}

/** "庚寅" 형태의 표시 문자열. */
export function ganZhiText(stem: HeavenlyStem, branch: EarthlyBranch): string {
  return `${stem}${branch}`;
}

/** 60간지 목록 (원국·대운 표기에 사용). */
export const SEXAGENARY_CYCLE: readonly GanZhi[] = Array.from({ length: SEXAGENARY_COUNT }, (_, i) =>
  ganZhiFromIndex(i),
);
