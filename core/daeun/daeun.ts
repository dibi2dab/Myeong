/**
 * 대운(大運) — 10년 단위 운의 흐름.
 *
 * 규칙 (RULE_DAEUN_001, docs/calculation-rules.md)
 *
 * 1. 순역(順逆) 결정 — **하나의 규칙만** 사용한다.
 *    - 성별이 주어지면 성별순역법: 양남·음녀 순행, 음남·양녀 역행.
 *    - 성별이 없으면 간지순역법: 년간이 양(甲丙戊庚壬)이면 순행, 음(乙丁己辛癸)이면 역행.
 *    - 적용된 규칙을 `directionRule` 로 기록해 근거 보기에 노출한다.
 * 2. 기산(起算) — 생일에서 인접한 **구분 절기(節)** 까지의 기간을 3일 = 1년으로 환산한다.
 *    - 순행이면 **다음 절기**까지의 일수, 역행이면 **이전 절기**로부터 지난 일수.
 *    - 1일 = 4개월 = 1/3년 이므로 기산 나이는 `일수 / 3` 이다.
 * 3. 대운 간지는 월주를 기준으로 60간지를 순/역으로 하나씩 옮긴다.
 *    - 순행: 월주 인덱스 + 1, + 2, …  /  역행: 월주 인덱스 − 1, − 2, …
 * 4. 대운 하나는 시작 날짜·끝 날짜(exclusive)·나이·간지·십신·오행을 모두 갖는다.
 */

import { addMonths, type CivilDate } from "../calendar/civilDate";
import { BRANCHES, STEMS, type EarthlyBranch, type FiveElement, type HeavenlyStem, type YinYang } from "../constants/stems";
import { hiddenStemsOf, type HiddenStem } from "../hidden_stems/hiddenStems";
import type { FourPillars, Pillar } from "../pillars/fourPillars";
import { withDayMaster } from "../pillars/fourPillars";
import { branchOfIndex, ganZhiFromIndex, stemOfIndex } from "../pillars/sexagenary";
import { jieForMonthBranch, monthBoundaryOf, solarTermsOfYear, type SolarTermInstant } from "../solar_terms/solarTerms";
import { tenGodOfStem, type TenGod } from "../ten_gods/tenGods";
import { twelveStageOf, type TwelveStageInfo } from "../twelve_stages/twelveStages";
import type { Gender } from "../types";

export type DirectionRule = "성별순역" | "간지순역";
export type Direction = "순행" | "역행";

export interface Daeun {
  order: number;
  /** 시작 나이 (소수 둘째 자리) */
  startAge: number;
  /** 끝 나이 (exclusive) */
  endAge: number;
  /** 시작 날짜 (양력, KST) */
  startDate: CivilDate;
  /** 끝 날짜 (exclusive, 양력, KST) */
  endDate: CivilDate;
  /** 시작 연도 · 끝 연도 (표시용) */
  startYear: number;
  endYear: number;
  ganZhiIndex: number;
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  element: FiveElement;
  branchElement: FiveElement;
  /** 일간 기준 십신 */
  tenGod: TenGod;
  stage: TwelveStageInfo;
  hidden: readonly HiddenStem[];
  pillar: Pillar;
}

export interface DaeunTimeline {
  direction: Direction;
  directionRule: DirectionRule;
  /** 기산에 쓰인 절기 (순행이면 다음 절기, 역행이면 이전 절기) */
  startTerm: SolarTermInstant;
  /** 생일과 기산 절기 사이의 일수 */
  daysToStartTerm: number;
  /** 기산 시작 나이 (3일 = 1년) */
  startAgeYears: number;
  daeun: readonly Daeun[];
}

/** 대운 하나의 기간(년). */
export const DAEUN_SPAN_YEARS = 10;
/** 대운을 몇 개까지 살필지. (기본 12개 = 120세) */
export const DAEUN_COUNT = 12;
/** 기산 환산: 3일 = 1년. */
const DAYS_PER_YEAR_OF_AGE = 3;

function stemPolarityOf(stem: HeavenlyStem): YinYang {
  return STEMS.find((s) => s.char === stem)!.polarity;
}
function branchPolarityOf(branch: EarthlyBranch): YinYang {
  return BRANCHES.find((b) => b.char === branch)!.polarity;
}

/** 순역 결정 — 단일 규칙. */
export function daeunDirection(
  yearStem: HeavenlyStem,
  yearBranch: EarthlyBranch,
  gender: Gender | undefined,
): { direction: Direction; rule: DirectionRule } {
  const yangYear = stemPolarityOf(yearStem) === "양" && branchPolarityOf(yearBranch) === "양";
  if (gender) {
    // 양남·음녀 = 순행, 음남·양녀 = 역행.
    const forward = gender === "남" ? yangYear : !yangYear;
    return { direction: forward ? "순행" : "역행", rule: "성별순역" };
  }
  return { direction: stemPolarityOf(yearStem) === "양" ? "순행" : "역행", rule: "간지순역" };
}

/**
 * 생일을 둘러싼 이전/다음 구분 절기(節)를 찾는다.
 *
 * 이전 절기는 `monthBoundaryOf` 가 이미 결정해 준다. 다음 절기는 그 절기의
 * 사월 지지 인덱스 바로 다음 절기이며, 발생 연도가 달라질 수 있으므로
 * 후보 연도(생일 연도, 그 해 + 1)의 절기 목록에서 현재 경계보다 뒤에 있는
 * 가장 이른 것을 고른다.
 */
function adjacentJieTerms(chart: FourPillars): { previous: SolarTermInstant; next: SolarTermInstant } {
  const birth = chart.basis.solarDate;
  const current = monthBoundaryOf(birth);
  const nextDef = jieForMonthBranch((current.monthBranchIndex + 1) % 12);
  const candidates = [birth.year, birth.year + 1]
    .flatMap((year) => solarTermsOfYear(year))
    .filter((t) => t.definition.name === nextDef.name && t.epochMs > current.term.epochMs)
    .sort((a, b) => a.epochMs - b.epochMs);
  const next = candidates[0];
  if (!next) throw new Error(`다음 절기를 찾을 수 없습니다: ${nextDef.name} (${birth.year} 기준)`);
  return { previous: current.term, next };
}

/** 대운을 계산한다. (결정론적) */
export function computeDaeun(chart: FourPillars, birthDate: CivilDate, gender: Gender | undefined): DaeunTimeline {
  const { direction, rule } = daeunDirection(chart.year.stem, chart.year.branch, gender);
  const { previous, next } = adjacentJieTerms(chart);

  const daysToNext = Math.max(0, dayCount(birthDate, next.koreaDate));
  const daysSincePrev = Math.max(0, dayCount(previous.koreaDate, birthDate));
  const startTerm = direction === "순행" ? next : previous;
  const days = direction === "순행" ? daysToNext : daysSincePrev;
  const startAgeYears = Number((days / DAYS_PER_YEAR_OF_AGE).toFixed(2));

  // 기산 시작 날짜: 1일 = 4개월. 1년 12개월 단위로 나누되 나머지는 월로 보탠다.
  const wholeYears = Math.floor(days / DAYS_PER_YEAR_OF_AGE);
  const restDays = days - wholeYears * DAYS_PER_YEAR_OF_AGE;
  const extraMonths = Math.round((restDays / DAYS_PER_YEAR_OF_AGE) * 12);
  const firstStartDate = addMonths(birthDate, wholeYears * 12 + extraMonths);

  const list: Daeun[] = [];
  for (let i = 0; i < DAEUN_COUNT; i += 1) {
    const step = direction === "순행" ? i + 1 : -(i + 1);
    const idx = ((chart.month.ganZhiIndex + step) % 60 + 60) % 60;
    const stem = stemOfIndex(idx);
    const branch = branchOfIndex(idx);
    const startDate = addMonths(firstStartDate, i * DAEUN_SPAN_YEARS * 12);
    const endDate = addMonths(startDate, DAEUN_SPAN_YEARS * 12);
    const base: Pillar = {
      position: "year",
      stem,
      branch,
      ganZhiIndex: idx,
      ganZhi: ganZhiFromIndex(idx),
      element: STEMS.find((s) => s.char === stem)!.element,
      branchElement: BRANCHES.find((b) => b.char === branch)!.element,
      polarity: stemPolarityOf(stem),
      branchPolarity: branchPolarityOf(branch),
      hidden: hiddenStemsOf(branch),
      tenGod: tenGodOfStem(chart.dayMaster, stem),
      stage: twelveStageOf(chart.dayMaster, branch),
    };
    const pillar = withDayMaster(base, chart.dayMaster);
    list.push({
      order: i + 1,
      startAge: Number((startAgeYears + i * DAEUN_SPAN_YEARS).toFixed(2)),
      endAge: Number((startAgeYears + (i + 1) * DAEUN_SPAN_YEARS).toFixed(2)),
      startDate,
      endDate,
      startYear: startDate.year,
      endYear: endDate.year,
      ganZhiIndex: idx,
      stem,
      branch,
      element: pillar.element,
      branchElement: pillar.branchElement,
      tenGod: pillar.tenGod,
      stage: pillar.stage,
      hidden: pillar.hidden,
      pillar,
    });
  }

  return { direction, directionRule: rule, startTerm, daysToStartTerm: days, startAgeYears, daeun: list };
}

/** `from` → `to` 까지 지난 날짜 수 (양력 날짜 기준, 양수). */
function dayCount(from: CivilDate, to: CivilDate): number {
  return Math.round(
    (Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / 86_400_000,
  );
}

/** 특정 날짜가 속한 대운. 범위 밖이면 null. */
export function daeunOfDate(timeline: DaeunTimeline, date: CivilDate): Daeun | null {
  const t = Date.UTC(date.year, date.month - 1, date.day);
  return (
    timeline.daeun.find((d) => {
      const s = Date.UTC(d.startDate.year, d.startDate.month - 1, d.startDate.day);
      const e = Date.UTC(d.endDate.year, d.endDate.month - 1, d.endDate.day);
      return t >= s && t < e;
    }) ?? null
  );
}
