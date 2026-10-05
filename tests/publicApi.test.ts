/**
 * 공개 API (`core/index.ts`) 계약.
 *
 * 웹과 이메일이 **이 파일만** 가져간다. 따라서 여기서 검사하는 것은
 *  1. 사용자 입력 오류가 사람이 읽을 메시지이고 스택·개인정보를 새어나오지 않는지
 *  2. 음력 → 양력 변환 결과가 사용자에게 그대로 노출되는지
 *  3. 시주 미상 · 출생지 미선택 같은 제한이 계산 결과에 명시되는지
 *  4. 기간 비교가 점수나 좋고 나쁨을 만들지 않는지
 * 다. 계산 자체의 정확성은 각 모듈 테스트가 담당한다.
 */

import { describe, expect, it } from "vitest";

import * as api from "../core";
import {
  LUNAR_SUPPORT_END,
  LUNAR_SUPPORT_RANGE,
  LUNAR_SUPPORT_START,
  MyeongInputError,
  TERMS,
  analyzeBirth,
  analyzeFortune,
  comparePeriods,
  convertCalendar,
  formatCivilDate,
  validateBirthInput,
  type SajuResult,
} from "../core";
import { DISCLAIMER_SHORT, DISCLAIMER_TEXT } from "../data/rules/rules";
import { ganZhiText } from "../core/pillars/sexagenary";
import type { BirthInput } from "../core/types";
import { REFERENCE_DATE, birth, lunarBirth } from "./fixtures/samples";

/** 오류 메시지를 한 번에 확인한다. */
function expectError(input: BirthInput, message: string): void {
  let thrown: unknown;
  try {
    analyzeBirth(input);
  } catch (e) {
    thrown = e;
  }
  expect(thrown, message).toBeInstanceOf(MyeongInputError);
  expect((thrown as Error).message).toBe(message);
  // 스택 트레이스를 사용자에게 보여주지 않는다. (에러 클래스 이름만 예외)
  expect((thrown as Error).name).toBe("MyeongInputError");
}

// ---------------------------------------------------------------------------

describe("입력 오류 메시지", () => {
  it("존재하지 않는 날짜", () => {
    expectError(birth({ year: 2024, month: 2, day: 30 }), "잘못된 날짜입니다.");
    expectError(birth({ year: 2023, month: 2, day: 29 }), "잘못된 날짜입니다.");
    expectError(birth({ year: 2024, month: 13, day: 1 }), "잘못된 날짜입니다.");
    expectError(birth({ year: 2024, month: 0, day: 1 }), "잘못된 날짜입니다.");
    expectError(birth({ year: 2024, month: 1, day: 0 }), "잘못된 날짜입니다.");
    expectError(birth({ year: 2024.5, month: 1, day: 1 }), "잘못된 날짜입니다.");
  });

  it("윤달 여부 미선택", () => {
    const input = lunarBirth({ year: 1990, month: 4, day: 15 });
    delete input.leapMonth;
    expectError(input, "윤달 여부를 선택해주세요.");
  });

  it("윤달이 없는 달을 윤달로 요청", () => {
    // 1991년은 윤달이 없는 해다. (1990년은 5월이 윤달인 해)
    expectError(lunarBirth({ year: 1991, month: 4, day: 15, leapMonth: true }), "1991년은 윤달이 없는 해입니다.");
    // 2023년은 윤2월이 있는 해다. 4월을 윤달로 요청하면 어떤 달이 윤달인지 알려준다.
    expectError(lunarBirth({ year: 2023, month: 4, day: 15, leapMonth: true }), "2023년은 2월이 윤달인 해입니다.");
    // 1990년은 윤5월이 있는 해다.
    expectError(lunarBirth({ year: 1990, month: 4, day: 15, leapMonth: true }), "1990년은 5월이 윤달인 해입니다.");
  });

  it("그 달에 없는 날짜 (음력)", () => {
    // 음력 월의 길이는 29일 또는 30일이다.
    let found = false;
    for (let y = 1990; y <= 2100 && !found; y += 1) {
      for (let m = 1; m <= 12 && !found; m += 1) {
        const input = lunarBirth({ year: y, month: m, day: 30, leapMonth: false });
        try {
          analyzeBirth(input);
        } catch (e) {
          if ((e as Error).message.includes("일까지입니다")) {
            expect((e as Error).message).toBe(`음력 ${y}년 ${m}월은 29일까지입니다.`);
            found = true;
          }
        }
      }
    }
    expect(found, "29일짜리 음력 월을 하나 이상 찾지 못했다").toBe(true);
  });

  it("출생지 미선택 · 목록에 없는 지역", () => {
    const noRegion = { ...birth() } as BirthInput;
    delete (noRegion as { region?: unknown }).region;
    expectError(noRegion, "출생지를 선택해주세요.");

    expectError(birth({ region: { sido: "" } }), "출생지를 선택해주세요.");
    expectError(birth({ region: { sido: "서울" } }), "출생지를 선택해주세요.");
    // 시/군/구 이름은 시·도가 아니다. 자유 텍스트로 받지 않는다.
    expectError(birth({ region: { sido: "종로구" } }), "출생지를 선택해주세요.");
    // 국가를 받는 자유 텍스트는 받지 않는다.
    expectError(birth({ region: { sido: "대한민국" } }), "출생지를 선택해주세요.");
  });

  it("성별 · 시진 · 자시 기준 미선택", () => {
    expectError(birth({ gender: "male" as unknown as "남" }), "성별을 선택해주세요.");
    expectError(
      birth({ time: { kind: "doubleHour", branchIndex: 13, ziMode: "자정" } }),
      "시진을 선택해주세요.",
    );
    expectError(
      birth({ time: { kind: "doubleHour", branchIndex: 0, ziMode: "" as unknown as "자정" } }),
      "자시 기준을 선택해주세요.",
    );
    expectError(birth({ time: { kind: "hour" } as unknown as BirthInput["time"] }), "출생시간을 선택해주세요.");
  });

  it("계산 가능 범위를 벗어난 날짜", () => {
    expectError(
      birth({ year: LUNAR_SUPPORT_START.year - 1, month: 12, day: 31 }),
      `계산 가능한 범위는 ${formatCivilDate(LUNAR_SUPPORT_START)} ~ ${formatCivilDate(LUNAR_SUPPORT_END)} 입니다.`,
    );
    expectError(
      birth({ year: LUNAR_SUPPORT_END.year + 1, month: 1, day: 1 }),
      `계산 가능한 범위는 ${formatCivilDate(LUNAR_SUPPORT_START)} ~ ${formatCivilDate(LUNAR_SUPPORT_END)} 입니다.`,
    );
  });

  it("오류 메시지에 스택·경로·내부 상태가 섞이지 않는다", () => {
    const messages: string[] = [];
    const inputs: BirthInput[] = [
      birth({ year: 2024, month: 2, day: 30 }),
      birth({ region: { sido: "서울" } }),
      birth({ year: 1800, month: 1, day: 1 }),
      lunarBirth({ year: 1990, month: 4, day: 15, leapMonth: true }),
    ];
    for (const input of inputs) {
      try {
        analyzeBirth(input);
      } catch (e) {
        messages.push((e as Error).message);
      }
    }
    for (const m of messages) {
      expect(m).not.toMatch(/at\s+\w+\s*\(/); // 스택 프레임
      expect(m).not.toMatch(/[A-Za-z]:\\|\/home\/|\/Users\//); // 파일 경로
      expect(m).not.toMatch(/\.ts:\d+/); // 소스 위치
      expect(m).not.toContain("undefined");
      expect(m).not.toContain("null");
      expect(m).toMatch(/[.]$/);
    }
  });

  it("성별은 선택 사항이다 (없어도 계산된다)", () => {
    const input = birth();
    delete input.gender;
    expect(() => validateBirthInput(input)).not.toThrow();
    const r = analyzeBirth(input);
    // 성별이 없으면 간지순역법을 쓴다고 결과에 남는다.
    expect(r.daeun.directionRule).toBe("간지순역");
  });
});

describe("음력 → 양력 변환", () => {
  it("변환 결과가 사용자에게 그대로 노출된다", () => {
    const c = convertCalendar(lunarBirth({ year: 1990, month: 4, day: 15, leapMonth: false }));
    expect(c.inputCalendar).toBe("lunar");
    expect(c.converted).toBe(true);
    expect(c.solarDate).toEqual({ year: 1990, month: 5, day: 9 });
    expect(c.note).toContain("양력");
    expect(c.summary).toContain("음력 1990년 4월 15일");
    expect(c.summary).toContain("양력 1990-05-09");
  });

  it("양력 입력도 음력 날짜를 함께 보여준다 (역변환)", () => {
    const c = convertCalendar(birth({ year: 1990, month: 5, day: 20 }));
    expect(c.inputCalendar).toBe("solar");
    expect(c.converted).toBe(false);
    expect(c.solarDate).toEqual({ year: 1990, month: 5, day: 20 });
    expect(c.lunar).toEqual({ year: 1990, month: 4, day: 26, isLeapMonth: false });
  });

  it("설날 기준이 맞는다 (음력 1월 1일 = 설날)", () => {
    // 국가공휴일 데이터로 확인할 수 있는 기준일들
    for (const [lunarYear, solar] of [
      [2024, { year: 2024, month: 2, day: 10 }],
      [2025, { year: 2025, month: 1, day: 29 }],
      [2026, { year: 2026, month: 2, day: 17 }],
    ] as const) {
      expect(
        convertCalendar(lunarBirth({ year: lunarYear, month: 1, day: 1, leapMonth: false })).solarDate,
        `${lunarYear} 설날`,
      ).toEqual(solar);
    }
  });

  it("윤달 입력은 윤달 표시가 유지된다", () => {
    const leap = api.leapMonthOfLunarYear(2023);
    expect(leap).toBe(2);
    const c = convertCalendar(lunarBirth({ year: 2023, month: 2, day: 1, leapMonth: true }));
    expect(c.summary).toContain("윤달");
    expect(c.lunar.isLeapMonth).toBe(true);
    // 윤2월 1일은 3월 22일이다.
    expect(c.solarDate).toEqual({ year: 2023, month: 3, day: 22 });
  });

  it("변환된 양력이 사주 계산에 실제로 쓰인다", () => {
    const fromLunar = analyzeBirth(lunarBirth({ year: 1990, month: 4, day: 15, leapMonth: false }));
    expect(fromLunar.natal.basis.solarDate).toEqual({ year: 1990, month: 5, day: 9 });
    const fromSolar = analyzeBirth(birth({ year: 1990, month: 5, day: 9 }));
    expect(ganZhiText(fromSolar.natal.chart.day.stem, fromSolar.natal.chart.day.branch)).toBe(
      ganZhiText(fromLunar.natal.chart.day.stem, fromLunar.natal.chart.day.branch),
    );
  });

  it("지원 범위 양 끝에서 동작한다", () => {
    for (const d of [LUNAR_SUPPORT_START, LUNAR_SUPPORT_END]) {
      expect(() => analyzeBirth(birth({ ...d }))).not.toThrow();
    }
  });
});

describe("시주 미상", () => {
  const noHour = birth({ time: { kind: "unknown" } });

  it("오류가 나지 않고 계산된다", () => {
    const r = analyzeBirth(noHour);
    expect(r.natal.chart.hour).toBeNull();
    expect(r.natal.chart.basis.hourUnknown).toBe(true);
  });

  it("시주 라벨이 네 개가 아니라 세 개다", () => {
    const r = analyzeBirth(noHour);
    expect(r.natal.pillars.map((p) => p.position)).toEqual(["year", "month", "day"]);
    expect(r.natal.interactions.flatMap((i) => i.participants)).not.toContain("시주");
  });

  it("시진 신호가 하나도 나오지 않는다", () => {
    const withHour = analyzeBirth(birth());
    const a = analyzeFortune(withHour, REFERENCE_DATE);
    const b = analyzeFortune(analyzeBirth(noHour), REFERENCE_DATE);
    expect(b.context.hourUnknown).toBe(true);
    expect(b.reading.restrictions.join("")).toContain("시주");
    expect(a.reading.restrictions).toEqual([]);
    // 시주가 없을 때는 시주 고유 근거가 사라진다.
    expect(b.context.interactions.flatMap((i) => i.participants)).not.toContain("시주");
    expect(a.context.interactions.flatMap((i) => i.participants)).toContain("시주");
  });

  it("출생시간 모름 이라는 문구가 화면에 쓰일 수 있다", () => {
    expect(api.TIME_BRANCHES).toHaveLength(12);
    expect(TERMS.find((t) => t.term === "출생시간 모름")).toBeDefined();
  });
});

describe("출생지", () => {
  it("계산에는 쓰지 않고 표기에만 남는다", () => {
    const a = analyzeBirth(birth({ region: { sido: "서울특별시" } }));
    const b = analyzeBirth(birth({ region: { sido: "부산광역시" } }));
    // 출생지가 달라도 사주 계산 결과는 같다 (진태양시 보정을 하지 않는다).
    expect(ganZhiText(a.natal.chart.day.stem, a.natal.chart.day.branch)).toBe(
      ganZhiText(b.natal.chart.day.stem, b.natal.chart.day.branch),
    );
    expect(a.natal.distribution).toEqual(b.natal.distribution);
    expect(a.input.region.sido).toBe("서울특별시");
  });
});

describe("기간 비교", () => {
  const result: SajuResult = analyzeBirth(birth());

  it("구조 차이만 나열하고 좋고 나쁨을 말하지 않는다", () => {
    const c = comparePeriods(result, REFERENCE_DATE, { year: 2026, month: 6, day: 15 });
    for (const r of c.rows) {
      for (const v of [r.a, r.b]) {
        expect(v).not.toMatch(/\d+\s*점/);
        expect(v).not.toMatch(/좋|나쁘|최고|최악|행운|불운/);
      }
    }
    expect(c.note).toContain("좋은 쪽과 나쁜 쪽을 정하지 않는다");
  });

  it("비교 항목에 대운·세운·월운·일운·십신·절기와 8개 항목이 들어 있다", () => {
    const c = comparePeriods(result, REFERENCE_DATE, { year: 2026, month: 6, day: 15 });
    const labels = c.rows.map((r) => r.label);
    for (const required of ["대운", "세운", "월운", "일운", "세운 십신", "월운 절기", "총운 기세", "건강운 방향"]) {
      expect(labels, required).toContain(required);
    }
    expect(labels.filter((l) => l.endsWith(" 기세"))).toHaveLength(8);
    expect(labels.filter((l) => l.endsWith(" 방향"))).toHaveLength(8);
  });

  it("같은 날짜끼리 비교하면 전부 같음으로 표시된다", () => {
    const c = comparePeriods(result, REFERENCE_DATE, REFERENCE_DATE);
    expect(c.rows.every((r) => r.same)).toBe(true);
    expect(c.onlyA).toEqual([]);
    expect(c.onlyB).toEqual([]);
    expect(c.sharedInteractions.length).toBeGreaterThan(0);
  });

  it("다른 달끼리 비교하면 실제로 달라지는 항목이 있다", () => {
    const c = comparePeriods(result, REFERENCE_DATE, { year: 2026, month: 1, day: 5 });
    expect(c.rows.some((r) => !r.same)).toBe(true);
    expect(c.aDate).toEqual(REFERENCE_DATE);
    expect(c.bDate).toEqual({ year: 2026, month: 1, day: 5 });
  });

  it("간(干支)은 공통 / 각자 한쪽에만 있는 것 으로 나눠 담는다", () => {
    const c = comparePeriods(result, REFERENCE_DATE, { year: 2026, month: 1, day: 5 });
    const aAll = analyzeFortune(result, REFERENCE_DATE).context.interactions;
    const bAll = analyzeFortune(result, { year: 2026, month: 1, day: 5 }).context.interactions;
    expect(c.sharedInteractions.length + c.onlyA.length).toBe(aAll.length);
    expect(c.sharedInteractions.length + c.onlyB.length).toBe(bAll.length);
    const keyOf = (i: api.Interaction) => `${i.type}:${i.description}:${i.participants.join("+")}`;
    for (const i of c.onlyA) expect(c.onlyB.map(keyOf)).not.toContain(keyOf(i));
    for (const i of c.onlyB) expect(c.onlyA.map(keyOf)).not.toContain(keyOf(i));
  });

  it("같은 구조라도 붙은 자리가 다르면 다른 간으로 센다", () => {
    // 巳酉 반합이 두 자리 쌍에서 각각 성립하면 서로 다른 2건이다.
    // 유형+설명만 키로 쓰면 두 건이 하나로 뭉개진다.
    const c = comparePeriods(result, REFERENCE_DATE, { year: 2026, month: 6, day: 15 });
    const aAll = analyzeFortune(result, REFERENCE_DATE).context.interactions;
    const keyOf = (i: api.Interaction) => `${i.type}:${i.description}:${i.participants.join("+")}`;
    expect(new Set(aAll.map(keyOf)).size).toBe(aAll.length);
    expect(c.sharedInteractions.length + c.onlyA.length).toBe(aAll.length);
  });
});

describe("공개 API 표면", () => {
  it("고지 문구가 함께 제공된다", () => {
    expect(DISCLAIMER_TEXT.length).toBeGreaterThan(20);
    expect(DISCLAIMER_SHORT.length).toBeGreaterThan(10);
    expect(api.DISCLAIMER_TEXT).toBe(DISCLAIMER_TEXT);
  });

  it("화면이 필요한 표를 모두 노출한다", () => {
    expect(api.FORTUNE_TOPICS).toHaveLength(8);
    expect(api.FIVE_ELEMENTS).toEqual(["木", "火", "土", "金", "水"]);
    expect(Object.keys(api.ELEMENT_KOREAN)).toEqual(["木", "火", "土", "金", "水"]);
    expect(Object.keys(api.ELEMENT_COLOR)).toEqual(["木", "火", "土", "金", "水"]);
    expect(api.TIME_BRANCHES).toHaveLength(12);
    expect(api.TEN_GODS).toHaveLength(10);
    expect(api.TWELVE_STAGES).toHaveLength(12);
    expect(api.DRILLDOWN_CHAIN).toEqual(["일운", "월운", "세운", "대운", "원국"]);
    expect(Object.keys(api.INTENSITY_LABELS)).toHaveLength(5);
    expect(api.SIDO_LIST).toHaveLength(17);
  });

  it("오늘의 날짜는 한국 시간으로만 구한다", () => {
    const today = api.todayInKorea();
    expect(Object.keys(today).sort()).toEqual(["day", "month", "year"]);
    expect(api.isValidSolarDate(today.year, today.month, today.day)).toBe(true);
    // KST 자정 = UTC 15:00 (UTC+9). 그 1초 전후로 날짜가 넘어간다.
    expect(api.todayInKorea(Date.UTC(2026, 8, 26, 14, 59, 59))).toEqual({
      year: 2026,
      month: 9,
      day: 26,
    });
    expect(api.todayInKorea(Date.UTC(2026, 8, 26, 15, 0, 0))).toEqual({
      year: 2026,
      month: 9,
      day: 27,
    });
    // UTC 자정은 한국 시간으로 오전 9시라 아직 같은 날이다.
    expect(api.todayInKorea(Date.UTC(2026, 8, 27, 0, 30, 0))).toEqual({
      year: 2026,
      month: 9,
      day: 27,
    });
  });

  it("ISO 날짜 파싱이 왕복한다", () => {
    for (const d of [REFERENCE_DATE, { year: 1900, month: 12, day: 31 }, { year: 2100, month: 1, day: 1 }]) {
      expect(api.parseIsoDate(formatCivilDate(d))).toEqual(d);
    }
    expect(api.parseIsoDate("")).toBeNull();
    expect(api.parseIsoDate("2026-13-01")).toBeNull();
    expect(api.parseIsoDate("26-01-01")).toBeNull();
  });

  it("지원 범위가 문서와 일치한다", () => {
    expect(LUNAR_SUPPORT_RANGE).toEqual({ fromYear: 1900, toYear: 2100 });
    expect(formatCivilDate(LUNAR_SUPPORT_START)).toBe("1900-01-31");
    expect(formatCivilDate(LUNAR_SUPPORT_END)).toBe("2100-12-31");
  });
});
