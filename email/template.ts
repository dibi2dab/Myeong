/**
 * 오늘의 운세를 메일 본문(평문 UTF-8)으로 만든다.
 *
 * 규칙
 * - 계산은 **전혀 하지 않는다.** `core` 가 만든 결과만 글자로 옮긴다.
 * - 웹 화면과 **같은 순서 · 같은 항목** 을 쓴다. (그래서 같은 날짜면 내용이 같다)
 * - 점수 · 확률 · 좋은 쪽/나쁜 쪽 판정을 만들지 않는다.
 * - 화면에 없는 말을 더하지 않는다. (해석은 `reading` 에 있는 문장을 그대로 쓴다)
 *
 * ※ 이 파일은 `web/` 를 가져가지 않는다. (DOM 이 없어야 메일에서 돌아간다)
 */

import {
  DISCLAIMER_TEXT,
  INTENSITY_LABELS,
  formatCivilDate,
  type Caution,
  type CivilDate,
  type Evidence,
  type FortuneResult,
  type FortuneSection,
  type KeyPoint,
  type SajuResult,
} from "../core";

/** 항목 하나에 붙이는 근거 개수. (메일은 길면 읽히지 않는다) */
const EVIDENCE_PER_SECTION = 3;
/** 주의점 최대 개수. (고지류는 `core` 가 이미 제한한다) */
const CAUTION_LIMIT = 6;

/* ------------------------------------------------------------------ 표기 */

/** 열을 맞춰 주는 고정 폭 표기. (전각 한글이 폭 2 가 되도록 계산) */
function pad(value: string, width: number): string {
  let used = 0;
  for (const ch of value) used += isWide(ch) ? 2 : 1;
  return value + " ".repeat(Math.max(0, width - used));
}

/** 동아시아 전각 문자는 두 칸을 차지한다. */
function isWide(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  );
}

/** 구분선. (표시용이므로 내용에는 규칙 ID 가 붙지 않는다) */
const RULE = "─".repeat(46);

function section(title: string): string[] {
  return ["", RULE, title, RULE];
}

/** 항목 하나. */
function line(text: string): string {
  return `  ${text}`;
}

/** `  - 본문` + `      RULE_XXX · 계층` — 반드시 `\r\n` 로 잇는다. */
function bullet(text: string, ruleId: string, detail: string): string {
  const tail = detail === "" ? ruleId : `${ruleId} · ${detail}`;
  return `    - ${text}\r\n      ${tail}`;
}

/* ------------------------------------------------------------------ 본문 조각 */

/** 원국 한 줄. (이메일은 고정 정보이므로 짧게) */
function natalLine(saju: SajuResult): string {
  // 간지를 두 글자로 이어 붙인다. (Pillar 에는 ganZhi 문자열이 없다)
  const pillars = saju.natal.pillars
    .map((p) => `${p.stem}${p.branch}${p.position === "day" ? "(일간)" : ""}`)
    .join(" · ");
  const yongshin = saju.natal.yongshin.yongshin.result;
  const heeshin = saju.natal.yongshin.heeshin.result;
  return [
    `원국  ${pillars}`,
    `일간  ${saju.natal.strength.verdict} · 용신 ${yongshin.group} · 희신 ${heeshin.group}`,
    `해석 기준  ${saju.conversion.summary}`,
  ].join("\n");
}

/** 오늘의 운(運) 한 줄. */
function periodsLine(fortune: FortuneResult): string {
  const { daeun, seun, wolun, ilun } = fortune.context;
  const part = (label: string, ganZhi: string | null, extra = ""): string =>
    ganZhi === null ? `${label} —` : `${label} ${ganZhi}${extra}`;
  return [
    part("대운", daeun?.ganZhi ?? null),
    part("세운", seun.ganZhi, ` ${seun.tenGod}`),
    part("월운", wolun.ganZhi, ` ${wolun.tenGod}`),
    part("일운", ilun.ganZhi, ` ${ilun.tenGod}`),
  ].join(" · ");
}

function evidenceLines(evidence: readonly Evidence[]): string[] {
  return evidence.slice(0, EVIDENCE_PER_SECTION).map((e) => bullet(e.text, e.ruleId, e.layer));
}

function keyPointLines(keyPoints: readonly KeyPoint[]): string[] {
  if (keyPoints.length === 0) return [line("오늘은 특별히 두드러지는 핵심이 없습니다.")];
  return keyPoints.map((k) => bullet(k.text, k.ruleId, k.layer));
}

function cautionLines(cautions: readonly Caution[]): string[] {
  if (cautions.length === 0) return [line("이 날에 특별히 조심할 신호가 없습니다.")];
  return cautions.slice(0, CAUTION_LIMIT).map((c) => bullet(c.text, c.ruleId, c.layer));
}

function sectionBlock(sectionData: FortuneSection): string[] {
  const out = section(sectionData.topic);
  out.push(line(`해석  ${sectionData.interpretation}`));
  out.push(line(`기세  ${INTENSITY_LABELS[sectionData.intensity]} · 방향 ${sectionData.direction}`));
  if (sectionData.evidence.length === 0) {
    out.push(line("분석 근거  특별한 신호가 두드러지지 않습니다."));
    return out;
  }
  out.push("  분석 근거");
  out.push(...evidenceLines(sectionData.evidence));
  return out;
}

/** 오늘의 운세 → 일운 → 원국 으로 내려가는 실제 기둥. */
function drilldownLines(fortune: FortuneResult): string[] {
  const out = section("오늘에서 원국까지 (드릴다운)");
  const total = fortune.drilldown.reduce((sum, s) => sum + s.evidenceCount, 0);
  for (const step of fortune.drilldown) {
    out.push(
      line(
        `${pad(step.layer, 6)}${pad(step.ganZhi, 6)}${pad(step.tenGod, 8)}${pad(step.element, 5)}십이운성 ${step.stage} · 근거 ${step.evidenceCount}개`,
      ),
    );
  }
  out.push(line(`오늘의 운세 전체 근거 ${total}개`));
  return out;
}

/* ------------------------------------------------------------------ 공개 API */

export interface EmailContent {
  subject: string;
  body: string;
}

/** 메일 제목. 날짜만 들어간다. (개인 정보가 제목에 새지 않게) */
export function subjectOf(date: CivilDate): string {
  return `[Myeong] ${date.year}년 ${date.month}월 ${date.day}일 오늘의 운세`;
}

/**
 * 메일 본문.
 *
 * @param saju   출생 정보로 계산한 원국 결과 (변하지 않는 값)
 * @param fortune 그날의 운세 결과 (날짜마다 달라지는 값)
 */
export function renderEmail(saju: SajuResult, fortune: FortuneResult, date: CivilDate): EmailContent {
  const reading = fortune.reading;
  const out: string[] = [];

  out.push(`Myeong 命 · 오늘의 운세 · ${formatCivilDate(date)} (한국 시간 기준)`);
  out.push(RULE);

  out.push(...section("고정 정보 · 내 사주"));
  out.push(natalLine(saju));

  out.push(...section("오늘 걸린 운"));
  out.push(line(periodsLine(fortune)));
  if (!fortune.context.daeunAvailable) {
    out.push(line("아직 대운 기산 전입니다. 대운이 빠진 상태로 계산합니다."));
  }

  out.push(...section("핵심 포인트"));
  out.push(...keyPointLines(reading.keyPoints));

  out.push(...section("항목별 운세"));
  for (const s of reading.sections) out.push(...sectionBlock(s));

  out.push(...section("주의점"));
  out.push(...cautionLines(reading.cautions));

  if (reading.restrictions.length > 0) {
    out.push(...section("해석 제한"));
    for (const r of reading.restrictions) out.push(line(`- ${r}`));
  }

  out.push(...drilldownLines(fortune));

  out.push(...section("고지"));
  out.push(line(DISCLAIMER_TEXT));

  out.push("");
  out.push(RULE);
  out.push("Myeong 은 전통 명리학의 고정된 규칙집으로 계산합니다.");
  out.push("무작위 선택과 외부 AI 호출이 없고, 같은 출생 정보와 같은 날짜면");
  out.push("언제 어디서 계산해도 이 본문과 같은 결과가 나옵니다.");
  out.push("모든 계산은 이 실행의 메모리 안에서만 이루어졌습니다.");

  return { subject: subjectOf(date), body: out.join("\r\n") };
}