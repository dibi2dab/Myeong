/**
 * 십신 (十神) — 일간과 다른 천간·지지와의 관계.
 *
 * 규칙 (RULE_TENGOD_001, docs/calculation-rules.md)
 * - 대상과 일간의 오행 관계(비화/식상/인성/재성/관살)와 음양(같은가 다른가)으로
 *   10개의 십신을 결정한다. 이 프로젝트는 이 **하나의 규칙**만 사용한다.
 */

import {
  elementRelation,
  STEMS,
  type FiveElement,
  type HeavenlyStem,
  type YinYang,
} from "../constants/stems";

export type TenGod =
  | "비견" | "겁재" | "식신" | "상관" | "편재" | "정재" | "편관" | "정관" | "편인" | "정인";

export interface TenGodInfo {
  key: TenGod;
  korean: string;
  hanja: string;
  /** 본 기(本氣) · 중 기(中氣) · 여 기(餘氣) 구분 */
  layer: "본기" | "중기" | "여기";
  /** 이 십신이 나타내는 영역 (해석 문구에서 사용) */
  domain: string;
}

export const TEN_GODS: readonly TenGodInfo[] = [
  { key: "비견", korean: "비견", hanja: "比肩", layer: "본기", domain: "자아·동료·독립심" },
  { key: "겁재", korean: "겁재", hanja: "劫財", layer: "중기", domain: "경쟁·돌발·분배" },
  { key: "식신", korean: "식신", hanja: "食神", layer: "여기", domain: "재능·표현·먹이·여유" },
  { key: "상관", korean: "상관", hanja: "傷官", layer: "본기", domain: "표현력·반항·창작·말" },
  { key: "편재", korean: "편재", hanja: "偏財", layer: "중기", domain: "투자·변동수·경험적 수입" },
  { key: "정재", korean: "정재", hanja: "正財", layer: "여기", domain: "고정 수입·저축·안정된 자원" },
  { key: "편관", korean: "편관", hanja: "偏官", layer: "본기", domain: "압박·권위·위험·집중력" },
  { key: "정관", korean: "정관", hanja: "正官", layer: "중기", domain: "규율·직위·책임·사회적 인정" },
  { key: "편인", korean: "편인", hanja: "偏印", layer: "여기", domain: "비정통 학습·직관·고독" },
  { key: "정인", korean: "정인", hanja: "正印", layer: "본기", domain: "보호·문서·학문·어머니" },
] as const;

export const TEN_GOD_BY_KEY: Readonly<Record<TenGod, TenGodInfo>> = Object.freeze(
  TEN_GODS.reduce(
    (acc, g) => {
      acc[g.key] = g;
      return acc;
    },
    {} as Record<TenGod, TenGodInfo>,
  ),
);

const TEN_GOD_SET: ReadonlySet<string> = new Set(TEN_GODS.map((g) => g.key));

export function isTenGod(value: string): value is TenGod {
  return TEN_GOD_SET.has(value);
}

/** 십신이 속하는 오행 계열 (비겁/식상/재성/관성/인성). */
export type TenGodGroup = "비겁" | "식상" | "재성" | "관성" | "인성";

export const TEN_GOD_GROUP: Readonly<Record<TenGod, TenGodGroup>> = Object.freeze({
  비견: "비겁",
  겁재: "비겁",
  식신: "식상",
  상관: "식상",
  편재: "재성",
  정재: "재성",
  편관: "관성",
  정관: "관성",
  편인: "인성",
  정인: "인성",
} as Record<TenGod, TenGodGroup>);

export function tenGodGroup(god: TenGod): TenGodGroup {
  return TEN_GOD_GROUP[god];
}

function polarityOf(stem: HeavenlyStem): YinYang {
  return STEMS.find((s) => s.char === stem)!.polarity;
}

function elementOf(stem: HeavenlyStem): FiveElement {
  return STEMS.find((s) => s.char === stem)!.element;
}

/**
 * 일간 `dayStem` 에 대한 `targetStem` 의 십신.
 *
 * `elementRelation(일간, 대상)` 기준:
 *   비화 = 비겁 / 식상(내가 생함) / 재성(내가 극함)
 *   / 관살(나를 극함) / 인성(나를 생함)
 *   같은 음양이면 偏(편), 다른 음양이면 正(정).
 */
export function tenGodOfStem(dayStem: HeavenlyStem, targetStem: HeavenlyStem): TenGod {
  return tenGodOfElement(dayStem, elementOf(targetStem), polarityOf(targetStem));
}

/** 오행·음양만으로 십신을 구한다 (지장간의 십신 계산에 사용). */
export function tenGodOfElement(
  dayStem: HeavenlyStem,
  targetElement: FiveElement,
  targetPolarity: YinYang,
): TenGod {
  const samePolarity = polarityOf(dayStem) === targetPolarity;
  switch (elementRelation(elementOf(dayStem), targetElement)) {
    case "비화":
      return samePolarity ? "비견" : "겁재";
    case "식상":
      return samePolarity ? "식신" : "상관";
    case "재성":
      return samePolarity ? "편재" : "정재";
    case "관살":
      return samePolarity ? "편관" : "정관";
    case "인성":
    default:
      return samePolarity ? "편인" : "정인";
  }
}
