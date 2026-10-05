/**
 * 세운(歲運) · 월운(月運) · 일운(日運).
 *
 * 규칙 (RULE_SEUN_001 / RULE_WOLUN_001 / RULE_ILUN_001, docs/calculation-rules.md)
 *
 * - 세운: 입춘(立春) 기준 절기 연도의 간지. `yearGanZhiIndex()` 를 그대로 쓴다.
 * - 월운: 입춘 기준 절기 연도 + 그 날짜가 속한 사월의 지지. 월주와 같은 五虎遁 규칙.
 * - 일운: 그 날짜의 일주. `dayGanZhiIndex()` 를 그대로 쓴다.
 *
 * 세운·월운·일운은 모두 **원국의 일간을 기준으로** 십신·십이운성을 매긴다.
 * 세운은 立春 에서 다음 立春 직전까지, 월운은 節 에서 다음 節 직전까지다.
 */

import type { CivilDate } from "../calendar/civilDate";
import { koreaCivilDate, utcMsFromKoreaCivilTime } from "../calendar/koreaTime";
import { BRANCHES, STEMS, type FiveElement, type HeavenlyStem } from "../constants/stems";
import { hiddenStemsOf } from "../hidden_stems/hiddenStems";
import {
  dayGanZhiIndex,
  monthGanZhiIndex,
  solarYearOf,
  withDayMaster,
  yearGanZhiIndex,
  type FourPillars,
  type Pillar,
} from "../pillars/fourPillars";
import { branchOfIndex, ganZhiFromIndex, stemOfIndex } from "../pillars/sexagenary";
import {
  jieForMonthBranch,
  monthBoundaryOf,
  solarTerm,
  solarTermsOfYear,
  type SolarTermInstant,
} from "../solar_terms/solarTerms";
import { tenGodOfStem } from "../ten_gods/tenGods";
import { twelveStageOf } from "../twelve_stages/twelveStages";
import { groupOfElement } from "../yongshin/yongshin";
import type { PeriodKind, PeriodPillar } from "./period";

/** 하루의 절반(정오)을 대표로 삼아 그 날짜가 속한 절기 연도를 구한다. */
const NOON_HOUR = 12;

/** 60간지 인덱스 + 일간으로 운 기둥 하나를 만든다. */
function periodPillarFrom(
  kind: PeriodKind,
  ganZhiIndex: number,
  dayMaster: HeavenlyStem,
): PeriodPillar {
  const idx = ((ganZhiIndex % 60) + 60) % 60;
  const stem = stemOfIndex(idx);
  const branch = branchOfIndex(idx);
  const element = STEMS.find((s) => s.char === stem)!.element;
  const hidden = hiddenStemsOf(branch);
  const base: Pillar = {
    position: "year",
    stem,
    branch,
    ganZhiIndex: idx,
    ganZhi: ganZhiFromIndex(idx),
    element,
    branchElement: BRANCHES.find((b) => b.char === branch)!.element,
    polarity: STEMS.find((s) => s.char === stem)!.polarity,
    branchPolarity: BRANCHES.find((b) => b.char === branch)!.polarity,
    hidden,
    tenGod: "비견",
    stage: twelveStageOf(dayMaster, branch),
  };
  const pillar = withDayMaster(base, dayMaster);
  const dmElement = STEMS.find((s) => s.char === dayMaster)!.element;
  return {
    kind,
    ganZhiIndex: idx,
    ganZhi: `${stem}${branch}`,
    stem,
    branch,
    element,
    branchElement: pillar.branchElement,
    tenGod: pillar.tenGod,
    tenGodGroup: groupOfElement(dmElement, element),
    stage: pillar.stage,
    hidden,
    hiddenTenGods: hidden.map((h) => tenGodOfStem(dayMaster, h.stem)),
    pillar,
  };
}

/** 그 날짜가 속한 입춘 기준 절기 연도. (정오를 대표 시각으로 쓴다) */
export function solarYearOfDate(date: CivilDate): number {
  const epochMs = utcMsFromKoreaCivilTime({
    year: date.year,
    month: date.month,
    day: date.day,
    hour: NOON_HOUR,
    minute: 0,
    second: 0,
  });
  return solarYearOf(date.year, epochMs);
}

/* ------------------------------------------------------------------ 세운 */

export interface PeriodRange {
  /** 입춘 기준 절기 연도 */
  solarYear: number;
  start: CivilDate;
  /** exclusive */
  endExclusive: CivilDate;
}

/** 세운 — `date` 가 속한 해의 세운 기둥. */
export function seunOf(chart: FourPillars, date: CivilDate): PeriodPillar {
  return periodPillarFrom("seun", yearGanZhiIndex(solarYearOfDate(date)), chart.dayMaster);
}

/** 세운의 기간 (立春 ~ 다음 立春 직전). */
export function seunRangeOf(date: CivilDate): PeriodRange {
  const solarYear = solarYearOfDate(date);
  return {
    solarYear,
    start: koreaCivilDate(solarTerm(solarYear, "입춘").epochMs),
    endExclusive: koreaCivilDate(solarTerm(solarYear + 1, "입춘").epochMs),
  };
}

/* ------------------------------------------------------------------ 월운 */

/** 월운 — `date` 가 속한 사월의 월운 기둥. */
export function wolunOf(chart: FourPillars, date: CivilDate): PeriodPillar {
  const solarYear = solarYearOfDate(date);
  const boundary = monthBoundaryOf(date);
  return periodPillarFrom(
    "wolun",
    monthGanZhiIndex(solarYear, boundary.monthBranchIndex),
    chart.dayMaster,
  );
}

/** 월운의 기간 (현재 節 ~ 다음 節 직전). */
export function wolunRangeOf(date: CivilDate): PeriodRange & { termName: string; monthBranchIndex: number } {
  const boundary = monthBoundaryOf(date);
  // 끝일은 **현재 경계 節 의 바로 다음 節** 이다. 경계일 + 1일 로 다시
  // monthBoundaryOf 를 부르면 아직 같은 節 을 돌려주므로(節 간격이 29~32일이라
  // 언제나 그렇다) 범위가 0일짜리가 된다. 반드시 節 이름으로 다음 절기를 찾는다.
  return {
    solarYear: solarYearOfDate(date),
    termName: boundary.term.definition.name,
    monthBranchIndex: boundary.monthBranchIndex,
    start: boundary.term.koreaDate,
    endExclusive: nextJieAfter(boundary.term).koreaDate,
  };
}

/**
 * `term` 바로 다음 節 의 시각.
 *
 * 節 12개는 60일 주기로 순환하지 않고 해마다 한 번씩 오므로, 다음 절기의 발생
 * 연도가 달라질 수 있다(예: 12월 7일 대설의 다음 節 은 이듬해 2월 4일 입춘).
 */
function nextJieAfter(term: SolarTermInstant): SolarTermInstant {
  const nextDef = jieForMonthBranch((term.definition.monthBranchIndex + 1) % 12);
  const candidates = [term.year, term.year + 1]
    .flatMap((year) => solarTermsOfYear(year))
    .filter((t) => t.definition.name === nextDef.name && t.epochMs > term.epochMs)
    .sort((a, b) => a.epochMs - b.epochMs);
  const found = candidates[0];
  if (!found) throw new Error(`다음 절기를 찾을 수 없습니다: ${nextDef.name} (${term.year} 기준)`);
  return found;
}

/* ------------------------------------------------------------------ 일운 */

/** 일운 — `date` 의 일주와 같은 기둥. */
export function ilunOf(chart: FourPillars, date: CivilDate): PeriodPillar {
  return periodPillarFrom("ilun", dayGanZhiIndex(date), chart.dayMaster);
}

export type { FiveElement };
