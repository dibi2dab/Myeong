import { describe, expect, it } from "vitest";
import {
  KST_DST_OFFSET_MINUTES,
  KST_OFFSET_MINUTES,
  isKstDaylightSaving,
  koreaCivilDate,
  koreaCivilTime,
  koreaOffsetMinutes,
  todayInKorea,
  utcMsFromKoreaCivilTime,
} from "../core/calendar/koreaTime";
import { formatIsoDate, type CivilDateTime } from "../core/calendar/civilDate";
import { kstInstant } from "../core/solar_terms/solarTerms";

const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;

function iso(epochMs: number): string {
  const t = koreaCivilTime(epochMs);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${t.year}-${p(t.month)}-${p(t.day)} ` +
    `${p(t.hour)}:${p(t.minute)}:${p(t.second)} KST`
  );
}

// ---------------------------------------------------------------------------

describe("KST 오프셋", () => {
  it("기본 오프셋은 UTC+9 이다", () => {
    expect(KST_OFFSET_MINUTES).toBe(9 * 60);
    expect(KST_DST_OFFSET_MINUTES).toBe(10 * 60);
  });

  it("일반 시대에는 UTC+9 다", () => {
    for (const y of [1955, 1970, 2000, 2024, 2026]) {
      expect(koreaOffsetMinutes(Date.UTC(y, 5, 15, 3)), String(y)).toBe(KST_OFFSET_MINUTES);
      expect(isKstDaylightSaving(Date.UTC(y, 5, 15, 3)), String(y)).toBe(false);
    }
  });

  it("UTC+9 시각을 정확히 환산한다", () => {
    // 2026-09-28 09:30 KST = 2026-09-28 00:30 UTC
    const ms = Date.UTC(2026, 8, 28, 0, 30);
    expect(koreaCivilTime(ms).hour).toBe(9);
    expect(koreaCivilTime(ms).minute).toBe(30);
  });
});

describe("UTC 00:30 = KST 09:30 (요구된 경계 사례)", () => {
  it("UTC 00:30 은 한국으로 09:30 이고 같은 날이다", () => {
    const utc = Date.UTC(2026, 8, 28, 0, 30);
    expect(iso(utc)).toBe("2026-09-28 09:30:00 KST");
    expect(formatIsoDate(koreaCivilDate(utc))).toBe("2026-09-28");
  });

  it("UTC 15:00 이 정확히 KST 자정이라 그 순간 날짜가 바뀐다", () => {
    const before = Date.UTC(2026, 8, 28, 14, 59, 59);
    const at = Date.UTC(2026, 8, 28, 15, 0, 0);
    expect(formatIsoDate(koreaCivilDate(before))).toBe("2026-09-28");
    expect(formatIsoDate(koreaCivilDate(at))).toBe("2026-09-29");
    expect(iso(at)).toBe("2026-09-29 00:00:00 KST");
  });

  it("UTC 15:00 이 정확히 KST 자정이다", () => {
    const midnight = Date.UTC(2026, 8, 28, 15, 0, 0);
    expect(iso(midnight)).toBe("2026-09-29 00:00:00 KST");
  });

  it("같은 UTC 날짜 안에서 한국 날짜가 두 개가 될 수 있다", () => {
    // 2026-09-28 UTC 00:00 ~ 14:59 → 한국은 09-28, 15:00 ~ 23:59 → 09-29
    expect(formatIsoDate(koreaCivilDate(Date.UTC(2026, 8, 28, 0, 0)))).toBe("2026-09-28");
    expect(formatIsoDate(koreaCivilDate(Date.UTC(2026, 8, 28, 23, 59)))).toBe("2026-09-29");
  });
});

describe("todayInKorea", () => {
  it("UTC/KST 날짜 불일치를 정확히 처리한다", () => {
    // UTC 2026-09-28 15:30 → KST 2026-09-29
    expect(formatIsoDate(todayInKorea(Date.UTC(2026, 8, 28, 15, 30)))).toBe("2026-09-29");
    // UTC 2026-09-28 14:30 → KST 2026-09-28
    expect(formatIsoDate(todayInKorea(Date.UTC(2026, 8, 28, 14, 30)))).toBe("2026-09-28");
  });

  it("인자가 없으면 Date.now() 를 쓴다 (결정론 경로 밖)", () => {
    const spy = Date.now;
    try {
      Date.now = () => Date.UTC(2026, 8, 28, 15, 30);
      expect(formatIsoDate(todayInKorea())).toBe("2026-09-29");
    } finally {
      Date.now = spy;
    }
  });

  it("월말·연말 경계도 넘어간다", () => {
    // UTC 2026-12-31 15:00 → KST 2027-01-01
    expect(formatIsoDate(todayInKorea(Date.UTC(2026, 11, 31, 15, 0)))).toBe("2027-01-01");
    expect(formatIsoDate(todayInKorea(Date.UTC(2026, 11, 31, 14, 59)))).toBe("2026-12-31");
  });
});

describe("서머타임 (1948 · 1951 · 1987 · 1988)", () => {
  const periods = [
    { year: 1948, from: { month: 6, day: 1 }, to: { month: 9, day: 13 } },
    { year: 1951, from: { month: 6, day: 1 }, to: { month: 9, day: 9 } },
    { year: 1987, from: { month: 5, day: 24 }, to: { month: 10, day: 24 } },
    { year: 1988, from: { month: 5, day: 8 }, to: { month: 10, day: 24 } },
  ];

  it("운영 기간 안에서는 UTC+10 이다", () => {
    for (const p of periods) {
      const mid = Date.UTC(p.year, p.from.month - 1, p.from.day + 10, 3);
      expect(koreaOffsetMinutes(mid), `${p.year}`).toBe(KST_DST_OFFSET_MINUTES);
      expect(isKstDaylightSaving(mid), `${p.year}`).toBe(true);
    }
  });

  it("운영 기간 밖에서는 UTC+9 다", () => {
    for (const p of periods) {
      expect(koreaOffsetMinutes(Date.UTC(p.year, 0, 15, 3)), `${p.year} 1월`).toBe(KST_OFFSET_MINUTES);
      expect(koreaOffsetMinutes(Date.UTC(p.year, 11, 15, 3)), `${p.year} 12월`).toBe(KST_OFFSET_MINUTES);
    }
  });

  it("운영 기간이 아닌 해에는 서머타임이 전혀 없다", () => {
    for (const y of [1947, 1949, 1950, 1952, 1986, 1989, 1990]) {
      for (let m = 0; m < 12; m += 1) {
        expect(isKstDaylightSaving(Date.UTC(y, m, 15, 6)), `${y}-${m + 1}`).toBe(false);
      }
    }
  });

  it("1988 서머타임 기간에 12시 기준 날짜가 한 번 밀린다", () => {
    // UTC 1988-06-15 12:00 → UTC+9 면 21:00, UTC+10 면 22:00
    const ms = Date.UTC(1988, 5, 15, 12);
    expect(koreaCivilTime(ms).hour).toBe(22);
    expect(koreaCivilTime(ms - MS_PER_HOUR).hour).toBe(21);
  });

  it("UTC+10 에서는 자정이 UTC 14:00 이다", () => {
    // 1988 서머타임 중에는 하루가 13시간 짧아진다.
    expect(formatIsoDate(koreaCivilDate(Date.UTC(1988, 5, 14, 13, 59)))).toBe("1988-06-14");
    expect(formatIsoDate(koreaCivilDate(Date.UTC(1988, 5, 14, 14, 0)))).toBe("1988-06-15");
    expect(iso(Date.UTC(1988, 5, 14, 14, 0))).toBe("1988-06-15 00:00:00 KST");
  });

  it("서머타임이 없는 해에는 같은 UTC 시각이 1시간 늦게 온다", () => {
    // 1988-06-15 03:00 UTC → +10 = 13:00, 1990-06-15 03:00 UTC → +9 = 12:00
    expect(koreaCivilTime(Date.UTC(1988, 5, 15, 3)).hour).toBe(13);
    expect(koreaCivilTime(Date.UTC(1990, 5, 15, 3)).hour).toBe(12);
  });
});

describe("utcMsFromKoreaCivilTime 역변환", () => {
  it("KST 벽시계 → UTC 가 정확히 역산된다", () => {
    const dt: CivilDateTime = { year: 2026, month: 9, day: 28, hour: 9, minute: 30, second: 0 };
    const ms = utcMsFromKoreaCivilTime(dt);
    expect(koreaCivilTime(ms)).toEqual(dt);
    expect(ms).toBe(Date.UTC(2026, 8, 28, 0, 30));
  });

  it("서머타임 기간에도 정확히 역산된다", () => {
    const dt: CivilDateTime = { year: 1988, month: 6, day: 15, hour: 13, minute: 0, second: 0 };
    const ms = utcMsFromKoreaCivilTime(dt);
    expect(koreaCivilTime(ms)).toEqual(dt);
    expect(ms).toBe(Date.UTC(1988, 5, 15, 3));
  });

  it("서머타임 시작 당일 00:00~00:59 은 실제로 존재하지 않는 시각이다", () => {
    // 1988-05-08 에 시계가 00:00 → 01:00 로 뛰어 넘었다. 이 구간의 벽시계 시각은
    // UTC 로 환산해도 되돌아오면 23:59 이전이 되므로 왕복이 성립하지 않는다.
    // 이 한 시간만 예외이며, 결정론을 위해 항상 **전환 이전 순간**으로 고정한다.
    const gap: CivilDateTime = { year: 1988, month: 5, day: 8, hour: 0, minute: 0, second: 0 };
    const ms = utcMsFromKoreaCivilTime(gap);
    expect(koreaOffsetMinutes(ms)).toBe(KST_OFFSET_MINUTES); // +9 로 해석된다
    expect(koreaCivilTime(ms).hour).toBe(23);
    expect(koreaCivilTime(ms).day).toBe(7);
    // 01:00 부터는 정상적으로 왕복된다.
    const after: CivilDateTime = { year: 1988, month: 5, day: 8, hour: 1, minute: 0, second: 0 };
    expect(koreaCivilTime(utcMsFromKoreaCivilTime(after))).toEqual(after);
  });

  it("전후 2시간 동안 왕복이 일관된다", () => {
    for (let h = 0; h < 24; h += 1) {
      const dt: CivilDateTime = { year: 1988, month: 7, day: 20, hour: h, minute: 30, second: 15 };
      expect(koreaCivilTime(utcMsFromKoreaCivilTime(dt)), `${h}시`).toEqual(dt);
    }
  });

  it("윤년 2월 29일도 왕복된다", () => {
    const dt: CivilDateTime = { year: 2024, month: 2, day: 29, hour: 23, minute: 59, second: 59 };
    expect(koreaCivilTime(utcMsFromKoreaCivilTime(dt))).toEqual(dt);
  });

  it("kstInstant 은 동일한 변환을 쓴다", () => {
    const dt: CivilDateTime = { year: 2026, month: 2, day: 4, hour: 5, minute: 3, second: 0 };
    expect(kstInstant(dt)).toBe(utcMsFromKoreaCivilTime(dt));
  });
});

describe("역시력 / 분 단위", () => {
  it("1분 차이를 정확히 구분한다", () => {
    const base = Date.UTC(2026, 8, 28, 0, 0);
    expect(koreaCivilTime(base).minute).toBe(0);
    expect(koreaCivilTime(base + MS_PER_MINUTE).minute).toBe(1);
    expect(formatIsoDate(koreaCivilDate(base))).toBe("2026-09-28");
  });

  it("koreaOffsetMinutes 는 순수 함수다 (같은 입력 → 같은 출력)", () => {
    const ms = Date.UTC(1988, 6, 1, 3);
    const first = koreaOffsetMinutes(ms);
    for (let i = 0; i < 3; i += 1) {
      expect(koreaOffsetMinutes(ms)).toBe(first);
    }
  });

  it("오프셋은 항상 9 또는 10 시간이다", () => {
    for (let y = 1900; y <= 2100; y += 1) {
      for (const m of [0, 3, 6, 9]) {
        const off = koreaOffsetMinutes(Date.UTC(y, m, 15, 12));
        expect(off === KST_OFFSET_MINUTES || off === KST_DST_OFFSET_MINUTES, `${y}-${m + 1}`).toBe(true);
      }
    }
  });

  it("1900~2100 에서 서머타임은 4년뿐이다", () => {
    const years = new Set<number>();
    for (let y = 1900; y <= 2100; y += 1) {
      for (const m of [0, 3, 6, 9]) {
        if (isKstDaylightSaving(Date.UTC(y, m, 15, 6))) years.add(y);
      }
    }
    expect([...years].sort((a, b) => a - b)).toEqual([1948, 1951, 1987, 1988]);
  });
});

describe("웹 / 이메일 동일성 전제", () => {
  it("같은 now 값으로 두 경로가 같은 날짜를 얻는다", () => {
    const now = Date.UTC(2026, 8, 28, 15, 30);
    const a = todayInKorea(now);
    const b = koreaCivilDate(utcMsFromKoreaCivilTime({ ...koreaCivilTime(now), hour: 0, minute: 0, second: 0 }));
    expect(a).toEqual(b);
  });

  it("자정을 넘긴 시각에는 다음 날로 넘어간다", () => {
    expect(formatIsoDate(todayInKorea(Date.UTC(2026, 8, 29, 0, 0)))).toBe("2026-09-29");
    expect(formatIsoDate(todayInKorea(Date.UTC(2026, 8, 27, 23, 0)))).toBe("2026-09-28");
  });

  it("KST 기준 하루는 24시간 (서머타임 없음) 이다", () => {
    const midnight = utcMsFromKoreaCivilTime({ year: 2026, month: 9, day: 28, hour: 0, minute: 0, second: 0 });
    const next = utcMsFromKoreaCivilTime({ year: 2026, month: 9, day: 29, hour: 0, minute: 0, second: 0 });
    expect(next - midnight).toBe(24 * MS_PER_HOUR);
  });
});
