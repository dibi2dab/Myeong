/**
 * 해석 결과의 공통 형태.
 *
 * 원칙
 * 1. 모든 해석은 `[해석]` 문장과 `[분석 근거]` 목록을 **분리**해 함께 제시한다.
 * 2. 근거마다 고유 규칙 ID( RULE_XXX_NNN )와 발생 계층(원국/대운/세운/월운/일운)을
 *    붙여 드릴다운 체인을 따라갈 수 있게 한다.
 * 3. **점수·확률·숫자 등급은 화면에 내보내지 않는다.** 노출하는 것은
 *    기세(intensity)와 방향(direction)의 범주뿐이고, 그것조차 "참/거짓"이 아니라
 *    전통 명리학의 언어로 "두드러짐의 정도"를 나타낸다.
 */

import type { FiveElement } from "../constants/stems";
import type { Interaction } from "../interactions/interactions";
import type { PeriodKind } from "../periods/period";

/** 기세 — 화면에 노출되는 유일한 정도 표현. */
export type Intensity = "very_low" | "low" | "medium" | "high" | "very_high";

export const INTENSITY_LABELS: Readonly<Record<Intensity, string>> = Object.freeze({
  very_low: "두드러짐이 약함",
  low: "약간 두드러짐",
  medium: "보통",
  high: "뚜렷함",
  very_high: "매우 두드러짐",
});

/** 방향. "상승/하락"이 아니라 흐름의 형태로 표현한다. */
export type Direction = "상승" | "유지" | "하락" | "변화" | "중립";

/** 운세 항목 — 오늘의 운세 화면의 고정 순서. */
export type FortuneTopic =
  | "총운"
  | "재물운"
  | "직업·사업운"
  | "애정운"
  | "대인관계운"
  | "학업·성장운"
  | "건강운"
  | "이동·변화운";

export const FORTUNE_TOPICS: readonly FortuneTopic[] = [
  "총운",
  "재물운",
  "직업·사업운",
  "애정운",
  "대인관계운",
  "학업·성장운",
  "건강운",
  "이동·변화운",
] as const;

/** 근거가 나온 계층. 드릴다운 체인의 한 단계다. */
export type Layer = "원국" | "대운" | "세운" | "월운" | "일운";

/** 드릴다운 체인의 표시 순서 (오늘의 운세 → 원국). */
export const DRILLDOWN_CHAIN: readonly Layer[] = ["일운", "월운", "세운", "대운", "원국"] as const;

export function layerOfPeriod(kind: PeriodKind): Layer {
  switch (kind) {
    case "daeun":
      return "대운";
    case "seun":
      return "세운";
    case "wolun":
      return "월운";
    case "ilun":
      return "일운";
  }
}

export interface Evidence {
  /** 고유 규칙 ID. 예: RULE_MONEY_001 */
  ruleId: string;
  /** 근거 문장 (한 줄) */
  text: string;
  /** 어느 계층에서 나왔는가 */
  layer: Layer;
  /** 더 좁은 위치. 예: "월운 丙寅", "월지 庚寅" */
  detail: string;
  /** 오행이 관여한다면 그 오행 */
  element?: FiveElement;
  /** 이 근거가 가리키는 대상 기둥의 간지 (드릴다운 연결용) */
  ganZhi?: string;
  /** 이 근거를 만들어 낸 간(干支) 정보 */
  interaction?: Interaction;
}

export interface FortuneSection {
  topic: FortuneTopic;
  /** [해석] — 사람이 읽는 문장 */
  interpretation: string;
  /** [분석 근거] — 근거 보기에서 펼쳐지는 목록 */
  evidence: readonly Evidence[];
  intensity: Intensity;
  direction: Direction;
}

/** 주의점 — 위험 신호를 별도로 모은다. */
export interface Caution {
  ruleId: string;
  text: string;
  layer: Layer;
  detail: string;
  severity: 1 | 2 | 3;
}

export interface KeyPoint {
  ruleId: string;
  text: string;
  layer: Layer;
  detail: string;
  /** 이 요약이 어떤 항목의 기세를 끌어올렸는지 */
  topics: readonly FortuneTopic[];
}

export interface FortuneReading {
  dateLabel: string;
  sections: readonly FortuneSection[];
  cautions: readonly Caution[];
  keyPoints: readonly KeyPoint[];
  /** 시주 미상으로 해석이 제한될 때 노출되는 안내 */
  restrictions: readonly string[];
}
