import { describe, expect, it } from "vitest";
import {
  DAEUN_COUNT,
  DAEUN_SPAN_YEARS,
  computeDaeun,
  daeunDirection,
  daeunOfDate,
  type DaeunTimeline,
} from "../core/daeun/daeun";
import { computeFourPillars, type FourPillars } from "../core/pillars/fourPillars";
import { ganZhiText } from "../core/pillars/sexagenary";
import { STEMS, BRANCHES } from "../core/constants/stems";
import { TEN_GODS, isTenGod, tenGodOfStem } from "../core/ten_gods/tenGods";
import { addDays, addMonths, differenceInDays, formatIsoDate, type CivilDate } from "../core/calendar/civilDate";
import { monthBoundaryOf, solarTerm } from "../core/solar_terms/solarTerms";
import type { Gender } from "../core/types";

/** 시진 6 = 午시. 기준 원국. */
const BIRTH: CivilDate = { year: 1990, month: 5, day: 20 };

function chartAt(date: CivilDate, branchIndex: number | null = 6, gender?: Gender): FourPillars {
  return computeFourPillars({ solarDate: date, timeBranchIndex: branchIndex, ziMode: null, gender });
}

function timelineOf(date: CivilDate, gender?: Gender, branchIndex: number | null = 6): DaeunTimeline {
  return computeDaeun(chartAt(date, branchIndex, gender), date, gender);
}

// ---------------------------------------------------------------------------

describe("순역 결정 — 단일 규칙", () => {
  it("성별순역: 양남·음녀 순행, 음남·양녀 역행", () => {
    // 庚午(양양) 년
    expect(daeunDirection("庚", "午", "남")).toEqual({ direction: "순행", rule: "성별순역" });
    expect(daeunDirection("庚", "午", "여")).toEqual({ direction: "역행", rule: "성별순역" });
    // 辛未(음음) 년
    expect(daeunDirection("辛", "未", "남")).toEqual({ direction: "역행", rule: "성별순역" });
    expect(daeunDirection("辛", "未", "여")).toEqual({ direction: "순행", rule: "성별순역" });
  });

  it("간지순역: 성별이 없으면 년간 양음이 기준이다", () => {
    expect(daeunDirection("庚", "午", undefined)).toEqual({ direction: "순행", rule: "간지순역" });
    expect(daeunDirection("辛", "未", undefined)).toEqual({ direction: "역행", rule: "간지순역" });
  });

  it("성별이 있으면 간지순역이 절대 쓰이지 않는다", () => {
    // 庚년 여성은 성별순역으로는 역행(간지순역 순행과 반대)
    expect(daeunDirection("庚", "午", "여").direction).not.toBe(daeunDirection("庚", "午", undefined).direction);
  });

  it("10개 천간 전부에 대해 양간·음간 분류가 성별순역과 일관된다", () => {
    const yang: string[] = [];
    const yin: string[] = [];
    for (const s of STEMS) (STEMS.indexOf(s) % 2 === 0 ? yang : yin).push(s.char);
    expect(yang).toEqual(["甲", "丙", "戊", "庚", "壬"]);
    expect(yin).toEqual(["乙", "丁", "己", "辛", "癸"]);
    for (const stem of [...yang, ...yin]) {
      const branch = STEMS.indexOf(STEMS.find((s) => s.char === stem)!) % 2 === 0 ? "子" : "丑";
      const rule = daeunDirection(stem as never, branch as never, undefined);
      expect(rule.direction, stem).toBe(yang.includes(stem) ? "순행" : "역행");
    }
  });
});

// ---------------------------------------------------------------------------

describe("기산 (3일 = 1년)", () => {
  it("순행이면 다음 절기까지의 일수, 역행이면 이전 절기로부터의 일수를 쓴다", () => {
    const date: CivilDate = { year: 1990, month: 5, day: 20 };
    const boundary = monthBoundaryOf(date);
    // 1990-05-20 午시 = 庚午년. 양녀 → 역행.
    const backward = timelineOf(date, "여");
    expect(backward.direction).toBe("역행");
    expect(backward.startTerm.definition.name, "역행이면 생일의 현재 경계 節").toBe(
      boundary.term.definition.name,
    );
    expect(backward.daysToStartTerm).toBe(differenceInDays(date, boundary.term.koreaDate));

    // 陰남 = 庚년(양) + 남 → 순행. 기산 절기는 다음 節.
    const forward = timelineOf(date, "남");
    expect(forward.direction).toBe("순행");
    expect(forward.startTerm.definition.name, "순행이면 생일의 현재 경계 節").not.toBe(
      boundary.term.definition.name,
    );
    expect(forward.startTerm.epochMs, "순행 기산 절기는 생일 이후").toBeGreaterThan(
      boundary.term.epochMs,
    );
    expect(forward.daysToStartTerm).toBe(differenceInDays(forward.startTerm.koreaDate, date));
    expect(forward.daeun[0].ganZhiIndex).toBe(
      ((chartAt(date, 6, "남").month.ganZhiIndex + 1) % 60 + 60) % 60,
    );
  });

  it("기산 나이는 일수 ÷ 3 이고 소수 둘째 자리까지 반올림된다", () => {
    for (const date of [
      { year: 1990, month: 5, day: 20 },
      { year: 1975, month: 1, day: 3 },
      { year: 2001, month: 11, day: 28 },
      { year: 1960, month: 7, day: 15 },
    ] satisfies CivilDate[]) {
      const tl = timelineOf(date, "여");
      expect(tl.startAgeYears, formatIsoDate(date)).toBe(
        Number((tl.daysToStartTerm / 3).toFixed(2)),
      );
      // 인접한 節 사이의 간격은 최대 약 31일 이므로 기산 나이는 10.4세 이내.
      expect(tl.daysToStartTerm, formatIsoDate(date)).toBeLessThanOrEqual(31);
      expect(tl.startAgeYears).toBeLessThanOrEqual(10.4);
      expect(tl.startAgeYears).toBeGreaterThanOrEqual(0);
    }
  });

  it("기산 시작 날짜는 생일 + (일수/3) 개월", () => {
    const date: CivilDate = { year: 1990, month: 5, day: 20 };
    const tl = timelineOf(date, "여");
    const expected = addMonths(date, Math.round((tl.daysToStartTerm / 3) * 12));
    expect(tl.daeun[0].startDate).toEqual(expected);
  });

  it("일수가 0 이면 기산 나이 0 이다 (절기 당일 출생)", () => {
    // 2026 입춘 = 02-04 05:03 KST. 해시(22:00) 출생이면 그날이 기산절기.
    const date: CivilDate = { year: 2026, month: 2, day: 4 };
    const tl = timelineOf(date, "남");
    expect(tl.startTerm.koreaDate).toEqual(date);
    expect(tl.daysToStartTerm).toBe(0);
    expect(tl.startAgeYears).toBe(0);
    expect(tl.daeun[0].startDate).toEqual(date);
  });
});

// ---------------------------------------------------------------------------

describe("대운 12개 구조", () => {
  const tl = timelineOf(BIRTH, "여");

  it("기본 개수와 각운 기간이 10년이다", () => {
    expect(DAEUN_SPAN_YEARS).toBe(10);
    expect(DAEUN_COUNT).toBe(12);
    expect(tl.daeun).toHaveLength(DAEUN_COUNT);
    for (const d of tl.daeun) {
      expect(differenceInDays(d.endDate, d.startDate), `${d.startYear} 대운`).toBeGreaterThan(3600);
      expect(differenceInDays(d.endDate, d.startDate), `${d.startYear} 대운`).toBeLessThan(3660);
    }
  });

  it("대운이 순서대로 이어지고 겹치거나 비지 않는다", () => {
    for (let i = 1; i < tl.daeun.length; i += 1) {
      expect(tl.daeun[i].startDate, `대운 ${i + 1}`).toEqual(tl.daeun[i - 1].endDate);
      expect(tl.daeun[i].startAge).toBeGreaterThan(tl.daeun[i - 1].startAge);
      expect(tl.daeun[i].order).toBe(i + 1);
    }
  });

  it("각 대운은 10년 간격으로 시작한다", () => {
    expect(tl.daeun[0].endAge - tl.daeun[0].startAge).toBe(DAEUN_SPAN_YEARS);
    for (let i = 1; i < tl.daeun.length; i += 1) {
      expect(
        tl.daeun[i].startAge - tl.daeun[i - 1].startAge,
        `대운 ${i + 1} 기산 간격`,
      ).toBeCloseTo(DAEUN_SPAN_YEARS, 6);
      expect(tl.daeun[i].startDate).toEqual(addMonths(tl.daeun[0].startDate, i * 120));
    }
  });

  it("간지는 월주를 기준으로 한 칸씩 순/역행한다", () => {
    const chart = chartAt(BIRTH, 6, "여");
    const base = chart.month.ganZhiIndex;
    for (const [i, d] of tl.daeun.entries()) {
      const step = tl.direction === "순행" ? i + 1 : -(i + 1);
      expect(d.ganZhiIndex, `대운 ${i + 1}`).toBe(((base + step) % 60 + 60) % 60);
      expect(ganZhiText(d.stem, d.branch)).toBe(ganZhiText(STEMS[d.ganZhiIndex % 10].char, BRANCHES[d.ganZhiIndex % 12].char));
    }
  });

  it("대운 첫 간지는 월주와 인접하고, 12개 모두 겹치지 않는다", () => {
    const chart = chartAt(BIRTH, 6, "여");
    const step = tl.direction === "순행" ? 1 : -1;
    expect(tl.daeun[0].ganZhiIndex).toBe(((chart.month.ganZhiIndex + step) % 60 + 60) % 60);
    expect(new Set(tl.daeun.map((d) => d.ganZhiIndex)).size).toBe(DAEUN_COUNT);
  });

  it("십신·오행·운성·지장간이 일간 기준으로 채워진다", () => {
    for (const d of tl.daeun) {
      const text = ganZhiText(d.stem, d.branch);
      expect(d.tenGod, text).toBe(tenGodOfStem(chartAt(BIRTH, 6, "여").dayMaster, d.stem));
      expect(d.element, text).toBe(STEMS[STEMS.findIndex((s) => s.char === d.stem)].element);
      expect(d.branchElement, text).toBe(BRANCHES[BRANCHES.findIndex((b) => b.char === d.branch)].element);
      expect(d.hidden.length, text).toBeGreaterThanOrEqual(1);
      expect(d.stage.key, text).toBeDefined();
      expect(typeof d.stage.vitality, text).toBe("number");
    }
  });

  it("대운의 십신이 비견만 나오는 비정상 상태는 없다", () => {
    // 12개 대운이 모두 같은 십신일 수는 없지만, 값이 유효한 십신 명칭인지 확인한다.
    const valid = new Set(TEN_GODS.map((g) => g.key));
    expect(valid.size).toBeGreaterThan(1);
    for (const d of tl.daeun) {
      expect(isTenGod(d.tenGod), d.tenGod).toBe(true);
      expect(valid.has(d.tenGod), d.tenGod).toBe(true);
    }
    expect(new Set(tl.daeun.map((d) => d.tenGod)).size).toBeGreaterThan(1);
  });

  it("directionRule 이 항상 기록된다", () => {
    expect(timelineOf(BIRTH, "여").directionRule).toBe("성별순역");
    expect(timelineOf(BIRTH, "남").directionRule).toBe("성별순역");
    expect(timelineOf(BIRTH, undefined).directionRule).toBe("간지순역");
  });
});

// ---------------------------------------------------------------------------

describe("특정 날짜의 대운 찾기", () => {
  const tl = timelineOf(BIRTH, "여");

  it("범위 안의 날짜는 정확히 하나의 대운에 속한다", () => {
    for (const d of tl.daeun) {
      for (const offset of [0, 30, 180, 1000, 3000]) {
        const date = addDays(d.startDate, offset);
        const found = daeunOfDate(tl, date);
        expect(found, formatIsoDate(date)).not.toBeNull();
        expect(found?.order, formatIsoDate(date)).toBe(d.order);
        expect(differenceInDays(date, d.startDate), formatIsoDate(date)).toBeGreaterThanOrEqual(0);
        expect(differenceInDays(date, d.startDate), formatIsoDate(date)).toBeLessThan(3653);
      }
    }
  });

  it("기산 시작일 당일도 새 대운에 속한다 (경계 포함)", () => {
    expect(daeunOfDate(tl, tl.daeun[0].startDate)?.order).toBe(1);
    expect(daeunOfDate(tl, tl.daeun[3].startDate)?.order).toBe(4);
  });

  it("기산 시작일 하루 전은 이전 대운이다 (첫 대운이면 null)", () => {
    const before = addDays(tl.daeun[0].startDate, -1);
    expect(daeunOfDate(tl, before)).toBeNull();
    expect(daeunOfDate(tl, addDays(tl.daeun[2].startDate, -1))?.order).toBe(2);
  });

  it("끝 날짜(exclusive) 당일에는 다음 대운으로 넘어간다", () => {
    expect(daeunOfDate(tl, tl.daeun[0].endDate)?.order).toBe(2);
    expect(daeunOfDate(tl, addDays(tl.daeun[0].endDate, -1))?.order).toBe(1);
  });

  it("기산 이전과 마지막 대운 이후는 null", () => {
    expect(daeunOfDate(tl, { year: 1890, month: 1, day: 1 })).toBeNull();
    expect(daeunOfDate(tl, addDays(tl.daeun[DAEUN_COUNT - 1].endDate, 1))).toBeNull();
  });

  it("연속한 날짜의 대운 번호는 같거나 하나씩 증가한다", () => {
    let prev = 0;
    let date = tl.daeun[0].startDate;
    const end = tl.daeun[DAEUN_COUNT - 1].endDate;
    while (date < end) {
      const cur = daeunOfDate(tl, date)?.order ?? 0;
      expect(cur - prev, formatIsoDate(date)).toBeLessThanOrEqual(1);
      expect(cur - prev, formatIsoDate(date)).toBeGreaterThanOrEqual(0);
      prev = cur;
      date = addDays(date, 1);
    }
  });
});

// ---------------------------------------------------------------------------

describe("경계 날짜 안정성", () => {
  it("2월 29일 출생에도 대운 날짜가 유효하다", () => {
    const date: CivilDate = { year: 2000, month: 2, day: 29 };
    const tl = timelineOf(date, "여");
    for (const d of tl.daeun) {
      expect(isValidDate(d.startDate), formatIsoDate(d.startDate)).toBe(true);
      expect(isValidDate(d.endDate), formatIsoDate(d.endDate)).toBe(true);
    }
  });

  it("1월 31일 출생에도 대운 날짜가 유효하다", () => {
    for (const date of [
      { year: 1990, month: 1, day: 31 },
      { year: 2000, month: 1, day: 31 },
      { year: 2024, month: 1, day: 31 },
    ] satisfies CivilDate[]) {
      const tl = timelineOf(date, "여");
      for (const d of tl.daeun) {
        expect(isValidDate(d.startDate), `${formatIsoDate(date)} → ${formatIsoDate(d.startDate)}`).toBe(true);
      }
    }
  });

  it("12월 31일 출생의 기산은 다음 해로 넘어갈 수 있다", () => {
    const date: CivilDate = { year: 1990, month: 12, day: 31 };
    const tl = timelineOf(date, "여");
    expect(tl.startTerm.koreaDate).toBeDefined();
    expect(differenceInDays(tl.startTerm.koreaDate, date)).toBeLessThanOrEqual(32);
    expect(tl.startTerm.koreaDate.year).toBeGreaterThanOrEqual(date.year);
  });

  it("시주 미상이어도 대운이 계산된다 (월주 기준이므로)", () => {
    const date: CivilDate = { year: 1988, month: 11, day: 3 };
    const withHour = timelineOf(date, "여", 6);
    const without = timelineOf(date, "여", null);
    expect(without.daeun).toHaveLength(DAEUN_COUNT);
    // 월주가 같으면 대운 간지 순서도 같다.
    for (const [i, d] of without.daeun.entries()) {
      expect(d.ganZhiIndex, `대운 ${i + 1}`).toBe(withHour.daeun[i].ganZhiIndex);
    }
  });

  it("1900대와 2100년 대에서도 유효하다", () => {
    for (const date of [
      { year: 1901, month: 6, day: 15 },
      { year: 2098, month: 2, day: 10 },
    ] satisfies CivilDate[]) {
      const tl = timelineOf(date, "여");
      expect(tl.daeun).toHaveLength(DAEUN_COUNT);
      expect(tl.startAgeYears).toBeGreaterThanOrEqual(0);
    }
  });
});

/** 월·일 범위 확인. */
function isValidDate(d: CivilDate): boolean {
  return d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= 31;
}

// ---------------------------------------------------------------------------

describe("결정론", () => {
  it("같은 입력은 항상 같은 대운을 낸다", () => {
    const a = timelineOf(BIRTH, "여");
    for (let i = 0; i < 3; i += 1) {
      const b = timelineOf(BIRTH, "여");
      expect(b.direction).toBe(a.direction);
      expect(b.daeun.map((d) => d.ganZhiIndex)).toEqual(a.daeun.map((d) => d.ganZhiIndex));
      expect(b.daeun.map((d) => d.startDate)).toEqual(a.daeun.map((d) => d.startDate));
    }
  });

  it("기산 절기는 생일을 둘러싼 인접한 節 이다", () => {
    const date: CivilDate = { year: 1990, month: 5, day: 20 };
    const boundary = monthBoundaryOf(date);
    const prevNames = new Set([boundary.term.definition.name]);
    const tl = timelineOf(date, "여");
    // 기산 절기는 직전 절기(역행)이거나 다음 절기(순행)이며 둘 다 節 이다.
    expect(tl.startTerm.definition.isJie).toBe(true);
    if (tl.direction === "역행") expect(prevNames.has(tl.startTerm.definition.name)).toBe(true);
    expect(differenceInDays(tl.startTerm.koreaDate, date)).toBeLessThanOrEqual(32);
  });

  it("절기 표와 대운 기산이 어긋나지 않는다", () => {
    const date: CivilDate = { year: 1990, month: 5, day: 20 };
    const tl = timelineOf(date, "여");
    expect(solarTerm(tl.startTerm.year, tl.startTerm.definition.name).epochMs).toBe(tl.startTerm.epochMs);
  });
});
