import { describe, expect, it } from "vitest";
import {
  LUNAR_INFO,
  LUNAR_INFO_END_YEAR,
  LUNAR_INFO_START_YEAR,
  isLeapLunarYear,
  leapMonthDaysOf,
  leapMonthOfLunarYear,
  lunarMonthDaysOf,
  lunarYearDays,
} from "../data/lunar/lunarInfo";
import {
  LUNAR_SUPPORT_END,
  LUNAR_SUPPORT_START,
  LunarConversionError,
  formatLunarDate,
  lunarToSolar,
  solarToLunar,
} from "../core/lunar/lunarDate";
import { addDays, compareCivilDate, differenceInDays, formatIsoDate, type CivilDate } from "../core/calendar/civilDate";
import { SOLAR_TERMS, solarTermsOfYear } from "../core/solar_terms/solarTerms";
import cnyFixture from "./fixtures/cny-1900-2099.json";

/**
 * 설날 기준표.
 * pinyin.info Chinese New Year 1900-1999 / 2000-2099 로 만든 테스트 전용 픽스처.
 * (香港天文台 「公曆與農曆日期對照表」와 교차 확인한 값이다.)
 */
const CNY = cnyFixture as unknown as Record<string, string>;

/**
 * 중기(中氣) — 겉보기 태양황경이 30° 배수인 절기 12개.
 * 참고: "중기"는 발음이 같지만 음양력 판정에서 쓰는 것은 **중기(中氣)** 이다.
 */
const ZHONG_QI = SOLAR_TERMS.filter((t) => t.longitude % 30 === 0).map((t) => t.name);

/** 중국 표준시(UTC+8) 오프셋 — 음력 표의 기준 시간대. */
const CST_OFFSET_MS = 8 * 60 * 60_000;

/** UTC 밀리초 → UTC+8 벽시계 날짜. (음력 규칙은 UTC+8 자정으로 판정한다) */
function chinaStandardDate(epochMs: number): CivilDate {
  const d = new Date(epochMs + CST_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function zhongQiDatesIn(year: number): CivilDate[] {
  return solarTermsOfYear(year)
    .filter((t) => t.definition.longitude % 30 === 0)
    .map((t) => chinaStandardDate(t.epochMs));
}

function winterSolstice(year: number): CivilDate {
  const term = solarTermsOfYear(year).find((t) => t.definition.name === "동지");
  if (!term) throw new Error(`동지를 찾을 수 없습니다: ${year}`);
  return chinaStandardDate(term.epochMs);
}

/**
 * 음력 달의 순서. 윤달이 있으면 해당 번호 뒤에 삽입된다.
 * (core/lunar/lunarDate.ts 의 monthSequenceOf 와 같은 규칙)
 */
function monthSequenceOf(lunarYear: number): Array<{ month: number; isLeapMonth: boolean }> {
  const leap = leapMonthOfLunarYear(lunarYear);
  const seq: Array<{ month: number; isLeapMonth: boolean }> = [];
  for (let m = 1; m <= 12; m += 1) {
    seq.push({ month: m, isLeapMonth: false });
    if (leap === m) seq.push({ month: m, isLeapMonth: true });
  }
  return seq;
}

/** 음력 달 한 개의 [시작, 다음 달 시작) 구간. */
function monthSpan(
  lunarYear: number,
  month: number,
  leap: boolean,
): { start: CivilDate; end: CivilDate } {
  const seq = monthSequenceOf(lunarYear);
  const i = seq.findIndex((s) => s.month === month && s.isLeapMonth === leap);
  const start = lunarToSolar({ year: lunarYear, month, day: 1, isLeapMonth: leap });
  const end =
    i + 1 < seq.length
      ? lunarToSolar({ year: lunarYear, month: seq[i + 1].month, day: 1, isLeapMonth: seq[i + 1].isLeapMonth })
      : lunarToSolar({ year: lunarYear + 1, month: 1, day: 1, isLeapMonth: false });
  return { start, end };
}

function containsDate(start: CivilDate, end: CivilDate, d: CivilDate): boolean {
  return compareCivilDate(d, start) >= 0 && compareCivilDate(d, end) < 0;
}

function hasZhongQi(start: CivilDate, end: CivilDate): boolean {
  for (let y = start.year; y <= end.year; y += 1) {
    for (const d of zhongQiDatesIn(y)) if (containsDate(start, end, d)) return true;
  }
  return false;
}

describe("음력 표 자체", () => {
  it("1900~2100 을 201개로 담는다", () => {
    expect(LUNAR_INFO.length).toBe(201);
    expect(LUNAR_INFO_START_YEAR).toBe(1900);
    expect(LUNAR_INFO_END_YEAR).toBe(2100);
  });

  it("모든 항목이 17비트 이내이며 윤월 번호가 1~12 다", () => {
    for (const [i, info] of LUNAR_INFO.entries()) {
      const year = LUNAR_INFO_START_YEAR + i;
      expect(info, String(year)).toBeLessThan(0x20000);
      expect(info, String(year)).toBeGreaterThanOrEqual(0);
      const leap = info & 0xf;
      expect(leap, String(year)).toBeGreaterThanOrEqual(0);
      expect(leap, String(year)).toBeLessThanOrEqual(12);
    }
  });

  it("월 일수는 29 또는 30 이다", () => {
    for (let y = LUNAR_INFO_START_YEAR; y <= LUNAR_INFO_END_YEAR; y += 1) {
      for (let m = 1; m <= 12; m += 1) {
        expect([29, 30], `${y}년 ${m}월`).toContain(lunarMonthDaysOf(y, m, false));
      }
      const leap = leapMonthDaysOf(y);
      if (leap > 0) expect([29, 30], `${y}년 윤${leap}월`).toContain(leap);
      else expect(leap).toBe(0);
    }
  });

  it("연 총 일수는 353~385 이다", () => {
    for (let y = LUNAR_INFO_START_YEAR; y <= LUNAR_INFO_END_YEAR; y += 1) {
      const days = lunarYearDays(y);
      expect(days, String(y)).toBeGreaterThanOrEqual(353);
      expect(days, String(y)).toBeLessThanOrEqual(385);
    }
  });

  it("윤달이 있는 해는 13개월이므로 최소 383일이다", () => {
    for (let y = LUNAR_INFO_START_YEAR; y <= LUNAR_INFO_END_YEAR; y += 1) {
      const days = lunarYearDays(y);
      if (isLeapLunarYear(y)) expect(days, String(y)).toBeGreaterThanOrEqual(383);
      else expect(days, String(y)).toBeLessThanOrEqual(355);
    }
  });
});

describe("설날 (음력 1월 1일) — 권위 있는 간지표 대조", () => {
  it("1900~2099년 200개 해가 모두 일치한다", () => {
    const years = Object.keys(CNY)
      .map(Number)
      .filter((y) => Number.isInteger(y))
      .sort((a, b) => a - b);
    expect(years).toHaveLength(200);
    expect(years[0]).toBe(1900);
    expect(years[years.length - 1]).toBe(2099);

    const mismatches: string[] = [];
    for (const y of years) {
      const got = formatIsoDate(lunarToSolar({ year: y, month: 1, day: 1, isLeapMonth: false }));
      if (got !== CNY[String(y)]) mismatches.push(`${y}: ${got} != ${CNY[String(y)]}`);
    }
    expect(mismatches).toEqual([]);
  });

  it("잘 알려진 설날", () => {
    const spot: Array<[number, string]> = [
      [1900, "1900-01-31"],
      [1987, "1987-01-29"],
      [1990, "1990-01-27"],
      [2000, "2000-02-05"],
      [2020, "2020-01-25"],
      [2023, "2023-01-22"],
      [2024, "2024-02-10"],
      [2025, "2025-01-29"],
      [2026, "2026-02-17"],
      [2099, "2099-01-21"],
    ];
    for (const [year, iso] of spot) {
      expect(formatIsoDate(lunarToSolar({ year, month: 1, day: 1, isLeapMonth: false })), String(year)).toBe(iso);
    }
  });
});

describe("윤달 규칙 — 1900~2100 전 구간 검증", () => {
  interface MonthSpan {
    year: number;
    month: number;
    isLeapMonth: boolean;
    start: CivilDate;
    end: CivilDate;
    lengthDays: number;
  }

  /** 지원 범위 안의 모든 음력 달을 시간순으로 나열한다. */
  const allMonths: MonthSpan[] = (() => {
    const out: MonthSpan[] = [];
    let cursor = LUNAR_SUPPORT_START;
    for (;;) {
      const lunarYear = solarToLunar(cursor).year;
      const seq = monthSequenceOf(lunarYear);
      let idx = -1;
      for (const [i, s] of seq.entries()) {
        const s1 = lunarToSolar({ year: lunarYear, month: s.month, day: 1, isLeapMonth: s.isLeapMonth });
        if (differenceInDays(cursor, s1) >= 0) idx = i;
      }
      if (idx < 0) break;
      const e = seq[idx];
      const { start, end } = monthSpan(lunarYear, e.month, e.isLeapMonth);
      out.push({
        year: lunarYear,
        month: e.month,
        isLeapMonth: e.isLeapMonth,
        start,
        end,
        lengthDays: differenceInDays(end, start),
      });
      if (differenceInDays(end, LUNAR_SUPPORT_END) >= 0) break;
      cursor = end;
    }
    return out;
  })();

  /** 이 달이 동지를 포함하는지. 포함하면 그 동지 날짜를 돌려준다. */
  const solsticeIn = allMonths.map((m) => {
    for (const y of [m.start.year - 1, m.start.year]) {
      const w = winterSolstice(y);
      if (containsDate(m.start, m.end, w)) return w;
    }
    return null;
  });

  /** 세운(歲) = 동지를 포함하는 달부터 다음 동지 달 직전까지. */
  const suis: Array<{ solstice: CivilDate; months: MonthSpan[] }> = [
    { solstice: winterSolstice(1899), months: [] },
  ];
  for (const [i, m] of allMonths.entries()) {
    if (solsticeIn[i]) suis.push({ solstice: solsticeIn[i], months: [] });
    suis[suis.length - 1].months.push(m);
  }

  it("검사에 필요한 입력값이 모두 채워진다 (2485개월 / 202세운 / 윤달 74개)", () => {
    expect(allMonths.length).toBe(2485);
    expect(suis.length).toBe(202);
    expect(allMonths.filter((m) => m.isLeapMonth).length).toBe(74);
  });

  it("규칙1: 윤달에는 중기(中氣)가 없다", () => {
    const bad = allMonths
      .filter((m) => m.isLeapMonth && hasZhongQi(m.start, m.end))
      .map((m) => `${m.year}년 윤${m.month}월 ${formatIsoDate(m.start)}`);
    expect(bad).toEqual([]);
  });

  it("규칙2: 동지를 포함하는 달은 반드시 11월 또는 윤11월이다", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const [i, m] of allMonths.entries()) {
      if (!solsticeIn[i]) continue;
      checked += 1;
      if (m.month !== 11) bad.push(`${formatIsoDate(solsticeIn[i])} → ${m.year}년 ${m.month}월`);
    }
    expect(checked).toBe(201);
    expect(bad).toEqual([]);
  });

  it("규칙3: 동지를 포함한 달에는 반드시 중기가 있다 (윤11월은 정의상 제외)", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const [i, m] of allMonths.entries()) {
      if (!solsticeIn[i] || m.isLeapMonth) continue;
      checked += 1;
      if (!hasZhongQi(m.start, m.end)) bad.push(`${m.year}년 11월 ${formatIsoDate(m.start)}`);
    }
    expect(checked).toBe(201);
    expect(bad).toEqual([]);
  });

  it("규칙4: 세운은 12개월(윤달 0개) 또는 13개월(윤달 1개)이다", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const s of suis) {
      if (s.months.length < 12) continue;
      checked += 1;
      const leaps = s.months.filter((m) => m.isLeapMonth).length;
      const ok = s.months.length === 12 ? leaps === 0 : s.months.length === 13 && leaps === 1;
      if (!ok) bad.push(`세운 ${formatIsoDate(s.solstice)}: ${s.months.length}개월 / 윤달 ${leaps}개`);
    }
    expect(checked).toBe(200);
    expect(bad).toEqual([]);
  });

  it("규칙5: 13개월 세운의 윤달은 동지 달 이후 '중기가 없는 첫 달'이다", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const s of suis) {
      if (s.months.length !== 13) continue;
      checked += 1;
      const leapIdx = s.months.findIndex((m) => m.isLeapMonth);
      let first = -1;
      for (let i = 0; i < s.months.length; i += 1) {
        if (!hasZhongQi(s.months[i].start, s.months[i].end)) {
          first = i;
          break;
        }
      }
      if (first !== leapIdx) {
        const f = first >= 0 ? s.months[first] : null;
        bad.push(
          `세운 ${formatIsoDate(s.solstice)}: 윤달=idx${leapIdx} / 중기없는첫달=idx${first}` +
            (f ? ` (${f.year}년 ${f.isLeapMonth ? "윤" : ""}${f.month}월)` : " (없음)"),
        );
      }
    }
    expect(checked).toBe(73);
    expect(bad).toEqual([]);
  });

  it("중기가 없는 달은 윤달 74개 + 알려진 '가짜 윤달 후보' 4개뿐이다", () => {
    const noZhongQi = allMonths.filter((m) => !hasZhongQi(m.start, m.end));
    const normal = noZhongQi.filter((m) => !m.isLeapMonth);
    expect(noZhongQi.filter((m) => m.isLeapMonth).length).toBe(74);
    expect(normal.map((m) => `${m.year}/${m.month}`)).toEqual(["1985/1", "2033/8", "2034/1", "2053/1"]);
  });

  it("윤달은 같은 번호의 일반달 바로 뒤에 온다", () => {
    for (let y = LUNAR_INFO_START_YEAR; y <= LUNAR_INFO_END_YEAR; y += 1) {
      const leap = leapMonthOfLunarYear(y);
      if (leap === 0) continue;
      const regular = monthSpan(y, leap, false);
      const leapSpan = monthSpan(y, leap, true);
      // monthSpan 의 end 는 다음 달 시작(배타)이므로 윤달 시작일이 곧 이전 달의 end 다.
      expect(formatIsoDate(leapSpan.start), `${y}년 윤${leap}월`).toBe(formatIsoDate(regular.end));
    }
  });

  it("윤달 일수는 표에 적힌 값(29 또는 30)과 일치한다", () => {
    for (let y = LUNAR_INFO_START_YEAR; y <= LUNAR_INFO_END_YEAR; y += 1) {
      const leap = leapMonthOfLunarYear(y);
      if (leap === 0) continue;
      const span = monthSpan(y, leap, true);
      expect(differenceInDays(span.end, span.start), `${y}년 윤${leap}월`).toBe(leapMonthDaysOf(y));
    }
  });

  it("중기 12개가 표에 잡힌다", () => {
    expect(ZHONG_QI).toHaveLength(12);
  });
});

describe("양력 ↔ 음력 왕복 변환", () => {
  it("지원 범위 전역에서 무손실이다 (7일 간격)", () => {
    const bad: string[] = [];
    let cursor = LUNAR_SUPPORT_START;
    let count = 0;
    while (compareCivilDate(cursor, LUNAR_SUPPORT_END) <= 0) {
      const back = lunarToSolar(solarToLunar(cursor));
      if (formatIsoDate(back) !== formatIsoDate(cursor)) {
        bad.push(`${formatIsoDate(cursor)} -> ${formatLunarDate(solarToLunar(cursor))} -> ${formatIsoDate(back)}`);
      }
      count += 1;
      cursor = addDays(cursor, 7);
    }
    expect(bad).toEqual([]);
    expect(count).toBeGreaterThan(10_000);
  });

  it("연초·연말 경계에서도 무손실이다", () => {
    let checked = 0;
    for (let y = 1900; y <= 2100; y += 1) {
      for (const [m, d] of [
        [1, 1],
        [2, 28],
        [12, 31],
      ] as const) {
        const solar: CivilDate = { year: y, month: m, day: d };
        if (compareCivilDate(solar, LUNAR_SUPPORT_START) < 0) continue;
        if (compareCivilDate(solar, LUNAR_SUPPORT_END) > 0) continue;
        const back = lunarToSolar(solarToLunar(solar));
        expect(formatIsoDate(back), formatIsoDate(solar)).toBe(formatIsoDate(solar));
        checked += 1;
      }
    }
    // 1900-01-01 한 건만 지원 범위(1900-01-31) 밖이라 제외된다.
    expect(checked).toBe(602);
  });

  it("윤달 날짜가 실제 날짜로 변환된다", () => {
    const spot: Array<[{ year: number; month: number; day: number; isLeapMonth: boolean }, string]> = [
      [{ year: 2020, month: 4, day: 1, isLeapMonth: true }, "2020-05-23"],
      [{ year: 2023, month: 2, day: 1, isLeapMonth: true }, "2023-03-22"],
      [{ year: 2025, month: 6, day: 1, isLeapMonth: true }, "2025-07-25"],
      [{ year: 2033, month: 11, day: 1, isLeapMonth: true }, "2033-12-22"],
    ];
    for (const [lunar, iso] of spot) {
      expect(formatIsoDate(lunarToSolar(lunar)), formatLunarDate(lunar)).toBe(iso);
      expect(solarToLunar({ year: +iso.slice(0, 4), month: +iso.slice(5, 7), day: +iso.slice(8, 10) })).toEqual(
        lunar,
      );
    }
  });

  it("윤달 표기가 없는 해의 윤달 요청은 거절한다", () => {
    expect(() => lunarToSolar({ year: 2021, month: 3, day: 1, isLeapMonth: true })).toThrow(LunarConversionError);
    expect(() => lunarToSolar({ year: 2021, month: 3, day: 1, isLeapMonth: true })).toThrow(
      "2021년은 윤달이 없는 해입니다.",
    );
  });
});

describe("음력 입력 오류 메시지", () => {
  it("지원 범위를 벗어난 음력 연도", () => {
    expect(() => lunarToSolar({ year: 1899, month: 1, day: 1, isLeapMonth: false })).toThrow(
      "음력 연도가 지원 범위(1900-2100)를 벗어났습니다: 1899",
    );
    expect(() => lunarToSolar({ year: 2101, month: 1, day: 1, isLeapMonth: false })).toThrow(
      "음력 연도가 지원 범위(1900-2100)를 벗어났습니다: 2101",
    );
  });

  it("잘못된 월·일", () => {
    expect(() => lunarToSolar({ year: 2024, month: 0, day: 1, isLeapMonth: false })).toThrow("잘못된 음력 월입니다");
    expect(() => lunarToSolar({ year: 2024, month: 13, day: 1, isLeapMonth: false })).toThrow("잘못된 음력 월입니다");
    expect(() => lunarToSolar({ year: 2024, month: 1, day: 0, isLeapMonth: false })).toThrow("잘못된 음력 일입니다");
  });

  it("그 달이 없는 일수는 거절하고 실제 일수를 알려준다", () => {
    const days = lunarMonthDaysOf(2024, 1, false);
    expect(days).toBe(29);
    expect(() => lunarToSolar({ year: 2024, month: 1, day: 30, isLeapMonth: false })).toThrow(
      "2024년 1월은 29일까지입니다.",
    );
  });

  it("잘못된 양력 날짜", () => {
    expect(() => solarToLunar({ year: 2023, month: 2, day: 29 })).toThrow("잘못된 양력 날짜입니다");
  });

  it("지원 범위 밖 양력", () => {
    expect(() => solarToLunar({ year: 1900, month: 1, day: 30 })).toThrow(/지원 범위/);
    expect(() => solarToLunar({ year: 2101, month: 1, day: 1 })).toThrow(/지원 범위/);
  });

  it("오류에는 스택 트레이스 대신 사람이 읽을 문장만 담는다", () => {
    try {
      solarToLunar({ year: 2023, month: 2, day: 29 });
      expect.unreachable("예외가 나야 한다");
    } catch (e) {
      expect(e).toBeInstanceOf(LunarConversionError);
      const err = e as LunarConversionError;
      expect(err.code).toBe("INVALID_SOLAR_DATE");
      expect(err.message).not.toContain("at ");
      expect(err.message).not.toContain(".ts");
    }
  });
});

describe("음력 표기", () => {
  it("윤달 여부를 표기에 반영한다", () => {
    expect(formatLunarDate({ year: 2023, month: 2, day: 1, isLeapMonth: true })).toBe("2023년 윤2월 1일");
    expect(formatLunarDate({ year: 2023, month: 2, day: 1, isLeapMonth: false })).toBe("2023년 2월 1일");
  });
});
