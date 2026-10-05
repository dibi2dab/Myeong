/**
 * 운의 단계 — 대운·세운·월운·일운이 공통으로 갖는 형태.
 *
 * 명리학의 운 계층은 언제나 **원국 → 대운 → 세운 → 월운 → 일운** 순서로
 * 좁아진다. 이 모듈은 각 단계가 "무엇인지"와 "어느 계층에 속하는지"만
 * 표현하고, 해석은 `core/interpretation` 이 담당한다.
 */

import type { CivilDate } from "../calendar/civilDate";
import type { FiveElement, HeavenlyStem, EarthlyBranch } from "../constants/stems";
import type { HiddenStem } from "../hidden_stems/hiddenStems";
import type { Pillar } from "../pillars/fourPillars";
import type { TenGod } from "../ten_gods/tenGods";
import type { TwelveStageInfo } from "../twelve_stages/twelveStages";

/** 운 계층. 숫자가 작을수록 넓은 층위다. */
export type PeriodKind = "daeun" | "seun" | "wolun" | "ilun";

export const PERIOD_KIND_LABELS: Readonly<Record<PeriodKind, string>> = Object.freeze({
  daeun: "대운",
  seun: "연운",
  wolun: "월운",
  ilun: "일운",
});

/** 계층 위계 — 항상 이 순서로만 해석한다. */
export const PERIOD_HIERARCHY: readonly PeriodKind[] = ["daeun", "seun", "wolun", "ilun"] as const;

/** 특정 계층보다 좁은(아래) 계층들. */
export function narrowerThan(kind: PeriodKind): readonly PeriodKind[] {
  const i = PERIOD_HIERARCHY.indexOf(kind);
  return PERIOD_HIERARCHY.slice(i + 1);
}

export interface PeriodPillar {
  kind: PeriodKind;
  /** 60간지 인덱스 (甲子 = 0) */
  ganZhiIndex: number;
  ganZhi: string;
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  /** 천간 오행 */
  element: FiveElement;
  /** 지지 본기 오행 */
  branchElement: FiveElement;
  /** 일간 기준 십신 */
  tenGod: TenGod;
  /** 십신 계열 (비겁/식상/재성/관성/인성) */
  tenGodGroup: PeriodTenGodGroup;
  stage: TwelveStageInfo;
  hidden: readonly HiddenStem[];
  /** 이 운이 지장간을 포함한 모든 십신 */
  hiddenTenGods: readonly TenGod[];
  /** 화면 표기용 Pillar 형태 (십이운성은 원국 일간 기준) */
  pillar: Pillar;
}

export type PeriodTenGodGroup = "비겁" | "식상" | "재성" | "관성" | "인성";

/** 이 운이 차지하는 기간을 사람이 읽을 형태로. */
export function periodRangeText(start: CivilDate, endExclusive: CivilDate): string {
  return `${start.year}.${pad2(start.month)}.${pad2(start.day)} ~ ${endExclusive.year}.${pad2(endExclusive.month)}.${pad2(endExclusive.day)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
