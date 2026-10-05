/**
 * 한국 시간(KST) 처리.
 *
 * 프로젝트의 시간 기준은 **한국 표준시**로 고정한다.
 * (역서 기준 · 진태양시 보정 미적용 — docs/calculation-rules.md 참조)
 *
 * 1. 기본 오프셋은 UTC+9 이다.
 * 2. 한국은 1948·1951·1987·1988년에 서머타임을 운영했다. 출생 초의 인스턴스
 *    계산에 영향을 줄 수 있으므로 해당 기간만 UTC+10 을 적용한다.
 * 3. 서머타임 기간의 경계는 KST 표준시 자정으로 표시된 값이며, 본 구현은
 *    알려진 운영 기간을 그대로 표로 관리한다.
 *
 * 서머타임 **없음 구간** (1948-09-13 ~ 1951-06-01 등)에서 벽시계 → UTC 왕복은
 * 언제나 성립한다. 서머타임 **시작 당일 00:00~00:59** 은 시계가 00:00 → 01:00
 * 로 뛰어넘어 실제 존재하지 않는 시각이므로 왕복이 성립하지 않는다
 * (요청 00:00 → UTC 14:00Z → KST 23:59). 이 한 시간 구간만 예외이며,
 * 결정론을 위해 항상 **전환 이전 순간**으로 고정한다. 출생 입력은 시진 단위라
 * 이 구간이 사주에 미치는 영향은 없다.
 *
 * 주의: 출생 입력은 "시진(12략자)" 단위이므로 정밀 시각을 알 수 없다.
 * 서머타임 보정으로 시진이 바뀌지는 않으며, 절기 경계 판단과 대운 시작
 * 계산에서 1시간 이내의 미세한 차이만 발생한다.
 */

import { MS_PER_MINUTE, type CivilDate, type CivilDateTime } from "./civilDate";

export const KST_OFFSET_MINUTES = 9 * 60;
export const KST_DST_OFFSET_MINUTES = 10 * 60;

/** KST 서머타임 운영 기간 (UTC ms 구간). */
const KST_DST_PERIODS: ReadonlyArray<readonly [number, number]> = [
  [toUtcMsFromKstCivil({ year: 1948, month: 6, day: 1, hour: 0, minute: 0, second: 0 }),
   toUtcMsFromKstCivil({ year: 1948, month: 9, day: 13, hour: 0, minute: 0, second: 0 })],
  [toUtcMsFromKstCivil({ year: 1951, month: 6, day: 1, hour: 0, minute: 0, second: 0 }),
   toUtcMsFromKstCivil({ year: 1951, month: 9, day: 9, hour: 0, minute: 0, second: 0 })],
  [toUtcMsFromKstCivil({ year: 1987, month: 5, day: 24, hour: 0, minute: 0, second: 0 }),
   toUtcMsFromKstCivil({ year: 1987, month: 10, day: 24, hour: 0, minute: 0, second: 0 })],
  [toUtcMsFromKstCivil({ year: 1988, month: 5, day: 8, hour: 0, minute: 0, second: 0 }),
   toUtcMsFromKstCivil({ year: 1988, month: 10, day: 24, hour: 0, minute: 0, second: 0 })],
];

function toUtcMsFromKstCivil(dt: CivilDateTime): number {
  return Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second) - KST_OFFSET_MINUTES * MS_PER_MINUTE;
}

/**
 * 주어진 UTC 순간에 적용되는 한국 시간 오프셋(분).
 * KST_DST_PERIODS 는 모듈 초기화 시 계산되므로 순수 함수다.
 */
export function koreaOffsetMinutes(epochMs: number): number {
  for (const [start, end] of KST_DST_PERIODS) {
    if (epochMs >= start && epochMs < end) return KST_DST_OFFSET_MINUTES;
  }
  return KST_OFFSET_MINUTES;
}

export function isKstDaylightSaving(epochMs: number): boolean {
  return koreaOffsetMinutes(epochMs) === KST_DST_OFFSET_MINUTES;
}

/** UTC 순간 → 한국 현지 시각(벽시계). */
export function koreaCivilTime(epochMs: number): CivilDateTime {
  const shifted = new Date(epochMs + koreaOffsetMinutes(epochMs) * MS_PER_MINUTE);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/** UTC 순간 → 한국 현지 날짜. */
export function koreaCivilDate(epochMs: number): CivilDate {
  const t = koreaCivilTime(epochMs);
  return { year: t.year, month: t.month, day: t.day };
}

/** 한국 현지 벽시계 → UTC 순간. 서머타임 경계의 모호함은 한 번의 재검사로 흡수한다. */
export function utcMsFromKoreaCivilTime(dt: CivilDateTime): number {
  const wall = Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second, 0);
  const guess = wall - KST_OFFSET_MINUTES * MS_PER_MINUTE;
  const refined = wall - koreaOffsetMinutes(guess) * MS_PER_MINUTE;
  return refined;
}

/**
 * "한국의 오늘".
 *
 * 웹 화면과 GitHub Actions 이메일이 같은 날짜를 보도록 하기 위해,
 * 두 경로 모두 이 함수 하나로 기준 날짜를 정한다. (UTC/KST 문제 차단)
 */
export function todayInKorea(nowMs: number = Date.now()): CivilDate {
  return koreaCivilDate(nowMs);
}
