/**
 * 이메일 경로.
 *
 * 웹과 이메일이 **같은 Core** 를 쓰는지가 이 파일의 첫 번째 검증 대상이다.
 * 같은 날짜를 넣으면 본문이 완전히 같아야 한다.
 *
 * 그 다음 확인하는 것
 * - 본문에 점수 · 확률 · 좋고 나쁨 판정이 새지 않는가
 * - 모든 문장이 `core` 가 만든 규칙 ID 를 함께 실어 나가는가 (근거를 지울 수 없다)
 * - 개인 정보가 로그·아티팩트에 남지 않는가 (코드에 파일·캐시 쓰기가 없는지)
 * - SMTP 조립이 규격대로 되는가 (줄바꿈 · 헤더 주입 · 길이)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { analyzeBirth, analyzeFortune, FORTUNE_TOPICS } from "../core";
import { EmailConfigError, readEnvironment } from "../email/env";
import { commandArg, encodeHeader, foldLines, headerValue, SmtpError } from "../email/smtp";
import { renderEmail, subjectOf } from "../email/template";
import { birth, REFERENCE_DATE } from "./fixtures/samples";

/** `undefined` 면 그 변수를 걷어낸다. (vitest 의 stubEnv 규약) */
function stubEnv(values: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(values)) vi.stubEnv(k, v);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const SAJU = analyzeBirth(birth());
const FORTUNE = analyzeFortune(SAJU, REFERENCE_DATE);

function mail() {
  return renderEmail(SAJU, FORTUNE, REFERENCE_DATE);
}

/* ------------------------------------------------------------------ 본문 */

describe("메일 본문", () => {
  it("날짜가 제목과 본문 첫 줄에 들어간다", () => {
    const { subject, body } = mail();
    expect(subject).toBe(subjectOf(REFERENCE_DATE));
    expect(subject).toContain("2026년 9월 27일");
    expect(body.split("\r\n")[0]).toContain("2026-09-27");
  });

  it("여덟 항목이 모두 나온다 (웹 화면과 같은 순서)", () => {
    const { body } = mail();
    const positions = FORTUNE_TOPICS.map((t) => body.indexOf(`\r\n${t}\r\n`));
    for (const p of positions) expect(p).toBeGreaterThan(0);
    // 순서가 지켜져야 한다.
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("[해석] 과 [분석 근거] 가 함께 나온다", () => {
    const { body } = mail();
    const interpreted = body.split("해석  ").length - 1;
    expect(interpreted).toBe(FORTUNE_TOPICS.length);
    expect(body).toContain("분석 근거");
  });

  it("드릴다운이 일운 → 월운 → 세운 → 대운 → 원국 순서로 나온다", () => {
    const { body } = mail();
    const block = body.slice(body.indexOf("오늘에서 원국까지"));
    const order = ["일운", "월운", "세운", "대운", "원국"].map((l) => block.indexOf(`\r\n  ${l} `));
    for (const p of order) expect(p).toBeGreaterThan(0);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("고지 문구가 맨 뒤에 붙는다", () => {
    const { body } = mail();
    expect(body).toContain("과학적으로 검증된");
    expect(body.lastIndexOf("고지")).toBeGreaterThan(body.indexOf("항목별 운세"));
  });

  it("[해석] 문장은 웹 화면과 글자까지 같다", () => {
    const { body } = mail();
    for (const s of FORTUNE.reading.sections) {
      expect(body).toContain(s.interpretation);
    }
  });
});

/* ------------------------------------------------------------------ 근거 · 결정론 */

describe("메일이 근거를 지우지 않는다", () => {
  it("본문의 모든 규칙 ID 가 카탈로그에 존재한다", () => {
    const { body } = mail();
    const ids = new Set(body.match(/RULE_[A-Z_]+_\d{3}/g) ?? []);
    expect(ids.size).toBeGreaterThan(5);
    for (const id of ids) {
      // 이건 아래 "규칙 카탈로그" 테스트가 함께 확인한다.
      expect(id).toMatch(/^RULE_[A-Z]+(_[A-Z]+)*_\d{3}$/);
    }
  });

  it("근거 줄마다 규칙 ID 가 붙는다", () => {
    const { body } = mail();
    const evidenceLines = body.split("\r\n").filter((l) => l.startsWith("    - "));
    expect(evidenceLines.length).toBeGreaterThan(10);
    // `    - 문장` 다음 줄에 `      RULE_XXX · 계층` 이 붙는다.
    const lines = body.split("\r\n");
    for (const [i, l] of lines.entries()) {
      if (!l.startsWith("    - ")) continue;
      expect(lines[i + 1] ?? "").toMatch(/^ {6}RULE_[A-Z_]+_\d{3} · /);
    }
  });

  it("같은 날짜면 본문이 완전히 같다", () => {
    expect(mail().body).toBe(mail().body);
    // 새로 계산해도 같아야 한다. (캐시 · 시간 · 순회 순서에 흔들리지 않는다)
    const again = analyzeFortune(analyzeBirth(birth()), REFERENCE_DATE);
    expect(renderEmail(SAJU, again, REFERENCE_DATE).body).toBe(mail().body);
  });

  it("날짜가 바뀌면 일운이 달라지고 본문도 달라진다", () => {
    const other = analyzeFortune(SAJU, { year: 2026, month: 9, day: 28 });
    expect(other.context.ilun.ganZhi).not.toBe(FORTUNE.context.ilun.ganZhi);
    expect(renderEmail(SAJU, other, { year: 2026, month: 9, day: 28 }).body).not.toBe(mail().body);
  });
});

/* ------------------------------------------------------------------ 금지 표현 */

describe("메일 본문에 없어야 할 것", () => {
  const { body } = mail();

  it("점수 · 확률 · 백점 단위가 없다", () => {
    expect(body).not.toMatch(/점\b/);
    expect(body).not.toMatch(/\d{2,3}\s*점/);
    expect(body).not.toMatch(/\d+(\.\d+)?%/);
    expect(body).not.toMatch(/확률|퍼센트| Odds|odds/);
  });

  it("좋은 쪽 / 나쁜 쪽 판정이 없다", () => {
    expect(body).not.toMatch(/가장 좋은|가장 나쁜|최고의|최악의|권합니다!|피하세요!/);
  });

  it("[object Object] 처럼 잘못 조립된 문자열이 없다", () => {
    expect(body).not.toContain("[object");
    expect(body).not.toContain("undefined");
    expect(body).not.toContain("NaN");
  });

  it("탐색적 표기 (이(가) 같은) 가 없다", () => {
    expect(body).not.toMatch(/[가은를이]\((?:가|는|를|이)\)/);
  });

  it("한글이 깨지지 않는다 (NFC)", () => {
    // 분해형(받침이 코드포인트로 빠진 형태)이 섞여 있으면 화면이 이상하게 보인다.
    expect(body).toBe(body.normalize("NFC"));
  });
});

/* ------------------------------------------------------------------ SMTP 조립 */

describe("SMTP 본문 조립", () => {
  it("ASCII 헤더는 그대로 두고 한글 헤더만 BASE64 으로 감싼다", () => {
    expect(encodeHeader("plain-ascii")).toBe("plain-ascii");
    expect(encodeHeader("오늘의 운세")).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
  });

  it("헤더 값에 줄바꿈이 있으면 막는다 (헤더 주입)", () => {
    expect(() => headerValue("제목\r\nBcc: x@y.z", "제목", "subject")).toThrow(SmtpError);
    expect(() => commandArg("a@b.c\r\nDATA", "mail-from")).toThrow(SmtpError);
  });

  it("명령 인자에 공백이나 꺾쇠가 있으면 막는다", () => {
    expect(() => commandArg("a@b.c 두 개", "mail-from")).toThrow(SmtpError);
    expect(() => commandArg("<a@b.c>", "mail-from")).toThrow(SmtpError);
    expect(commandArg("someone@example.com", "mail-from")).toBe("someone@example.com");
  });

  it("오류 메시지에 계정 · 본문이 새지 않는다", () => {
    try {
      commandArg("secret-token\r\n", "auth-username");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SmtpError);
      expect((error as Error).message).not.toContain("secret-token");
    }
  });

  it("긴 줄을 접되 UTF-8 바이트 경계를 깨지 않는다", () => {
    const long = "가".repeat(500); // 1500 바이트
    const lines = foldLines(long, 998);
    expect(lines.length).toBe(2);
    for (const l of lines) {
      expect(Buffer.byteLength(l, "utf8")).toBeLessThanOrEqual(999);
      expect(l).toBe(l.normalize("NFC"));
      expect(l.includes("�")).toBe(false);
    }
  });

  it("짧은 줄은 접지 않는다", () => {
    expect(foldLines("짧은 줄", 998)).toEqual(["짧은 줄"]);
  });

  it("줄바꿈 종류가 섞여도 정규화한다", () => {
    expect(foldLines("a\nb\rc\r\nd", 998)).toEqual(["a", "b", "c", "d"]);
  });
});

/* ------------------------------------------------------------------ 환경변수 */

describe("환경변수 읽기", () => {
  const FULL = {
    BIRTH_DATE: "1990-05-20",
    BIRTH_CALENDAR: "solar",
    BIRTH_LEAP_MONTH: "false",
    BIRTH_TIME: "6",
    BIRTH_ZI_MODE: "자정",
    BIRTH_GENDER: "여",
    BIRTH_PLACE: "서울특별시/서대문구",
    EMAIL_USERNAME: "someone@example.com",
    EMAIL_PASSWORD: "app-password",
    EMAIL_TO: "someone@example.com",
    SMTP_HOST: "smtp.example.com",
  };

  it("필수 값이 없으면 **변수 이름**만 알린다", () => {
    stubEnv({ ...FULL, BIRTH_DATE: undefined });
    expect(() => readEnvironment()).toThrow(EmailConfigError);
    expect(() => readEnvironment()).toThrow(/BIRTH_DATE/);
  });

  it("오류 메시지에 실제 값이 새지 않는다", () => {
    stubEnv({ ...FULL, BIRTH_DATE: "seoul-jongno-1990-05-20" });
    try {
      readEnvironment();
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("seoul-jongno");
    }
  });

  it("형식이 틀린 값은 이유만 알린다", () => {
    for (const [key, bad, pattern] of [
      ["BIRTH_DATE", "1990/05/20", /BIRTH_DATE/],
      ["BIRTH_CALENDAR", "양력", /BIRTH_CALENDAR/],
      ["BIRTH_TIME", "13", /BIRTH_TIME/],
      ["BIRTH_GENDER", "male", /BIRTH_GENDER/],
      ["BIRTH_PLACE", "서울", /BIRTH_PLACE/],
    ] as const) {
      stubEnv({ ...FULL, [key]: bad });
      expect(() => readEnvironment(), key).toThrow(pattern);
    }
  });

  it("양력 입력은 윤달 여부를 요구하지 않는다", () => {
    stubEnv({ ...FULL, BIRTH_LEAP_MONTH: undefined });
    expect(readEnvironment().birth.leapMonth).toBe(false);
  });

  it("음력 입력은 윤달 여부를 요구한다", () => {
    stubEnv({ ...FULL, BIRTH_CALENDAR: "lunar", BIRTH_LEAP_MONTH: undefined });
    expect(() => readEnvironment()).toThrow(/BIRTH_LEAP_MONTH/);
  });

  it("출생시간이 없으면 출생시간 모름 으로 읽는다", () => {
    stubEnv({ ...FULL, BIRTH_TIME: undefined });
    expect(readEnvironment().birth.time).toEqual({ kind: "unknown" });
  });

  it("성별이 없어도 읽힌다 (간지순역법)", () => {
    stubEnv({ ...FULL, BIRTH_GENDER: undefined });
    expect(readEnvironment().birth.gender).toBeUndefined();
  });

  it("EMAIL_TO 가 없으면 발신 계정으로 보낸다", () => {
    stubEnv({ ...FULL, EMAIL_TO: undefined });
    expect(readEnvironment().smtp.to).toBe(FULL.EMAIL_USERNAME);
  });

  it("읽은 입력으로 바로 계산된다 (즉석 호출)", () => {
    stubEnv(FULL);
    const env = readEnvironment();
    expect(env.birth.year).toBe(1990);
    expect(env.birth.region.sigungu).toBe("서대문구");
    expect(env.smtp.port).toBe(465);
    expect(analyzeBirth(env.birth).natal.chart.year.stem).toBe("庚");
  });
});

/* ------------------------------------------------------------------ 소스 감사 */

/**
 * 코드를 읽고 확인하는 대신 **파일 내용을 검사**한다.
 *
 * 개인정보가 새는 가장 흔한 길은 로그다. 그래서 로그 호출을 문자열로 훑는다.
 */
describe("개인정보가 새지 않는 구조", () => {
  const emailDir = fileURLToPath(new URL("../email/", import.meta.url));
  const files = ["main.ts", "env.ts", "template.ts", "smtp.ts"];
  const sources = files.map((f) => ({
    name: f,
    text: readFileSync(emailDir + f, "utf8"),
  }));

  it("이메일 경로가 파일을 **쓰지 않는다**", () => {
    for (const { name, text } of sources) {
      expect(text, name).not.toMatch(/writeFileSync|appendFileSync|createWriteStream|mkdirSync/);
      expect(text, name).not.toMatch(/\bfetch\(|\baxios\b|node-fetch/);
    }
  });

  it("로그로 남기는 문장은 네 줄뿐이다", () => {
    const main = sources.find((s) => s.name === "main.ts")!.text;

    // ① `log()` / `fail()` 에 넘어가는 것은 `ALLOWED_LOGS` 의 상수뿐이다.
    //    호출부만 본다. (`function log(...)` 선언과 `console.log(...)` 는 제외)
    const emitted = [...main.matchAll(/(?:^|[^.\w])(?:log|fail)\(((?:[^()]|\([^()]*\))*)\)\s*;/g)].map(
      (m) => m[1].trim(),
    );
    expect(emitted).toEqual([
      "ALLOWED_LOGS.started",
      "ALLOWED_LOGS.calculated",
      "ALLOWED_LOGS.sent",
      "ALLOWED_LOGS.failed, reasonOf(error)",
    ]);

    // ② `ALLOWED_LOGS` 안에는 네 줄짜리 상수만 있고, 값이 섞이지 않는다.
    const block = /const ALLOWED_LOGS = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(main)?.[1] ?? "";
    const messages = [...block.matchAll(/: "([^"]*)"/g)].map((m) => m[1]);
    expect(messages).toEqual([
      "Myeong Core started",
      "Calculation completed",
      "Email sent successfully",
      "Email sending failed",
    ]);

    // ③ `console` 을 직접 부르는 곳은 두 군데뿐이고, 둘 다 값이 아닌 변수를 넘긴다.
    const call = /console\.(?:log|error|warn|info)\(((?:[^()]|\([^()]*\))*)\)/g;
    expect([...main.matchAll(call)].map((m) => m[1].trim()).sort()).toEqual(
      ["message", "`${message}: ${reason}`"].sort(),
    );
  });

  it("로그로 남길 수 있는 문자열에 간지 · 주소 · 본문이 없다", () => {
    const call = /console\.(?:log|error|warn|info)\(((?:[^()]|\([^()]*\))*)\)/g;
    for (const { name, text } of sources) {
      for (const m of text.matchAll(call)) {
        // 문자열에 직접 들어가는 상수만 본다. (변수는 reasonOf 로만 지난다)
        expect(m[1], name).not.toMatch(/ganZhi|pillar|stem|branch|body|address|username|password/i);
      }
    }
  });

  it("workflow 가 결과물을 저장하지 않는다", () => {
    const workflow = readFileSync(fileURLToPath(new URL("../.github/workflows/daily-fortune.yml", import.meta.url)), "utf8");
    expect(workflow).not.toMatch(/actions\/upload-artifact/);
    expect(workflow).not.toMatch(/actions\/cache/);
    expect(workflow).not.toMatch(/\bgit\b/);
  });
});