/**
 * 신호(signal) — 해석의 최소 단위.
 *
 * 이 모듈은 **판단하지 않는다.** 이미 계산된 구조
 * (십신, 오행, 십이운성, 간(干支))를 "어느 항목에, 어느 정도의 세기로,
 * 어느 계층에서, 무엇을 말하는가"라는 신호로 바꿔 줄 뿐이다.
 * 실제 합산과 문장 생성은 `core/interpretation/reading.ts` 가 담당한다.
 *
 * 신호 세기(strength)는 규칙마다 **고정**되어 있다. 입력에 따라 바뀌지 않는다.
 * 바뀌면 그것은 "의미"가 아니라 "설정"이 되어 버리기 때문이다.
 */

import { controlledBy, type FiveElement } from "../constants/stems";
import { ELEMENT_KOREAN } from "../elements/elementBalance";
import type { FortuneContext } from "../fortune/fortuneContext";
import type { Interaction } from "../interactions/interactions";
import type { PeriodKind, PeriodPillar } from "../periods/period";
import { TWELVE_STAGES, type TwelveStageName } from "../twelve_stages/twelveStages";
import { object, subject, topic } from "../text/korean";
import type { Evidence, FortuneTopic, Layer } from "./types";

/** 신호가 가리키는 변화의 성격. */
export type SignalPolarity = "favourable" | "adverse" | "volatile" | "neutral";

export interface Signal {
  /** 고유 규칙 ID (data/rules/rules.ts 에 정의가 있다) */
  ruleId: string;
  topic: FortuneTopic;
  layer: Layer;
  /** 사람이 읽는 근거 문장 */
  text: string;
  /** 고정 신호 세기 1·2·3 */
  strength: 1 | 2 | 3;
  polarity: SignalPolarity;
  /** 드릴다운 연결용 간지 */
  ganZhi?: string;
  element?: FiveElement;
  interaction?: Interaction;
}

/** 계층별 가중치. 위 계층일수록 무게가 크다. (RULE_HIERARCHY_001) */
export const LAYER_WEIGHT: Readonly<Record<Layer, number>> = Object.freeze({
  원국: 1.0,
  대운: 1.0,
  세운: 0.9,
  월운: 0.7,
  일운: 0.5,
});

/** 신호의 기여값. 화면에 노출되지 않는다. */
export function signalValue(signal: Signal): number {
  return signal.strength * LAYER_WEIGHT[signal.layer];
}

function el(element: FiveElement): string {
  return ELEMENT_KOREAN[element];
}

/** `"오행 목은"` 처럼 오행 이름에 화제 조사를 붙인다. (수만 은, 나머지는 는) */
function elTopic(element: FiveElement): string {
  return `${el(element)}${topic(el(element))}`;
}

/** `"오행 수가"` 처럼 주격 조사를 붙인다. */
function elSubject(element: FiveElement): string {
  return `${el(element)}${subject(el(element))}`;
}

/** `"목(비겁)이"` 처럼 오행 이름 + 계열명 을 묶고 마지막 이름에 조사를 붙인다. */
function elGrouped(result: { element: FiveElement; group: string }): string {
  const name = el(result.element);
  return `${name}(${result.group})${subject(name)}`;
}

/* ------------------------------------------------------------------ 오행 신호 */

/**
 * 용신·희신 기준 오행 신호. (RULE_YONGSHIN_001 결과를 운 계층에 적용)
 */
export function elementSignals(period: PeriodPillar, layer: Layer, ctx: FortuneContext): Signal[] {
  const ys = ctx.yongshin;
  const isFavorable = ys.favorableElements.includes(period.element);
  const isUnfavorable = ys.unfavorableElements.includes(period.element);
  if (!isFavorable && !isUnfavorable) return [];
  return [
    {
      ruleId: "RULE_YONGSHIN_001",
      topic: "총운",
      layer,
      text: isFavorable
        ? `${layer} ${period.ganZhi}의 오행 ${elTopic(period.element)} 용신·희신 쪽이라 원국의 순환을 돕는다.`
        : `${layer} ${period.ganZhi}의 오행 ${elTopic(period.element)} 용신을 약하게 하거나 일간을 누르는 쪽이다.`,
      strength: 2,
      polarity: isFavorable ? "favourable" : "adverse",
      ganZhi: period.ganZhi,
      element: period.element,
    },
  ];
}

/** 관살 계열이 강하면 책임과 압박이 함께 늘어난다. */
export function pressureSignals(period: PeriodPillar, layer: Layer): Signal[] {
  if (period.tenGodGroup !== "관성") return [];
  return [
    {
      ruleId: "RULE_CAREER_001",
      topic: "직업·사업운",
      layer,
      text: `${layer} ${period.ganZhi}의 십신이 ${period.tenGod}(관성)이라 책임과 압박이 동시에 늘어난다.`,
      strength: 2,
      polarity: "volatile",
      ganZhi: period.ganZhi,
      element: period.element,
    },
  ];
}

/* ------------------------------------------------------------------ 십신 신호 */

/** 항목 → 규칙 ID 매핑. (RULE_* 를 흩뿌리지 않는 한 곳) */
export const TOPIC_RULE_IDS: Readonly<Record<FortuneTopic, string>> = Object.freeze({
  총운: "RULE_TOTAL_001",
  재물운: "RULE_MONEY_001",
  "직업·사업운": "RULE_CAREER_001",
  애정운: "RULE_LOVE_001",
  대인관계운: "RULE_RELATION_001",
  "학업·성장운": "RULE_STUDY_001",
  건강운: "RULE_HEALTH_001",
  "이동·변화운": "RULE_MOVE_001",
});

/**
 * 십신 계열이 주로 말하는 항목들. 이 표 하나만 사용한다.
 *
 * **여기에 "총운" 을 넣지 않는다.**
 * 십신이 다섯 계열 어디에나 걸리므로 총운에 같은 신호를 넣으면,
 * 어떤 날이든 다섯 계층 전부에서 총운 신호가 생겨 총운이 늘 최댓값에 붙는다.
 * (기세가 "두드러짐 → 보통 → 약함" 사이를 못 오간다)
 * 총운은 원국의 구조·각 운의 용신 오행 여부·십이지운성·반합/삼합이 말한다.
 * 아래 표의 항목은 각각 자기 항목의 근거만 받는다.
 */
const GROUP_TOPICS: Readonly<Record<PeriodPillar["tenGodGroup"], readonly FortuneTopic[]>> =
  Object.freeze({
    비겁: ["대인관계운"],
    식상: ["재물운", "학업·성장운"],
    재성: ["재물운", "애정운"],
    관성: ["직업·사업운"],
    인성: ["학업·성장운"],
  });

const GROUP_TEXT: Readonly<Record<PeriodPillar["tenGodGroup"], string>> = Object.freeze({
  비겁: "같은 오행끼리 부딪히고 나누는 일이 늘어난다",
  식상: "내가 만들어 내보내는 일이 늘어난다",
  재성: "내가 쥐고 쓰는 자원과 현실적인 관심이 늘어난다",
  관성: "나를 재우고 치르는 바깥의 힘이 늘어난다",
  인성: "나를 북돋워 채워 주는 기운이 늘어난다",
});

/** 偏 / 正 계열에 따른 고정 세기. */
function godStrength(god: string): 1 | 2 | 3 {
  if (god === "상관" || god === "편관" || god === "편인" || god === "편재") return 3;
  if (god === "겁재" || god === "정재" || god === "정인" || god === "식신") return 2;
  return 1;
}

const GROUP_POLARITY: Readonly<Record<PeriodPillar["tenGodGroup"], SignalPolarity>> = Object.freeze({
  비겁: "volatile",
  식상: "favourable",
  재성: "favourable",
  관성: "adverse",
  인성: "favourable",
});

/** 십신이 만드는 신호. */
export function tenGodSignals(period: PeriodPillar, layer: Layer): Signal[] {
  const topics = GROUP_TOPICS[period.tenGodGroup];
  const base = GROUP_TEXT[period.tenGodGroup];
  const strength = godStrength(period.tenGod);
  const polarity = GROUP_POLARITY[period.tenGodGroup];
  return topics.map((topic, i) => ({
    ruleId: TOPIC_RULE_IDS[topic],
    topic,
    layer,
    // "…이라서" 로 이어 붙여 조사가 문장에 자연스럽게 붙는다.
    text: `${layer} ${period.ganZhi}의 십신이 ${period.tenGod}이라서 ${base}.`,
    // 두 번째 이후 항목은 같은 근거를 중복 계상하지 않도록 가장 약하게 둔다.
    strength: (i === 0 ? strength : 1) as 1 | 2 | 3,
    polarity,
    ganZhi: period.ganZhi,
    element: period.element,
  }));
}

/** 偏 / 正 계열에 따른 문장 보강. (같은 계열도 편·정은 방향이 다르다) */
export function tenGodFlavor(period: PeriodPillar): string | null {
  switch (period.tenGod) {
    case "겁재":
      return "겁재는 같은 오행이지만 음양이 달라, 함께 있는 사람과 자원이 겹치기 쉽다.";
    case "상관":
      return "상관은 나와 겉은 같지만 정면으로 반대로 작용해, 있는 것을 밖으로 꺼내는 힘이 크다.";
    case "편재":
      return "편재는 뜻밖의 수입과 지출이 함께 끊긴다. 안정적이지 않지만 폭이 넓다.";
    case "편관":
      return "편관은 통제력과 압박이 함께 온다. 자유가 줄고 대신 권한이 늘어난다.";
    case "편인":
      return "편인은 정식보다 비정식적인 길로 배운다. 통째로 이해되기보다 조각으로 들어온다.";
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ 십이운성 */

/** 십이운성 단계의 성격. */
const STAGE_NATURE: Readonly<
  Record<TwelveStageName, { vitality: "rising" | "peak" | "falling"; text: string }>
> = Object.freeze({
  장생: { vitality: "rising", text: "막 생겨나는 자리라 기운이 고여 올라온다" },
  목욕: { vitality: "rising", text: "떠오르지만 아직 정하지 못해 변화가 잦다" },
  관대: { vitality: "rising", text: "성숙에 가까워지면서 사회로 나아간다" },
  임관: { vitality: "peak", text: "실력이 인정받는 자리로 일이 정리된다" },
  제왕: { vitality: "peak", text: "가장 힘이 찬 자리로 감당할 수 있는 범위가 가장 넓다" },
  쇠: { vitality: "falling", text: "기운이 기울기 시작해 감각이 둔해진다" },
  병: { vitality: "falling", text: "약해지는 자리라 회복이 필요하다" },
  사: { vitality: "falling", text: "막히는 자리로 움직임이 적다" },
  묘: { vitality: "falling", text: "저장되고 모이는 자리라 바깥으로 안 드러난다" },
  절: { vitality: "falling", text: "끊기기 직전이라 계획이 중간에서 끊긴다" },
  태: { vitality: "rising", text: "다시 태어날 씨가 생기는 자리다" },
  양: { vitality: "rising", text: "양육되며 준비되는 자리다" },
});

/** 십이지운성의 왕쇠(旺衰) 단계가 말하는 힘의 방향. (건강운 읽기에 쓴다) */
const VITALITY_TEXT: Readonly<Record<"rising" | "peak" | "falling", string>> = Object.freeze({
  rising: "기운이 올라오는 자리라 회복이 붙는다",
  peak: "기운이 가장 찬 자리라 힘이 남아 있다",
  falling: "기운이 기울어 가는 자리라 소모가 쌓인다",
});

/** 십이운성이 만들어 내는 신호. */
export function stageSignals(period: PeriodPillar, layer: Layer): Signal[] {
  const nature = STAGE_NATURE[period.stage.key];
  const falling = nature.vitality === "falling";
  return [
    {
      ruleId: "RULE_STAGE_001",
      topic: "총운",
      layer,
      text: `${layer} ${period.ganZhi}에서 일간의 십이운성이 ${period.stage.key}로, ${nature.text}.`,
      strength: 2,
      polarity: falling ? "adverse" : "favourable",
      ganZhi: period.ganZhi,
    },
    {
      // 건강은 원국(체질)만으로 읽으면 하루가 지나도 늘 같다. 십이지운성의
      // 왕쇠(旺衰) 단계가 그날의 컨디션을 말해 주므로 함께 읽는다.
      ruleId: "RULE_STAGE_001",
      topic: "건강운",
      layer,
      text: `${layer} ${period.ganZhi}의 십이운성이 ${period.stage.key}라 ${VITALITY_TEXT[nature.vitality]}.`,
      strength: falling || nature.vitality === "peak" ? 2 : 1,
      polarity: falling ? "adverse" : "favourable",
      ganZhi: period.ganZhi,
    },
  ];
}

/* ------------------------------------------------------------------ 간(干支) */

/**
 * 간(干支) 종류마다 어느 항목에 · 어느 방향으로 · 무엇을 말할지 정한 표.
 *
 * 강함/약함과 방향은 표의 값으로 고정된다. 입력에 따라 바뀌면 그것은 해석이
 * 아니라 설정이 되어 버리기 때문이다. (`강함/보통/약함` 으로만 표기한다.
 * 백 점짜리 점수를 만들지 않는다.)
 *
 * **세기(`strength`) 는 이 표에 없다.**
 * 반합(삼합 두 자)과 완성된 삼합은 같은 종류지만 힘이 다르다. 그 구분을
 * 여기서 다시 정하면 `core/interactions/` 가 이미 계산해 둔 값을 버리는 셈이 된다.
 * 그래서 세기는 `Interaction.strength` 를 그대로 쓴다.
 * (반합 1~2 · 반방합 1 · 완성 삼합·방합 3 · 지지합 1 · 천간합 2 · 충 3 · 형·해 2 · 파 1)
 */
const INTERACTION_READING: Readonly<
  Record<
    Interaction["type"],
    {
      topic: FortuneTopic;
      polarity: SignalPolarity;
      /** 이 간(干支)이 무슨 일이 되는지. */
      meaning: string;
    }
  >
> = Object.freeze({
  충: {
    topic: "이동·변화운",
    polarity: "volatile",
    meaning: "고정된 것이 흔들리고 이동·변화가 생기기 쉽다.",
  },
  형: {
    topic: "대인관계운",
    polarity: "adverse",
    meaning: "감정적으로 어긋나거나 같은 말이 되풀이된다.",
  },
  해: {
    topic: "대인관계운",
    polarity: "adverse",
    meaning: "의도치 않게 소모되거나 방해받는다.",
  },
  파: {
    topic: "이동·변화운",
    polarity: "adverse",
    meaning: "전체는 유지되지만 계획의 한 부분이 비어 있다.",
  },
  지지합: {
    topic: "애정운",
    polarity: "favourable",
    meaning: "관계가 붙고 서로에게 끌리는 형태가 강해진다.",
  },
  천간합: {
    topic: "애정운",
    polarity: "favourable",
    meaning: "관계가 붙고 서로에게 끌리는 형태가 강해진다.",
  },
  삼합: {
    topic: "총운",
    polarity: "favourable",
    meaning: "해당 기운이 한동안 강하게 드러난다.",
  },
  방합: {
    topic: "총운",
    polarity: "favourable",
    meaning: "해당 기운이 한동안 강하게 드러난다.",
  },
});

/** 간(干支)이 만들어 내는 신호. */
export function interactionSignals(ctx: FortuneContext): Signal[] {
  return ctx.interactions.map((i) => {
    const reading = INTERACTION_READING[i.type];
    // 예: "년주 · 일주에서 庚乙 합 → 金이 걸렸다."
    // 참여자 이름(년주 · 일주) 은 받침이 있고, 설명 끝은 한자라 역시 이/을 이다.
    const who = i.participants.join(" · ");
    const what = `${i.description}${subject(i.description)}`;
    return {
      ruleId: i.ruleId,
      topic: reading.topic,
      layer: narrowestLayer(i.participants),
      text: `${who}에서 ${what} 걸렸다. ${reading.meaning}`,
      // 세기는 계산 층이 정한 값을 그대로 쓴다. (반합 ≠ 완성 삼합)
      strength: i.strength,
      polarity: reading.polarity,
      ganZhi: i.description.split(" ")[0],
      // 합·방합은 결과 오행이 있지만 충·형·해·파는 없다. (없으면 undefined)
      element: i.resultElement,
      interaction: i,
    };
  });
}

const LAYER_LABEL: Readonly<Record<PeriodKind, Layer>> = Object.freeze({
  daeun: "대운",
  seun: "세운",
  wolun: "월운",
  ilun: "일운",
});

/** 참여자 라벨에서 **가장 좁은** 계층을 뽑는다. (RULE_HIERARCHY_001) */
function narrowestLayer(participants: readonly string[]): Layer {
  const order: readonly PeriodKind[] = ["ilun", "wolun", "seun", "daeun"];
  const labels = participants.join(" ");
  for (const kind of order) {
    if (labels.includes(LAYER_LABEL[kind])) return LAYER_LABEL[kind];
  }
  return "원국";
}

/* ------------------------------------------------------------------ 원국 신호 */

/** 원국에서 한 번만 나는 신호 — 구조 자체. */
export function natalSignals(ctx: FortuneContext): Signal[] {
  const out: Signal[] = [];
  const { yongshin, chart, daeunStrength } = ctx;
  const dist = yongshin.distribution;

  out.push({
    ruleId: "RULE_DAYMASTER_001",
    topic: "총운",
    layer: "원국",
    text: `일간이 ${daeunStrength.verdict}로 판정되어, 용신은 ${elGrouped(yongshin.yongshin.result)} 되고 희신은 ${elGrouped(yongshin.heeshin.result)} 된다.`,
    strength: 3,
    polarity: "neutral",
    element: chart.dayMasterElement,
  });

  if (dist.missing.length > 0) {
    out.push({
      ruleId: "RULE_ELEMENT_001",
      topic: "총운",
      layer: "원국",
      text: `오행에 ${dist.missing.map((e) => `${el(e)}${subject(el(e))}`).join(", ")} 드러나지 않는다. 그 편에 해당하는 영역은 원국 안에서 아직 채워지지 않은 상태다.`,
      strength: 2,
      polarity: "neutral",
    });
  }
  out.push({
    ruleId: "RULE_ELEMENT_001",
    topic: "총운",
    layer: "원국",
    text: `오행 분포에서 ${elSubject(dist.strongest)} 가장 강하고 ${elSubject(dist.weakest)} 가장 약하다. 원국의 주된 기류가 ${el(dist.strongest)} 쪽으로 쏠려 있다.`,
    strength: 1,
    polarity: "neutral",
    element: dist.strongest,
  });

  for (const c of dist.contributions) {
    if (c.ratio >= 34) {
      out.push({
        ruleId: "RULE_HEALTH_001",
        topic: "건강운",
        layer: "원국",
        text: `오행 분포에서 ${elSubject(c.element)} 큰 비중을 차지한다. 이 편에 해당하는 장부가 과로해지기 쉽다.`,
        strength: 2,
        polarity: "adverse",
        element: c.element,
      });
    }
  }
  for (const missing of dist.missing) {
    out.push({
      ruleId: "RULE_HEALTH_001",
      topic: "건강운",
      layer: "원국",
      text: `${elSubject(missing)} 원국에 드러나지 않는다. 이 편은 비어 있어 채워 넣으려는 자극을 찾는 경향이 생길 수 있다.`,
      strength: 2,
      polarity: "neutral",
      element: missing,
    });
  }

  const yongshinElement = yongshin.yongshin.result.element;
  const breaker = controlledBy(yongshinElement);
  const breakerWeight = dist.contributions.find((c) => c.element === breaker)?.weight ?? 0;
  if (breakerWeight > 0) {
    out.push({
      ruleId: "RULE_YONGSHIN_001",
      topic: "총운",
      layer: "원국",
      text: `용신 ${el(yongshinElement)}${object(el(yongshinElement))} 약하게 하는 ${elSubject(breaker)} 원국에 있어, 순환을 늦추는 부분이 내재되어 있다.`,
      strength: 2,
      polarity: "adverse",
      element: breaker,
    });
  }

  if (ctx.hourUnknown) {
    out.push({
      ruleId: "RULE_HOUR_001",
      topic: "총운",
      layer: "원국",
      text: "출생시간을 모른다고 입력해 시주(時柱)가 없다. 시주는 사주의 완성도를 보여주므로, 이번 해석은 시주에서 나오는 신호가 빠져 있다.",
      strength: 2,
      polarity: "neutral",
    });
  }

  return out;
}

/* ------------------------------------------------------------------ 신호 → 근거 */

export function toEvidence(signal: Signal, detail: string): Evidence {
  const evidence: Evidence = {
    ruleId: signal.ruleId,
    text: signal.text,
    layer: signal.layer,
    detail,
  };
  if (signal.ganZhi !== undefined) evidence.ganZhi = signal.ganZhi;
  if (signal.element !== undefined) evidence.element = signal.element;
  if (signal.interaction !== undefined) evidence.interaction = signal.interaction;
  return evidence;
}

export { TWELVE_STAGES };
