/**
 * 결정론(determinism) — 이 프로젝트의 가장 중요한 성질.
 *
 * 1. 같은 입력이면 언제 어디서 돌려도 **완전히 같은 결과**가 나온다.
 *    (난수 · 시계 · 로케일 · 순회 순서에 흔들리지 않는다)
 * 2. 웹과 이메일이 같은 Core 를 부르므로, 같은 날짜면 같은 일운·같은 해석이다.
 * 3. 결과에는 순서가 있는 자료구조만 있고, Map/Set 의 순서 누출이 없다.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  analyzeBirth,
  analyzeFortune,
  comparePeriods,
  type SajuResult,
} from "../core";
import { collectSignals, readFortune } from "../core/interpretation/reading";
import { buildFortuneContext } from "../core/fortune/fortuneContext";
import { computeFourPillars, pillarsOf } from "../core/pillars/fourPillars";
import { elementDistribution } from "../core/elements/elementBalance";
import { computeYongshin } from "../core/yongshin/yongshin";
import { analyzeInteractions } from "../core/interactions/interactions";
import type { CivilDate } from "../core/calendar/civilDate";
import { REFERENCE_DATE, birth, lunarBirth } from "./fixtures/samples";

/**
 * 키 순서와 무관하게 결과를 문자열로 만드는 직렬화기.
 *
 * 순환 검출은 **현재 경로(경로 스택)** 에만 있는지로 한다.
 * 전역 방문 집합을 쓰면 "같은 객체를 두 번 참조한 것"까지 순환으로 오인한다.
 */
function stableStringify(value: unknown, path: object[] = []): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number") return Number.isFinite(value as number) ? String(value) : "nonfinite";
  if (t === "boolean" || t === "string") return JSON.stringify(value);
  if (t === "undefined") return "undefined";
  if (t === "function" || t === "symbol") return "[uncallable]";
  if (t === "bigint") return `${String(value)}n`;
  const obj = value as object;
  if (path.includes(obj)) return "[circular]";
  const next = [...path, obj];
  if (Array.isArray(obj)) return `[${obj.map((v) => stableStringify(v, next)).join(",")}]`;
  if (obj instanceof Date) return `Date(${obj.getTime()})`;
  if (obj instanceof Set) {
    // Set 의 삽입 순서가 결과에 영향을 주지 않아야 하므로 정렬해 비교한다.
    return `Set{${[...obj].map((v) => stableStringify(v, next)).sort().join(",")}}`;
  }
  if (obj instanceof Map) {
    return `Map{${[...obj.entries()]
      .map(([k, v]) => `${stableStringify(k, next)}=>${stableStringify(v, next)}`)
      .sort()
      .join(",")}}`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${k}:${stableStringify((obj as Record<string, unknown>)[k], next)}`)
    .join(",")}}`;
}

const RESULT = analyzeBirth(birth());

// 가짜 시계를 쓴 테스트가 실패해도 다음 테스트에 새벽 시각이 새어나지 않게 한다.
afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------

describe("같은 입력 → 같은 결과", () => {
  it("원국 전체가 바이트 단위로 같다", () => {
    const a = stableStringify(analyzeBirth(birth()));
    for (let i = 0; i < 4; i += 1) {
      expect(stableStringify(analyzeBirth(birth())), `run ${i}`).toBe(a);
    }
  });

  it("입력 객체를 여러 번 만들어도 결과가 같다", () => {
    const a = analyzeBirth(birth()).natal.chart;
    const b = analyzeBirth(birth({ year: 1990, month: 5, day: 20 })).natal.chart;
    expect(stableStringify(b)).toBe(stableStringify(a));
  });

  it("원국을 바꾸지 않은 입력을 복사해도 결과가 같다", () => {
    const input = birth();
    const a = analyzeBirth({ ...input });
    const b = analyzeBirth({ ...input, region: { ...input.region } });
    expect(stableStringify(b)).toBe(stableStringify(a));
  });

  it("계산 모듈을 직접 불러도 공개 API 와 같은 기둥을 낸다", () => {
    const viaApi = pillarsOf(RESULT.natal.chart);
    const viaModule = pillarsOf(
      computeFourPillars({
        solarDate: RESULT.natal.chart.basis.solarDate,
        timeBranchIndex: 6,
        ziMode: "자정",
      }),
    );
    expect(stableStringify(viaModule)).toBe(stableStringify(viaApi));
  });

  it("오행 분포도 공개 API 경로와 같다", () => {
    expect(stableStringify(elementDistribution(RESULT.natal.chart))).toBe(
      stableStringify(RESULT.natal.distribution),
    );
  });

  it("운세 결과도 같다", () => {
    const a = analyzeFortune(RESULT, REFERENCE_DATE);
    for (let i = 0; i < 3; i += 1) {
      expect(stableStringify(analyzeFortune(RESULT, REFERENCE_DATE)), `run ${i}`).toBe(
        stableStringify(a),
      );
    }
  });

  it("결과에 순환 참조·비유한 수·함수가 없다", () => {
    const text = stableStringify(analyzeFortune(RESULT, REFERENCE_DATE));
    expect(text).not.toContain("[circular]");
    expect(text).not.toContain("nonfinite");
    expect(text).not.toContain("[uncallable]");
  });

  it("결과에 Map / Set 이 새어나오지 않는다 (직렬화 가능한 구조만)", () => {
    const text = stableStringify(analyzeBirth(birth()));
    expect(text).not.toContain("Set{");
    expect(text).not.toContain("Map{");
  });
});

describe("웹 · 이메일 경로의 일치", () => {
  /** 웹 화면이 쓰는 경로. */
  function webPath(date: CivilDate) {
    const r = analyzeBirth(birth());
    return analyzeFortune(r, date);
  }

  /** 이메일이 쓰는 경로. (같은 Core 를 같은 인자로 부른다) */
  function emailPath(date: CivilDate) {
    const r = analyzeBirth(birth());
    const context = buildFortuneContext({
      chart: r.natal.chart,
      date,
      gender: r.input.gender,
    });
    return {
      context,
      reading: readFortune(context, { dateLabel: `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}` }),
    };
  }

  const DATES: CivilDate[] = [
    REFERENCE_DATE,
    { year: 2026, month: 9, day: 28 },
    { year: 2026, month: 1, day: 1 },
    { year: 2026, month: 2, day: 4 },
    { year: 2026, month: 6, day: 15 },
    { year: 1901, month: 3, day: 3 },
    { year: 2099, month: 12, day: 31 },
  ];

  it("같은 날짜면 일운이 같다", () => {
    for (const date of DATES) {
      expect(emailPath(date).context.ilun.ganZhi, `${date.year}-${date.month}`).toBe(
        webPath(date).context.ilun.ganZhi,
      );
    }
  });

  it("같은 날짜면 세운 · 월운 · 대운이 같다", () => {
    for (const date of DATES) {
      const w = webPath(date).context;
      const e = emailPath(date).context;
      expect([e.seun.ganZhi, e.wolun.ganZhi, e.daeun?.ganZhi], `${date.year}`).toEqual([
        w.seun.ganZhi,
        w.wolun.ganZhi,
        w.daeun?.ganZhi,
      ]);
    }
  });

  it("같은 날짜면 8개 항목 해석이 같다", () => {
    for (const date of DATES) {
      const w = webPath(date).reading;
      const e = emailPath(date).reading;
      expect(e.sections.map((s) => [s.topic, s.intensity, s.direction, s.interpretation]), `${date.year}`)
        .toEqual(w.sections.map((s) => [s.topic, s.intensity, s.direction, s.interpretation]));
    }
  });

  it("같은 날짜면 주의점 · 핵심 포인트 · 제한 고지가 같다", () => {
    for (const date of DATES) {
      const w = webPath(date).reading;
      const e = emailPath(date).reading;
      expect(e.cautions, `${date.year}`).toEqual(w.cautions);
      expect(e.keyPoints, `${date.year}`).toEqual(w.keyPoints);
      expect(e.restrictions, `${date.year}`).toEqual(w.restrictions);
    }
  });

  it("같은 날짜면 간(干支) 목록이 같다", () => {
    for (const date of DATES) {
      expect(stableStringify(emailPath(date).context.interactions), `${date.year}`).toBe(
        stableStringify(webPath(date).context.interactions),
      );
    }
  });
});

describe("음력 경로도 결정론적이다", () => {
  it("같은 음력 입력을 여러 번 넣어도 같다", () => {
    const a = stableStringify(analyzeBirth(lunarBirth({ year: 1990, month: 4, day: 15, leapMonth: false })));
    for (let i = 0; i < 3; i += 1) {
      expect(stableStringify(analyzeBirth(lunarBirth({ year: 1990, month: 4, day: 15, leapMonth: false })))).toBe(a);
    }
  });

  it("음력 → 양력 변환이 같은 결과를 낸다", () => {
    const fromLunar = analyzeBirth(lunarBirth({ year: 1990, month: 4, day: 15, leapMonth: false }));
    const solarDate = fromLunar.conversion.solarDate;
    const fromSolar = analyzeBirth(birth({ calendar: "solar", ...solarDate }));
    expect(stableStringify(fromSolar.natal)).toBe(stableStringify(fromLunar.natal));
  });
});

describe("입력 순서·캐시 상태가 결과를 바꾸지 않는다", () => {
  it("다른 사주를 먼저 계산해도 영향을 주지 않는다", () => {
    // 캐시가 켜져 있는 모듈이 많아这一步가 중요하다.
    const a = stableStringify(analyzeBirth(birth()));
    for (const other of [
      birth({ year: 1977, month: 2, day: 2 }),
      birth({ year: 2001, month: 11, day: 28, time: { kind: "unknown" } }),
      birth({ year: 1960, month: 7, day: 15, time: { kind: "doubleHour", branchIndex: 0, ziMode: "조자시" } }),
    ]) {
      analyzeBirth(other);
    }
    expect(stableStringify(analyzeBirth(birth()))).toBe(a);
  });

  it("시주 미상 사주를 계산한 뒤에도 시주 있는 사주가 그대로다", () => {
    const before = stableStringify(elementDistribution(RESULT.natal.chart));
    analyzeBirth(birth({ time: { kind: "unknown" } }));
    expect(stableStringify(elementDistribution(RESULT.natal.chart))).toBe(before);
  });

  it("간(干支) 분석 결과를 캐시해도 순서가 흔들리지 않는다", () => {
    const inputs = RESULT.natal.pillars.map((p) => ({
      label: p.position,
      position: p.position,
      pillar: p,
    }));
    const first = stableStringify(analyzeInteractions(inputs));
    for (let i = 0; i < 3; i += 1) {
      expect(stableStringify(analyzeInteractions(inputs))).toBe(first);
    }
  });

  it("용신·희신이 캐시를 건드려도 같다", () => {
    const a = stableStringify(computeYongshin(RESULT.natal.chart));
    for (let i = 0; i < 3; i += 1) {
      expect(stableStringify(computeYongshin(RESULT.natal.chart))).toBe(a);
    }
  });
});

describe("시계에 의존하지 않는다", () => {
  it("시스템 시각을 바꿔도 결과가 같다", () => {
    // 가짜 시계로 하루 중 어느 순간이든 같은 결과를 내야 한다.
    // (KST 자정 직전 23:59:59, KST 00:00:01, UTC 자정 등 경계 시각을 모두 훑는다)
    const baseline = stableStringify(analyzeFortune(RESULT, REFERENCE_DATE));
    const moments = [
      Date.UTC(2026, 8, 26, 14, 59, 59), // 2026-09-26 23:59:59 KST (다음 날 직전)
      Date.UTC(2026, 8, 26, 15, 0, 0), //  2026-09-27 00:00:00 KST
      Date.UTC(2026, 8, 26, 15, 0, 1), //  2026-09-27 00:00:01 KST
      Date.UTC(2026, 8, 27, 3, 30, 0), //  2026-09-27 12:30 KST
      Date.UTC(2026, 8, 27, 14, 59, 59), // 2026-09-27 23:59:59 KST
      Date.UTC(1999, 0, 1, 0, 0, 0), // 1999
      Date.UTC(2100, 11, 31, 23, 59, 59), // 2101
    ];
    for (const now of moments) {
      vi.setSystemTime(now);
      expect(stableStringify(analyzeFortune(RESULT, REFERENCE_DATE)), new Date(now).toISOString()).toBe(
        baseline,
      );
    }
    vi.useRealTimers();
  });

  it("시스템 시각이 달라도 원국 계산이 같다", () => {
    const baseline = stableStringify(analyzeBirth(birth()));
    vi.setSystemTime(Date.UTC(2030, 5, 15, 3, 0, 0));
    expect(stableStringify(analyzeBirth(birth()))).toBe(baseline);
    vi.useRealTimers();
  });

  it("운세 결과에는 요청한 날짜만 들어간다", () => {
    const result = analyzeFortune(RESULT, REFERENCE_DATE);
    expect(result.reading.dateLabel).toBe("2026-09-27 (한국 시간 기준)");
    expect(result.context.date).toEqual(REFERENCE_DATE);
  });

  it("다른 날짜를 계산한 흔적이 결과에 남지 않는다", () => {
    const a = stableStringify(analyzeFortune(RESULT, REFERENCE_DATE));
    analyzeFortune(RESULT, { year: 1988, month: 4, day: 15 });
    analyzeFortune(RESULT, { year: 2077, month: 12, day: 31 });
    expect(stableStringify(analyzeFortune(RESULT, REFERENCE_DATE))).toBe(a);
  });
});

describe("비교 결과도 결정론적이다", () => {
  it("기간 비교를 두 번 돌려도 같다", () => {
    const a = stableStringify(comparePeriods(RESULT, REFERENCE_DATE, { year: 2026, month: 6, day: 15 }));
    for (let i = 0; i < 3; i += 1) {
      expect(
        stableStringify(comparePeriods(RESULT, REFERENCE_DATE, { year: 2026, month: 6, day: 15 })),
      ).toBe(a);
    }
  });

  it("같은 날짜끼리 비교하면 전부 같은 것으로 표시된다", () => {
    const c = comparePeriods(RESULT, REFERENCE_DATE, REFERENCE_DATE);
    expect(c.rows.every((r) => r.same)).toBe(true);
    expect(c.onlyA).toEqual([]);
    expect(c.onlyB).toEqual([]);
  });

  it("신호 목록은 같은 날짜면 같은 순서로 나온다", () => {
    const ctx = buildFortuneContext({ chart: RESULT.natal.chart, date: REFERENCE_DATE, gender: "여" });
    const a = collectSignals(ctx).map((s) => s.ruleId);
    expect(collectSignals(ctx).map((s) => s.ruleId)).toEqual(a);
  });
});

describe("SajuResult 는 값만 담는다", () => {
  it("계산 결과에 함수가 섞여 있지 않다", () => {
    const text = stableStringify(RESULT);
    expect(text).not.toContain("[uncallable]");
  });

  it("결과를 그대로 다시 계산에 쓸 수 있다", () => {
    const again: SajuResult = analyzeBirth(RESULT.input);
    expect(stableStringify(again)).toBe(stableStringify(RESULT));
  });
});
