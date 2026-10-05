import { describe, expect, it } from "vitest";
import {
  JIE_QI,
  SOLAR_TERM_BY_NAME,
  SOLAR_TERMS,
  jieForMonthBranch,
  monthBoundaryAt,
  monthBoundaryOf,
  solarTerm,
  solarTermsOfYear,
} from "../core/solar_terms/solarTerms";
import { deltaTSeconds } from "../core/solar_terms/deltaT";
import { formatIsoDate, type CivilDate } from "../core/calendar/civilDate";
import hko from "./fixtures/hko-solar-terms-2020-2027.json";

/**
 * 香港天文台(HKO) 24절기 기준표.
 * https://www.hko.gov.hk/en/gts/astronomy/data/files/24SolarTerms_YYYY.xml
 *
 * ⚠ HKO 는 **홍콩 현지시(UTC+8)** 로 게재한다. 한국 표준시(KST=UTC+9)와 1시간 차이가
 * 나므로, 비교할 때는 반드시 UTC+8 벽시계로 환산해야 한다. KST 라고 가정하면
 * 전부 60분씩 어긋나면서 겉보기 오차가 60분으로 보인다.
 */
type HkoRow = [number, Array<[number, number, string]>];
const HKO = (hko as unknown as { data: HkoRow[] }).data;

const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE_ = 60_000;
/** HKO 기준 시각대: UTC+8 */
const HKT_OFFSET_MS = 8 * MS_PER_HOUR;

/** HKO 의 "M/D HH:MM" (UTC+8 벽시계) → UTC 밀리초. */
function hkoInstant(row: HkoRow, index: number): number {
  const [year, terms] = row;
  const [month, day, hhmm] = terms[index];
  const [h, m] = hhmm.split(":").map(Number);
  return Date.UTC(year, month - 1, day, h, m, 0) - HKT_OFFSET_MS;
}

/** UTC 밀리초 → HKO 벽시계 날짜. */
function hkoDate(epochMs: number): CivilDate {
  const d = new Date(epochMs + HKT_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 192개 기준점 전부의 |오차| 를 분 단위로 모은다. */
function hkoDeviationsMinutes(): number[] {
  const out: number[] = [];
  for (const row of HKO) {
    const computed = solarTermsOfYear(row[0]);
    for (let i = 0; i < 24; i += 1) {
      out.push(Math.abs((computed[i].epochMs - hkoInstant(row, i)) / MS_PER_MINUTE_));
    }
  }
  return out;
}

describe("절기 정의표", () => {
  it("24절기가 15° 간격으로 놓여 있다", () => {
    expect(SOLAR_TERMS).toHaveLength(24);
    for (const [i, t] of SOLAR_TERMS.entries()) {
      expect(t.index).toBe(i);
      expect(t.longitude, t.name).toBe((285 + i * 15) % 360);
    }
  });

  it("12개의 節(isJie)과 12개의 氣로 나뉜다", () => {
    expect(JIE_QI).toHaveLength(12);
    expect(SOLAR_TERMS.filter((t) => !t.isJie)).toHaveLength(12);
  });

  it("구분 절기는 소한(丑)부터 순서대로 丑寅卯辰巳午未申酉戌亥子 에 대응한다", () => {
    // SOLAR_TERKS 순서는 소한(1월) → 동지(12월) 이므로 monthBranchIndex 도 그 순서다.
    expect(JIE_QI.map((t) => t.monthBranchIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0]);
    expect(jieForMonthBranch(1).name).toBe("소한");
    expect(jieForMonthBranch(2).name).toBe("입춘");
    expect(jieForMonthBranch(11).name).toBe("입동");
    expect(jieForMonthBranch(0).name).toBe("대설");
  });

  it("입춘만 해의 경계 절기로 지정되어 있다", () => {
    expect(SOLAR_TERMS.filter((t) => t.isNewYearBoundary).map((t) => t.name)).toEqual(["입춘"]);
  });

  it("지지의 이름이 시진 순서와 맞는다", () => {
    // 節 12개는 입춘(寅) 시작이므로 monthBranchIndex 2 → "寅"
    expect(jieForMonthBranch(2).name).toBe("입춘");
    expect(SOLAR_TERM_BY_NAME["입춘"].monthBranchIndex).toBe(2);
  });
});

describe("절기 시각 — HKO 192개 기준값 대조", () => {
  it("픽스처가 8년 × 24절기다", () => {
    expect(HKO).toHaveLength(8);
    for (const [year, terms] of HKO) {
      expect(year, String(year)).toBeGreaterThanOrEqual(2020);
      expect(terms, String(year)).toHaveLength(24);
    }
  });

  it("모든 절기 시각의 오차가 허용 범위 이내다", () => {
    // 실측(2020~2027, 192개): 최대 13.93분, 평균 3.60분. 15분을 상한으로 고정한다.
    const MAX_MINUTES = 15;
    const bad: string[] = [];
    for (const row of HKO) {
      const computed = solarTermsOfYear(row[0]);
      for (let i = 0; i < 24; i += 1) {
        const diffMin = (computed[i].epochMs - hkoInstant(row, i)) / MS_PER_MINUTE_;
        if (Math.abs(diffMin) <= MAX_MINUTES) continue;
        const c = computed[i];
        bad.push(
          `${row[0]} ${c.definition.name}: ${diffMin.toFixed(1)}분 (HKO ${row[1][i].join("/")})`,
        );
      }
    }
    const all = hkoDeviationsMinutes();
    const max = Math.max(...all);
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    expect(bad).toEqual([]);
    expect(max, `최대 오차 ${max.toFixed(2)}분`).toBeLessThanOrEqual(MAX_MINUTES);
    expect(mean, `평균 오차 ${mean.toFixed(2)}분`).toBeLessThanOrEqual(5);
  });

  it("실측 정확도가 문서에 적힌 값과 일치한다", () => {
    const all = hkoDeviationsMinutes();
    expect(all).toHaveLength(192);
    const max = Math.max(...all);
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    // docs/calculation-rules.md "절기 기준" 절에 적은 실측값
    expect(max, `최대 ${max.toFixed(2)}분`).toBeGreaterThan(13.9);
    expect(max, `최대 ${max.toFixed(2)}분`).toBeLessThan(14);
    expect(mean, `평균 ${mean.toFixed(2)}분`).toBeGreaterThan(3.5);
    expect(mean, `평균 ${mean.toFixed(2)}분`).toBeLessThan(3.7);
  });

  it("연도별 최대 오차가 전부 15분 이내다", () => {
    for (const [year] of HKO) {
      const computed = solarTermsOfYear(year);
      let worst = 0;
      let worstName = "";
      for (let i = 0; i < 24; i += 1) {
        const d = Math.abs((computed[i].epochMs - hkoInstant(HKO.find((r) => r[0] === year)!, i)) / MS_PER_MINUTE_);
        if (d > worst) {
          worst = d;
          worstName = computed[i].definition.name;
        }
      }
      expect(worst, `${year} ${worstName}: ${worst.toFixed(2)}분`).toBeLessThan(15);
    }
  });

  it("절기 날짜가 192개 중 대부분 일치한다", () => {
    // ±14분이면 날짜가 바뀔 수 있으므로 날짜가 같은 비율을 확인한다.
    let same = 0;
    let total = 0;
    const mismatched: string[] = [];
    for (const row of HKO) {
      const computed = solarTermsOfYear(row[0]);
      for (let i = 0; i < 24; i += 1) {
        total += 1;
        const [m, d] = row[1][i];
        if (formatIsoDate(hkoDate(computed[i].epochMs)) === formatIsoDate({ year: row[0], month: m, day: d })) {
          same += 1;
        } else {
          mismatched.push(`${row[0]} ${computed[i].definition.name} (HKO ${m}/${d})`);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`절기 날짜 불일치 ${mismatched.length}건: ${mismatched.join(", ") || "없음"}`);
    expect(same / total).toBeGreaterThan(0.97);
  });
});

describe("절기 순서와 연속성", () => {
  it("24절기는 시간순으로 单调 증가한다", () => {
    for (let y = 1901; y <= 2100; y += 1) {
      const terms = solarTermsOfYear(y);
      for (let i = 1; i < 24; i += 1) {
        expect(terms[i].epochMs, `${y} ${terms[i].definition.name}`).toBeGreaterThan(terms[i - 1].epochMs);
      }
    }
  });

  it("같은 절기의 해를 넘으면 약 365.24일 뒤다", () => {
    for (let y = 1901; y <= 2099; y += 1) {
      const a = solarTerm(y, "입춘").epochMs;
      const b = solarTerm(y + 1, "입춘").epochMs;
      const days = (b - a) / (24 * MS_PER_HOUR);
      expect(days, `${y}→${y + 1}`).toBeGreaterThan(365);
      expect(days, `${y}→${y + 1}`).toBeLessThan(366);
    }
  });

  it("춘분과 추분은 약 6개월 apart 다", () => {
    for (let y = 1901; y <= 2099; y += 1) {
      const vernal = solarTerm(y, "춘분");
      const autumnal = solarTerm(y, "추분");
      const days = (autumnal.epochMs - vernal.epochMs) / MS_PER_HOUR / 24;
      expect(days, `${y}`).toBeGreaterThan(183);
      expect(days, `${y}`).toBeLessThan(190);
    }
  });

  it("동지는 해마다 12월 20~23일에 분포한다", () => {
    for (let y = 1902; y <= 2099; y += 1) {
      const w = solarTerm(y, "동지");
      expect(w.koreaDate.month, String(y)).toBe(12);
      expect(w.koreaDate.day, `${y}-12`).toBeGreaterThanOrEqual(20);
      expect(w.koreaDate.day, `${y}-12`).toBeLessThanOrEqual(23);
    }
  });

  it("입춘은 해마다 2월 3~5일에 분포한다", () => {
    for (let y = 1902; y <= 2099; y += 1) {
      const r = solarTerm(y, "입춘");
      expect(r.koreaDate.month, String(y)).toBe(2);
      expect(r.koreaDate.day, `${y}-02`).toBeGreaterThanOrEqual(3);
      expect(r.koreaDate.day, `${y}-02`).toBeLessThanOrEqual(5);
    }
  });

  it("지원 연도 밖은 거절한다", () => {
    expect(() => solarTermsOfYear(999)).toThrow();
    expect(() => solarTermsOfYear(3001)).toThrow();
    expect(() => solarTermsOfYear(2020.5)).toThrow();
  });
});

describe("구분 절기 경계 (월주 경계)", () => {
  it("2026-01-05 는 자월(子), 01-06 부터 축월(丑)", () => {
    expect(monthBoundaryOf({ year: 2026, month: 1, day: 5 }).monthBranchIndex).toBe(0);
    expect(monthBoundaryOf({ year: 2026, month: 1, day: 6 }).monthBranchIndex).toBe(1);
  });

  it("2026-02-04 는 축월(丑), 02-05 부터 인월(寅)", () => {
    expect(monthBoundaryOf({ year: 2026, month: 2, day: 4 }).monthBranchIndex).toBe(1);
    expect(monthBoundaryOf({ year: 2026, month: 2, day: 5 }).monthBranchIndex).toBe(2);
  });

  it("1월 1일은 아직 소한 전이므로 전년도 대설 경계를 쓴다", () => {
    const b = monthBoundaryOf({ year: 2026, month: 1, day: 1 });
    expect(b.term.definition.name).toBe("대설");
    expect(b.term.year).toBe(2025);
    // 대설(大雪)이 여는 사월은 자월(子, index 0) 이다.
    expect(b.monthBranchIndex).toBe(0);
  });

  it("절기 순간 1초 전에는 이전 절기, 그 순간부터는 새 절기에 든다", () => {
    for (let y = 1902; y <= 2099; y += 1) {
      for (const def of JIE_QI) {
        const t = solarTerm(y, def.name);
        if (t.koreaDate.year !== y) continue;
        const before = monthBoundaryAt(t.epochMs - 1000);
        const after = monthBoundaryAt(t.epochMs);
        expect(before.term.definition.name, `${y} ${def.name} 직전`).not.toBe(def.name);
        expect(after.term.definition.name, `${y} ${def.name} 직후`).toBe(def.name);
        expect(after.monthBranchIndex, `${y} ${def.name}`).toBe(def.monthBranchIndex);
      }
    }
  });

  it("절기 당일 자정에는 아직 이전 절기 구간이고, 같은 날 저녁에는 새 구간이다", () => {
    // 2026 소한은 01-05 12:20 KST. 자정(00:00)에는 아직 자월(子) 이다.
    const sohan = solarTerm(2026, "소한");
    expect(formatIsoDate(sohan.koreaDate)).toBe("2026-01-05");
    expect(monthBoundaryOf({ year: 2026, month: 1, day: 5 }).term.definition.name).toBe("대설");
    expect(monthBoundaryAt(sohan.epochMs + 60_000).term.definition.name).toBe("소한");
  });

  it("연중 모든 날짜에서 경계 지지와 절기 이름이 1:1 로 대응한다", () => {
    for (let y = 2000; y <= 2030; y += 1) {
      for (let m = 1; m <= 12; m += 1) {
        for (const d of [1, 15, 28]) {
          const date: CivilDate = { year: y, month: m, day: d };
          const b = monthBoundaryOf(date);
          expect(jieForMonthBranch(b.monthBranchIndex).name).toBe(b.term.definition.name);
        }
      }
    }
  });

  it("연속한 날짜의 경계는 그대로이거나 새 절기가 반드시 節 이다", () => {
    // 대설(22) → 소한(0) 처럼 중간의 氣(동지 23) 를 건너뛰며 인덱스가 2씩 뛸 수 있다.
    // 다만 날짜가 바뀌어 경계가 넘어갈 때 새로 적용되는 절기는 반드시 12개 節 중 하나다.
    for (let y = 2000; y <= 2030; y += 1) {
      for (let m = 1; m <= 12; m += 1) {
        const days = m === 2 ? 28 : m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
        for (let d = 1; d < days; d += 1) {
          const a = monthBoundaryOf({ year: y, month: m, day: d });
          const b = monthBoundaryOf({ year: y, month: m, day: d + 1 });
          if (a.term.definition.name === b.term.definition.name) continue;
          expect(b.term.definition.isJie, `${y}-${m}-${d + 1}: ${b.term.definition.name}`).toBe(true);
          expect(b.term.epochMs, `${y}-${m}-${d + 1}`).toBeGreaterThan(a.term.epochMs);
          expect(b.monthBranchIndex).toBe(b.term.definition.monthBranchIndex);
        }
      }
    }
  });
});

describe("ΔT (TT − UT)", () => {
  it("역사적으로는 1900년 부근이 음수이고 이후 계속 증가한다", () => {
    // 실측: 1900 ≈ −2.8초. 지구회전 속도 변화는 20세기 초에 잠시 앞섰기 때문이다.
    expect(deltaTSeconds(1900)).toBeLessThan(0);
    expect(deltaTSeconds(1900)).toBeGreaterThan(-5);
    expect(deltaTSeconds(1950)).toBeCloseTo(29.07, 1);
    expect(deltaTSeconds(2000)).toBeCloseTo(63.86, 1);
  });

  it("지원 범위(1900~2100)에서 단조 증가하고 이산이 작다", () => {
    // Espenak–Meeus 다항식 구간이 바뀌는 지점에서도 실측값은 이어진다.
    // 1900~2100 구간의 최대 연 간격 변화는 2.36초(2099→2100) 이므로 2.5초로 둔다.
    // 불연속이 hundreds 초 수준이면 이 검사가 즉시 잡아낸다.
    for (let y = 1900; y < 2100; y += 1) {
      const a = deltaTSeconds(y);
      const b = deltaTSeconds(y + 1);
      const jump = Math.abs(b - a);
      expect(jump, `${y} → ${y + 1} (${a.toFixed(2)} → ${b.toFixed(2)})`).toBeLessThan(2.5);
    }
  });

  it("ΔT 는 1920년 전후에 큰 이산을 갖지만 크기는 수십 초 이내다", () => {
    // 1919 ≈ 20.8초, 1920 ≈ 21.2초 로 실제로 이어진다. 큰 이산은 다른 구간에서 온다.
    expect(deltaTSeconds(1920) - deltaTSeconds(1919)).toBeLessThan(0.5);
    expect(deltaTSeconds(1941) - deltaTSeconds(1940)).toBeLessThan(0.5);
    expect(deltaTSeconds(1961) - deltaTSeconds(1960)).toBeLessThan(0.5);
  });

  it("미래 구간(2150~2300)까지 유한한 값을 준다", () => {
    expect(deltaTSeconds(2150)).toBeGreaterThan(90);
    expect(deltaTSeconds(2300)).toBeGreaterThan(deltaTSeconds(2150));
    expect(Number.isFinite(deltaTSeconds(3000))).toBe(true);
  });
});
