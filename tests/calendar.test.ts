import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  addYears,
  compareCivilDate,
  daysInSolarMonth,
  differenceInDays,
  formatIsoDate,
  formatKoreanDate,
  isLeapSolarYear,
  isSameCivilDate,
  isValidSolarDate,
  parseIsoDate,
  weekdayLabel,
  type CivilDate,
} from "../core/calendar/civilDate";
import {
  civilDateFromJulianDayNumber,
  julianDayNumber,
  julianDayNumberFromEpochMs,
  julianDayNumberOf,
} from "../core/calendar/julianDay";

describe("윤년 판정", () => {
  it("4의 배수이면서 100의 배수가 아니면 윤년", () => {
    for (const y of [1904, 1996, 2000, 2004, 2020, 2024, 2396]) {
      expect(isLeapSolarYear(y), String(y)).toBe(true);
    }
  });

  it("100의 배수이면서 400의 배수가 아니면 평년", () => {
    for (const y of [1900, 2100, 2200, 2300, 1800]) {
      expect(isLeapSolarYear(y), String(y)).toBe(false);
    }
  });

  it("400 의 배수는 윤년", () => {
    for (const y of [1600, 2000, 2400]) expect(isLeapSolarYear(y), String(y)).toBe(true);
  });

  it("정수가 아니면 윤년이 아니다", () => {
    expect(isLeapSolarYear(2020.5)).toBe(false);
    expect(isLeapSolarYear(Number.NaN)).toBe(false);
  });
});

describe("월별 일수", () => {
  it("윤년의 2월은 29일, 평년은 28일", () => {
    expect(daysInSolarMonth(2024, 2)).toBe(29);
    expect(daysInSolarMonth(2023, 2)).toBe(28);
    expect(daysInSolarMonth(1900, 2)).toBe(28);
    expect(daysInSolarMonth(2000, 2)).toBe(29);
  });

  it("나머지 달은 표를 따른다", () => {
    const expected = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let m = 1; m <= 12; m += 1) expect(daysInSolarMonth(2023, m), String(m)).toBe(expected[m - 1]);
  });

  it("잘못된 월은 오류", () => {
    expect(() => daysInSolarMonth(2023, 0)).toThrow();
    expect(() => daysInSolarMonth(2023, 13)).toThrow();
  });
});

describe("날짜 유효성", () => {
  it("월말을 넘는 날짜를 거절한다", () => {
    expect(isValidSolarDate(2023, 2, 28)).toBe(true);
    expect(isValidSolarDate(2023, 2, 29)).toBe(false);
    expect(isValidSolarDate(2024, 2, 29)).toBe(true);
    expect(isValidSolarDate(2023, 4, 31)).toBe(false);
    expect(isValidSolarDate(2023, 13, 1)).toBe(false);
    expect(isValidSolarDate(2023, 0, 1)).toBe(false);
  });

  it("정수가 아닌 값을 거절한다", () => {
    expect(isValidSolarDate(2023, 1.5, 1)).toBe(false);
    expect(isValidSolarDate(2023, 1, 1.5)).toBe(false);
  });
});

describe("날짜 덧셈·뺄셈", () => {
  it("연말을 넘어 더한다 (12월 31일 + 1일)", () => {
    expect(addDays({ year: 2023, month: 12, day: 31 }, 1)).toEqual({ year: 2024, month: 1, day: 1 });
    expect(addDays({ year: 2023, month: 12, day: 31 }, 31)).toEqual({ year: 2024, month: 1, day: 31 });
  });

  it("연초를 넘어 뺀다 (1월 1일 - 1일)", () => {
    expect(addDays({ year: 2024, month: 1, day: 1 }, -1)).toEqual({ year: 2023, month: 12, day: 31 });
  });

  it("윤년 2월 29일을 지나지 않는다", () => {
    expect(addDays({ year: 2024, month: 2, day: 28 }, 1)).toEqual({ year: 2024, month: 2, day: 29 });
    expect(addDays({ year: 2024, month: 2, day: 29 }, 1)).toEqual({ year: 2024, month: 3, day: 1 });
  });

  it("평년 2월 28일 다음 날은 3월 1일", () => {
    expect(addDays({ year: 2023, month: 2, day: 28 }, 1)).toEqual({ year: 2023, month: 3, day: 1 });
  });

  it("differenceInDays 는 정수다", () => {
    const a: CivilDate = { year: 2024, month: 3, day: 1 };
    const b: CivilDate = { year: 2024, month: 2, day: 28 };
    expect(differenceInDays(a, b)).toBe(2);
    expect(differenceInDays(b, a)).toBe(-2);
  });

  it("1900-01-01 부터 2000-01-01 까지 36524일", () => {
    expect(differenceInDays({ year: 2000, month: 1, day: 1 }, { year: 1900, month: 1, day: 1 })).toBe(36524);
  });

  it("대칭성: 어떤 두 날짜든 차이는 부호만 반대다", () => {
    let cursor: CivilDate = { year: 1899, month: 12, day: 25 };
    for (let i = 0; i < 900; i += 1) {
      const next = addDays(cursor, 37);
      expect(differenceInDays(next, cursor) + differenceInDays(cursor, next)).toBe(0);
      cursor = next;
    }
  });
});

describe("월·연 덧셈", () => {
  it("월을 넘겨 넘어간다", () => {
    expect(addMonths({ year: 2023, month: 12, day: 15 }, 1)).toEqual({ year: 2024, month: 1, day: 15 });
    expect(addMonths({ year: 2024, month: 1, day: 15 }, -1)).toEqual({ year: 2023, month: 12, day: 15 });
  });

  it("목표 월에 같은 일자가 없으면 그 달 마지막 날로 맞춘다", () => {
    expect(addMonths({ year: 2023, month: 1, day: 31 }, 1)).toEqual({ year: 2023, month: 2, day: 28 });
    expect(addMonths({ year: 2024, month: 1, day: 31 }, 1)).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it("연도 덧셈", () => {
    expect(addYears({ year: 1990, month: 5, day: 20 }, 30)).toEqual({ year: 2020, month: 5, day: 20 });
    expect(addYears({ year: 2024, month: 2, day: 29 }, 1)).toEqual({ year: 2025, month: 2, day: 28 });
  });
});

describe("비교·표기", () => {
  it("연·월·일 순으로 비교한다", () => {
    expect(compareCivilDate({ year: 2024, month: 1, day: 1 }, { year: 2023, month: 12, day: 31 })).toBeGreaterThan(0);
    expect(compareCivilDate({ year: 2023, month: 5, day: 1 }, { year: 2023, month: 5, day: 2 })).toBeLessThan(0);
    expect(compareCivilDate({ year: 2023, month: 5, day: 1 }, { year: 2023, month: 5, day: 1 })).toBe(0);
  });

  it("ISO 표기 왕복", () => {
    for (const d of [
      { year: 1900, month: 1, day: 31 },
      { year: 1990, month: 5, day: 20 },
      { year: 2024, month: 2, day: 29 },
      { year: 2100, month: 12, day: 31 },
    ]) {
      expect(parseIsoDate(formatIsoDate(d))).toEqual(d);
    }
  });

  it("잘못된 ISO 문자열은 null", () => {
    expect(parseIsoDate("2023-02-30")).toBeNull();
    expect(parseIsoDate("23-1-1")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
  });

  it("한국어 표기와 요일", () => {
    expect(formatKoreanDate({ year: 1990, month: 5, day: 20 })).toBe("1990년 5월 20일");
    expect(weekdayLabel({ year: 2024, month: 1, day: 1 })).toBe("월");
    expect(weekdayLabel({ year: 2026, month: 9, day: 27 })).toBe("일");
  });

  it("isSameCivilDate", () => {
    expect(isSameCivilDate({ year: 2024, month: 2, day: 1 }, { year: 2024, month: 2, day: 1 })).toBe(true);
    expect(isSameCivilDate({ year: 2024, month: 2, day: 1 }, { year: 2024, month: 2, day: 2 })).toBe(false);
  });
});

describe("율리우스 일수", () => {
  it("역서 기준점", () => {
    expect(julianDayNumber(2000, 1, 1)).toBe(2451545);
    expect(julianDayNumber(1949, 10, 1)).toBe(2433191);
    expect(julianDayNumber(2024, 1, 1)).toBe(2460311);
    expect(julianDayNumber(2024, 2, 10)).toBe(2460351);
  });

  it("JDN 은 날짜와 1:1 대응한다", () => {
    for (const d of [
      { year: 1900, month: 1, day: 1 },
      { year: 1999, month: 12, day: 31 },
      { year: 2000, month: 2, day: 29 },
      { year: 2100, month: 12, day: 31 },
    ]) {
      expect(julianDayNumber(d.year, d.month, d.day)).toBe(julianDayNumberOf(d));
    }
  });

  it("JDN → 그레고리력 왕복이 무손실", () => {
    for (let jdn = 2415021; jdn <= 2415021 + 400; jdn += 7) {
      expect(julianDayNumberOf(civilDateFromJulianDayNumber(jdn))).toBe(jdn);
    }
  });

  it("epoch ms → JDN 은 UTC 날짜를 가리킨다 (정오 규약)", () => {
    // 정수 JDN 은 해당 날짜 정오(UTC 12:00)를 가리킨다. 따라서 같은 날짜 안의
    // 어느 시각이든 같은 JDN 이 나온다.
    expect(julianDayNumberFromEpochMs(Date.UTC(2000, 0, 1, 12, 0, 0))).toBe(2451545);
    expect(julianDayNumberFromEpochMs(Date.UTC(2000, 0, 1, 0, 0, 0))).toBe(2451545);
    expect(julianDayNumberFromEpochMs(Date.UTC(1999, 11, 31, 23, 59, 59))).toBe(2451544);
  });

  it("윤년 2월 29일 JDN 은 2월 28일 + 1", () => {
    expect(julianDayNumber(2024, 2, 29) - julianDayNumber(2024, 2, 28)).toBe(1);
    expect(julianDayNumber(2023, 3, 1) - julianDayNumber(2023, 2, 28)).toBe(1);
  });
});
