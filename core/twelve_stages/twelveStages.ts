/**
 * 십이운성 (十二運星) — 일간이 각 지지를 거치는 12단계.
 *
 * 규칙 (RULE_STAGE_001, docs/calculation-rules.md)
 * - 양간(甲丙戊庚壬)은 순행, 음간(乙丁己辛癸)은 역행한다.
 * - 장생(長生)의 시작 지지는 아래 표 하나로 고정한다.
 */

import { BRANCHES, type EarthlyBranch, type HeavenlyStem } from "../constants/stems";

export type TwelveStageName =
  | "장생" | "목욕" | "관대" | "임관" | "제왕" | "쇠"
  | "병" | "사" | "묘" | "절" | "태" | "양";

export interface TwelveStageInfo {
  key: TwelveStageName;
  korean: string;
  hanja: string;
  /** 0 = 장생 … 11 = 양 */
  step: number;
  /** 기(氣)의 활력 — 오행 강약 판단의 보조 기준 */
  vitality: number;
  description: string;
}

export const TWELVE_STAGES: readonly TwelveStageInfo[] = [
  { key: "장생", korean: "장생", hanja: "長生", step: 0, vitality: 0.6, description: "태어남·시작의 기운" },
  { key: "목욕", korean: "목욕", hanja: "沐浴", step: 1, vitality: 0.3, description: "불안정·초기 변화" },
  { key: "관대", korean: "관대", hanja: "冠帶", step: 2, vitality: 0.5, description: "성장·사회 진출 준비" },
  { key: "임관", korean: "임관", hanja: "臨官", step: 3, vitality: 0.8, description: "직위 획득·실력 인정" },
  { key: "제왕", korean: "제왕", hanja: "帝旺", step: 4, vitality: 1, description: "최고의 힘·전성기" },
  { key: "쇠", korean: "쇠", hanja: "衰", step: 5, vitality: 0.6, description: "기운이 기울기 시작" },
  { key: "병", korean: "병", hanja: "病", step: 6, vitality: 0.4, description: "약해짐·회복이 필요" },
  { key: "사", korean: "사", hanja: "死", step: 7, vitality: 0.2, description: "정지·막힘" },
  { key: "묘", korean: "묘", hanja: "墓", step: 8, vitality: 0.3, description: "저장·은폐·모임" },
  { key: "절", korean: "절", hanja: "絶", step: 9, vitality: 0.1, description: "끊김·소멸 직전" },
  { key: "태", korean: "태", hanja: "胎", step: 10, vitality: 0.3, description: "다시 태어남의 씨" },
  { key: "양", korean: "양", hanja: "養", step: 11, vitality: 0.5, description: "양육·준비" },
] as const;

const STAGE_BY_STEP: readonly TwelveStageInfo[] = TWELVE_STAGES;

/** 이름 → 정보. (표기 모듈이 이름만 받아 한자 표기를 붙일 때 쓴다) */
export const TWELVE_STAGE_BY_NAME: Readonly<Record<TwelveStageName, TwelveStageInfo>> = Object.freeze(
  TWELVE_STAGES.reduce(
    (acc, s) => {
      acc[s.key] = s;
      return acc;
    },
    {} as Record<TwelveStageName, TwelveStageInfo>,
  ),
);

const LONG_LIFE_BRANCH: Readonly<Record<HeavenlyStem, EarthlyBranch>> = {
  甲: "亥",
  乙: "午",
  丙: "寅",
  丁: "酉",
  戊: "寅",
  己: "酉",
  庚: "巳",
  辛: "子",
  壬: "申",
  癸: "卯",
};

const BRANCH_INDEX_BY_CHAR: Readonly<Record<string, number>> = Object.freeze(
  BRANCHES.reduce(
    (acc, b, i) => {
      acc[b.char] = i;
      return acc;
    },
    {} as Record<string, number>,
  ),
);

/** 양간(甲丙戊庚壬)이면 true. */
/** 등록된 십이운성 이름만 참. (표기 모듈이 검증할 때 쓴다) */
export function isTwelveStageName(value: string): value is TwelveStageName {
  return Object.hasOwn(TWELVE_STAGE_BY_NAME, value);
}

export function isYangStem(stem: HeavenlyStem): boolean {
  return ["甲", "丙", "戊", "庚", "壬"].includes(stem);
}

const CACHE = new Map<string, TwelveStageInfo>();

/** 일간 `dayStem` 이 지지 `branch` 에서 갖는 십이운성. */
export function twelveStageOf(dayStem: HeavenlyStem, branch: EarthlyBranch): TwelveStageInfo {
  const key = `${dayStem}${branch}`;
  const cached = CACHE.get(key);
  if (cached) return cached;
  const start = BRANCH_INDEX_BY_CHAR[LONG_LIFE_BRANCH[dayStem]];
  const target = BRANCH_INDEX_BY_CHAR[branch];
  const forward = isYangStem(dayStem);
  const raw = forward ? target - start : start - target;
  const step = ((raw % 12) + 12) % 12;
  const stage = STAGE_BY_STEP[step];
  CACHE.set(key, stage);
  return stage;
}
