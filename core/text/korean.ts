/**
 * 한국어 문장 조립 도움.
 *
 * 한자 이름(오행·천간·지지) 뒤에 조사(을·를, 이·가, 은·는)를 붙일 때 쓴다.
 * 받침이 있으면 이·은·을, 없으면 가·는·를.
 *
 * **명리학 계산은 없다.** 이미 정해진 값을 문장으로 엮는 것만 한다.
 * (파생 값을 만들어 내는 일은 `core` 의 다른 모듈이 이미 끝냈다)
 *
 * ── 이 프로젝트에서 실제로 쓰이는 이름 ───────────────────────────
 * **마지막 글자 하나만** 본다. (첫 음절에 받침이 있어도 상관없다)
 *   오행 다섯 글자    목(ㄱ) 화(없음) 토(없음) 금(ㅁ) 수(없음) — 섞여 있다.
 *                     (金 은 금이라 이·은, 水 는 수라 가·는 가 된다)
 *   십신 열 자       비견 겁재 식신 상관 편재 정재 편관 정관 편인 정인 → 전부 이·은
 *   십이지 열두 자    장생 … 절장 → 전부 이·은
 *   천간 열 자       甲 ~ 癸 → 한자음이라 전부 이·은
 *   지지 열두 자      子 ~ 亥 → 한자음이라 전부 이·은
 *
 * 그래도 **매번 하드코딩하지 않고** 이 함수로 고른다. (읽는 사람이 고르지 않도록)
 * 한자를 받으면 받침 있음으로 본다. — 위 표와 어긋나지 않는 쪽이다.
 */

const HANGUL_START = 0xac00;
const HANGUL_LAST = 0xd7a3;
const HANGUL_COUNT = 28; // 자음 19 + 모음 21 → 조합 수

/** 마지막 글자에 받침(종성)이 있는가. 한글이 아니면 받침 있는 것으로 본다. */
export function hasBatchim(word: string): boolean {
  const last = word.charCodeAt(word.length - 1);
  if (Number.isNaN(last)) return false;
  if (last < HANGUL_START || last > HANGUL_LAST) return true;
  return (last - HANGUL_START) % HANGUL_COUNT !== 0;
}

/** 주격 조사. 예: `subject("목") === "이"`, `subject("화") === "가"` */
export function subject(word: string): string {
  return hasBatchim(word) ? "이" : "가";
}

/** 목적격 조사. 예: `object("목") === "을"`, `object("화") === "를"` */
export function object(word: string): string {
  return hasBatchim(word) ? "을" : "를";
}

/** 화제 조사. 예: `topic("목") === "은"`, `topic("화") === "는"` */
export function topic(word: string): string {
  return hasBatchim(word) ? "은" : "는";
}

/** 조사 종류. */
export type ParticleKind = "subject" | "object" | "topic";

/** `"목이"` 처럼 이름에 조사를 붙인다. 어떤 조사인지 고를 필요가 없다. */
export function withParticle(word: string, kind: ParticleKind = "subject"): string {
  const particle = kind === "object" ? object(word) : kind === "topic" ? topic(word) : subject(word);
  return `${word}${particle}`;
}