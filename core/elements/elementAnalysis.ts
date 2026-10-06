/**
 * 오행 해석 시스템 (지시 §5–12)
 *
 * 단순 비율(%)을 넘어 사주 전체와의 관계 중심으로 해석한다.
 * 점수나 "무조건 좋음/나쁨"을 쓰지 않고, 관계(비화·상생·상극)와 월령·계절·
 * 일간 강약을 종합해 상태와 역할을 문장으로 제시한다.
 */

import { elementRelation, type FiveElement } from "../constants/stems";
import type { FourPillars } from "../pillars/fourPillars";
import type { ElementDistribution, DayMasterVerdict } from "./elementBalance";
import { dayMasterStrength, ELEMENT_KOREAN, moonCommandOf } from "./elementBalance";

export type ElementState =
  | "부족"
  | "다소부족"
  | "균형"
  | "다소강함"
  | "강함"
  | "과다";

export interface ElementRole {
  element: FiveElement;
  ratio: number;
  state: ElementState;
  role: string;
  help: string;
  caution: string;
  note: string;
}

export interface ElementAnalysis {
  roles: readonly ElementRole[];
  summary: string;
  verdictNote: string;
}

const STATE_THRESHOLDS: Record<ElementState, number> = {
  부족: 8,
  다소부족: 12,
  균형: 20,
  다소강함: 26,
  강함: 32,
  과다: 40,
};

function classify(ratio: number, isDayMaster: boolean, verdict: DayMasterVerdict): ElementState {
  // 일간 오행은 조금 더 관대하게 본다 (자기 힘은 당연히 필요)
  let r = ratio;
  if (isDayMaster && verdict === "신강") r = Math.min(ratio, 35);
  if (isDayMaster && verdict === "신약") r = Math.max(ratio, 12);

  if (r < STATE_THRESHOLDS.부족) return "부족";
  if (r < STATE_THRESHOLDS.다소부족) return "다소부족";
  if (r < STATE_THRESHOLDS.균형) return "균형";
  if (r < STATE_THRESHOLDS.다소강함) return "다소강함";
  if (r < STATE_THRESHOLDS.강함) return "강함";
  return "과다";
}

export function analyzeElements(
  chart: FourPillars,
  distribution: ElementDistribution,
): ElementAnalysis {
  const strength = dayMasterStrength(chart, distribution);
  const dmEl = strength.element;
  const moon = moonCommandOf(chart.month.branch);

  const roles: ElementRole[] = distribution.contributions.map((c) => {
    const state = classify(c.ratio, c.element === dmEl, strength.verdict);
    const rel = elementRelation(dmEl, c.element) as any;

    // 관계 중심 설명
    let role = `${ELEMENT_KOREAN[c.element]}의 기운이 원국에서 어떻게 작용하는지 살피는 기준 중 하나로, 단순히 양만으로 좋고 나쁜 게 아니다.`;
    if (rel === "비화") role = `${ELEMENT_KOREAN[c.element]}는 일간(${ELEMENT_KOREAN[dmEl]})과 비견·겁재 계열로, 자아·동료·버티는 힘과 관련된다.`;
    else if (rel === "인성") role = `${ELEMENT_KOREAN[c.element]}는 일간을 보호·지지하는 성향이 있어, 현실적인 도움으로 작용할 수 있다.`;
    else if (rel === "식상") role = `${ELEMENT_KOREAN[c.element]}는 일간의 능력을 표현·소비하는 작용으로, 재능·표현력과 연관된다.`;
    else if (rel === "재성") role = `${ELEMENT_KOREAN[c.element]}는 일간에게 자원을 빼앗는 성향이 있어, 재물 관련 흐름에서 주의 깊게 본다.`;
    else if (rel === "관살") role = `${ELEMENT_KOREAN[c.element]}는 일간을 제약하는 성향이 있어, 책임·규율과 연관된다.`;
    else if (rel === "상생") role = `${ELEMENT_KOREAN[c.element]}는 일간에게 생기를 주는 쪽으로 작용한다.`;
    else if (rel === "상극") role = `${ELEMENT_KOREAN[c.element]}는 일간과 부딪히는 쪽으로 작용한다.`;

    let help = "월령·계절·대운·연운·월운·일운의 흐름에 따라 도움 여부가 달라진다.";
    if (rel === "비화" || rel === "인성") help = "들어오면 일간 버티기에 보탬이 될 수 있다. 다만 과해져도 무조건 유리한 것만은 아니다.";
    if (rel === "식상") help = "재능·표현력·학업과 관련해 강점으로 드러날 여지가 있다.";
    if (rel === "재성") help = "금전 흐름이 부각되지만, 일간이 약한 경우 부담으로 느껴질 수도 있다.";
    if (rel === "관살") help = "책임·직업적 성과와 연결될 수 있으나, 스트레스 요인도 될 수 있다.";

    let caution = "단순히 많다고 나쁘거나 적다고 좋은 게 아니라, 전체 구조와 계절을 함께 본다.";
    if (state === "과다") caution = "과도해지면 원국 균형을 흔들 수 있어, 다른 오행과의 조화를 살피는 게 더 중요하다.";
    if (state === "부족" || state === "다소부족") caution = "부족하다고 무조건 보충하는 게 정답은 아니다. 어떤 경로로 들어오느냐가 핵심이다.";
    if (c.element === dmEl && strength.verdict === "신약") caution = "일간 자체가 약한 편이므로, 일간을 돕는 흐름이 유리해진다.";

    const note = `월령(${moon.branch}월, ${moon.seasonKorean})과 계절적 성격을 고려하면, ${ELEMENT_KOREAN[c.element]}의 현재 상태는 "${state}" 쪽에 가깝다. 비율은 ${c.ratio.toFixed(1)}% 이다.`;

    return { element: c.element, ratio: c.ratio, state, role, help, caution, note };
  });

  // 전체 요약
  const sorted = [...distribution.contributions].sort((a, b) => b.ratio - a.ratio);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const missing = distribution.missing;

  let summary = `전체적으로 ${ELEMENT_KOREAN[strongest.element]}의 기운이 상대적으로 강하고, ${ELEMENT_KOREAN[weakest.element]}의 기운이 상대적으로 약하게 나타납니다.`;
  if (missing.length > 0) {
    const names = missing.map((e) => ELEMENT_KOREAN[e]).join(", ");
    summary += ` 다만 ${names}은 원국에서 거의 보이지 않아, 운에서 들어오는 양과 경로가 중요해집니다.`;
  }
  summary += " 단순히 부족한 오행을 채우기보다, 토·금·목·화·수 사이의 관계와 월령·계절을 함께 살피는 게 더 정확한 방향입니다.";

  const verdictNote = strength.verdict === "중화"
    ? "일간 강약은 중화 쪽으로, 어느 한쪽으로 치우치기보다 균형을 지향하는 구조에 가깝습니다."
    : strength.verdict === "신강"
      ? "일간 강약은 신강 쪽으로, 본인이 버티는 힘이 비교적 있는 편입니다."
      : "일간 강약은 신약 쪽으로, 도움이 들어오는 흐름이 유리해질 수 있습니다.";

  return { roles, summary, verdictNote };
}