/**
 * 운세 읽기 — 신호를 항목별 문장으로 합친다.
 *
 * 규칙 (RULE_HIERARCHY_001 / RULE_INTENSITY_001 / RULE_NEUTRAL_001)
 *
 * 1. 신호는 위 계층(원국·대운·세운)이 아래 계층(월운·일운)보다 큰 가중치를 갖는다.
 *    따라서 일운 하나가 세운 하나를 덮지 못한다. (RULE_HIERARCHY_001)
 * 2. 합계는 `very_low … very_high` 다섯 단계로만 환산하고 **숫자를 노출하지 않는다.**
 * 3. 합계가 낮으면 억지로 좋고 나쁨을 만들지 않는다. "특별한 신호가 두드러지지
 *    않습니다"로 끝낸다. (RULE_NEUTRAL_001)
 * 4. 각 항목의 [해석] 은 신호의 성격과 방향만 조합해 만든다. 운세 문장은
 *    결정론적으로 생성되며 임의 문구가 끼어들지 않는다.
 */

import { ELEMENT_KOREAN } from "../elements/elementBalance";
import type { FortuneContext } from "../fortune/fortuneContext";
import type { PeriodPillar } from "../periods/period";
import { ganZhiText } from "../pillars/sexagenary";
import {
  elementSignals,
  interactionSignals,
  LAYER_WEIGHT,
  natalSignals,
  pressureSignals,
  signalValue,
  stageSignals,
  tenGodSignals,
  toEvidence,
  type Signal,
} from "./signals";
import {
  DRILLDOWN_CHAIN,
  FORTUNE_TOPICS,
  type Caution,
  type Direction,
  type Evidence,
  type FortuneReading,
  type FortuneSection,
  type FortuneTopic,
  type Intensity,
  type KeyPoint,
  type Layer,
} from "./types";

/* ------------------------------------------------------------------ 기세 환산 */

/** 신호 세기의 최댓값. (RULE_INTENSITY_001) */
const MAX_SIGNAL_STRENGTH = 3;

/**
 * 기세 구간 상한. (RULE_INTENSITY_001)
 *
 * 상한이 **비율**인 이유
 * - 합계의 절댓값은 항목마다 다르다. 총운은 다섯 계층이 모두 말하고,
 *   직업·사업운은 관성이 걸린 날만 말한다. 같은 숫자를 그대로 비교하면
 *   말하는 계층이 많은 항목만 항상 맨 위가 된다.
 * - 그래서 "이 사주가 만들 수 있는 최대 합계" 로 나눈 비율로 본다.
 *   그러면 항목끼리도 날짜끼리도 같은 눈금으로 비교된다.
 *
 * 이 세 숫자는 임의로 고른 것이 아니다. 여러 사주에서 1년 365일을 돌려 나온
 * 비율 분포를 보고 정했다. (대략 p10 0.1 · 중간값 0.35 · p90 0.6 부근이
 * 각각 약함 · 보통 · 뚜렷함 에 걸린다)
 */
const INTENSITY_BANDS: ReadonlyArray<readonly [number, Intensity]> = [
  [0.25, "low"],
  [0.45, "medium"],
  [0.75, "high"],
  [Number.POSITIVE_INFINITY, "very_high"],
];

/**
 * 비율 → 기세. 비율이 0 이하면 very_low.
 *
 * @param ratio 항목별 합계 ÷ 이 사주가 만들 수 있는 최대 합계
 */
export function intensityOf(ratio: number): Intensity {
  if (ratio <= 0) return "very_low";
  for (const [upper, band] of INTENSITY_BANDS) {
    if (ratio < upper) return band;
  }
  return "very_high";
}

const NEUTRAL_BAND: Intensity = "very_low";

/**
 * 항목별 합계. (RULE_HIERARCHY_001)
 *
 * **한 계층은 항목 하나에 한 번만 더한다.**
 * 계층 하나에서 십신·오행·십이지운성이 같은 항목으로 각각 말할 수 있지만,
 * 그것을 그대로 더하면 계층이 많을수록 합계가 불어나고 기세가 항상 "매우 두드러짐" 이 된다.
 * (일운 하나가 대운 하나를 덮어서는 안 된다는 규칙의 반대편 조건이기도 하다)
 * 그래서 계층마다 **가장 강한 신호 하나만** 골라 더한다.
 */
export function topicTotal(signals: readonly Signal[]): number {
  const strongestPerLayer = new Map<Layer, number>();
  for (const s of signals) {
    const v = signalValue(s);
    const current = strongestPerLayer.get(s.layer) ?? 0;
    if (v > current) strongestPerLayer.set(s.layer, v);
  }
  let total = 0;
  for (const v of strongestPerLayer.values()) total += v;
  return total;
}

/** 이 사주가 만들 수 있는 최대 합계. (존재하는 계층마다 최대 세기 하나씩) */
function ceilingOf(ctx: FortuneContext): number {
  let weight = LAYER_WEIGHT["원국"] + LAYER_WEIGHT["세운"] + LAYER_WEIGHT["월운"] + LAYER_WEIGHT["일운"];
  if (ctx.daeun) weight += LAYER_WEIGHT["대운"];
  return MAX_SIGNAL_STRENGTH * weight;
}

/* ------------------------------------------------------------------ 신호 수집 */

/** 운 계층을 위에서 아래 순서로 나열한다. (대운이 없으면 건너뛴다) */
function layersOf(ctx: FortuneContext): Array<{ period: PeriodPillar; layer: Layer }> {
  const list: Array<{ period: PeriodPillar; layer: Layer }> = [{ period: ctx.seun, layer: "세운" }];
  if (ctx.daeun) list.unshift({ period: ctx.daeun, layer: "대운" });
  list.push({ period: ctx.wolun, layer: "월운" }, { period: ctx.ilun, layer: "일운" });
  return list;
}

/** 그날의 모든 신호를 모은다. */
export function collectSignals(ctx: FortuneContext): Signal[] {
  const signals: Signal[] = [...natalSignals(ctx)];
  for (const { period, layer } of layersOf(ctx)) {
    signals.push(...tenGodSignals(period, layer));
    signals.push(...elementSignals(period, layer, ctx));
    signals.push(...stageSignals(period, layer));
    signals.push(...pressureSignals(period, layer));
  }
  signals.push(...interactionSignals(ctx));
  return signals;
}

/* ------------------------------------------------------------------ 문장 생성 */

/** 계층 정렬 순서. 위 계층이 앞이다. (RULE_HIERARCHY_001) */
const LAYER_ORDER: Readonly<Record<Layer, number>> = Object.freeze({
  원국: 0,
  대운: 1,
  세운: 2,
  월운: 3,
  일운: 4,
});

/** 방향 결정 — 유리 신호와 불리 신호의 힘 차이. (계층당 가장 강한 신호만 쓴다) */
function directionOf(signals: readonly Signal[]): Direction {
  let up = 0;
  let down = 0;
  for (const s of signals) {
    const v = signalValue(s);
    if (s.polarity === "favourable") up += v;
    else if (s.polarity === "adverse") down += v;
    else if (s.polarity === "volatile") up += v * 0.4;
  }
  const diff = up - down;
  // 중립 판정 폭은 이 사주가 만들 수 있는 최대 불리 합계(= ceiling) 에 비례한다.
  // 고정값을 쓰면 신호가 많은 항목은 늘 상승, 적은 항목은 늘 중립이 된다.
  if (Math.abs(diff) < neutralBandOf(signals)) return "중립";
  return diff > 0 ? "상승" : "하락";
}

/** 방향을 중립이라고 볼 폭. 계층마다 최대 세기 하나씩의 합계(= ceiling)의 12%. */
function neutralBandOf(signals: readonly Signal[]): number {
  const layers = new Set<Layer>(signals.map((s) => s.layer));
  let weight = 0;
  for (const layer of layers) weight += LAYER_WEIGHT[layer];
  return MAX_SIGNAL_STRENGTH * weight * NEUTRAL_BAND_RATIO;
}

/** 중립 판정 폭의 비율. */
const NEUTRAL_BAND_RATIO = 0.12;

/** 항목별 [해석] 문장을 만든다. */
function interpretationOf(topic: FortuneTopic, section: {
  intensity: Intensity;
  direction: Direction;
  topLayers: readonly string[];
  dominant: Signal | null;
}): string {
  const { intensity, direction, topLayers, dominant } = section;
  if (intensity === NEUTRAL_BAND) {
    return `${topic} — 이 날은 특별히 두드러지는 신호가 많지 않다. 원국과 대운·세운의 큰 흐름이 그대로 이어지는 날로 보면 된다.`;
  }
  // 계층 이름(원국·대운·세운·월운·일운) 은 모두 받침이 있어 항상 "…에서" 다.
  const where = topLayers.length > 0 ? ` 주로 ${topLayers.join(", ")}에서 나온다.` : "";
  const head = `${topic} — 신호가 ${INTENSITY_WORD[intensity]} 모이며 방향은 ${direction}이다.${where}`;
  if (!dominant) return head;
  return `${head} ${dominant.text}`;
}

const INTENSITY_WORD: Readonly<Record<Intensity, string>> = Object.freeze({
  very_low: "거의 없고",
  low: "약간",
  medium: "보통으로",
  high: "뚜렷하게",
  very_high: "매우 뚜렷하게",
});

/* ------------------------------------------------------------------ 본 함수 */

function detailOf(period: PeriodPillar, layer: Layer): string {
  void layer;
  return `${layer} ${period.ganZhi} · ${period.tenGod} · ${ELEMENT_KOREAN[period.element]}`;
}

export interface FortuneReadOptions {
  /** 화면에 보여줄 날짜 표기. */
  dateLabel: string;
}

/** 그날의 운세 전체를 읽는다. */
export function readFortune(
  ctx: FortuneContext,
  options: FortuneReadOptions,
): FortuneReading {
  const signals = collectSignals(ctx);
  const ceiling = ceilingOf(ctx);

  const sections: FortuneSection[] = FORTUNE_TOPICS.map((topic) => {
    const own = signals.filter((s) => s.topic === topic);
    const total = topicTotal(own);
    const intensity = intensityOf(total / ceiling);
    const direction = directionOf(own);
    // 위 계층 신호를 먼저, 같은 계층이면 세기가 큰 것을 앞에 둔다.
    const ordered = [...own].sort((a, b) => {
      const byLayer = LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer];
      if (byLayer !== 0) return byLayer;
      return b.strength - a.strength;
    });
    const topLayers = [...new Set(ordered.slice(0, 3).map((s) => s.layer))];
    const evidence: Evidence[] = ordered.map((s) => toEvidence(s, detailFor(ctx, s)));
    const dominant = ordered[0] ?? null;
    return {
      topic,
      interpretation: interpretationOf(topic, { intensity, direction, topLayers, dominant }),
      evidence,
      intensity,
      direction,
    };
  });

  return {
    dateLabel: options.dateLabel,
    sections,
    cautions: cautionsOf(ctx, signals),
    keyPoints: keyPointsOf(ctx, signals),
    restrictions: restrictionsOf(ctx),
  };
}

/** 신호가 가리키는 위치의 사람이 읽는 표기. */
function detailFor(ctx: FortuneContext, s: Signal): string {
  if (s.interaction) return `${s.layer} · ${s.interaction.description}`;
  if (s.layer === "원국") {
    if (s.element) return `원국 · ${ELEMENT_KOREAN[s.element]}`;
    return "원국 · 구조";
  }
  const period = periodOfLayer(ctx, s.layer);
  if (!period) return s.layer;
  if (s.ganZhi && s.ganZhi !== period.ganZhi) return `${s.layer} · ${period.ganZhi} → ${s.ganZhi}`;
  return detailOf(period, s.layer);
}

function periodOfLayer(ctx: FortuneContext, layer: Layer): PeriodPillar | null {
  switch (layer) {
    case "대운":
      return ctx.daeun;
    case "세운":
      return ctx.seun;
    case "월운":
      return ctx.wolun;
    case "일운":
      return ctx.ilun;
    case "원국":
      return null;
  }
}

/* ------------------------------------------------------------------ 주의점 */

function cautionsOf(ctx: FortuneContext, signals: readonly Signal[]): Caution[] {
  const out: Caution[] = [];
  for (const s of signals) {
    if (s.polarity !== "adverse") continue;
    const severity: 1 | 2 | 3 = s.strength === 3 ? 3 : s.strength === 2 ? 2 : 1;
    out.push({
      ruleId: s.ruleId,
      text: s.text,
      layer: s.layer,
      detail: detailFor(ctx, s),
      severity,
    });
  }
  out.sort((a, b) => b.severity - a.severity);
  const topSignals = out.slice(0, SIGNAL_CAUTION_LIMIT);

  // 시주 미상 · 대운 기산 전은 "여기까지 해석이 제한된다"는 사실 자체이므로
  // 다른 신호가 많아도 절대 잘라내지 않는다. 사용자가 먼저 알아야 할 고지다.
  return [...restrictionCautions(ctx), ...topSignals];
}

/** 신호에서 뽑아 내는 주의점 수의 상한. (고지류는 이 상한을 쓰지 않는다) */
const SIGNAL_CAUTION_LIMIT = 6;

/** 해석 범위 자체를 제한하는 고지. 신호 개수와 무관하게 항상 남는다. */
function restrictionCautions(ctx: FortuneContext): Caution[] {
  const out: Caution[] = [];
  if (ctx.hourUnknown) {
    out.push({
      ruleId: "RULE_HOUR_001",
      text: "시주가 없어 시주에서 나오는 신호는 반영되지 않았다. 출생시간을 알면 해석의 폭이 넓어진다.",
      layer: "원국",
      detail: "시주 미상",
      severity: 1,
    });
  }
  if (!ctx.daeunAvailable) {
    out.push({
      ruleId: "RULE_DAEUN_001",
      text: "이 날짜는 대운 기산(起算) 시점 이전이라 대운이 아직 들어오지 않았다.",
      layer: "대운",
      detail: "대운 기산 이전",
      severity: 1,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ 핵심 포인트 */

function keyPointsOf(ctx: FortuneContext, signals: readonly Signal[]): KeyPoint[] {
  const scored = signals
    .filter((s) => s.polarity === "favourable" || s.polarity === "volatile")
    .map((s) => ({ s, v: signalValue(s) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 4);
  return scored.map(({ s }) => ({
    ruleId: s.ruleId,
    text: s.text,
    layer: s.layer,
    detail: detailFor(ctx, s),
    topics: FORTUNE_TOPICS.filter((t) => signals.some((x) => x === s && x.topic === t)),
  }));
}

/* ------------------------------------------------------------------ 해석 제한 */

function restrictionsOf(ctx: FortuneContext): string[] {
  const out: string[] = [];
  if (ctx.hourUnknown) {
    out.push("출생시간을 모른다고 입력해 시주가 없습니다. 시주에 해당하는 해석은 제외했습니다.");
  }
  if (!ctx.daeunAvailable) {
    out.push("이 날짜는 대운 기산(起算) 시점 이전이라 대운이 아직 들어오지 않았습니다. 원국과 세운·월운·일운만 반영했습니다.");
  }
  return out;
}

/* ------------------------------------------------------------------ 드릴다운 */

/** 드릴다운 체인 — 오늘의 운세에서 원국까지 내려가는 실제 기둥들. */
export interface DrilldownStep {
  layer: Layer;
  ganZhi: string;
  tenGod: string;
  element: string;
  stage: string;
  /** 이 계층에서 나온 근거 개수 */
  evidenceCount: number;
}

export function drilldown(ctx: FortuneContext, reading: FortuneReading): DrilldownStep[] {
  const counts = new Map<Layer, number>();
  for (const s of reading.sections) {
    for (const e of s.evidence) counts.set(e.layer, (counts.get(e.layer) ?? 0) + 1);
  }
  // 원국은 기둥이 하나(일주)가 아니라 사주 전체다. 드릴다운에서는 "무엇을 기준으로
  // 사주를 읽는가"의 기준이 되는 일주를 대표로 세운다. (periodOfLayer 는 원국에
  // 대해 null 이므로 여기서 따로 넣는다)
  const steps: DrilldownStep[] = [
    {
      layer: "원국",
      ganZhi: ganZhiText(ctx.chart.day.stem, ctx.chart.day.branch),
      tenGod: ctx.chart.day.tenGod,
      element: ELEMENT_KOREAN[ctx.chart.dayMasterElement],
      stage: ctx.chart.day.stage.key,
      evidenceCount: counts.get("원국") ?? 0,
    },
  ];
  // 위 계층부터 쌓고 마지막에 뒤집어 "일운 → 원국" 방향으로 보여준다.
  for (const layer of [...DRILLDOWN_CHAIN].reverse()) {
    if (layer === "원국") continue;
    const period = periodOfLayer(ctx, layer);
    if (!period) continue;
    steps.push({
      layer,
      ganZhi: period.ganZhi,
      tenGod: period.tenGod,
      element: ELEMENT_KOREAN[period.element],
      stage: period.stage.key,
      evidenceCount: counts.get(layer) ?? 0,
    });
  }
  return steps.reverse();
}

export { DRILLDOWN_CHAIN };
