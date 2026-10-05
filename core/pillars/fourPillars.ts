/**
 * 원국(原局) 네 기둥 계산.
 *
 * 규칙 (docs/calculation-rules.md "사주 계산 구조")
 * - 년주: 입춘(立春) 시각을 경계로 삼는다. 양력 1월 1일이 아직 입춘 전이면
 *   전년도 간지를 쓴다. (음력 설날이 아니라 **입춘** 기준)
 * - 월주: 12개 節(입춘·경칩·청명·입하·망종·소서·입추·백로·한로·입동·대설·소한)의
 *   시각을 경계로 삼는다. 월지의 천간은 절기년의 천간에 **五虎遁**을 적용한다.
 * - 일주: 해당 날짜의 정수 율리우스일수(JDN) 기준. 자시 규칙(자정/조자시)에 따라
 *   날짜가 달라질 수 있다.
 * - 시주: 12시진의 지지와 일주를 기준으로 **五子遁**을 적용한다.
 *   "출생시간 모름"이면 시주는 계산하지 않는다.
 *
 * 모든 계산은 결정론적이며, 같은 입력 → 항상 같은 결과다.
 */

import { addDays, type CivilDate, type CivilDateTime } from "../calendar/civilDate";
import { julianDayNumberOf } from "../calendar/julianDay";
import { utcMsFromKoreaCivilTime } from "../calendar/koreaTime";
import { representativeHour, type ZiHourMode } from "../constants/timeBranches";
import {
  BRANCHES,
  STEMS,
  branchPolarity,
  stemPolarity,
  type EarthlyBranch,
  type FiveElement,
  type HeavenlyStem,
  type YinYang,
} from "../constants/stems";
import { hiddenStemsOf, type HiddenStem } from "../hidden_stems/hiddenStems";
import { monthBoundaryAt, solarTerm, type SolarTermInstant } from "../solar_terms/solarTerms";
import { tenGodOfStem, type TenGod } from "../ten_gods/tenGods";
import { twelveStageOf, type TwelveStageInfo } from "../twelve_stages/twelveStages";
import type { CalculationBasis } from "../types";
import { branchOfIndex, ganZhiFromIndex, stemOfIndex, type GanZhi } from "./sexagenary";

export type PillarPosition = "year" | "month" | "day" | "hour";

export const PILLAR_POSITIONS: readonly PillarPosition[] = ["year", "month", "day", "hour"] as const;

export const PILLAR_LABELS: Readonly<Record<PillarPosition, string>> = Object.freeze({
  year: "년주",
  month: "월주",
  day: "일주",
  hour: "시주",
});

export interface Pillar {
  position: PillarPosition;
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  /** 60간지 인덱스 (甲子 = 0) */
  ganZhiIndex: number;
  ganZhi: GanZhi;
  element: FiveElement;
  branchElement: FiveElement;
  polarity: YinYang;
  branchPolarity: YinYang;
  /** 지장간 (본기 → 중기 → 여기) */
  hidden: readonly HiddenStem[];
  /** 일간 기준 십신. 일주는 비견. */
  tenGod: TenGod;
  /** 일간 기준 십이운성 */
  stage: TwelveStageInfo;
}

export interface FourPillars {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  /** 출생시간 모름이면 null */
  hour: Pillar | null;
  dayMaster: HeavenlyStem;
  dayMasterElement: FiveElement;
  basis: CalculationBasis;
  /** 입춘 기준 절기 연도 — 대운·세운 계산에 쓴다. */
  solarYear: number;
}

export const STEM_INDEX: Readonly<Record<string, number>> = Object.freeze(
  STEMS.reduce(
    (acc, s, i) => {
      acc[s.char] = i;
      return acc;
    },
    {} as Record<string, number>,
  ),
);

export const BRANCH_INDEX: Readonly<Record<string, number>> = Object.freeze(
  BRANCHES.reduce(
    (acc, b, i) => {
      acc[b.char] = i;
      return acc;
    },
    {} as Record<string, number>,
  ),
);

const GANZHI_PAIR_CACHE = new Map<string, number>();

/** 천간·지지 → 60간지 인덱스. 천간/지지의 홀짝이 맞지 않으면 throw. */
export function ganZhiIndexOf(stem: HeavenlyStem, branch: EarthlyBranch): number {
  const key = `${stem}${branch}`;
  const cached = GANZHI_PAIR_CACHE.get(key);
  if (cached !== undefined) return cached;
  const s = STEM_INDEX[stem];
  const b = BRANCH_INDEX[branch];
  if (s === undefined || b === undefined) throw new Error(`잘못된 간지입니다: ${key}`);
  if (s % 2 !== b % 2) throw new Error(`천간과 지지의 음양이 맞지 않습니다: ${key}`);
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === s && i % 12 === b) {
      GANZHI_PAIR_CACHE.set(key, i);
      return i;
    }
  }
  throw new Error(`간지 조합을 만들 수 없습니다: ${key}`);
}

/** 60간지 인덱스로 기둥을 만든다. 십신·운성은 나중에 십신 미운을 채운다. */
function pillarFromIndex(position: PillarPosition, index: number): Pillar {
  const i = ((index % 60) + 60) % 60;
  const stem = stemOfIndex(i);
  const branch = branchOfIndex(i);
  return {
    position,
    stem,
    branch,
    ganZhiIndex: i,
    ganZhi: ganZhiFromIndex(i),
    element: STEMS[STEM_INDEX[stem]].element,
    branchElement: BRANCHES[BRANCH_INDEX[branch]].element,
    polarity: stemPolarity(stem),
    branchPolarity: branchPolarity(branch),
    hidden: hiddenStemsOf(branch),
    tenGod: "비견",
    stage: twelveStageOf(stem, branch),
  };
}

/** 일간을 기준으로 십신·운성을 채운다. */
export function withDayMaster(pillar: Pillar, dayMaster: HeavenlyStem): Pillar {
  return {
    ...pillar,
    tenGod: pillar.position === "day" ? "비견" : tenGodOfStem(dayMaster, pillar.stem),
    stage: twelveStageOf(dayMaster, pillar.branch),
  };
}

/** 입춘을 경계로 한 절기 연도. */
export function solarYearOf(year: number, epochMs: number): number {
  const lichun: SolarTermInstant = solarTerm(year, "입춘");
  return epochMs >= lichun.epochMs ? year : year - 1;
}

/** 절기년(입춘 기준)의 천간 인덱스. 1984 = 甲子. */
function solarYearStemIndex(solarYear: number): number {
  return (((solarYear - 1984) % 60) + 60) % 60 % 10;
}

/** 년주 간지 인덱스. */
export function yearGanZhiIndex(solarYear: number): number {
  return (((solarYear - 1984) % 60) + 60) % 60;
}

/** 월주 간지 인덱스. monthBranchIndex: 0 = 子 … 11 = 亥. */
export function monthGanZhiIndex(solarYear: number, monthBranchIndex: number): number {
  // 五虎遁: 인월(寅)의 천간 = (절기년 천간 % 5) * 2 + 2
  const yinStemIndex = ((solarYearStemIndex(solarYear) % 5) * 2 + 2) % 10;
  const offsetFromYin = (((monthBranchIndex - 2) % 12) + 12) % 12;
  const stemIndex = (yinStemIndex + offsetFromYin) % 10;
  return ganZhiIndexOf(stemOfIndex(stemIndex), BRANCHES[monthBranchIndex].char);
}

/** 일주 간지 인덱스. JDN + 49 규칙 (1949-10-01 = 甲子 검증). */
export function dayGanZhiIndex(date: CivilDate): number {
  return (((julianDayNumberOf(date) + 49) % 60) + 60) % 60;
}

/** 시주 간지 인덱스. 五子遁. */
export function hourGanZhiIndex(dayStem: HeavenlyStem, timeBranchIndex: number): number {
  const ziStemIndex = ((STEM_INDEX[dayStem] % 5) * 2) % 10;
  const stemIndex = (ziStemIndex + timeBranchIndex) % 10;
  return ganZhiIndexOf(stemOfIndex(stemIndex), BRANCHES[timeBranchIndex].char);
}

export interface FourPillarsInput {
  /** 사주 계산에 쓸 양력 날짜 (KST) */
  solarDate: CivilDate;
  /** 시진 인덱스 또는 null (출생시간 모름) */
  timeBranchIndex: number | null;
  /** 자시일 때만 의미가 있다. */
  ziMode: ZiHourMode | null;
  /** 대운 순역 결정에 쓰이는 성별 (미지정 시 간지순역법) */
  gender?: "남" | "여" | undefined;
}

/**
 * 원국 네 기둥을 계산한다.
 *
 * 대표 순간: 시진의 중시각. 자시는 선택한 자시 규칙에 따라
 * 23:30(조자시) 또는 00:30(만자시)을 쓴다. 시주 미상이면 noon(12:00)을 쓴다.
 */
export function computeFourPillars(input: FourPillarsInput): FourPillars {
  const { solarDate, timeBranchIndex, ziMode } = input;
  const hourUnknown = timeBranchIndex === null;
  const isZi = timeBranchIndex === 0;

  // 1) 대표 순간 (절기 경계 비교용)
  let repHour: number = hourUnknown ? 12 : representativeHour(timeBranchIndex);
  let repMinute = 0;
  if (isZi) {
    if (ziMode === "조자시") {
      repHour = 23;
      repMinute = 30;
    } else {
      repHour = 0;
      repMinute = 30;
    }
  }
  const representative: CivilDateTime = {
    year: solarDate.year,
    month: solarDate.month,
    day: solarDate.day,
    hour: repHour,
    minute: repMinute,
    second: 0,
  };
  const representativeEpochMs = utcMsFromKoreaCivilTime(representative);

  // 2) 절기 연도 (입춘 기준) → 년주
  const solarYear = solarYearOf(solarDate.year, representativeEpochMs);
  const yearPillar = pillarFromIndex("year", yearGanZhiIndex(solarYear));

  // 3) 월주 — 절기 경계(절기 시각 기준) + 五虎遁
  const boundary = monthBoundaryAt(representativeEpochMs);
  const monthPillar = pillarFromIndex("month", monthGanZhiIndex(solarYear, boundary.monthBranchIndex));

  // 4) 일주 — 조자시 규칙으로 날짜 보정
  const dayPillarDate = isZi && ziMode === "조자시" ? addDays(solarDate, 1) : solarDate;
  const dayPillar = pillarFromIndex("day", dayGanZhiIndex(dayPillarDate));
  const dayMaster = dayPillar.stem;

  // 5) 시주 — 五子遁 (시주 미상이면 계산하지 않는다)
  const hourPillar =
    hourUnknown || timeBranchIndex === null
      ? null
      : pillarFromIndex("hour", hourGanZhiIndex(dayMaster, timeBranchIndex));

  const basis: CalculationBasis = {
    solarDate,
    representativeKoreaTime: {
      year: representative.year,
      month: representative.month,
      day: representative.day,
      hour: representative.hour,
      minute: representative.minute,
    },
    representativeEpochMs,
    solarYear,
    monthBoundaryTerm: boundary.term.definition.name,
    monthBranchIndex: boundary.monthBranchIndex,
    dayPillarDate,
    hourUnknown,
    ziMode: isZi ? (ziMode ?? "자정") : null,
    directionRule: input.gender ? "성별순역" : "간지순역",
  };

  return {
    year: withDayMaster(yearPillar, dayMaster),
    month: withDayMaster(monthPillar, dayMaster),
    day: withDayMaster(dayPillar, dayMaster),
    hour: hourPillar ? withDayMaster(hourPillar, dayMaster) : null,
    dayMaster,
    dayMasterElement: STEMS[STEM_INDEX[dayMaster]].element,
    basis,
    solarYear,
  };
}

/** 원국 기둥을 순서대로. 시주 미상이면 3개. */
export function pillarsOf(chart: FourPillars): readonly Pillar[] {
  return [chart.year, chart.month, chart.day, ...(chart.hour ? [chart.hour] : [])];
}

/** 원국 표기용 한 줄. 예: "丙午 庚寅 甲子 乙丑" */
export function chartText(chart: FourPillars): string {
  return pillarsOf(chart)
    .map((p) => `${p.stem}${p.branch}`)
    .join(" ");
}
