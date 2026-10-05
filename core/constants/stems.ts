/**
 * 천간 · 지지 · 오행 상수.
 *
 * 이 파일은 "규칙"이 아니라 "표준 데이터"다.
 * 모든 인덱스(0 기반)는 이후 모든 계산 모듈의 기준이 되므로 여기서만 정의한다.
 */

export type HeavenlyStem = "甲" | "乙" | "丙" | "丁" | "戊" | "己" | "庚" | "辛" | "壬" | "癸";
export type EarthlyBranch = "子" | "丑" | "寅" | "卯" | "辰" | "巳" | "午" | "未" | "申" | "酉" | "戌" | "亥";
export type FiveElement = "木" | "火" | "土" | "金" | "水";
export type YinYang = "양" | "음";

export interface StemInfo {
  /** 천간 한자 */
  char: HeavenlyStem;
  /** 한자 읽기 (한자음) */
  hanja: string;
  /** 한국어 자모 이름 */
  korean: string;
  /** 오행 */
  element: FiveElement;
  /** 음양 */
  polarity: YinYang;
}

export interface BranchInfo {
  /** 지지 한자 */
  char: EarthlyBranch;
  /** 한국어 자모 이름 */
  korean: string;
  /** 오행 (지지 본기의 오행) */
  element: FiveElement;
  /** 음양 */
  polarity: YinYang;
  /** 오행의 계절적 성격 (용신·월령 판단에 사용) */
  season: Season;
}

/** 12지지가 속하는 계절 구분. 旺(가장 강함) 오행은 `SEASON_WANG` 한 벌로 관리한다. */
export type Season =
  | "spring"
  | "late-spring"
  | "summer"
  | "late-summer"
  | "autumn"
  | "late-autumn"
  | "winter"
  | "late-winter";

export const STEMS: readonly StemInfo[] = [
  { char: "甲", hanja: "갑", korean: "갑목", element: "木", polarity: "양" },
  { char: "乙", hanja: "을", korean: "을목", element: "木", polarity: "음" },
  { char: "丙", hanja: "병", korean: "병화", element: "火", polarity: "양" },
  { char: "丁", hanja: "정", korean: "정화", element: "火", polarity: "음" },
  { char: "戊", hanja: "무", korean: "무토", element: "土", polarity: "양" },
  { char: "己", hanja: "기", korean: "기도", element: "土", polarity: "음" },
  { char: "庚", hanja: "경", korean: "경금", element: "金", polarity: "양" },
  { char: "辛", hanja: "신", korean: "신금", element: "金", polarity: "음" },
  { char: "壬", hanja: "임", korean: "임수", element: "水", polarity: "양" },
  { char: "癸", hanja: "계", korean: "계수", element: "水", polarity: "음" },
] as const;

export const BRANCHES: readonly BranchInfo[] = [
  { char: "子", korean: "자", element: "水", polarity: "양", season: "winter" },
  { char: "丑", korean: "축", element: "土", polarity: "음", season: "late-winter" },
  { char: "寅", korean: "인", element: "木", polarity: "양", season: "spring" },
  { char: "卯", korean: "묘", element: "木", polarity: "음", season: "spring" },
  { char: "辰", korean: "진", element: "土", polarity: "양", season: "late-spring" },
  { char: "巳", korean: "사", element: "火", polarity: "음", season: "summer" },
  { char: "午", korean: "오", element: "火", polarity: "양", season: "summer" },
  { char: "未", korean: "미", element: "土", polarity: "음", season: "late-summer" },
  { char: "申", korean: "신", element: "金", polarity: "양", season: "autumn" },
  { char: "酉", korean: "유", element: "金", polarity: "음", season: "autumn" },
  { char: "戌", korean: "술", element: "土", polarity: "양", season: "late-autumn" },
  { char: "亥", korean: "해", element: "水", polarity: "음", season: "late-winter" },
] as const;

export const FIVE_ELEMENTS: readonly FiveElement[] = ["木", "火", "土", "金", "水"] as const;

/** 오행의 한국어 이름과 화면 색 (표기용 — 계산에는 한자만 쓴다). */
export const ELEMENT_LABELS: Readonly<Record<FiveElement, { korean: string; hanja: string; color: string }>> =
  Object.freeze({
    木: { korean: "목", hanja: "木", color: "#2f7d5d" },
    火: { korean: "화", hanja: "火", color: "#b3402f" },
    土: { korean: "토", hanja: "土", color: "#8a6d3b" },
    金: { korean: "금", hanja: "金", color: "#7d828b" },
    水: { korean: "수", hanja: "水", color: "#2f5d8a" },
  });

/** 계절별 旺(가장 강함) 오행 — 月令 판단의 단일 표. */
export const SEASON_WANG: Readonly<Record<Season, FiveElement>> = Object.freeze({
  spring: "木",
  "late-spring": "木",
  summer: "火",
  "late-summer": "土",
  autumn: "金",
  "late-autumn": "金",
  winter: "水",
  "late-winter": "水",
});

/**
 * 旺相休囚死 표 — 한 달의 계절 기운이 다섯 오행에 어떻게 배어 있는가.
 *
 * 전승(轉生) 관계로는 5단계가 단순 순환을 이루지 않으므로, 고전 표를
 * **데이터**로 그대로 둔다. (RULE_MOONCMD_001)
 *
 * | 계절 | 旺 | 相 | 休 | 囚 | 死 |
 * |------|----|----|----|----|----|
 * | 봄   | 木 | 火 | 水 | 金 | 土 |
 * | 여름 | 火 | 土 | 木 | 水 | 金 |
 * | 늦여름| 土 | 金 | 火 | 木 | 水 |
 * | 가을 | 金 | 水 | 土 | 火 | 木 |
 * | 겨울 | 水 | 木 | 金 | 火 | 土 |
 */
export type MoonCommandKey = "相" | "休" | "囚" | "死";

export const MOON_COMMAND_TABLE: Readonly<Record<FiveElement, Readonly<Record<MoonCommandKey, FiveElement>>>> =
  Object.freeze({
    木: { 相: "火", 休: "水", 囚: "金", 死: "土" },
    火: { 相: "土", 休: "木", 囚: "水", 死: "金" },
    土: { 相: "金", 休: "火", 囚: "木", 死: "水" },
    金: { 相: "水", 休: "土", 囚: "火", 死: "木" },
    水: { 相: "木", 休: "金", 囚: "火", 死: "土" },
  });

/** 천간 인덱스 (0 = 甲) */
export const STEM_INDEX: Readonly<Record<HeavenlyStem, number>> = Object.freeze(
  STEMS.reduce(
    (acc, s, i) => {
      acc[s.char] = i;
      return acc;
    },
    {} as Record<HeavenlyStem, number>,
  ),
);

/** 지지 인덱스 (0 = 子) */
export const BRANCH_INDEX: Readonly<Record<EarthlyBranch, number>> = Object.freeze(
  BRANCHES.reduce(
    (acc, b, i) => {
      acc[b.char] = i;
      return acc;
    },
    {} as Record<EarthlyBranch, number>,
  ),
);

export function stemInfo(stem: HeavenlyStem): StemInfo {
  return STEMS[STEM_INDEX[stem]];
}

export function branchInfo(branch: EarthlyBranch): BranchInfo {
  return BRANCHES[BRANCH_INDEX[branch]];
}

export function stemElement(stem: HeavenlyStem): FiveElement {
  return STEMS[STEM_INDEX[stem]].element;
}

export function branchElement(branch: EarthlyBranch): FiveElement {
  return BRANCHES[BRANCH_INDEX[branch]].element;
}

export function stemPolarity(stem: HeavenlyStem): YinYang {
  return STEMS[STEM_INDEX[stem]].polarity;
}

export function branchPolarity(branch: EarthlyBranch): YinYang {
  return BRANCHES[BRANCH_INDEX[branch]].polarity;
}

/** 오행의 상생 관계: A가 B를 생한다. (木→火→土→金→水→木) */
export const GENERATES: Readonly<Record<FiveElement, FiveElement>> = Object.freeze({
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
});

/** 오행의 상극 관계: A가 B를 극한다. (木→土→水→火→金→木) */
export const CONTROLS: Readonly<Record<FiveElement, FiveElement>> = Object.freeze({
  木: "土",
  土: "水",
  水: "火",
  火: "金",
  金: "木",
});

/** B를 생하는 오행 (= A를 생하는 오행). */
export function generatedBy(a: FiveElement): FiveElement {
  return FIVE_ELEMENTS.find((e) => GENERATES[e] === a)!;
}

/** A를 극하는 오행. */
export function controlledBy(a: FiveElement): FiveElement {
  return FIVE_ELEMENTS.find((e) => CONTROLS[e] === a)!;
}

export function generates(a: FiveElement, b: FiveElement): boolean {
  return GENERATES[a] === b;
}

export function controls(a: FiveElement, b: FiveElement): boolean {
  return CONTROLS[a] === b;
}

/**
 * 오행 관계 — **항상 `elementRelation(일간, 대상)` 순서**로 부른다.
 * 즉 `source` 가 곧 "나"이고 `target` 이 "상대"다.
 *
 * | 값 | 뜻 | 십신 계열 |
 * |----|-----|-----------|
 * | 비화 | source 와 target 이 같은 오행 | 비겁 |
 * | 식상 | source 가 target 을 생한다 (我生) | 식상 |
 * | 인성 | target 가 source 를 생한다 (生我) | 인성 |
 * | 재성 | source 가 target 을 극한다 (我剋) | 재성 |
 * | 관살 | target 가 source 를 극한다 (剋我) | 관성 |
 */
export type ElementRelation = "비화" | "식상" | "인성" | "재성" | "관살";

/** `elementRelation(일간, 대상)` — 오행 관계. */
export function elementRelation(source: FiveElement, target: FiveElement): ElementRelation {
  if (source === target) return "비화";
  if (generates(source, target)) return "식상";
  if (generates(target, source)) return "인성";
  if (controls(source, target)) return "재성";
  return "관살";
}

/** 오행을 0-4 인덱스로 (목=0, 화=1, 토=2, 금=3, 수=4) */
export function elementIndex(element: FiveElement): number {
  return FIVE_ELEMENTS.indexOf(element);
}

/** 오행 0-4 인덱스를 오행으로. */
export function elementFromIndex(index: number): FiveElement {
  const e = FIVE_ELEMENTS[index];
  if (!e) throw new Error(`잘못된 오행 인덱스: ${index}`);
  return e;
}
