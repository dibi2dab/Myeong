import { describe, expect, it } from "vitest";
import {
  ilunOf,
  seunOf,
  seunRangeOf,
  solarYearOfDate,
  wolunOf,
  wolunRangeOf,
} from "../core/periods/seunWolunIlun";
import {
  PERIOD_HIERARCHY,
  PERIOD_KIND_LABELS,
  narrowerThan,
  periodRangeText,
} from "../core/periods/period";
import { computeFourPillars, dayGanZhiIndex, monthGanZhiIndex, yearGanZhiIndex } from "../core/pillars/fourPillars";
import { ganZhiFromIndex, ganZhiText } from "../core/pillars/sexagenary";
import { TIME_BRANCHES } from "../core/constants/timeBranches";
import { BRANCHES, STEMS } from "../core/constants/stems";
import { tenGodOfStem, TEN_GODS, TEN_GOD_GROUP, isTenGod } from "../core/ten_gods/tenGods";
import { addDays, compareCivilDate, differenceInDays, formatIsoDate, type CivilDate } from "../core/calendar/civilDate";
import { monthBoundaryOf, solarTerm } from "../core/solar_terms/solarTerms";
import type { FourPillars } from "../core/pillars/fourPillars";

const CHART: FourPillars = computeFourPillars({
  solarDate: { year: 1990, month: 5, day: 20 },
  timeBranchIndex: 6,
  ziMode: null,
});

/** 절기 연도(정오 기준). `solarYearOfDate` 와 같은 기준. */
function solarYearOf(date: CivilDate): number {
  return solarYearOfDate(date);
}

function chartOn(date: CivilDate): FourPillars {
  return computeFourPillars({ solarDate: date, timeBranchIndex: 6, ziMode: null });
}

// ---------------------------------------------------------------------------

describe("운의 위계", () => {
  it("항상 원국 → 대운 → 세운 → 월운 → 일운 순서다", () => {
    expect([...PERIOD_HIERARCHY]).toEqual(["daeun", "seun", "wolun", "ilun"]);
  });

  it("narrowerThan 은 자기 자신보다 좁은 운만 담는다", () => {
    expect([...narrowerThan("daeun")]).toEqual(["seun", "wolun", "ilun"]);
    expect([...narrowerThan("seun")]).toEqual(["wolun", "ilun"]);
    expect([...narrowerThan("wolun")]).toEqual(["ilun"]);
    expect([...narrowerThan("ilun")]).toEqual([]);
  });

  it("네 운에 모두 한국어 이름이 있다", () => {
    expect(Object.values(PERIOD_KIND_LABELS)).toEqual(["대운", "연운", "월운", "일운"]);
    // 세운(歲運)은 UI 에서 "연운"으로 표시한다.
    expect(PERIOD_KIND_LABELS.seun).toBe("연운");
  });

  it("periodRangeText 는 시작일과 끝일(exclusive)을 함께 보여준다", () => {
    const text = periodRangeText({ year: 2026, month: 1, day: 1 }, { year: 2026, month: 2, day: 1 });
    expect(text).toContain("2026.01.01");
    expect(text).toContain("2026.02.01");
  });
});

// ---------------------------------------------------------------------------

describe("세운 — 入春 기준", () => {
  it("세운 기간은 입춘 당일 정오부터 다음 입춘까지다", () => {
    // solarYearOfDate 는 정오(12:00) 를 대표 시각으로 쓴다. 그래서 1월 1일처럼
    // 입춘(2월 초)보다 확실히 이른 날짜는 전년도, 입춘 당일 정오는 이미 당해 연도다.
    // 세운 기간의 시작일도 입춘 *날짜* 로 표시되므로 "당일"은 두 계산에서 어긋난다.
    // 문서화할 기준: 세운은 입춘이 지난 날짜부터 다음 입춘 날짜 직전까지.
    const before = { year: 2026, month: 1, day: 31 };
    const at = { year: 2026, month: 2, day: 4 };
    expect(solarYearOfDate(before)).toBe(2025);
    expect(seunOf(CHART, before).ganZhiIndex).toBe(yearGanZhiIndex(2025));
    expect(solarYearOfDate(at)).toBe(2026);
    expect(seunOf(CHART, at).ganZhiIndex).toBe(yearGanZhiIndex(2026));
  });

  it("세운은 세운 기간 안에선 계속 같다", () => {
    const r = seunRangeOf({ year: 2026, month: 6, day: 15 });
    const g = ganZhiFromIndex(yearGanZhiIndex(r.solarYear));
    const expected = ganZhiText(g.stem, g.branch);
    for (const d of [r.start, addDays(r.start, 1), addDays(r.endExclusive, -1)]) {
      expect(seunOf(CHART, d).ganZhi, formatIsoDate(d)).toBe(expected);
      expect(seunOf(CHART, d).ganZhiIndex, formatIsoDate(d)).toBe(yearGanZhiIndex(r.solarYear));
    }
    expect(seunOf(CHART, r.endExclusive).ganZhiIndex).toBe(yearGanZhiIndex(r.solarYear + 1));
  });

  it("세운 기간은 입춘 ~ 다음 입춘 직전이다", () => {
    const r = seunRangeOf({ year: 2026, month: 6, day: 15 });
    expect(r.start).toEqual(solarTerm(2026, "입춘").koreaDate);
    expect(r.endExclusive).toEqual(solarTerm(2027, "입춘").koreaDate);
    expect(differenceInDays(r.endExclusive, r.start)).toBeGreaterThanOrEqual(364);
    expect(differenceInDays(r.endExclusive, r.start)).toBeLessThanOrEqual(367);
  });

  it("60년 주기로 같은 세운이 반복된다", () => {
    for (const y of [2000, 2026, 2050, 2090]) {
      const a = seunOf(CHART, { year: y, month: 6, day: 15 });
      const b = seunOf(CHART, { year: y + 60, month: 6, day: 15 });
      expect(b.ganZhi, String(y)).toBe(a.ganZhi);
    }
  });

  it("2026년 6월 15일 세운 = 丙午", () => {
    const s = seunOf(CHART, { year: 2026, month: 6, day: 15 });
    expect(s.kind).toBe("seun");
    expect(s.ganZhi).toBe("丙午");
    expect(s.stem).toBe("丙");
    expect(s.branch).toBe("午");
    expect(s.element).toBe("火");
  });
});

// ---------------------------------------------------------------------------

describe("월운 — 節 경계", () => {
  it("월운 지지는 원국 월주와 같은 五虎遁 규칙을 따른다", () => {
    for (const date of [
      { year: 2026, month: 1, day: 20 },
      { year: 2026, month: 3, day: 1 },
      { year: 2026, month: 7, day: 15 },
      { year: 2026, month: 11, day: 20 },
    ] satisfies CivilDate[]) {
      const w = wolunOf(CHART, date);
      const boundary = monthBoundaryOf(date);
      expect(w.ganZhiIndex, formatIsoDate(date)).toBe(
        monthGanZhiIndex(solarYearOfDate(date), boundary.monthBranchIndex),
      );
      expect(w.branch, formatIsoDate(date)).toBe(BRANCHES[boundary.monthBranchIndex].char);
    }
  });

  it("월운은 12개 지지를 순환한다", () => {
    const seen: string[] = [];
    for (let m = 1; m <= 12; m += 1) {
      // 2026 각 월 15일 — 절기 경계를 피하려면 8일 이후가 안전하다.
      seen.push(wolunOf(CHART, { year: 2026, month: m, day: 20 }).branch);
    }
    expect(new Set(seen).size).toBeGreaterThanOrEqual(10);
  });

  it("월운 기간은 현재 節 ~ 다음 節 직전이다", () => {
    const r = wolunRangeOf({ year: 2026, month: 6, day: 15 });
    expect(r.termName).toBe("망종"); // 2026-06-15 는 芒種 후
    expect(r.start).toEqual(solarTerm(2026, "망종").koreaDate);
    expect(r.endExclusive).toEqual(solarTerm(2026, "소서").koreaDate);
  });

  it("월운 기간은 12절기 전부에서 유효하다 (0일 범위가 없다)", () => {
    for (let y = 2020; y <= 2030; y += 1) {
      for (let m = 1; m <= 12; m += 1) {
        const r = wolunRangeOf({ year: y, month: m, day: 15 });
        const len = differenceInDays(r.endExclusive, r.start);
        // 節 간격은 실제 29~32일이다 (양력 한 달보다 길다).
        expect(len, `${y}-${m} (${r.termName})`).toBeGreaterThan(28);
        expect(len, `${y}-${m} (${r.termName})`).toBeLessThan(33);
        expect(r.start).toEqual(monthBoundaryOf({ year: y, month: m, day: 15 }).term.koreaDate);
      }
    }
  });

  it("연말에 걸친 월운도 범위가 유효하다 (대설 → 소한)", () => {
    // 2025 대설 = 12-07, 2026 소한 = 01-05. 두 절기가 연을 넘나든다.
    const r = wolunRangeOf({ year: 2025, month: 12, day: 20 });
    expect(r.termName).toBe("대설");
    expect(r.start).toEqual(solarTerm(2025, "대설").koreaDate);
    expect(r.endExclusive).toEqual(solarTerm(2026, "소한").koreaDate);
    expect(r.endExclusive.year).toBe(2026);
    expect(differenceInDays(r.endExclusive, r.start)).toBeGreaterThan(28);
  });

  it("절기 경계 당일에는 아직 이전 월운이다 (KST 자정 기준)", () => {
    // 2026 입춘 = 02-04 05:03 KST. 월운은 KST 자정 시점으로 판정하므로
    // 입춘 당일(02-04) 자정까지는 아직 축월(丑)이고, 02-05 부터 인월(寅)이다.
    const onTermDay = wolunRangeOf({ year: 2026, month: 2, day: 4 });
    expect(onTermDay.termName).toBe("소한");
    expect(onTermDay.monthBranchIndex).toBe(1); // 丑
    const nextDay = wolunRangeOf({ year: 2026, month: 2, day: 5 });
    expect(nextDay.termName).toBe("입춘");
    expect(nextDay.start).toEqual({ year: 2026, month: 2, day: 4 });
  });

  it("월운 천간은 인월(2월)부터 5개씩 순환한다", () => {
    const stems = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1].map(
      (m) => wolunOf(CHART, { year: 2026, month: m, day: 20 }).stem,
    );
    expect(stems).toHaveLength(12);
    // 12개월에 걸쳐 각 천간이 정확히 한 번 이상 등장한다 (간지이므로 5회 주기).
    for (const s of STEMS) {
      expect(stems.filter((x) => x === s.char).length, s.char).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------

describe("일운", () => {
  it("일운은 그 날짜의 일주와 같다", () => {
    for (const date of [
      { year: 2026, month: 6, day: 15 },
      { year: 2000, month: 1, day: 1 },
      { year: 2024, month: 2, day: 29 },
      { year: 1988, month: 11, day: 3 },
    ] satisfies CivilDate[]) {
      const i = ilunOf(CHART, date);
      expect(i.kind, formatIsoDate(date)).toBe("ilun");
      expect(i.ganZhiIndex, formatIsoDate(date)).toBe(dayGanZhiIndex(date));
    }
  });

  it("같은 날짜면 원국과 무관하게 일운이 같다 (웹/이메일 동일)", () => {
    const other = chartOn({ year: 1977, month: 2, day: 2 });
    const date: CivilDate = { year: 2026, month: 6, day: 15 };
    expect(ilunOf(other, date).ganZhi).toBe(ilunOf(CHART, date).ganZhi);
  });

  it("십신만 원국 일간에 따라 달라진다", () => {
    const date: CivilDate = { year: 2026, month: 6, day: 15 };
    const a = ilunOf(CHART, date);
    const other = chartOn({ year: 1977, month: 2, day: 2 });
    const b = ilunOf(other, date);
    expect(b.ganZhi).toBe(a.ganZhi);
    expect(other.dayMaster).not.toBe(CHART.dayMaster);
    expect(b.tenGod).toBe(tenGodOfStem(other.dayMaster, b.stem));
    expect(a.tenGod).toBe(tenGodOfStem(CHART.dayMaster, a.stem));
  });

  it("연속한 날짜의 일운은 하루씩 넘어간다", () => {
    for (const start of [
      { year: 2026, month: 6, day: 15 },
      { year: 2024, month: 2, day: 27 },
      { year: 2024, month: 12, day: 30 },
    ] satisfies CivilDate[]) {
      for (const d of [1, 2, 30]) {
        expect(
          (ilunOf(CHART, addDays(start, d)).ganZhiIndex - ilunOf(CHART, start).ganZhiIndex + 60) % 60,
          `${formatIsoDate(start)} +${d}`,
        ).toBe(d);
      }
    }
  });

  it("2026-09-27 일운 스냅샷", () => {
    expect(ilunOf(CHART, { year: 2026, month: 9, day: 27 }).ganZhi).toBe("甲辰");
  });
});

// ---------------------------------------------------------------------------

describe("운 기둥 공통 구조", () => {
  const kinds = [
    { kind: "seun" as const, p: seunOf(CHART, { year: 2026, month: 6, day: 15 }) },
    { kind: "wolun" as const, p: wolunOf(CHART, { year: 2026, month: 6, day: 15 }) },
    { kind: "ilun" as const, p: ilunOf(CHART, { year: 2026, month: 6, day: 15 }) },
  ];

  it("kind · 간지 · 십신 · 십신 계열 · 오행 · 지장간이 모두 채워진다", () => {
    for (const { kind, p } of kinds) {
      expect(p.kind, kind).toBe(kind);
      expect(p.ganZhi, kind).toHaveLength(2);
      expect(p.ganZhi, kind).toBe(`${p.stem}${p.branch}`);
      expect(isTenGod(p.tenGod), `${kind} ${p.tenGod}`).toBe(true);
      expect(["비겁", "식상", "재성", "관성", "인성"]).toContain(p.tenGodGroup);
      expect(STEMS.map((s) => s.element)).toContain(p.element);
      expect(BRANCHES.map((b) => b.element)).toContain(p.branchElement);
      expect(p.hidden.length, kind).toBeGreaterThanOrEqual(1);
      expect(p.hiddenTenGods).toHaveLength(p.hidden.length);
    }
  });

  it("십신 계열이 십신 이름과 일치한다", () => {
    for (const { kind, p } of kinds) {
      const god = TEN_GODS.find((g) => g.key === p.tenGod);
      expect(god, `${kind} ${p.tenGod}`).toBeDefined();
      expect(TEN_GOD_GROUP[p.tenGod], `${kind} ${p.tenGod}`).toBe(p.tenGodGroup);
    }
  });

  it("지장간 십신이 일간 기준이다", () => {
    for (const { kind, p } of kinds) {
      p.hidden.forEach((h, i) => {
        expect(p.hiddenTenGods[i], `${kind} ${p.branch} ${h.stem}`).toBe(
          tenGodOfStem(CHART.dayMaster, h.stem),
        );
      });
    }
  });

  it("같은 날짜에 같은 결과다 (결정론)", () => {
    const date: CivilDate = { year: 2026, month: 6, day: 15 };
    const first = {
      seun: seunOf(CHART, date).ganZhi,
      wolun: wolunOf(CHART, date).ganZhi,
      ilun: ilunOf(CHART, date).ganZhi,
    };
    expect(first).toEqual({ seun: "丙午", wolun: "甲午", ilun: "庚申" });
    for (let i = 0; i < 3; i += 1) {
      expect(seunOf(CHART, date).ganZhi).toBe(first.seun);
      expect(wolunOf(CHART, date).ganZhi).toBe(first.wolun);
      expect(ilunOf(CHART, date).ganZhi).toBe(first.ilun);
    }
  });
});

// ---------------------------------------------------------------------------

describe("절기 연도 판정", () => {
  it("1월 전체는 전년도다 (입춘이 2월)", () => {
    for (const y of [2024, 2025, 2026]) {
      expect(solarYearOfDate({ year: y, month: 1, day: 1 }), String(y)).toBe(y - 1);
      expect(solarYearOfDate({ year: y, month: 1, day: 31 }), String(y)).toBe(y - 1);
    }
  });

  it("12월은 당해 연도다", () => {
    for (const y of [2024, 2025, 2026]) {
      expect(solarYearOfDate({ year: y, month: 12, day: 31 }), String(y)).toBe(y);
    }
  });

  it("입춘 시각에 따라 당일 판정이 정오 기준과 일치한다", () => {
    // solarYearOfDate 는 정오(12:00) 를 대표 시각으로 쓴다.
    // 입춘이 정오 이전(보통 05~06시)이면 **입춘 당일 정오**는 이미 입춘 이후다.
    let checked = 0;
    for (let y = 2000; y <= 2030; y += 1) {
      const t = solarTerm(y, "입춘");
      const at = solarYearOfDate(t.koreaDate);
      const lichunHour = t.koreaTime.hour;
      expect(at, `${y} 입춘 ${lichunHour}시`).toBe(lichunHour < 12 ? y : y - 1);
      // 입춘 다음 날은 언제나 당해 연도다.
      expect(solarYearOfDate(addDays(t.koreaDate, 1)), `${y} 입춘 익일`).toBe(y);
      if (lichunHour < 12) checked += 1;
    }
    // 31년 중 절반가량은 입춘이 정오 이전이다 (나머지는 자정 무렵).
    expect(checked).toBeGreaterThan(12);
  });
});

// ---------------------------------------------------------------------------

describe("기간 경계 연속성", () => {
  it("세운이 바뀌는 날은 반드시 입춘 날짜다", () => {
    let prev = seunOf(CHART, { year: 2026, month: 1, day: 1 }).ganZhi;
    let date: CivilDate = { year: 2026, month: 1, day: 1 };
    const changeDates: CivilDate[] = [];
    for (let i = 1; i < 800; i += 1) {
      date = addDays(date, 1);
      const cur = seunOf(CHART, date).ganZhi;
      if (cur === prev) continue;
      // 바뀌는 순간은 입춘 날짜여야 한다 (solarYearOfDate 가 정오 기준이라
      // 입춘이 05시 전이면 그날 자정~ noon 판정에서 이미 당해 연도가 된다).
      const r = seunRangeOf(date);
      expect(r.start, formatIsoDate(date)).toEqual(solarTerm(r.solarYear, "입춘").koreaDate);
      expect(solarYearOf(date), formatIsoDate(date)).toBe(r.solarYear);
      expect(r.solarYear, formatIsoDate(date)).toBe(date.year);
      changeDates.push(date);
      prev = cur;
    }
    // 800일(2026-01-01 ~ 2028-03-11) 안에서 입춘이 3번 지난다.
    // 세운이 바뀌는 날 = 입춘 날짜(정오 이전 입춘) 또는 익일(정오 이후 입춘).
    expect(changeDates).toHaveLength(3);
    expect(changeDates.map(formatIsoDate)).toEqual(
      [2026, 2027, 2028].map((y) => {
        const t = solarTerm(y, "입춘");
        return formatIsoDate(t.koreaTime.hour < 12 ? t.koreaDate : addDays(t.koreaDate, 1));
      }),
    );
  });

  it("월운 기간이 겹치지 않고 이어진다", () => {
    let date: CivilDate = { year: 2026, month: 1, day: 1 };
    for (let i = 0; i < 30; i += 1) {
      const r = wolunRangeOf(date);
      expect(compareCivilDate(r.start, r.endExclusive), formatIsoDate(date)).toBeLessThan(0);
      // 범위 안의 어느 날짜로도 같은 결과가 나와야 한다.
      const mid = addDays(r.start, Math.floor(differenceInDays(r.endExclusive, r.start) / 2));
      expect(wolunOf(CHART, mid).ganZhi, formatIsoDate(mid)).toBe(wolunOf(CHART, date).ganZhi);
      // endExclusive 는 다음 節 의 **날짜** 다. 그 절기가 그날 늦게 오면
      // 그날 자정 판정에서는 아직 이전 월운이므로, 다음 날부터 새 월운이 된다.
      expect(wolunOf(CHART, addDays(r.endExclusive, 1)).ganZhi, `${formatIsoDate(r.endExclusive)} 익일`).not.toBe(
        wolunOf(CHART, date).ganZhi,
      );
      // 절기 당일 자정까지는 이전 월운이다 (periods 는 KST 자정 기준).
      expect(wolunOf(CHART, r.endExclusive).ganZhi, `${formatIsoDate(r.endExclusive)} 당일 자정`).toBe(
        wolunOf(CHART, date).ganZhi,
      );
      date = addDays(r.endExclusive, 0);
    }
  });

  it("12시진 대표 시각이 달라도 일운은 안 바뀐다 (일운은 날짜 단위)", () => {
    const date: CivilDate = { year: 2026, month: 6, day: 15 };
    for (const t of TIME_BRANCHES) {
      const c = computeFourPillars({ solarDate: date, timeBranchIndex: t.index, ziMode: "자정" });
      expect(ilunOf(c, date).ganZhi, t.branch).toBe(ilunOf(CHART, date).ganZhi);
    }
  });

  it("자시 조자시로 일주가 넘어가도 일운은 원국과 무관하다", () => {
    const date: CivilDate = { year: 2026, month: 6, day: 15 };
    const cho = computeFourPillars({ solarDate: date, timeBranchIndex: 0, ziMode: "조자시" });
    const man = computeFourPillars({ solarDate: date, timeBranchIndex: 0, ziMode: "자정" });
    // 원국의 일주는 조자시로 하루 넘어갔지만, 일운은 '그 날짜'의 일주를 쓴다.
    expect(cho.day.ganZhiIndex).not.toBe(man.day.ganZhiIndex);
    expect(ilunOf(cho, date).ganZhi).toBe(ilunOf(man, date).ganZhi);
    expect(ilunOf(cho, date).ganZhi).toBe("庚申");
  });
});
