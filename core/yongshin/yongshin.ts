/**
 * 용신(用神) · 희신(喜神) 판단.
 *
 * 규칙 (RULE_YONGSHIN_001, docs/calculation-rules.md) — **이 프로젝트가 쓰는 단 하나의 규칙**
 *
 * 1. 판정 기준: `dayMasterStrength()` 가 낸 일간의 강약(신강 / 중화 / 신약) 3단계.
 * 2. 신강 → 용신 = 식상(食傷), 희신 = 재성(財星)
 *    신약 → 용신 = 인성(印星), 희신 = 비겁(比劫)
 *    중화 → 용신 = 오행 분포에서 가장 약한 오행이 인성 계열이면 인성, 아니면 식상
 *            (중립 구간의 **고정 우회 규칙**. 추측이 아니라 명시된 결정 규칙이다.)
 * 3. 판단 기록에는 기준(criteria) → 결과(result) → 규칙(rule) → 해석(interpretation)을
 *    모두 남겨 "근거 보기"에서 그대로 노출할 수 있게 한다.
 */

import {
  CONTROLS,
  controlledBy,
  elementRelation,
  FIVE_ELEMENTS,
  GENERATES,
  generatedBy,
  type FiveElement,
} from "../constants/stems";
import type { FourPillars } from "../pillars/fourPillars";
import { tenGodGroup, tenGodOfStem, type TenGod, type TenGodGroup } from "../ten_gods/tenGods";
import { subject } from "../text/korean";
import {
  ELEMENT_KOREAN,
  elementDistribution,
  dayMasterStrength,
  type DayMasterVerdict,
  type ElementDistribution,
} from "../elements/elementBalance";

export const YONGSHIN_RULE_ID = "RULE_YONGSHIN_001";

export const TEN_GOD_GROUP_KOREAN: Readonly<Record<TenGodGroup, string>> = Object.freeze({
  비겁: "비겁(比劫)",
  식상: "식상(食傷)",
  재성: "재성(財星)",
  관성: "관성(官星)",
  인성: "인성(印星)",
});

/** 오행이 일간에게 어떤 계열로 쓰이는지 (음양과 무관하게 오행 관계로만 정해진다). */
export function groupOfElement(dayMasterElement: FiveElement, element: FiveElement): TenGodGroup {
  switch (elementRelation(dayMasterElement, element)) {
    case "비화":
      return "비겁";
    case "식상":
      return "식상";
    case "재성":
      return "재성";
    case "관살":
      return "관성";
    case "인성":
    default:
      return "인성";
  }
}

export interface YongshinDecision {
  ruleId: string;
  criteria: string;
  result: {
    element: FiveElement;
    group: TenGodGroup;
    /** 원국에서 실제로 쓰인 같은 계열의 십신 */
    presentTenGods: readonly TenGod[];
  };
  interpretation: string;
}

export interface YongshinResult {
  dayMaster: string;
  verdict: DayMasterVerdict;
  yongshin: YongshinDecision;
  heeshin: YongshinDecision;
  /** 판단에 사용된 모든 근거 */
  evidence: readonly string[];
  /** 대운·세운·월운·일운에서 쓰는 방향 표 */
  favorableElements: readonly FiveElement[];
  unfavorableElements: readonly FiveElement[];
  distribution: ElementDistribution;
}

/** 원국에서 실제로 쓰인 십신 목록 (천간 + 지장간). */
function presentTenGods(chart: FourPillars): TenGod[] {
  const out: TenGod[] = [];
  for (const p of [chart.year, chart.month, chart.day, ...(chart.hour ? [chart.hour] : [])]) {
    for (const g of [p.tenGod, ...p.hidden.map((h) => tenGodOfStem(chart.dayMaster, h.stem))]) {
      if (!out.includes(g)) out.push(g);
    }
  }
  return out;
}

/** 중립(中化) 구간의 고정 우회 규칙. */
function neutralGroup(dist: ElementDistribution, dmEl: FiveElement): TenGodGroup {
  const weakest = dist.contributions[dist.contributions.length - 1].element;
  return weakest === generatedBy(dmEl) ? "인성" : "식상";
}

/**
 * 용신 · 희신을 판정한다. (결정론적)
 */
export function computeYongshin(chart: FourPillars): YongshinResult {
  const distribution = elementDistribution(chart);
  const strength = dayMasterStrength(chart, distribution);
  const dmEl = chart.dayMasterElement;
  const present = presentTenGods(chart);

  let yongshinGroup: TenGodGroup;
  if (strength.verdict === "신강") yongshinGroup = "식상";
  else if (strength.verdict === "신약") yongshinGroup = "인성";
  else yongshinGroup = neutralGroup(distribution, dmEl);

  const heeshinGroup: TenGodGroup = yongshinGroup === "식상" ? "재성" : "비겁";

  /**
   * `"식상(食傷)이"` 처럼 십신 계열명에 주격 조사를 붙인다.
   *
   * 계열명 = 한글 + 괄호 + 한자 (예: `비겁(比劫)`) 이므로 받침은 **한글** 로 봐야 한다.
   * 괄호까지 넣어서 받침을 재면 마지막 글자가 `)` 라 한글이 아니게 되어 틀린다.
   * (그래서 받침은 계열 키 `group` — 순수 한글 — 로 판정한다)
   */
  const groupSubject = (group: TenGodGroup): string =>
    `${TEN_GOD_GROUP_KOREAN[group]}${subject(group)}`;

  // 용신 오행: 식상 = 내가 생하는 것, 인성 = 나를 생하는 것
  const yongshinElement = yongshinGroup === "식상" ? GENERATES[dmEl] : generatedBy(dmEl);
  // 희신 오행: 재성 = 내가 극하는 것, 비겁 = 나와 같은 오행
  const heeshinElement = heeshinGroup === "재성" ? CONTROLS[dmEl] : dmEl;

  const weakest = distribution.contributions[distribution.contributions.length - 1].element;
  const criteria =
    strength.verdict === "중화"
      ? `일간이 중립 구간이므로, 오행 분포에서 가장 약한 오행(${ELEMENT_KOREAN[weakest]})이 인성 계열인지 확인해 결정했다.`
      : `일간이 ${strength.verdict}(내부 판정값 ${strength.supportScore})로 판정했다.`;

  const yongshin: YongshinDecision = {
    ruleId: YONGSHIN_RULE_ID,
    criteria,
    result: {
      element: yongshinElement,
      group: yongshinGroup,
      presentTenGods: present.filter((g) => tenGodGroup(g) === yongshinGroup),
    },
    interpretation:
      strength.verdict === "신강"
        ? `일간이 강한 편이므로 기운을 밖으로 빼내는 ${groupSubject(yongshinGroup)} 용신이다. 있는 것을 표현하고 만들어내는 것이 순환을 돕는다.`
        : strength.verdict === "신약"
          ? `일간이 약한 편이므로 기운을 채워 주는 ${groupSubject(yongshinGroup)} 용신이다. 배우고 안정되며 회복되는 시간이 결과를 좌우한다.`
          : `일간이 중간 정도이므로 ${groupSubject(yongshinGroup)} 균형을 잡는 데 도움이 된다.`,
  };

  const heeshin: YongshinDecision = {
    ruleId: YONGSHIN_RULE_ID,
    criteria,
    result: {
      element: heeshinElement,
      group: heeshinGroup,
      presentTenGods: present.filter((g) => tenGodGroup(g) === heeshinGroup),
    },
    interpretation: `희신은 용신을 받쳐 주는 ${groupSubject(heeshinGroup)} 용신과 함께 작용할 때 흐름이 더 순활하다.`,
  };

  const favorable: FiveElement[] = [];
  const unfavorable: FiveElement[] = [];
  for (const el of FIVE_ELEMENTS) {
    if (el === yongshinElement || el === heeshinElement || el === generatedBy(yongshinElement)) {
      favorable.push(el);
    } else if (el === controlledBy(yongshinElement) || el === controlledBy(dmEl) || el === CONTROLS[dmEl]) {
      unfavorable.push(el);
    }
  }

  return {
    dayMaster: chart.dayMaster,
    verdict: strength.verdict,
    yongshin,
    heeshin,
    evidence: strength.evidence,
    favorableElements: favorable,
    unfavorableElements: unfavorable,
    distribution,
  };
}
