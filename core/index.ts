/**
 * Myeong Core 공개 API.
 *
 * 웹(`web/`)과 이메일(`email/`)은 **이 파일만** 가져간다.
 * 두 경로가 같은 함수를 호출하므로, 같은 날짜를 넣으면 같은 일운이 나온다.
 *
 * 계산 순서
 *   ① 입력 검증 → ② 달력 변환(음력 → 양력) → ③ 원국 4기둥
 *   → ④ 오행·월령·일간강약 → ⑤ 용신·희신 → ⑥ 대운(10년) → ⑦ 간(干支)
 *
 * 이 파일에는 네트워크·파일·환경 접근이 없다. 순수 계산만 한다.
 */

import {
  compareCivilDate,
  isValidSolarDate,
  type CivilDate,
  type CivilDateTime,
} from "./calendar/civilDate";
import type { ZiHourMode } from "./constants/timeBranches";
import { computeDaeun, type DaeunTimeline } from "./daeun/daeun";
import {
  dayMasterStrength,
  elementDistribution,
  elementFlowLines,
  moonCommandOf,
  voidBranchesOf,
  type DayMasterStrength,
  type ElementDistribution,
} from "./elements/elementBalance";
import { buildFortuneContext, type FortuneContext } from "./fortune/fortuneContext";
import { analyzeInteractions, type Interaction, type InteractionInput } from "./interactions/interactions";
import { drilldown, readFortune, type DrilldownStep } from "./interpretation/reading";
import type { FortuneReading } from "./interpretation/types";
import {
  LUNAR_SUPPORT_END,
  LUNAR_SUPPORT_START,
  formatLunarDate,
  leapMonthOfLunarYear,
  lunarMonthDaysOf,
  lunarToSolar,
  solarToLunar,
  type LunarDate,
} from "./lunar/lunarDate";
import { PILLAR_LABELS, computeFourPillars, pillarsOf, type FourPillars, type Pillar } from "./pillars/fourPillars";
import { seunRangeOf, wolunRangeOf } from "./periods/seunWolunIlun";
import { computeYongshin, type YongshinResult } from "./yongshin/yongshin";
import type { BirthInput, CalculationBasis, CalendarConversion, Gender } from "./types";
import { isValidRegion } from "../data/regions/regions";

/** 음력 표가 담는 연도 범위. */
export const LUNAR_SUPPORT_RANGE = Object.freeze({
  fromYear: LUNAR_SUPPORT_START.year,
  toYear: LUNAR_SUPPORT_END.year,
});

/** 사용자에게 그대로 보여줄 수 있는 입력 오류. 스택 트레이스를 포함하지 않는다. */
export class MyeongInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MyeongInputError";
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatCivilDate(d: CivilDate): string {
  return `${d.year}-${pad2(d.month)}-${pad2(d.day)}`;
}

export function formatCivilDateTime(d: CivilDateTime): string {
  return `${formatCivilDate(d)} ${pad2(d.hour)}:${pad2(d.minute)}`;
}

/* ------------------------------------------------------------------ 입력 검증 */

/**
 * 사용자 입력을 검증한다. 실패하면 사람이 읽을 메시지를 담은
 * `MyeongInputError` 를 던진다. 내부 상태나 개인정보는 담지 않는다.
 */
export function validateBirthInput(input: BirthInput): void {
  const { calendar, year, month, day, time } = input;

  if (calendar !== "solar" && calendar !== "lunar") {
    throw new MyeongInputError("달력을 선택해주세요.");
  }
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new MyeongInputError("잘못된 날짜입니다.");
  }

  if (calendar === "solar") {
    if (!isValidSolarDate(year, month, day)) {
      throw new MyeongInputError("잘못된 날짜입니다.");
    }
    if (compareCivilDate({ year, month, day }, LUNAR_SUPPORT_START) < 0 ||
        compareCivilDate({ year, month, day }, LUNAR_SUPPORT_END) > 0) {
      throw new MyeongInputError(
        `계산 가능한 범위는 ${formatCivilDate(LUNAR_SUPPORT_START)} ~ ${formatCivilDate(LUNAR_SUPPORT_END)} 입니다.`,
      );
    }
  } else {
    if (year < LUNAR_SUPPORT_RANGE.fromYear || year > LUNAR_SUPPORT_RANGE.toYear) {
      throw new MyeongInputError(
        `음력은 ${LUNAR_SUPPORT_RANGE.fromYear}년 ~ ${LUNAR_SUPPORT_RANGE.toYear}까지만 계산할 수 있습니다.`,
      );
    }
    if (month < 1 || month > 12) throw new MyeongInputError("잘못된 날짜입니다.");
    if (day < 1 || day > 30) throw new MyeongInputError("잘못된 날짜입니다.");
    if (typeof input.leapMonth !== "boolean") {
      throw new MyeongInputError("윤달 여부를 선택해주세요.");
    }
    // 윤달이 없는 달을 윤달로 요청했거나, 그 달의 실제 일수를 넘는 경우는 막는다.
    const leap = leapMonthOfLunarYear(year);
    if (input.leapMonth && leap !== month) {
      throw new MyeongInputError(
        leap === 0
          ? `${year}년은 윤달이 없는 해입니다.`
          : `${year}년은 ${leap}월이 윤달인 해입니다.`,
      );
    }
    const length = lunarMonthDaysOf(year, month, input.leapMonth);
    if (day > length) {
      throw new MyeongInputError(`음력 ${year}년 ${input.leapMonth ? "윤" : ""}${month}월은 ${length}일까지입니다.`);
    }
  }

  if (time.kind === "doubleHour") {
    if (!Number.isInteger(time.branchIndex) || time.branchIndex < 0 || time.branchIndex > 11) {
      throw new MyeongInputError("시진을 선택해주세요.");
    }
    if (time.branchIndex === 0 && !isZiMode(time.ziMode)) {
      throw new MyeongInputError("자시 기준을 선택해주세요.");
    }
  } else if (time.kind !== "unknown") {
    throw new MyeongInputError("출생시간을 선택해주세요.");
  }

  if (input.gender !== undefined && input.gender !== "남" && input.gender !== "여") {
    throw new MyeongInputError("성별을 선택해주세요.");
  }
  if (!input.region) {
    throw new MyeongInputError("출생지를 선택해주세요.");
  }
  if (!isValidRegion(input.region.sido, input.region.sigungu)) {
    throw new MyeongInputError("출생지를 선택해주세요.");
  }
}

function isZiMode(value: string): value is ZiHourMode {
  return value === "조자시" || value === "자정";
}

/* ------------------------------------------------------------------ 달력 변환 */

export interface CalendarConversionResult extends CalendarConversion {
  lunar: LunarDate;
  /** 사용자에게 보여줄 한 줄 설명 */
  summary: string;
}

/** 음력 입력을 양력으로 바꾼다. 결과는 반드시 사용자에게 보여준다. */
export function convertCalendar(input: BirthInput): CalendarConversionResult {
  validateBirthInput(input);
  if (input.calendar === "solar") {
    const solar: CivilDate = { year: input.year, month: input.month, day: input.day };
    const lunar = solarToLunar(solar);
    return {
      inputCalendar: "solar",
      inputText: formatCivilDate(solar),
      solarDate: solar,
      converted: false,
      lunar,
      summary: `양력 ${formatCivilDate(solar)} (음력 ${formatLunarDate(lunar)})`,
    };
  }
  // validateBirthInput 이 윤달 여부의 존재를 보장한다.
  const isLeap = input.leapMonth === true;
  const solar = lunarToSolar({ year: input.year, month: input.month, day: input.day, isLeapMonth: isLeap });
  const inputText = `음력 ${input.year}년 ${input.month}월 ${input.day}일${isLeap ? " (윤달)" : ""}`;
  return {
    inputCalendar: "lunar",
    inputText,
    solarDate: solar,
    converted: true,
    note: `음력 입력을 양력 ${formatCivilDate(solar)}로 바꾸어 계산합니다.`,
    lunar: { year: input.year, month: input.month, day: input.day, isLeapMonth: isLeap },
    summary: `${inputText} → 양력 ${formatCivilDate(solar)}`,
  };
}

/* ------------------------------------------------------------------ 결과 형태 */

export interface NatalAnalysis {
  chart: FourPillars;
  basis: CalculationBasis;
  pillars: readonly Pillar[];
  distribution: ElementDistribution;
  moonCommand: ReturnType<typeof moonCommandOf>;
  strength: DayMasterStrength;
  yongshin: YongshinResult;
  voidBranches: readonly [string, string];
  /** 원국 내부의 간(干支) */
  interactions: readonly Interaction[];
  /** 오행 생극제화 흐름표 */
  flow: ReturnType<typeof elementFlowLines>;
}

export interface SajuResult {
  input: BirthInput;
  conversion: CalendarConversionResult;
  natal: NatalAnalysis;
  daeun: DaeunTimeline;
}

export interface FortuneResult {
  context: FortuneContext;
  reading: FortuneReading;
  drilldown: readonly DrilldownStep[];
  /** 대운·세운의 기간 */
  seunRange: ReturnType<typeof seunRangeOf>;
  wolunRange: ReturnType<typeof wolunRangeOf>;
}

/* ------------------------------------------------------------------ 원국 */

/** 출생 정보로 원국을 계산한다. */
export function analyzeBirth(input: BirthInput): SajuResult {
  const conversion = convertCalendar(input);
  const chart = computeFourPillars({
    solarDate: conversion.solarDate,
    timeBranchIndex: input.time.kind === "doubleHour" ? input.time.branchIndex : null,
    ziMode: input.time.kind === "doubleHour" && input.time.branchIndex === 0 ? input.time.ziMode : null,
    gender: input.gender,
  });

  const distribution = elementDistribution(chart);
  const yongshin = computeYongshin(chart);
  const strength = dayMasterStrength(chart, distribution);
  const natalInputs: InteractionInput[] = pillarsOf(chart).map((p) => ({
    label: PILLAR_LABELS[p.position],
    position: p.position,
    pillar: p,
  }));

  return {
    input,
    conversion,
    natal: {
      chart,
      basis: chart.basis,
      pillars: pillarsOf(chart),
      distribution,
      moonCommand: distribution.moonCommand,
      strength,
      yongshin,
      voidBranches: voidBranchesOf(chart.day.ganZhiIndex),
      interactions: analyzeInteractions(natalInputs),
      flow: elementFlowLines(),
    },
    daeun: computeDaeun(chart, conversion.solarDate, input.gender),
  };
}

/* ------------------------------------------------------------------ 운세 */

/** 특정 날짜의 운세 전체를 계산한다. (웹·이메일이 함께 쓴다) */
export function analyzeFortune(result: SajuResult, date: CivilDate): FortuneResult {
  const context = buildFortuneContext({
    chart: result.natal.chart,
    date,
    gender: result.input.gender,
  });
  const dateLabel = `${formatCivilDate(date)} ${TIME_BRANCHES_LABEL}`;
  const reading = readFortune(context, { dateLabel });
  return {
    context,
    reading,
    drilldown: drilldown(context, reading),
    seunRange: seunRangeOf(date),
    wolunRange: wolunRangeOf(date),
  };
}

const TIME_BRANCHES_LABEL = "(한국 시간 기준)";

/* ------------------------------------------------------------------ 기간 비교 */

export interface PeriodComparisonRow {
  label: string;
  a: string;
  b: string;
  same: boolean;
}

export interface PeriodComparison {
  aDate: CivilDate;
  bDate: CivilDate;
  rows: readonly PeriodComparisonRow[];
  /** 두 기간에 공통으로 걸린 간(干支) */
  sharedInteractions: readonly Interaction[];
  /** a 에만 있는 간 */
  onlyA: readonly Interaction[];
  onlyB: readonly Interaction[];
  note: string;
}

/**
 * 두 기간을 비교한다.
 * 좋은/나쁜 판정이나 점수를 만들지 않고 **구조가 어디서 다른지**만 나열한다.
 */
export function comparePeriods(
  result: SajuResult,
  aDate: CivilDate,
  bDate: CivilDate,
): PeriodComparison {
  const a = analyzeFortune(result, aDate);
  const b = analyzeFortune(result, bDate);

  const rows: PeriodComparisonRow[] = [];
  const row = (label: string, av: string, bv: string) =>
    rows.push({ label, a: av, b: bv, same: av === bv });

  row("대운", a.context.daeun?.ganZhi ?? "—", b.context.daeun?.ganZhi ?? "—");
  row("세운", a.context.seun.ganZhi, b.context.seun.ganZhi);
  row("월운", a.context.wolun.ganZhi, b.context.wolun.ganZhi);
  row("일운", a.context.ilun.ganZhi, b.context.ilun.ganZhi);
  row("세운 십신", a.context.seun.tenGod, b.context.seun.tenGod);
  row("월운 십신", a.context.wolun.tenGod, b.context.wolun.tenGod);
  row("일운 십신", a.context.ilun.tenGod, b.context.ilun.tenGod);
  row("월운 절기", a.wolunRange.termName, b.wolunRange.termName);

  for (const section of a.reading.sections) {
    const other = b.reading.sections.find((s) => s.topic === section.topic);
    if (!other) continue;
    row(`${section.topic} 기세`, section.intensity, other.intensity);
    row(`${section.topic} 방향`, section.direction, other.direction);
  }

  // 같은 유형·같은 구조라도 **어느 자리끼리** 붙었는지가 다르면 다른 간이다.
  // (예: 巳酉 반합이 년지↔월지에서도, 월지↔일지에서도 성립한다)
  const keyOf = (i: Interaction): string =>
    `${i.type}:${i.description}:${[...i.participants].join("+")}`;
  const aKeys = new Set(a.context.interactions.map(keyOf));
  const bKeys = new Set(b.context.interactions.map(keyOf));
  const shared = a.context.interactions.filter((i) => bKeys.has(keyOf(i)));

  return {
    aDate,
    bDate,
    rows,
    sharedInteractions: shared,
    onlyA: a.context.interactions.filter((i) => !bKeys.has(keyOf(i))),
    onlyB: b.context.interactions.filter((i) => !aKeys.has(keyOf(i))),
    note: "두 기간의 차이는 사주 구조가 달라진 지점이다. 좋은 쪽과 나쁜 쪽을 정하지 않는다.",
  };
}

/* ------------------------------------------------------------------ 재수출 */

export type { BirthInput, CalendarConversion, CalculationBasis, Gender };
export type { FourPillars, Pillar, PillarPosition } from "./pillars/fourPillars";
export type { ZiHourMode } from "./constants/timeBranches";
export type { Daeun, DaeunTimeline } from "./daeun/daeun";
export type { FortuneContext } from "./fortune/fortuneContext";
export type { DrilldownStep } from "./interpretation/reading";
export type { PeriodKind, PeriodPillar } from "./periods/period";
export { PERIOD_KIND_LABELS } from "./periods/period";
export { daeunOfDate } from "./daeun/daeun";
export type { SolarTermInstant } from "./solar_terms/solarTerms";
export type { ElementDistribution, MoonCommand } from "./elements/elementBalance";
export type { YongshinDecision, YongshinResult } from "./yongshin/yongshin";
export type {
  Caution,
  Direction,
  Evidence,
  FortuneReading,
  FortuneSection,
  FortuneTopic,
  Intensity,
  KeyPoint,
  Layer,
} from "./interpretation/types";
export { FORTUNE_TOPICS, INTENSITY_LABELS, DRILLDOWN_CHAIN } from "./interpretation/types";
export { YONGSHIN_RULE_ID } from "./yongshin/yongshin";
export {
  DISCLAIMER_SHORT,
  DISCLAIMER_TEXT,
  RULES,
  ruleById,
  rulesOfCategory,
  type RuleCategory,
  type RuleDoc,
} from "../data/rules/rules";
export {
  TERMS,
  TERM_CATEGORIES,
  termByName,
  termsOfCategory,
  type TermCategory,
  type TermDoc,
} from "../data/rules/terms";
export { todayInKorea } from "./calendar/koreaTime";
export { TIME_BRANCHES } from "./constants/timeBranches";
export {
  compareCivilDate,
  formatIsoDate,
  isValidSolarDate,
  parseIsoDate,
  type CivilDate,
  type CivilDateTime,
} from "./calendar/civilDate";
export { koreaCivilDate, koreaCivilTime } from "./calendar/koreaTime";
export {
  formatLunarDate,
  isLeapLunarYear,
  LUNAR_SUPPORT_END,
  LUNAR_SUPPORT_START,
  leapMonthOfLunarYear,
  type LunarDate,
} from "./lunar/lunarDate";
export { ELEMENT_COLOR, ELEMENT_KOREAN } from "./elements/elementBalance";
export {
  ELEMENT_LABELS,
  FIVE_ELEMENTS,
  type EarthlyBranch,
  type FiveElement,
  type HeavenlyStem,
  type Season,
  type YinYang,
} from "./constants/stems";
export {
  REGIONS,
  SIDO_LIST,
  SIDO_WITHOUT_SIGUNGU,
  isValidRegion,
  regionText,
  sigunguListOf,
  type Region,
} from "../data/regions/regions";
export {
  INTERACTION_TYPE_LABELS,
  type Interaction,
  type InteractionType,
} from "./interactions/interactions";
export { TEN_GODS, TEN_GOD_GROUP, type TenGod, type TenGodGroup } from "./ten_gods/tenGods";
export { TWELVE_STAGES, type TwelveStageName } from "./twelve_stages/twelveStages";
