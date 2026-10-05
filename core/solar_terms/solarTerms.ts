/**
 * 24절기 (二十四節氣) 시각 계산.
 *
 * 규칙 (RULE_TERM_001 · RULE_TERM_002 · RULE_TERM_003 · RULE_SUNLONG_001, docs/calculation-rules.md)
 * - 한 개의 절기 = 태양의 겉보기황도가 정해진 각도(15° 배수)에 이르는 순간.
 * - 계산은 천체력시(TT)로 하고 ΔT 만큼 보정해 지구시(UT)로 옮긴 뒤,
 *   한국 현지시각(KST) 벽시계로 표시한다.
 * - 같은 `year` 로 묶는 절기는 서기 연도가 같은 해에 속하는 것끼리다.
 *   (예: 2026-01-05 소한, 2026-01-20 대한, …, 2026-12-22 동지)
 *
 * 정확도에 관한 고지는 docs/calculation-rules.md 의 "절기 기준" 절을 본다.
 */

import type { CivilDate, CivilDateTime } from "../calendar/civilDate";
import { koreaCivilTime, utcMsFromKoreaCivilTime } from "../calendar/koreaTime";
import { deltaTSeconds } from "./deltaT";
import { J2000_JD, sunPosition } from "./sunLongitude";

export type SolarTermName =
  | "소한" | "대한" | "입춘" | "우수" | "경칩" | "춘분" | "청명" | "곡우"
  | "입하" | "소만" | "망종" | "하지" | "소서" | "대서" | "입추" | "처서"
  | "백로" | "추분" | "한로" | "상강" | "입동" | "소설" | "대설" | "동지";

export interface SolarTermDefinition {
  /** 0-23, 소한 = 0 */
  index: number;
  name: SolarTermName;
  hanja: string;
  /** 겉보기황도 (도) */
  longitude: number;
  /** 구분 절기(12개의 節) 여부 — 월주 경계에 쓰이는 절기 */
  isJie: boolean;
  /** 이 절기가 시작하는 사월의 지지 인덱스 (0 = 子). 12개 節만 값을 갖는다. */
  monthBranchIndex: number;
  /** 이 절기가 새해의 시작으로 삼아지는 절기인지 (입춘) */
  isNewYearBoundary: boolean;
}

const NAMES: ReadonlyArray<readonly [SolarTermName, string, number, boolean]> = [
  ["소한", "小寒", 285, true],
  ["대한", "大寒", 300, false],
  ["입춘", "立春", 315, true],
  ["우수", "雨水", 330, false],
  ["경칩", "驚蟄", 345, true],
  ["춘분", "春分", 0, false],
  ["청명", "清明", 15, true],
  ["곡우", "穀雨", 30, false],
  ["입하", "立夏", 45, true],
  ["소만", "小滿", 60, false],
  ["망종", "芒種", 75, true],
  ["하지", "夏至", 90, false],
  ["소서", "小暑", 105, true],
  ["대서", "大暑", 120, false],
  ["입추", "立秋", 135, true],
  ["처서", "處暑", 150, false],
  ["백로", "白露", 165, true],
  ["추분", "秋分", 180, false],
  ["한로", "寒露", 195, true],
  ["상강", "霜降", 210, false],
  ["입동", "立冬", 225, true],
  ["소설", "小雪", 240, false],
  ["대설", "大雪", 255, true],
  ["동지", "冬至", 270, false],
];

/**
 * 24절기 정의표. 순서는 소한(285°) → 동지(270°) 로 이어진다.
 */
export const SOLAR_TERMS: readonly SolarTermDefinition[] = NAMES.map(([name, hanja, longitude, isJie], index) => ({
  index,
  name,
  hanja,
  longitude,
  isJie,
  // 12개 節는 인월(寅, index 2)부터 자월(子, index 0)까지 차례로 대응한다.
  monthBranchIndex: isJie ? ((index - 2) / 2 + 2) % 12 : -1,
  isNewYearBoundary: name === "입춘",
}));

export const SOLAR_TERM_BY_NAME: Readonly<Record<SolarTermName, SolarTermDefinition>> = Object.freeze(
  SOLAR_TERMS.reduce(
    (acc, t) => {
      acc[t.name] = t;
      return acc;
    },
    {} as Record<SolarTermName, SolarTermDefinition>,
  ),
);

/** 구분 절기(12개의 節)만 순서대로. 월주 계산에 쓰인다. */
export const JIE_QI: readonly SolarTermDefinition[] = SOLAR_TERMS.filter((t) => t.isJie);

const JIE_BY_MONTH_BRANCH_INDEX: readonly SolarTermDefinition[] = (() => {
  const arr: SolarTermDefinition[] = new Array(12);
  for (const t of SOLAR_TERMS) {
    if (t.isJie) arr[t.monthBranchIndex] = t;
  }
  return arr;
})();

/** 지지 인덱스(0=子) → 그 달의 경계를 이루는 절기. */
export function jieForMonthBranch(branchIndex: number): SolarTermDefinition {
  const t = JIE_BY_MONTH_BRANCH_INDEX[((branchIndex % 12) + 12) % 12];
  if (!t) throw new Error(`절기를 찾을 수 없습니다: ${branchIndex}`);
  return t;
}

const MS_PER_DAY = 86_400_000;
/** 2000-01-01 12:00 TT = JD 2451545.0 에 해당하는 epoch ms. */
const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
/** 절기 시각 산출의 초기추정치(분). 정확한 값이 아니라 뉴턴 반복의 출발점일 뿐이다. */
const TERM_MINUTE_ESTIMATE: readonly number[] = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693,
  263343, 285989, 308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758,
];
/** 초기추정치의 기준 순간: 1900-01-06 02:05 UT. */
const TERM_EPOCH_JD = 2415020.59375;

function norm360(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

/** 황도각 차이를 [-180, 180) 구간으로 접는다. */
function normalizeDelta(delta: number): number {
  const d = norm360(delta);
  return d >= 180 ? d - 360 : d;
}

/** 겉보기황도가 `targetLongitude` 에 도달하는 Julian Day (TT). */
function solveApparentLongitude(jdApprox: number, targetLongitude: number): number {
  let jde = jdApprox;
  for (let i = 0; i < 12; i += 1) {
    const year = 2000 + (jde - J2000_JD) / 365.25;
    const tt = jde + deltaTSeconds(year) / MS_PER_DAY;
    const diff = normalizeDelta(targetLongitude - sunPosition(tt).apparentLongitude);
    jde += diff / 0.9856473;
    if (Math.abs(diff) < 1e-9) break;
  }
  return jde;
}

/** 해당 연도 · 절기 인덱스의 절기 시각 (JD, TT). */
function termJulianDayTT(year: number, termIndex: number): number {
  const meanTermMs = 31556925974.7 * (year - 1900) + TERM_MINUTE_ESTIMATE[termIndex] * 60_000;
  // 초기추정치의 기준: 1900-01-06 02:05 UT (= JD 2415020.59375)
  const jdApprox = TERM_EPOCH_JD + meanTermMs / MS_PER_DAY;
  return solveApparentLongitude(jdApprox, SOLAR_TERMS[termIndex].longitude);
}

const yearCache = new Map<number, readonly SolarTermInstant[]>();

export interface SolarTermInstant {
  definition: SolarTermDefinition;
  /** 이 절기가 속한 절기 연도 (입춘 기준) */
  year: number;
  /** UTC 밀리초 (TT − ΔT) */
  epochMs: number;
  /** KST 벽시계 시각 */
  koreaTime: CivilDateTime;
  /** KST 날짜 */
  koreaDate: CivilDate;
  /** KST 자정부터 지난 분 (소수) */
  koreaMinuteOfDay: number;
}

/** `year` 절기연도의 24절기 (소한 → 동지) 시각 목록. 순서 고정, 결과는 캐시된다. */
export function solarTermsOfYear(year: number): readonly SolarTermInstant[] {
  const cached = yearCache.get(year);
  if (cached) return cached;
  if (!Number.isInteger(year) || year < 1000 || year > 3000) {
    throw new Error(`절기 계산 지원 연도 범위를 벗어났습니다: ${year}`);
  }
  const list: SolarTermInstant[] = SOLAR_TERMS.map((definition) => {
    const jde = termJulianDayTT(year, definition.index);
    const deltaT = deltaTSeconds(2000 + (jde - J2000_JD) / 365.25);
    const jdUT = jde - deltaT / MS_PER_DAY;
    const epochMs = Math.round(J2000_EPOCH_MS + (jdUT - J2000_JD) * MS_PER_DAY);
    const koreaTime = koreaCivilTime(epochMs);
    return {
      definition,
      year,
      epochMs,
      koreaTime,
      koreaDate: { year: koreaTime.year, month: koreaTime.month, day: koreaTime.day },
      koreaMinuteOfDay: koreaTime.hour * 60 + koreaTime.minute + koreaTime.second / 60,
    };
  });
  yearCache.set(year, list);
  return list;
}

/** 특정 절기의 시각. */
export function solarTerm(year: number, name: SolarTermName): SolarTermInstant {
  const found = solarTermsOfYear(year).find((t) => t.definition.name === name);
  if (!found) throw new Error(`절기를 찾을 수 없습니다: ${year} ${name}`);
  return found;
}

/** KST 벽시계 시각 → UTC 밀리초. */
export function kstInstant(date: CivilDateTime): number {
  return utcMsFromKoreaCivilTime(date);
}

export interface MonthBoundary {
  /** 이 경계 절기 이후에 시작하는 사월의 지지 인덱스 */
  monthBranchIndex: number;
  /** 경계를 이루는 절기 */
  term: SolarTermInstant;
}

/**
 * UTC 순간 `epochMs` 에 적용되는 월주(사월) 경계.
 *
 * - 소한 이전(연초 1/1 ~ 소한)은 전년도 12월 구간이므로 **전년도 대설** 경계를 쓴다.
 * - 그 외에는 그 순간까지 지난 마지막 **구분 절기**를 쓴다.
 * - 절기가 지난 **순간**부터 새 사월이 시작된다. 비교는 초 단위까지 한다.
 */
export function monthBoundaryAt(epochMs: number): MonthBoundary {
  // KST 벽시계 연도로 절기표를 고른다. 자정 직후(UTC 15:00 이전)면 아직 그해다.
  const kst = koreaCivilTime(epochMs);
  const year = kst.year;
  const terms = solarTermsOfYear(year);
  const sohan = terms[SOLAR_TERM_BY_NAME["소한"].index];
  if (epochMs < sohan.epochMs) {
    // 1월 초: 자월(子, index 0)의 경계는 전년도 12월의 대설(大雪)이다.
    const daesul = solarTermsOfYear(year - 1)[SOLAR_TERM_BY_NAME["대설"].index];
    return { monthBranchIndex: daesul.definition.monthBranchIndex, term: daesul };
  }
  let boundary = sohan;
  for (const t of terms) {
    if (t.definition.isJie && t.epochMs <= epochMs && t.epochMs >= boundary.epochMs) {
      boundary = t;
    }
  }
  return { monthBranchIndex: boundary.definition.monthBranchIndex, term: boundary };
}

/**
 * KST 날짜 `date` **자정** 시점의 월주(사월) 경계.
 * 날짜만 있고 시각이 없을 때(캘린더 등) 쓴다.
 * 출생 시각이 있으면 `monthBoundaryAt(representativeEpochMs)` 를 쓴다.
 */
export function monthBoundaryOf(date: CivilDate): MonthBoundary {
  return monthBoundaryAt(kstInstant({ ...date, hour: 0, minute: 0, second: 0 }));
}
