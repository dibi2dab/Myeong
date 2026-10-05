/**
 * 프로젝트 전역 입력/공통 타입.
 *
 * 웹 화면과 이메일이 **같은 타입**을 사용해 같은 계산을 호출한다.
 */

import type { CivilDate } from "./calendar/civilDate";
import type { ZiHourMode } from "./constants/timeBranches";
import type { Region } from "../data/regions/regions";

/** 출생 시진 정보. */
export type BirthTime =
  | { kind: "doubleHour"; branchIndex: number; ziMode: ZiHourMode }
  | { kind: "unknown" };

/** 출생 성별 — 대운 순역(順逆) 행사에 사용한다. 미입력이면 간지순역법을 쓴다. */
export type Gender = "남" | "여";

/** 사용자 입력 원본. */
export interface BirthInput {
  calendar: "solar" | "lunar";
  /** 입력한 달력 기준 연·월·일 */
  year: number;
  month: number;
  day: number;
  /**
   * 윤달 여부. 음력 입력일 때는 반드시 `true`/`false` 로 선택되어야 한다.
   * 미선택(`undefined`)이면 "윤달 여부를 선택해주세요." 오류가 난다.
   */
  leapMonth?: boolean;
  time: BirthTime;
  gender?: Gender;
  /** 출생지 — 진태양시 보정을 하지 않으므로 계산에는 쓰지 않으나 표기에만 사용. */
  region: Region;
}

/** 음력 입력을 양력으로 바꾼 결과 (화면에서 반드시 사용자에게 보여준다). */
export interface CalendarConversion {
  inputCalendar: "solar" | "lunar";
  inputText: string;
  solarDate: CivilDate;
  converted: boolean;
  /** 음력 → 양력 변환이 발생했는지 */
  note?: string;
}

/** 계산에 사용된 기준 정보. */
export interface CalculationBasis {
  /** 사주 계산에 실제로 쓰인 양력 날짜 (KST) */
  solarDate: CivilDate;
  /** 대표 순간 (KST 벽시계). 절기 경계 비교에 쓴다. */
  representativeKoreaTime: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  };
  /** 대표 순간의 UTC 밀리초 */
  representativeEpochMs: number;
  /** 입춘 기준 절기 연도 (년주의 해) */
  solarYear: number;
  /** 월주를 결정한 경계 절기 이름 */
  monthBoundaryTerm: string;
  /** 월주를 결정한 사월의 지지 인덱스 (0 = 子) */
  monthBranchIndex: number;
  /** 일주 계산에 사용한 날짜 (조자시 규칙 적용 가능) */
  dayPillarDate: CivilDate;
  /** 시주 미상 여부 */
  hourUnknown: boolean;
  /** 적용된 자시 규칙 */
  ziMode: ZiHourMode | null;
  /** 적용된 대운 순역 규칙 */
  directionRule: "성별순역" | "간지순역";
}
