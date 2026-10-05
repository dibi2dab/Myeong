/**
 * 테스트 공통 데이터.
 *
 * 개인정보 보호 규칙: 여기 있는 값은 **모두 가상으로 지어낸 값**이다.
 * 실제 사람·실제 출생지·실제 이메일 주소를 넣지 않는다.
 * (`서울특별시`/`부산광역시` 같은 행정구역 이름은 공개 데이터이며,
 *  특정 시·군·구까지 임의로 조합해 개인을 특정할 수 없게 했다.)
 */

import type { BirthInput } from "../../core/types";

/** 출생지 표기에만 쓰이는 가상 표본. 계산에는 영향을 주지 않는다. */
export const SAMPLE_REGION = { sido: "서울특별시", sigungu: "서대문구" } as const;

/** 시진 0 = 자시. 23:00–01:00. */
export function birth(over: Partial<BirthInput> = {}): BirthInput {
  return {
    calendar: "solar",
    year: 1990,
    month: 5,
    day: 20,
    leapMonth: false,
    time: { kind: "doubleHour", branchIndex: 6, ziMode: "자정" },
    gender: "여",
    region: { ...SAMPLE_REGION },
    ...over,
  };
}

export function lunarBirth(over: Partial<BirthInput> = {}): BirthInput {
  return birth({ calendar: "lunar", ...over });
}

/** 대표 기준일. 모든 "같은 날짜면 같은 결과" 확인에 쓴다. */
export const REFERENCE_DATE = { year: 2026, month: 9, day: 27 } as const;

/** 절기 경계 확인용 날짜. (입춘 = 년주 경계) */
export const LICHUN_DATES = [
  { year: 2024, month: 2, day: 4 },
  { year: 2025, month: 2, day: 3 },
  { year: 2026, month: 2, day: 4 },
  { year: 2027, month: 2, day: 4 },
] as const;

/** 설날(음력 1월 1일) 날짜. 이 날짜는 **명리학의 해가 바뀌는 날이 아니다.** */
export const LUNAR_NEW_YEARS = [
  { year: 2024, month: 2, day: 10 },
  { year: 2025, month: 1, day: 29 },
  { year: 2026, month: 2, day: 17 },
  { year: 2027, month: 2, day: 6 },
] as const;
