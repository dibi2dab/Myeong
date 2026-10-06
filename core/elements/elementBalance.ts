/**
 * 오행 분석 — 오행 분포 · 세력 · 월령 · 일간 강약.
 *
 * 규칙 (RULE_ELEMENT_001 / RULE_MOONCMD_001, docs/calculation-rules.md)
 * - 오행 세력은 세 가지를 함께 반영한다.
 *   ① 지장간 기(氣)의 무게  ② 십이운성의 활력  ③ 월령(계절적 성격)
 *   생극제화의 역방향 관계는 `elementRelationText` 가 따로 다룬다.
 * - 월령(旺相休囚死)은 **데이터 표**로 관리하며 `core/constants/stems.ts` 의
 *   `SEASON_WANG` 한 벌만 쓴다. 다른 학교의 추출법을 섞지 않는다.
 * - 여기서 계산되는 모든 합산값은 **내부 비교용**이며 화면에 점수로 노출하지 않는다.
 */

import {
  BRANCHES,
  branchElement,
  CONTROLS,
  controlledBy,
  controls,
  ELEMENT_LABELS,
  elementRelation,
  FIVE_ELEMENTS,
  GENERATES,
  generatedBy,
  generates,
  MOON_COMMAND_TABLE,
  SEASON_WANG,
  type EarthlyBranch,
  type ElementRelation,
  type FiveElement,
  type HeavenlyStem,
  type Season,
} from "../constants/stems";
import { hiddenStemsOf } from "../hidden_stems/hiddenStems";
import type { FourPillars, Pillar } from "../pillars/fourPillars";
import { nameLabel, stemLabel } from "../text/labels";

/* ------------------------------------------------------------------ 표시용 재수출 */

/** 오행의 한국어 이름. (계산에는 한자만 쓴다) */
export const ELEMENT_KOREAN: Readonly<Record<FiveElement, string>> = Object.freeze(
  Object.fromEntries(FIVE_ELEMENTS.map((e) => [e, ELEMENT_LABELS[e].korean])) as Record<
    FiveElement,
    string
  >,
);

/** 오행의 화면 색. */
export const ELEMENT_COLOR: Readonly<Record<FiveElement, string>> = Object.freeze(
  Object.fromEntries(FIVE_ELEMENTS.map((e) => [e, ELEMENT_LABELS[e].color])) as Record<
    FiveElement,
    string
  >,
);

/** 생극제화 표는 단일 출처( stems.ts )에서 그대로 재수출한다. */
export { GENERATES, CONTROLS, generates, generatedBy, controls, controlledBy, FIVE_ELEMENTS };

/* ------------------------------------------------------------------ 월령(月令) */

/** 旺相休囚死 — 월령의 다섯 단계. */
export const MOON_COMMAND_PHASES = ["旺", "相", "休", "囚", "死"] as const;
export type MoonCommandPhase = (typeof MOON_COMMAND_PHASES)[number];

export const PHASE_KOREAN: Readonly<Record<MoonCommandPhase, string>> = Object.freeze({
  旺: "가장 힘셈",
  相: "전성기",
  休: "한숨돌림",
  囚: "억눌림",
  死: "기운이 죽음",
});

/** 단계별 세력 보정값. (분포 계산 안에서만 사용) */
const PHASE_WEIGHT: Readonly<Record<MoonCommandPhase, number>> = Object.freeze({
  旺: 1.2,
  相: 0.6,
  休: 0.2,
  囚: -0.2,
  死: -0.6,
});

const SEASON_KOREAN: Readonly<Record<Season, string>> = Object.freeze({
  spring: "봄",
  "late-spring": "봄의 늦은 달(暮春)",
  summer: "여름",
  "late-summer": "여름의 늦은 달(季夏)",
  autumn: "가을",
  "late-autumn": "가을의 늦은 달(季秋)",
  winter: "겨울",
  "late-winter": "겨울의 늦은 달(季冬)",
});

export interface MoonCommand {
  /** 사월의 지지 */
  branch: EarthlyBranch;
  season: Season;
  seasonKorean: string;
  /** 그 계절의 旺 오행 */
  wangElement: FiveElement;
  /** 오행별 旺相休囚死 단계 */
  phases: Readonly<Record<FiveElement, MoonCommandPhase>>;
  description: string;
}

const MOON_COMMAND_CACHE = new Map<string, MoonCommand>();

/**
 * 사월(월지)의 월령을 만든다.
 * 단계 배치는 `core/constants/stems.ts` 의 `MOON_COMMAND_TABLE` 한 벌에서만 가져온다.
 * (전승 관계로 5단계를 순환시킬 수 없는 오행이 있어 표 데이터로 관리한다.)
 */
function buildMoonCommand(branch: EarthlyBranch): MoonCommand {
  const info = BRANCHES.find((b) => b.char === branch)!;
  const wang = SEASON_WANG[info.season];
  const table = MOON_COMMAND_TABLE[wang];
  const phases = {} as Record<FiveElement, MoonCommandPhase>;
  phases[wang] = "旺";
  phases[table.相] = "相";
  phases[table.休] = "休";
  phases[table.囚] = "囚";
  phases[table.死] = "死";
  const seasonKorean = SEASON_KOREAN[info.season];
  const order = MOON_COMMAND_PHASES.map((p) => {
    const el = (Object.keys(phases) as FiveElement[]).find((e) => phases[e] === p)!;
    return `${ELEMENT_KOREAN[el]}(${p})`;
  }).join(" → ");
  return {
    branch,
    season: info.season,
    seasonKorean,
    wangElement: wang,
    phases,
    description: `${branch}월은 ${seasonKorean}의 기운이다. ${order} 순으로 기운의 힘이 배어 있다.`,
  };
}

/** 사월(월지)의 월령. */
export function moonCommandOf(monthBranch: EarthlyBranch): MoonCommand {
  const cached = MOON_COMMAND_CACHE.get(monthBranch);
  if (cached) return cached;
  const built = buildMoonCommand(monthBranch);
  MOON_COMMAND_CACHE.set(monthBranch, built);
  return built;
}

/* ------------------------------------------------------------------ 절지(旬空) */

/**
 * 절지(空亡) — 60간지 인덱스가 속한 旬(10일)의 12지지 중 빠진 두 지지.
 *
 * 甲子(0)~癸酉(9) = 첫 旬 → 戌·亥가 비어 있다.
 * 甲戌(10)~癸未(19) = 둘째 旬 → 申·酉가 비어 있다. … (10일마다 2지지가 순환)
 */
export function voidBranchesOf(ganZhiIndex: number): readonly [EarthlyBranch, EarthlyBranch] {
  const i = ((ganZhiIndex % 60) + 60) % 60;
  const start = (Math.floor(i / 10) * 10) % 12;
  return [BRANCHES[(start + 10) % 12].char, BRANCHES[(start + 11) % 12].char];
}

/* ------------------------------------------------------------------ 오행 분포 */

export interface ElementContribution {
  element: FiveElement;
  /** 가중 합 (내부 비교용. 화면에 점수로 노출하지 않는다) */
  weight: number;
  /** 어느 기둥에서 왔는지 */
  sources: readonly string[];
  /** 비례(%) — 분포 막대 표시에만 사용 */
  ratio: number;
}

export interface ElementDistribution {
  contributions: readonly ElementContribution[];
  strongest: FiveElement;
  weakest: FiveElement;
  /** 전혀 없는 오행 */
  missing: readonly FiveElement[];
  /** 지장간 전수 기준 오행별 합 (지장간 설명용) */
  hiddenCoverage: Readonly<Record<FiveElement, number>>;
  moonCommand: MoonCommand;
}

const PILLAR_LABEL: Readonly<Record<Pillar["position"], string>> = Object.freeze({
  year: "년주",
  month: "월주",
  day: "일주",
  hour: "시주",
});

/** 기둥 하나가 오행 세력에 기여하는 값. */
function pillarContribution(
  pillar: Pillar,
  dayMaster: HeavenlyStem,
): Map<FiveElement, { weight: number; sources: string[] }> {
  const map = new Map<FiveElement, { weight: number; sources: string[] }>();
  const label = PILLAR_LABEL[pillar.position];
  const add = (el: FiveElement, w: number, src: string) => {
    const cur = map.get(el) ?? { weight: 0, sources: [] };
    cur.weight += w;
    if (!cur.sources.includes(src)) cur.sources.push(src);
    map.set(el, cur);
  };

  // ① 천간 (일간은 1.2 — 사주의 主人)
  add(pillar.element, pillar.stem === dayMaster ? 1.2 : 1, `${label} 천간 ${pillar.stem}`);

  // ② 지장간 — 기(氣)의 무게 × 0.8 (지지가 천간보다 약하다)
  for (const h of hiddenStemsOf(pillar.branch)) {
    add(h.element, h.weight * 0.8, `${label} 지장간 ${h.stem}(${h.layer})`);
  }

  // ③ 십이운성 — 일간의 힘이 그 지지에 실린 정도 (일지만 해당)
  if (pillar.position === "day") {
    add(pillar.element, pillar.stage.vitality * 0.4, `${label} 십이운성 ${pillar.stage.key}`);
  }

  return map;
}

/** 원국의 오행 분포. */
export function elementDistribution(chart: FourPillars): ElementDistribution {
  const moon = moonCommandOf(chart.month.branch);
  const acc = new Map<FiveElement, { weight: number; sources: string[] }>();
  const bump = (el: FiveElement, w: number, src: string) => {
    const cur = acc.get(el) ?? { weight: 0, sources: [] };
    cur.weight += w;
    if (!cur.sources.includes(src)) cur.sources.push(src);
    acc.set(el, cur);
  };

  for (const pillar of [chart.year, chart.month, chart.day, ...(chart.hour ? [chart.hour] : [])]) {
    for (const [el, v] of pillarContribution(pillar, chart.dayMaster)) {
      bump(el, v.weight, v.sources.join(" · "));
    }
  }

  // ② 월령 반영
  for (const el of FIVE_ELEMENTS) {
    const phase = moon.phases[el];
    bump(el, PHASE_WEIGHT[phase], `월령 ${moon.branch}월 ${ELEMENT_KOREAN[el]}(${phase})`);
  }

  const hiddenCoverage = Object.fromEntries(
    FIVE_ELEMENTS.map((e) => [e, 0]),
  ) as Record<FiveElement, number>;
  for (const p of [chart.year, chart.month, chart.day, ...(chart.hour ? [chart.hour] : [])]) {
    for (const h of hiddenStemsOf(p.branch)) hiddenCoverage[h.element] += h.weight;
  }

  const raw = FIVE_ELEMENTS.map((el) => {
    const v = acc.get(el) ?? { weight: 0, sources: [] };
    return { element: el, weight: Math.max(0, v.weight), sources: v.sources };
  });
  const total = raw.reduce((a, c) => a + c.weight, 0) || 1;
  const contributions: ElementContribution[] = raw
    .map((c) => ({ ...c, ratio: (c.weight / total) * 100 }))
    .sort((a, b) => b.weight - a.weight);

  return {
    contributions,
    strongest: contributions[0].element,
    weakest: contributions[contributions.length - 1].element,
    missing: contributions.filter((c) => c.weight <= 0).map((c) => c.element),
    hiddenCoverage,
    moonCommand: moon,
  };
}

/* ------------------------------------------------------------------ 생극제화 */

export interface ElementRelationNote {
  from: FiveElement;
  to: FiveElement;
  relation: ElementRelation;
  text: string;
}

/**
 * `elementRelation(from, to)` 는 **from 의 입장에서 to 를 본다.**
 * - 비화: 같은 오행
 * - 식상(食傷, 我生): from 이 to 를 생한다
 * - 인성(印星, 生我): to 가 from 을 생한다
 * - 재성(財星, 我剋): from 이 to 를 극한다
 * - 관살(官殺, 剋我): to 가 from 을 극한다
 */
const RELATION_TEXT: Readonly<Record<ElementRelation, string>> = Object.freeze({
  비화: "같은 오행으로 서로 힘을 나눠준다.",
  식상: "앞의 기운이 뒤의 기운을 생해 밀어 올린다.",
  인성: "뒤의 기운이 앞의 기운을 생해 살린다.",
  재성: "앞의 기운이 뒤의 기운을 극해 정리한다.",
  관살: "뒤의 기운이 앞의 기운을 극해 눌러 둔다.",
});

/** 두 오행의 관계를 사람이 읽을 문장으로. */
export function elementRelationText(from: FiveElement, to: FiveElement): ElementRelationNote {
  const relation = elementRelation(from, to);
  return { from, to, relation, text: RELATION_TEXT[relation] };
}

export interface ElementFlowLine {
  element: FiveElement;
  /** 내가 생하는 오행 */
  generatesTo: FiveElement;
  /** 내가 극하는 오행 */
  controlsTo: FiveElement;
  /** 나를 생하는 오행 */
  generatedBy: FiveElement;
  /** 나를 극하는 오행 */
  controlledBy: FiveElement;
  note: readonly ElementRelationNote[];
}

/** 오행 생극제화 흐름표. */
export function elementFlowLines(): readonly ElementFlowLine[] {
  return FIVE_ELEMENTS.map((el) => ({
    element: el,
    generatesTo: GENERATES[el],
    controlsTo: CONTROLS[el],
    generatedBy: generatedBy(el),
    controlledBy: controlledBy(el),
    note: [
      elementRelationText(el, GENERATES[el]),
      elementRelationText(el, CONTROLS[el]),
      elementRelationText(el, generatedBy(el)),
      elementRelationText(el, controlledBy(el)),
    ],
  }));
}

/* ------------------------------------------------------------------ 일간 강약 */

export type DayMasterVerdict = "신강" | "중화" | "신약";

/**
 * 강약 판단 한 줄 뜻.
 *
 * `신강` 이라는 글자를 처음 보는 사람이 "그래서 무엇이 좋은 건가" 를 되묻지
 * 않게 하려고 둔다. (화면이 첫 등장 자리에서 붙여 준다)
 */
export const VERDICT_MEANING: Readonly<Record<DayMasterVerdict, string>> = Object.freeze({
  신강: "일간을 돕는 기운이 상대적으로 강한 상태. 본인이 버틸 힘이 충분하다는 뜻이지, 항상 좋은 사주라는 뜻은 아니다",
  중화: "일간을 돕는 기운과 빼앗는 기운이 비슷한 상태. 어느 한쪽으로 기울지 않는다",
  신약: "일간을 돕는 기운이 상대적으로 약한 상태. 스스로는 버티기보다 도움을 받는 형태가 맞다",
});

export interface DayMasterStrength {
  dayMaster: HeavenlyStem;
  element: FiveElement;
  /** 내부 합산값. 화면에 점수로 노출하지 않는다. */
  supportScore: number;
  verdict: DayMasterVerdict;
  /** 판단 근거 — "분석 근거" 화면에 그대로 노출한다. */
  evidence: readonly string[];
}

const VERDICT_THRESHOLD = 1.5;

/** 일간의 강약(격국)을 판단한다. (RULE_DAYMASTER_001) */
export function dayMasterStrength(
  chart: FourPillars,
  dist: ElementDistribution,
): DayMasterStrength {
  const dm = chart.dayMaster;
  const dmEl = chart.dayMasterElement;
  const monthBranch = chart.month.branch;
  const monthEl = branchElement(monthBranch);
  const evidence: string[] = [];

  // ① 월지(본기)와 일간의 관계 — 격국 판단의 기준
  //    `elementRelation(일간, 대상)` 기준: 비화=비겁, 비고=인성, 상생=식상, 상극=재성, 극화=관살
  const monthRel = elementRelation(dmEl, monthEl);
  const monthHelps = monthRel === "비화" || monthRel === "인성";
  evidence.push(
    `월지 ${nameLabel(monthBranch)}(본기 ${ELEMENT_KOREAN[monthEl]})와 일간 ${stemLabel(dm)}는 ${monthRel} 관계이므로, 월지가 일간을 ${
      monthHelps ? "돕는다(得地)" : "빼앗는다(失地)"
    }.`,
  );

  // ② 월지 지장간 전체
  let hiddenScore = 0;
  for (const h of hiddenStemsOf(monthBranch)) {
    const rel = elementRelation(dmEl, h.element);
    if (rel === "비화") hiddenScore += h.weight;
    else if (rel === "인성") hiddenScore += h.weight * 0.8;
    else if (rel === "재성") hiddenScore -= h.weight * 0.6;
    else if (rel === "식상") hiddenScore -= h.weight * 0.3;
    else hiddenScore -= h.weight * 0.8;
  }
  // 숫자 뒤에는 이/가 가 붙는다. ("영 점 팔 이다" 로 읽는다)
  evidence.push(
    `월지 지장간을 기(氣)의 무게로 합산하면 일간을 돕는 정도는 ${hiddenScore.toFixed(1)} 이다.`,
  );

  // ③ 연지·일지·시지
  let allyScore = 0;
  const others: Array<[string, Pillar]> = [
    ["연지", chart.year],
    ["일지", chart.day],
    ...(chart.hour ? ([["시지", chart.hour]] as Array<[string, Pillar]>) : []),
  ];
  for (const [label, p] of others) {
    const rel = elementRelation(dmEl, p.element);
    // 천간 열 자는 모두 받침이 있는 한자음이라 여기서 \"…이\" 가 맞다. (甲~癸 전부)
    if (rel === "비화" || rel === "인성") {
      allyScore += 1;
      evidence.push(`${label} ${nameLabel(p.branch)}의 천간 ${stemLabel(p.stem)}이 일간을 돕는다.`);
    } else if (rel === "관살") {
      allyScore -= 1;
      evidence.push(`${label} ${nameLabel(p.branch)}의 천간 ${stemLabel(p.stem)}이 일간을 제약한다(관살).`);
    }
    for (const h of hiddenStemsOf(p.branch)) {
      const hRel = elementRelation(dmEl, h.element);
      if (hRel === "비화" || hRel === "인성") allyScore += h.weight * 0.4;
      else if (hRel === "관살") allyScore -= h.weight * 0.4;
    }
  }

  // ④ 절지(旬空)
  const voids = voidBranchesOf(chart.day.ganZhiIndex);
  if (voids.includes(monthBranch)) {
    evidence.push(
      `일지 ${nameLabel(chart.day.branch)}가 속한 旬의 절지(空亡)에 월지 ${nameLabel(monthBranch)}가 들어 있어, 월지의 힘이 반감된다.`,
    );
    allyScore -= 1;
  }
  if (voids.includes(chart.day.branch)) {
    evidence.push(`일지 ${nameLabel(chart.day.branch)} 자신이 절지에 빠져 주체성이 약해진다.`);
  }

  // ⑤ 오행 분포 비율
  const dmContribution = dist.contributions.find((c) => c.element === dmEl)!;
  const ratioScore = (dmContribution.ratio - 20) / 20;
  const supportScore = Number((hiddenScore + allyScore + ratioScore).toFixed(2));
  const verdict: DayMasterVerdict =
    supportScore >= VERDICT_THRESHOLD
      ? "신강"
      : supportScore <= -VERDICT_THRESHOLD
        ? "신약"
        : "중화";

  evidence.push(`오행 분포에서 ${ELEMENT_KOREAN[dmEl]}의 비중은 ${dmContribution.ratio.toFixed(1)}% 다.`);
  evidence.push(`종합하면 일간을 돕는 정도는 ${supportScore} 이므로 ${verdict} 쪽에 가깝다.`);

  return { dayMaster: dm, element: dmEl, supportScore, verdict, evidence };
}
