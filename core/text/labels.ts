/**
 * 한자 표기 — **한자를 홀로 보여주지 않는다.**
 *
 * 사주를 모르는 사람에게 `庚` 은 뜻 모를 글자다. 그래서 글자가 나오는 자리마다
 * 한국어 음독과 오행을 함께 붙인다. 예: `경금(庚金)` · `자수(子水)` · `경자(庚子)`
 *
 * 왜 괄호에 한자를 두는지는 `辛`/`申` 을 보면 알 수 있다. 둘 다 한국어로 "신"이라
 * 소리만으로는 구분되지 않는다. 괄호의 한자가 그 구분을 담당한다. 그래서
 * 한자를 지우면 안 되고, 한글을 앞에 두어야 한다.
 *
 * **이 모듈은 계산하지 않는다.** 표기만 만든다. (`core/text/korean.ts` 와 같은 성격)
 * 웹 화면과 이메일이 같은 표기를 쓰도록 core 에 둔다.
 */

import { BRANCHES, ELEMENT_LABELS, STEMS } from "../constants/stems";
import type { BranchInfo, FiveElement, StemInfo } from "../constants/stems";
import { TEN_GOD_BY_KEY, type TenGod } from "../ten_gods/tenGods";
import { TWELVE_STAGE_BY_NAME, type TwelveStageName } from "../twelve_stages/twelveStages";

/**
 * 한자 표기를 앞/뒤 두 조각으로 나눈 것.
 *
 * 웹은 두 조각을 따로 스타일링하고(한자는 흐리게), 이메일은 이어 붙인 문자열로 쓴다.
 * 어느 쪽이든 **원문은 같다** — 어긋나면 같은 기둥이 화면마다 다르게 보인다.
 */
export interface LabelParts {
  /** 앞에 오는 한국어 설명. 예: `경금` */
  readonly main: string;
  /** 뒤에 붙는 한자 표기. 괄호 포함. 예: `(庚金)` */
  readonly hanja: string;
}

/** 두 조각을 화면·이메일 공통 문자열로. 예: `경금(庚金)` */
export function joinParts(parts: LabelParts): string {
  return `${parts.main}${parts.hanja}`;
}

const STEM_BY_CHAR: ReadonlyMap<string, StemInfo> = new Map(STEMS.map((s) => [s.char, s]));
const BRANCH_BY_CHAR: ReadonlyMap<string, BranchInfo> = new Map(BRANCHES.map((b) => [b.char, b]));

function stemOf(char: string): StemInfo {
  const s = STEM_BY_CHAR.get(char);
  if (!s) throw new Error(`알 수 없는 천간입니다: ${char}`);
  return s;
}

function branchOf(char: string): BranchInfo {
  const b = BRANCH_BY_CHAR.get(char);
  if (!b) throw new Error(`알 수 없는 지지는 아닙니다: ${char}`);
  return b;
}

/** 오행의 한국어 이름. 예: `금` */
export function elementKorean(element: FiveElement): string {
  return ELEMENT_LABELS[element].korean;
}

/**
 * 글자 이름만. 오행을 덧붙이지 않는다. 예: `인(寅)`
 *
 * `인목(寅木)월` 처럼 오행까지 넣으면 읽기 어색해진다. 시진·월령 이름처럼
 * 뒤에 "월"·"시"가 따로 붙는 자리에서는 오행을 빼고 이름만 붙인다.
 * (오행이 궁금하면 그 글자를 따로 `branchParts` 로 보여 준다)
 */
export function nameParts(char: string): LabelParts {
  if (STEM_BY_CHAR.has(char)) return stemNameParts(char);
  if (BRANCH_BY_CHAR.has(char)) return branchNameParts(char);
  throw new Error(`알 수 없는 글자입니다: ${char}`);
}

function stemNameParts(char: string): LabelParts {
  const s = stemOf(char);
  return { main: s.hanja, hanja: `(${s.char})` };
}

function branchNameParts(char: string): LabelParts {
  const b = branchOf(char);
  return { main: b.korean, hanja: `(${b.char})` };
}

/** 글자 이름만, 문자열. 예: `인(寅)` */
export function nameLabel(char: string): string {
  return joinParts(nameParts(char));
}

/**
 * 오행 하나. 예: `목(木)`
 * 오행은 원래 한 글자라 뒤에 설명을 더할 것이 없다.
 */
export function elementParts(element: FiveElement): LabelParts {
  return { main: ELEMENT_LABELS[element].korean, hanja: `(${element})` };
}

/** 오행 하나, 문자열. 예: `목(木)` */
export function elementLabel(element: FiveElement): string {
  return joinParts(elementParts(element));
}

/**
 * 천간 하나. 예: `경금(庚金)`
 *
 * 천간의 `korean` 은 이미 "음독 + 오행"(경 + 금)이라 그대로 쓴다.
 */
export function stemParts(char: string): LabelParts {
  const s = stemOf(char);
  return { main: s.korean, hanja: `(${s.char}${s.element})` };
}

/** 천간 하나, 문자열. 예: `경금(庚金)` */
export function stemLabel(char: string): string {
  return joinParts(stemParts(char));
}

/**
 * 지지 하나. 예: `자수(子水)`
 *
 * 지지의 `korean` 은 자모 이름(이)까지만이라("자", "축", "신") 오행을 덧붙인다.
 * 지장간의 본기를 쓴다는 점은 계산 쪽이 이미 정해 놓았다.
 */
export function branchParts(char: string): LabelParts {
  const b = branchOf(char);
  return { main: b.korean + ELEMENT_LABELS[b.element].korean, hanja: `(${b.char}${b.element})` };
}

/** 지지 하나, 문자열. 예: `자수(子水)` */
export function branchLabel(char: string): string {
  return joinParts(branchParts(char));
}

/**
 * 간지 두 글자. 예: `경자(庚子)`
 *
 * 두 글자를 이을 때는 오행을 넣지 않는다. `경금자수(庚子)` 는 읽는 법을
 * 알려주지 못할 뿐 길이만 늘어난다. 오행이 필요하면 두 글자를 따로 보여 준다.
 */
export function ganZhiParts(ganZhi: string): LabelParts {
  if (ganZhi.length !== 2) throw new Error(`간지는 두 글자여야 합니다: ${ganZhi}`);
  const stem = stemOf(ganZhi[0]);
  const branch = branchOf(ganZhi[1]);
  return { main: `${stem.hanja}${branch.korean}`, hanja: `(${ganZhi})` };
}

/** 간지 두 글자, 문자열. 예: `경자(庚子)` */
export function ganZhiLabel(ganZhi: string): string {
  return joinParts(ganZhiParts(ganZhi));
}

/**
 * 십신 하나. 예: `편재(偏財)`
 *
 * 십신 이름이 이미 한국어라 `비겁(比劫)` 처럼 오행을 덧붙일 필요는 없다.
 * (편재 · 정재 가 모두 금(財)이고, 편관 · 정관 이 모두 화(官)다)
 */
export function tenGodParts(key: TenGod): LabelParts {
  return { main: TEN_GOD_BY_KEY[key].korean, hanja: `(${TEN_GOD_BY_KEY[key].hanja})` };
}

/** 십신 하나, 문자열. 예: `편재(偏財)` */
export function tenGodLabel(key: TenGod): string {
  return joinParts(tenGodParts(key));
}

/**
 * 십이운성 하나. 예: `장생(長生)`
 *
 * 십이운성은 글자만 알면 뜻이 전혀 오지 않는다. 그래서 한자와 함께 보여 주고,
 * 설명이 필요하면 용어집으로 연결한다. (호출하는 쪽이 `description` 을 덧붙인다)
 */
export function twelveStageParts(name: TwelveStageName): LabelParts {
  const info = TWELVE_STAGE_BY_NAME[name];
  return { main: info.korean, hanja: `(${info.hanja})` };
}

/** 십이운성 하나, 문자열. 예: `장생(長生)` */
export function twelveStageLabel(name: TwelveStageName): string {
  return joinParts(twelveStageParts(name));
}