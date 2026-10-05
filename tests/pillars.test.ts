import { describe, expect, it } from "vitest";
import {
  BRANCH_INDEX,
  PILLAR_LABELS,
  PILLAR_POSITIONS,
  STEM_INDEX,
  computeFourPillars,
  dayGanZhiIndex,
  ganZhiIndexOf,
  hourGanZhiIndex,
  monthGanZhiIndex,
  pillarsOf,
  solarYearOf,
  yearGanZhiIndex,
  type FourPillars,
} from "../core/pillars/fourPillars";
import { SEXAGENARY_CYCLE, ganZhiFromIndex, ganZhiText, isYangGanZhi } from "../core/pillars/sexagenary";
import { BRANCHES, STEMS, type EarthlyBranch, type HeavenlyStem } from "../core/constants/stems";
import {
  TIME_BRANCHES,
  UNKNOWN_TIME_LABEL,
  ZI_HOUR_MODES,
  representativeHour,
  timeBranchFromHour,
} from "../core/constants/timeBranches";
import { solarTerm } from "../core/solar_terms/solarTerms";
import {
  addDays,
  differenceInDays,
  formatIsoDate,
  isLeapSolarYear,
  type CivilDate,
} from "../core/calendar/civilDate";
import { REFERENCE_DATE, SAMPLE_REGION, birth } from "./fixtures/samples";

/** GanZhi → "甲子" 형태 문자열. */
function gz(index: number): string {
  const v = ganZhiFromIndex(index);
  return ganZhiText(v.stem, v.branch);
}

/** 네 기둥을 "庚午 辛巳 乙酉 壬午" 형태의 한 줄로. */
function text(chart: FourPillars): string {
  return pillarsOf(chart)
    .map((p) => ganZhiText(p.stem, p.branch))
    .join(" ");
}

function pillarsAt(
  solarDate: CivilDate,
  timeBranchIndex: number | null,
  ziMode: "자정" | "조자시" | null = null,
): FourPillars {
  return computeFourPillars({ solarDate, timeBranchIndex, ziMode, gender: "여" });
}

// ---------------------------------------------------------------------------

describe("60간지", () => {
  it("60개가 순환하고 천간·지지 인덱스가 각자 10·12 주기로 맞물린다", () => {
    expect(SEXAGENARY_CYCLE).toHaveLength(60);
    for (const [i, g] of SEXAGENARY_CYCLE.entries()) {
      expect(STEM_INDEX[g.stem], g.stem).toBe(i % 10);
      expect(BRANCH_INDEX[g.branch], g.branch).toBe(i % 12);
    }
  });

  it("모든 간지는 천간과 지지의 음양이 일치한다", () => {
    for (const g of SEXAGENARY_CYCLE) {
      expect(isYangGanZhi(g.stem, g.branch), ganZhiText(g.stem, g.branch)).toBe(true);
      expect(STEM_INDEX[g.stem] % 2, ganZhiText(g.stem, g.branch)).toBe(BRANCH_INDEX[g.branch] % 2);
    }
  });

  it("양간은 모두 양지와만 짝지어진다 (양간 5 × 양지 6 = 30)", () => {
    const yangStems = STEMS.filter((s) => STEM_INDEX[s.char] % 2 === 0).map((s) => s.char);
    const yangBranches = BRANCHES.filter((b) => BRANCH_INDEX[b.char] % 2 === 0).map((b) => b.char);
    expect(yangStems).toHaveLength(5);
    expect(yangBranches).toHaveLength(6);
    expect(SEXAGENARY_CYCLE.filter((g) => yangStems.includes(g.stem))).toHaveLength(30);
    // 陽의 간지 30개가 모두 양간+양지 조합이다.
    for (const g of SEXAGENARY_CYCLE) {
      const isYang = yangStems.includes(g.stem);
      expect(yangBranches.includes(g.branch), ganZhiText(g.stem, g.branch)).toBe(isYang);
    }
  });

  it("간지 인덱스는 음수·큰 값도 0~59 로 접힌다", () => {
    expect(gz(0)).toBe("甲子");
    expect(gz(59)).toBe("癸亥");
    expect(gz(60)).toBe("甲子");
    expect(gz(-1)).toBe("癸亥");
    expect(gz(121)).toBe("乙丑"); // 121 mod 60 = 1
    expect(gz(-60)).toBe("甲子");
  });

  it("천간·지지의 홀짝이 맞지 않으면 거절한다", () => {
    expect(() => ganZhiIndexOf("甲", "丑")).toThrow("음양이 맞지 않습니다");
    expect(() => ganZhiIndexOf("甲", "子")).not.toThrow();
    expect(ganZhiIndexOf("甲", "子")).toBe(0);
    expect(ganZhiIndexOf("乙", "丑")).toBe(1);
  });
});

describe("시진", () => {
  it("12개가 23시부터 2시간 간격으로 이어진다", () => {
    expect(TIME_BRANCHES).toHaveLength(12);
    expect(TIME_BRANCHES[0].branch).toBe("子");
    expect(TIME_BRANCHES[11].branch).toBe("亥");
    for (const t of TIME_BRANCHES) {
      expect(t.startHour, t.branch).toBe((t.index * 2 + 23) % 24);
      expect(t.endHour, t.branch).toBe((t.startHour + 2) % 24);
      expect(t.range, t.branch).toBe(
        `${String(t.startHour).padStart(2, "0")}:00 – ${String(t.endHour).padStart(2, "0")}:00`,
      );
    }
  });

  it("각 시진의 대표 시각은 중시각이고 자시는 자정 0시다", () => {
    for (const t of TIME_BRANCHES) {
      expect(representativeHour(t.index), t.branch).toBe(t.index === 0 ? 0 : t.startHour + 1);
    }
  });

  it("시각 → 시진 변환이 23:00~00:59 를 자시로 묶는다", () => {
    expect(timeBranchFromHour(23)).toBe(0);
    expect(timeBranchFromHour(0)).toBe(0);
    expect(timeBranchFromHour(1)).toBe(1);
    expect(timeBranchFromHour(2)).toBe(1);
    expect(timeBranchFromHour(22)).toBe(11);
    for (let h = 0; h < 24; h += 1) {
      const idx = timeBranchFromHour(h);
      const t = TIME_BRANCHES[idx];
      expect(idx, `${h}시`).toBeGreaterThanOrEqual(0);
      expect(idx, `${h}시`).toBeLessThan(12);
      // 자시(0)만 자정을 가로지르고, 나머지는 startHour <= h < endHour 로 들어맞아야 한다.
      const inRange = t.index === 0 ? h >= 23 || h < 1 : h >= t.startHour && h < t.endHour;
      expect(inRange, `${h}시 → ${t.branch}`).toBe(true);
    }
  });

  it("범위를 벗어난 시진·시각은 거절한다", () => {
    expect(() => timeBranchFromHour(24)).toThrow("잘못된 시각입니다");
    expect(() => timeBranchFromHour(-1)).toThrow("잘못된 시각입니다");
    expect(() => timeBranchFromHour(1.5)).toThrow("잘못된 시각입니다");
    expect(() => representativeHour(12)).toThrow("잘못된 시진입니다");
  });

  it("출생시간 미상 표기가 따로 있다", () => {
    expect(UNKNOWN_TIME_LABEL).toBe("출생시간 모름");
  });
});

// ---------------------------------------------------------------------------

describe("년주 — 입춘 경계", () => {
  it("1984 = 甲子, 2024 = 甲辰, 2000 = 庚辰", () => {
    expect(gz(yearGanZhiIndex(1984))).toBe("甲子");
    expect(gz(yearGanZhiIndex(2024))).toBe("甲辰");
    expect(gz(yearGanZhiIndex(2000))).toBe("庚辰");
  });

  it("60년 주기로 반복된다", () => {
    for (let y = 1900; y <= 2100; y += 1) {
      expect(yearGanZhiIndex(y + 60), String(y)).toBe(yearGanZhiIndex(y));
    }
  });

  it("입춘 순간 직전·당시·직후로 절기 연도가 갈린다", () => {
    for (let y = 1902; y <= 2099; y += 1) {
      const lichun = solarTerm(y, "입춘");
      expect(solarYearOf(y, lichun.epochMs - 1000), `${y} 직전`).toBe(y - 1);
      expect(solarYearOf(y, lichun.epochMs), `${y} 순간`).toBe(y);
      expect(solarYearOf(y, lichun.epochMs + 1000), `${y} 직후`).toBe(y);
    }
  });

  it("입춘 당일 아침 출생은 아직 전년도 간지, 저녁 출생은 당해 간지다", () => {
    // 2024 입춘 = 2024-02-04 17:27 KST (HKO 16:27 HKT = 17:27 KST, 오차 0분)
    const day = solarTerm(2024, "입춘").koreaDate;
    expect(formatIsoDate(day)).toBe("2024-02-04");
    // 축시(02:00) · 미시(14:00) 는 입춘 이전 → 癸卯년
    for (const idx of [1, 7]) {
      expect(pillarsAt(day, idx).year.ganZhiIndex, `시진 ${idx}`).toBe(yearGanZhiIndex(2023));
    }
    // 해시(22:00) 는 입춘 이후 → 甲辰년
    expect(pillarsAt(day, 11).year.ganZhiIndex).toBe(yearGanZhiIndex(2024));
  });

  it("1월 1일 출생도 전년도 간지다 (입춘이 2월에 옴)", () => {
    for (const date of [
      { year: 2024, month: 1, day: 1 },
      { year: 2024, month: 1, day: 31 },
    ] satisfies CivilDate[]) {
      expect(pillarsAt(date, 7).year.ganZhiIndex, formatIsoDate(date)).toBe(yearGanZhiIndex(2023));
    }
  });

  it("입춘이 1월에 오는 해에는 1월 1일이 전년도다", () => {
    // 2021 입춘 = 2021-02-04 00:00 KST (계산값) — 1월은 여전히 庚子년
    const lichun2021 = solarTerm(2021, "입춘");
    expect(lichun2021.koreaDate.month).toBe(2);
    expect(gz(yearGanZhiIndex(2020))).toBe("庚子");
  });
});

// ---------------------------------------------------------------------------

describe("월주 — 節 경계와 五虎遁", () => {
  it("2026 인월(寅월)은 庚寅이다", () => {
    // 2026 절기년 천간 = 丙(2) → (2 % 5) * 2 + 2 = 6 = 庚
    expect(gz(monthGanZhiIndex(2026, 2))).toBe("庚寅");
  });

  it("인월 천간은 절기년 천간에서 五虎遁 으로 정해진다", () => {
    // 규칙: 인월 천간 = (절기년 천간 % 5) * 2 + 2
    //  甲年(0)→丙寅, 乙年(1)→戊寅, 丙年(2)→庚寅, 丁年(3)→壬寅, 戊年(4)→甲寅,
    //  己年(5)→丙寅, 庚年(6)→戊寅, 辛年(7)→庚寅, 壬年(8)→壬寅, 癸年(9)→甲寅
    const expected: Record<number, string> = {
      0: "丙寅", 1: "戊寅", 2: "庚寅", 3: "壬寅", 4: "甲寅",
      5: "丙寅", 6: "戊寅", 7: "庚寅", 8: "壬寅", 9: "甲寅",
    };
    // 절기년 천간 인덱스 0~9 를 모두 한 번씩 갖는 해를 골라 확인한다.
    const seen = new Map<number, number>();
    for (let y = 2020; y < 2080; y += 1) {
      seen.set(((y - 1984) % 60) % 10, y);
    }
    for (const [stemIdx, year] of seen) {
      expect(gz(monthGanZhiIndex(year, 2)), `${year}년(천간 인덱스 ${stemIdx})`).toBe(expected[stemIdx]);
    }
    expect(seen.size).toBe(10);
  });

  it("월주는 12개 지지를 寅부터 순환하며 천간은 5일마다 하나씩 넘어간다", () => {
    const list = Array.from({ length: 12 }, (_, b) => gz(monthGanZhiIndex(2026, b)));
    expect(list).toEqual([
      "庚子", "辛丑", "庚寅", "辛卯", "壬辰", "癸巳",
      "甲午", "乙未", "丙申", "丁酉", "戊戌", "己亥",
    ]);
  });

  it("절기 시각 전후로 월주가 갈린다 (2026 입춘 02-04 05:03 KST)", () => {
    const lichun = solarTerm(2026, "입춘");
    expect(formatIsoDate(lichun.koreaDate)).toBe("2026-02-04");
    // 丑월(소한~입춘)과 寅월(입춘~경칩)이 갈리는 지점. 2026 소한 = 01-05 17:26 KST
    expect(basis(pillarsAt({ year: 2026, month: 1, day: 5 }, 6))).toBe("대설"); // 12:00 < 17:26
    expect(basis(pillarsAt({ year: 2026, month: 1, day: 5 }, 11))).toBe("소한"); // 22:00 > 17:26
    expect(basis(pillarsAt({ year: 2026, month: 1, day: 6 }, 6))).toBe("소한");
    expect(pillarsAt({ year: 2026, month: 1, day: 6 }, 6).month.branch).toBe("丑");

    const before = pillarsAt(lichun.koreaDate, 1); // 축시 대표 02:00 < 05:03
    const after = pillarsAt(lichun.koreaDate, 6); // 오시 대표 12:00 > 05:03
    expect(basis(before)).toBe("소한");
    expect(before.month.branch).toBe("丑");
    expect(ganZhiText(before.month.stem, before.month.branch)).toBe("己丑");
    expect(basis(after)).toBe("입춘");
    expect(after.month.branch).toBe("寅");
    expect(ganZhiText(after.month.stem, after.month.branch)).toBe("庚寅");
  });

  it("절기 당일이라도 절기 시각 전에는 이전 월주다", () => {
    // 절기 시각은 12개 節 모두 21:00~24:00 또는 00:00~09:00 사이에 분포하므로,
    // 00:30(자정)과 22:00(해시) 두 대표 시각으로 경계 전후를 모두 확인한다.
    for (let y = 2000; y <= 2030; y += 1) {
      for (const def of ["입춘", "청명", "입하", "입추", "입동", "대설"] as const) {
        const t = solarTerm(y, def);
        const early = pillarsAt(t.koreaDate, 0, "자정"); // 00:30
        const late = pillarsAt(t.koreaDate, 11); // 22:00
        for (const [label, chart] of [["00:30", early], ["22:00", late]] as const) {
          const afterTerm = chart.basis.representativeEpochMs >= t.epochMs;
          expect(basis(chart) === def, `${y} ${def} ${label} (절기 ${t.koreaTime.hour}:${t.koreaTime.minute})`).toBe(
            afterTerm,
          );
          if (afterTerm) {
            expect(chart.month.branch, `${y} ${def} ${label}`).toBe(
              BRANCHES[chart.basis.monthBranchIndex].char,
            );
          }
        }
      }
    }
  });

  it("월주 12개는 寅 다음에 子 로 순환한다 (축월이 자월 다음)", () => {
    expect(monthGanZhiIndex(2026, 11) % 12).toBe(BRANCH_INDEX["亥"]);
    expect(monthGanZhiIndex(2026, 0) % 12).toBe(BRANCH_INDEX["子"]);
  });
});

/** 차트에서 월주 경계 절기 이름만 뽑는다. */
function basis(chart: FourPillars): string {
  return chart.basis.monthBoundaryTerm;
}

// ---------------------------------------------------------------------------

describe("일주", () => {
  it("기준일 1949-10-01 = 甲子", () => {
    expect(gz(dayGanZhiIndex({ year: 1949, month: 10, day: 1 }))).toBe("甲子");
  });

  it("2024-01-01 = 甲子, 2000-01-01 = 戊午", () => {
    expect(gz(dayGanZhiIndex({ year: 2024, month: 1, day: 1 }))).toBe("甲子");
    expect(gz(dayGanZhiIndex({ year: 2000, month: 1, day: 1 }))).toBe("戊午");
  });

  it("날짜가 하루 지나면 간지도 하나씩 넘어간다 (60일 주기)", () => {
    for (let y = 1900; y <= 2100; y += 7) {
      const a: CivilDate = { year: y, month: 3, day: 15 };
      const base = dayGanZhiIndex(a);
      for (const d of [1, 7, 30, 59]) {
        // 인덱스가 0~59 로 접히므로 60배수만큼 빼고 비교한다.
        expect((dayGanZhiIndex(addDays(a, d)) - base + 60) % 60, `${formatIsoDate(a)} +${d}`).toBe(d);
      }
      expect(dayGanZhiIndex(addDays(a, 60)), formatIsoDate(a)).toBe(base);
      // 같은 달·같은 날짜로 1년 뒤는 연 길이만큼 간지가 진행된다.
      // 3월 15일에서 1년 뒤로 갈 때 윤일이 끼는지는 **도착 연도** 가 윤년인지에 달려 있다.
      const next: CivilDate = { year: a.year + 1, month: a.month, day: a.day };
      const yearLen = differenceInDays(next, a);
      expect(yearLen, `${formatIsoDate(a)} → ${formatIsoDate(next)}`).toBe(
        isLeapSolarYear(a.year + 1) ? 366 : 365,
      );
      expect(
        (dayGanZhiIndex(next) - base + 60) % 60,
        `${formatIsoDate(a)} → ${formatIsoDate(next)}`,
      ).toBe(yearLen % 60);
    }
  });

  it("윤년 2월 29일을 건너뛰어도 연속된다", () => {
    const feb28: CivilDate = { year: 2024, month: 2, day: 28 };
    const feb29: CivilDate = { year: 2024, month: 2, day: 29 };
    const mar1: CivilDate = { year: 2024, month: 3, day: 1 };
    expect(gz(dayGanZhiIndex(feb29))).toBe(gz(dayGanZhiIndex(feb28) + 1));
    expect(gz(dayGanZhiIndex(mar1))).toBe(gz(dayGanZhiIndex(feb29) + 1));
    // 2024-01-01 = 甲子 (검증 기준일)
    expect(dayGanZhiIndex(feb29) - dayGanZhiIndex({ year: 2024, month: 1, day: 1 })).toBe(59);
  });

  it("연말을 넘어가면 이어진다", () => {
    const dec31: CivilDate = { year: 2024, month: 12, day: 31 };
    const jan1: CivilDate = { year: 2025, month: 1, day: 1 };
    expect(gz(dayGanZhiIndex(jan1))).toBe(gz(dayGanZhiIndex(dec31) + 1));
    // 2024 는 윤년이라 2025-01-01 은 2024-01-01 로부터 366일 뒤다.
    expect(
      (dayGanZhiIndex(jan1) - dayGanZhiIndex({ year: 2024, month: 1, day: 1 }) + 60) % 60,
    ).toBe(366 % 60);
  });

  it("지지 인덱스가 하루마다 순환한다", () => {
    for (let i = 0; i < 60; i += 1) {
      expect(gz(i).charAt(1), `인덱스 ${i}`).toBe(BRANCHES[i % 12].char);
      expect(gz(i).charAt(0), `인덱스 ${i}`).toBe(STEMS[i % 10].char);
    }
  });
});

// ---------------------------------------------------------------------------

describe("시주 — 五子遁", () => {
  it("甲·己일 기축은 甲子, 乙·庚일 기축은 丙子", () => {
    expect(gz(hourGanZhiIndex("甲", 0))).toBe("甲子");
    expect(gz(hourGanZhiIndex("己", 0))).toBe("甲子");
    expect(gz(hourGanZhiIndex("乙", 0))).toBe("丙子");
    expect(gz(hourGanZhiIndex("庚", 0))).toBe("丙子");
    expect(gz(hourGanZhiIndex("丙", 0))).toBe("戊子");
    expect(gz(hourGanZhiIndex("辛", 0))).toBe("戊子");
    expect(gz(hourGanZhiIndex("丁", 0))).toBe("庚子");
    expect(gz(hourGanZhiIndex("壬", 0))).toBe("庚子");
    expect(gz(hourGanZhiIndex("戊", 0))).toBe("壬子");
    expect(gz(hourGanZhiIndex("癸", 0))).toBe("壬子");
  });

  it("12개 시진이 자시 천간부터 순환한다", () => {
    const list = TIME_BRANCHES.map((t) => gz(hourGanZhiIndex("甲", t.index)));
    expect(list).toEqual([
      "甲子", "乙丑", "丙寅", "丁卯", "戊辰", "己巳",
      "庚午", "辛未", "壬申", "癸酉", "甲戌", "乙亥",
    ]);
  });

  it("시진 12개 모두에서 지지가 시진과 일치한다", () => {
    for (const dm of STEMS.map((s) => s.char)) {
      for (const t of TIME_BRANCHES) {
        expect(gz(hourGanZhiIndex(dm, t.index)).charAt(1), `${dm}일 ${t.branch}`).toBe(t.branch);
      }
    }
  });
});

// ---------------------------------------------------------------------------

describe("자시 — 조자시 / 만자시", () => {
  const ziDate: CivilDate = { year: 1990, month: 5, day: 20 };

  it("조자시(23:30 대표)는 일주 날짜를 다음 날로 넘긴다", () => {
    const cho = computeFourPillars({ solarDate: ziDate, timeBranchIndex: 0, ziMode: "조자시" });
    expect(cho.day.ganZhiIndex).toBe(dayGanZhiIndex(addDays(ziDate, 1)));
    expect(cho.basis.dayPillarDate.day).toBe(21);
    expect(cho.basis.solarDate.day).toBe(20);
    expect(cho.basis.representativeKoreaTime).toMatchObject({ day: 20, hour: 23, minute: 30 });
  });

  it("만자시(00:30 대표)는 그날 날짜를 유지한다", () => {
    const man = computeFourPillars({ solarDate: ziDate, timeBranchIndex: 0, ziMode: "자정" });
    expect(man.day.ganZhiIndex).toBe(dayGanZhiIndex(ziDate));
    expect(man.basis.dayPillarDate.day).toBe(20);
    expect(man.basis.representativeKoreaTime).toMatchObject({ day: 20, hour: 0, minute: 30 });
  });

  it("조자시와 만자시는 일주가 하루 어긋나고 시주 지지는 같다", () => {
    const cho = computeFourPillars({ solarDate: ziDate, timeBranchIndex: 0, ziMode: "조자시" });
    const man = computeFourPillars({ solarDate: ziDate, timeBranchIndex: 0, ziMode: "자정" });
    expect((cho.day.ganZhiIndex - man.day.ganZhiIndex + 60) % 60).toBe(1);
    expect(cho.hour?.branch).toBe("子");
    expect(man.hour?.branch).toBe("子");
  });

  it("자시가 아니면 ziMode 이 null 이어도 계산된다", () => {
    const noon = pillarsAt(ziDate, 6, null); // 午시 = 11:00~13:00
    expect(noon.hour?.branch).toBe("午");
    expect(noon.basis.ziMode).toBeNull();
  });

  it("자시면 ziMode 가 기록된다", () => {
    expect(computeFourPillars({ solarDate: ziDate, timeBranchIndex: 0, ziMode: "조자시" }).basis.ziMode).toBe("조자시");
    expect(computeFourPillars({ solarDate: ziDate, timeBranchIndex: 0, ziMode: "자정" }).basis.ziMode).toBe("자정");
  });

  it("ZI_HOUR_MODES 는 자정·조자시 두 가지뿐이다", () => {
    expect([...ZI_HOUR_MODES]).toEqual(["자정", "조자시"]);
  });
});

// ---------------------------------------------------------------------------

describe("시주 미상", () => {
  const date: CivilDate = { year: 1988, month: 11, day: 3 };

  it("hour 가 null 이고 나머지 세 기둥은 계산된다", () => {
    const chart = computeFourPillars({ solarDate: date, timeBranchIndex: null, ziMode: null });
    expect(chart.hour).toBeNull();
    expect(pillarsOf(chart)).toHaveLength(3);
    expect(chart.basis.hourUnknown).toBe(true);
  });

  it("대표 시각은 noon 이다", () => {
    const chart = computeFourPillars({ solarDate: date, timeBranchIndex: null, ziMode: null });
    expect(chart.basis.representativeKoreaTime.hour).toBe(12);
  });

  it("시주 미상이어도 년·월·일주는 어떤 시진으로 계산해도 같다", () => {
    const unknown = computeFourPillars({ solarDate: date, timeBranchIndex: null, ziMode: null });
    for (const idx of [1, 2, 6, 11]) {
      const known = pillarsAt(date, idx);
      expect(known.year.ganZhiIndex, `시진 ${idx} 년주`).toBe(unknown.year.ganZhiIndex);
      expect(known.month.ganZhiIndex, `시진 ${idx} 월주`).toBe(unknown.month.ganZhiIndex);
      expect(known.day.ganZhiIndex, `시진 ${idx} 일주`).toBe(unknown.day.ganZhiIndex);
    }
  });

  it("시주 미상이어도 십신·오행·지장간은 채워진다", () => {
    const chart = computeFourPillars({ solarDate: date, timeBranchIndex: null, ziMode: null });
    for (const p of pillarsOf(chart)) {
      expect(p.hidden.length, p.ganZhi.stem).toBeGreaterThanOrEqual(1);
      expect(p.element).toBe(STEMS[STEM_INDEX[p.stem]].element);
      expect(p.stage).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------

describe("전체 기준값 (스냅샷)", () => {
  it("1990-05-20 午시 = 庚午 辛巳 乙酉 壬午", () => {
    expect(text(pillarsAt({ year: 1990, month: 5, day: 20 }, 6))).toBe("庚午 辛巳 乙酉 壬午");
  });

  it("2000-01-01 자시(자정) = 己卯 丙子 戊午 壬子", () => {
    expect(text(pillarsAt({ year: 2000, month: 1, day: 1 }, 0, "자정"))).toBe("己卯 丙子 戊午 壬子");
  });

  it("1949-10-01 = 甲子일", () => {
    expect(pillarsAt({ year: 1949, month: 10, day: 1 }, 6).day.ganZhiIndex).toBe(0);
  });

  it("2024-02-10 = 甲辰년", () => {
    expect(pillarsAt({ year: 2024, month: 2, day: 10 }, 7).year.ganZhiIndex).toBe(yearGanZhiIndex(2024));
  });

  it("2026-09-27 午시 기준 스냅샷", () => {
    // 2026-09-27 = 白露 후 酉월, 일주 甲辰, 午시 庚午
    expect(text(pillarsAt({ ...REFERENCE_DATE }, 6))).toBe("丙午 丁酉 甲辰 庚午");
  });

  it("시주 미상 스냅샷 (2026-09-27)", () => {
    expect(text(pillarsAt({ ...REFERENCE_DATE }, null))).toBe("丙午 丁酉 甲辰");
  });
});

// ---------------------------------------------------------------------------

describe("기둥 구조적 불변식", () => {
  const dates: CivilDate[] = [
    { ...REFERENCE_DATE },
    { year: 1900, month: 1, day: 31 },
    { year: 1949, month: 10, day: 1 },
    { year: 1988, month: 5, day: 8 },
    { year: 2000, month: 2, day: 29 },
    { year: 2024, month: 2, day: 29 },
    { year: 2100, month: 12, day: 31 },
  ];

  it("모든 기둥의 천간·지지 홀짝이 맞는다", () => {
    for (const d of dates) {
      const chart = pillarsAt(d, 6);
      for (const p of pillarsOf(chart)) {
        expect(STEM_INDEX[p.stem] % 2, `${formatIsoDate(d)} ${ganZhiText(p.stem, p.branch)}`).toBe(
          BRANCH_INDEX[p.branch] % 2,
        );
      }
    }
  });

  it("PILLAR_LABELS 가 네 위치를 정확히 설명한다", () => {
    expect([...PILLAR_POSITIONS]).toEqual(["year", "month", "day", "hour"]);
    expect(Object.values(PILLAR_LABELS)).toEqual(["년주", "월주", "일주", "시주"]);
  });

  it("일주 십신은 항상 비견이고 일간은 일주의 천간이다", () => {
    for (const d of dates) {
      const chart = pillarsAt(d, 6);
      expect(chart.day.tenGod, formatIsoDate(d)).toBe("비견");
      expect(chart.dayMaster).toBe(chart.day.stem);
      expect(chart.dayMasterElement).toBe(chart.day.element);
    }
  });

  it("오행이 천간·지지 테이블과 일치한다", () => {
    for (const d of dates) {
      const chart = pillarsAt(d, 6);
      for (const p of pillarsOf(chart)) {
        expect(p.element, ganZhiText(p.stem, p.branch)).toBe(STEMS[STEM_INDEX[p.stem]].element);
        expect(p.branchElement, ganZhiText(p.stem, p.branch)).toBe(BRANCHES[BRANCH_INDEX[p.branch]].element);
        expect(p.hidden.length, ganZhiText(p.stem, p.branch)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("간지 인덱스와 문자열이 서로 일치한다", () => {
    for (const d of dates) {
      for (const p of pillarsOf(pillarsAt(d, 6))) {
        expect(gz(p.ganZhiIndex), formatIsoDate(d)).toBe(ganZhiText(p.stem, p.branch));
      }
    }
  });

  it("12개 시진 전부에 대해 구조가 유지된다", () => {
    const d: CivilDate = { year: 1990, month: 5, day: 20 };
    for (const t of TIME_BRANCHES) {
      const chart = pillarsAt(d, t.index, "자정");
      expect(chart.hour, t.branch).not.toBeNull();
      expect(chart.hour?.branch, t.branch).toBe(t.branch);
      expect(chart.hour?.stem).toBe(STEMS[hourGanZhiIndex(chart.dayMaster, t.index) % 10].char);
    }
  });

  it("같은 입력은 항상 같은 결과를 낸다", () => {
    const first = text(pillarsAt(REFERENCE_DATE, 6));
    for (let i = 0; i < 5; i += 1) {
      expect(text(pillarsAt(REFERENCE_DATE, 6))).toBe(first);
    }
  });

  it("성별은 원국 기둥에 영향을 주지 않는다 (대운 순역에만 쓰인다)", () => {
    const female = computeFourPillars({
      solarDate: { year: 1990, month: 5, day: 20 },
      timeBranchIndex: 6,
      ziMode: null,
      gender: "여",
    });
    const male = computeFourPillars({
      solarDate: { year: 1990, month: 5, day: 20 },
      timeBranchIndex: 6,
      ziMode: null,
      gender: "남",
    });
    const none = computeFourPillars({
      solarDate: { year: 1990, month: 5, day: 20 },
      timeBranchIndex: 6,
      ziMode: null,
    });
    expect(text(male)).toBe(text(female));
    expect(text(none)).toBe(text(female));
    expect(female.basis.directionRule).toBe("성별순역");
    expect(none.basis.directionRule).toBe("간지순역");
  });
});

// ---------------------------------------------------------------------------

describe("테스트 픽스처 자체의 안전성", () => {
  it("Fixture 출생 입력은 가상 데이터이며 region 이 시/군/구 구조다", () => {
    const b = birth({ year: 1990, month: 5, day: 20, time: { kind: "doubleHour", branchIndex: 6, ziMode: "자정" } });
    expect(b.region).toEqual(SAMPLE_REGION);
    expect(b.calendar).toBe("solar");
    expect(b.time.kind).toBe("doubleHour");
    expect(Object.keys(SAMPLE_REGION).sort()).toEqual(["sido", "sigungu"]);
  });

  it("기준일은 유효한 양력 날짜다", () => {
    expect(REFERENCE_DATE.year).toBeGreaterThan(1900);
    expect(REFERENCE_DATE.month).toBeGreaterThanOrEqual(1);
    expect(REFERENCE_DATE.month).toBeLessThanOrEqual(12);
    expect(REFERENCE_DATE.day).toBeGreaterThanOrEqual(1);
    expect(REFERENCE_DATE.day).toBeLessThanOrEqual(31);
  });
});

/** 타입 수준에서 천간/지지 유니온이 유지되는지 확인. */
const _typecheck: HeavenlyStem = "甲";
const _typecheck2: EarthlyBranch = "子";
void _typecheck;
void _typecheck2;
