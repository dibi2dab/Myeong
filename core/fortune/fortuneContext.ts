/**
 * 운세 컨텍스트 — 어떤 날짜의 운세를 볼 때 필요한 모든 것을 한 번에 모은다.
 *
 * 명리학의 계층은 언제나 **원국 → 대운 → 세운 → 월운 → 일운** 순으로 좁아진다.
 * 이 모듈은 그 계층을 재료로만 만들고 **해석하지 않는다.**
 * 해석은 `core/interpretation` 이 담당한다.
 *
 * 대운이 산출 범위 밖(기산 전)이면 `daeun` 은 null 이고, 그 사실은
 * `daeunAvailable: false` 로 명시되어 해석 단계에서 반드시 드러난다.
 */

import type { CivilDate } from "../calendar/civilDate";
import { STEMS, type HeavenlyStem } from "../constants/stems";
import { computeDaeun, daeunOfDate, type Daeun, type DaeunTimeline } from "../daeun/daeun";
import { elementDistribution, dayMasterStrength } from "../elements/elementBalance";
import { analyzeInteractions, type Interaction, type InteractionInput } from "../interactions/interactions";
import { PILLAR_LABELS, pillarsOf, type FourPillars, type PillarPosition } from "../pillars/fourPillars";
import type { PeriodPillar } from "../periods/period";
import { ilunOf, seunOf, wolunOf } from "../periods/seunWolunIlun";
import { tenGodOfStem } from "../ten_gods/tenGods";
import type { Gender } from "../types";
import { groupOfElement, computeYongshin, type YongshinResult } from "../yongshin/yongshin";

/** 대운을 기둥처럼 다루기 위한 어댑터. */
function daeunAsPeriod(daeun: Daeun, dayMaster: HeavenlyStem): PeriodPillar {
  return {
    kind: "daeun",
    ganZhiIndex: daeun.ganZhiIndex,
    ganZhi: `${daeun.stem}${daeun.branch}`,
    stem: daeun.stem,
    branch: daeun.branch,
    element: daeun.element,
    branchElement: daeun.branchElement,
    tenGod: daeun.tenGod,
    tenGodGroup: groupOfElement(STEMS.find((s) => s.char === dayMaster)!.element, daeun.element),
    stage: daeun.stage,
    hidden: daeun.hidden,
    hiddenTenGods: daeun.hidden.map((h) => tenGodOfStem(dayMaster, h.stem)),
    pillar: daeun.pillar,
  };
}

export interface FortuneContext {
  /** 원국 — 고정값 */
  chart: FourPillars;
  yongshin: YongshinResult;
  daeunStrength: ReturnType<typeof dayMasterStrength>;
  daeunTimeline: DaeunTimeline;
  /** 대상 날짜 */
  date: CivilDate;
  /** 대상 날짜가 속한 대운. 기산 전이면 null. */
  daeun: PeriodPillar | null;
  daeunAvailable: boolean;
  seun: PeriodPillar;
  wolun: PeriodPillar;
  ilun: PeriodPillar;
  /** 원국 내부 + 모든 계층을 한꺼번에 검사한 간(干支) 목록 */
  interactions: readonly Interaction[];
  /** 시주 미상 여부 (해석이 제한되는 경우를 알리기 위해 함께 둔다) */
  hourUnknown: boolean;
}

/** 대시보드·캘린더·기간 비교가 함께 쓰는 간 입력 목록. */
export function fortuneInteractionInputs(ctx: Omit<FortuneContext, "interactions">): InteractionInput[] {
  const inputs: InteractionInput[] = pillarsOf(ctx.chart).map((p) => ({
    label: PILLAR_LABELS[p.position as PillarPosition],
    position: p.position,
    pillar: p,
  }));
  if (ctx.daeun) {
    inputs.push({ label: "대운", position: "daeun", pillar: ctx.daeun.pillar });
  }
  inputs.push({ label: "세운", position: "seun", pillar: ctx.seun.pillar });
  inputs.push({ label: "월운", position: "wolun", pillar: ctx.wolun.pillar });
  inputs.push({ label: "일운", position: "ilun", pillar: ctx.ilun.pillar });
  return inputs;
}

export interface FortuneContextInput {
  chart: FourPillars;
  date: CivilDate;
  gender?: Gender | undefined;
}

/** 특정 날짜의 운세 컨텍스트를 만든다. (결정론적) */
export function buildFortuneContext(input: FortuneContextInput): FortuneContext {
  const { chart, date, gender } = input;
  const yongshin = computeYongshin(chart);
  const daeunStrength = dayMasterStrength(chart, yongshin.distribution);
  const daeunTimeline = computeDaeun(chart, chart.basis.solarDate, gender);
  const daeunRaw = daeunOfDate(daeunTimeline, date);
  const seun = seunOf(chart, date);
  const wolun = wolunOf(chart, date);
  const ilun = ilunOf(chart, date);

  const base: Omit<FortuneContext, "interactions"> = {
    chart,
    yongshin,
    daeunStrength,
    daeunTimeline,
    date,
    daeun: daeunRaw ? daeunAsPeriod(daeunRaw, chart.dayMaster) : null,
    daeunAvailable: daeunRaw !== null,
    seun,
    wolun,
    ilun,
    hourUnknown: chart.basis.hourUnknown,
  };

  return { ...base, interactions: analyzeInteractions(fortuneInteractionInputs(base)) };
}

/** 오행 분포만 필요할 때의 편의 함수. */
export { elementDistribution };
