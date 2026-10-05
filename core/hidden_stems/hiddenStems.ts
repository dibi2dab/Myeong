/**
 * 지장간 (地藏干) — 지지 안에 감춰진 천간.
 *
 * 규칙 (RULE_HIDDEN_001, docs/calculation-rules.md)
 * - 각 지지는 고전 통월(三命通會)의 장간표를 사용한다.
 * - 세 글자이면 앞이 본기(本氣), 가운데가 중기(中氣), 뒤가 여기(餘氣)다.
 *   하나뿐인 지지는 본기만 가진다.
 * - 표는 아래 RAW 하나에서만 관리한다. (다른 장간표를 섞지 않는다)
 */

import {
  BRANCHES,
  STEMS,
  type EarthlyBranch,
  type FiveElement,
  type HeavenlyStem,
  type YinYang,
} from "../constants/stems";

export type HiddenLayer = "본기" | "중기" | "여기";

export interface HiddenStem {
  stem: HeavenlyStem;
  element: FiveElement;
  polarity: YinYang;
  layer: HiddenLayer;
  /** 기(氣)의 가중치 — 본기 1.0 / 중기 0.5 / 여기 0.3 */
  weight: number;
}

const RAW: Readonly<Record<EarthlyBranch, readonly HeavenlyStem[]>> = {
  子: ["癸"],
  丑: ["己", "癸", "辛"],
  寅: ["甲", "丙", "戊"],
  卯: ["乙"],
  辰: ["戊", "乙", "癸"],
  巳: ["丙", "戊", "庚"],
  午: ["丁", "己"],
  未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"],
  酉: ["辛"],
  戌: ["戊", "辛", "丁"],
  亥: ["壬", "甲"],
};

const LAYERS: readonly HiddenLayer[] = ["본기", "중기", "여기"];
const WEIGHTS: readonly number[] = [1, 0.5, 0.3];

const STEM_BY_CHAR: Readonly<Record<HeavenlyStem, { element: FiveElement; polarity: YinYang }>> =
  Object.freeze(
    STEMS.reduce(
      (acc, s) => {
        acc[s.char] = { element: s.element, polarity: s.polarity };
        return acc;
      },
      {} as Record<HeavenlyStem, { element: FiveElement; polarity: YinYang }>,
    ),
  );

const CACHE: Readonly<Record<string, readonly HiddenStem[]>> = Object.freeze(
  BRANCHES.reduce(
    (acc, b) => {
      acc[b.char] = RAW[b.char].map((stem, i) => ({
        stem,
        element: STEM_BY_CHAR[stem].element,
        polarity: STEM_BY_CHAR[stem].polarity,
        layer: LAYERS[i],
        weight: WEIGHTS[i],
      }));
      return acc;
    },
    {} as Record<string, readonly HiddenStem[]>,
  ),
);

/** 지지의 지장간 목록 (본기 → 중기 → 여기). */
export function hiddenStemsOf(branch: EarthlyBranch): readonly HiddenStem[] {
  const list = CACHE[branch];
  if (!list) throw new Error(`지장간을 찾을 수 없습니다: ${branch}`);
  return list;
}

/** 지지의 본기 지장간. */
export function principalHiddenStem(branch: EarthlyBranch): HiddenStem {
  return hiddenStemsOf(branch)[0];
}

/** 지지 장간에 포함된 천간 문자들의 압축 표기, 예: "癸" / "己癸辛". */
export function hiddenStemText(branch: EarthlyBranch): string {
  return hiddenStemsOf(branch)
    .map((h) => h.stem)
    .join("");
}
