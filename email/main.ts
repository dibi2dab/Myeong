/**
 * 하루치 운세 이메일 — 실행 진입점.
 *
 * 순서
 *   ① 환경변수(비밀 값) 읽기  ② 같은 `core` 로 계산  ③ 본문 만들기  ④ 보내고 끝내기
 *
 * ── 개인정보 규칙 (docs/privacy.md) ─────────────────────────────────
 * - 로그에 남길 수 있는 것은 `log()` 에 적힌 네 줄뿐이다.
 * - 기둥 · 간지 · 운세 문장 · 메일 주소 · 본문은 **어디에도 남기지 않는다.**
 *   오류를 볼 때에도 이름과 사유만 남기고 스택 트레이스는 남기지 않는다.
 * - 계산 결과를 파일 · 아티팩트 · 캐시에 쓰지 않는다. (쓰려면 코드를 바꿔야 한다)
 * - 이 프로세스는 한 번 계산하고 바로 끝난다. (상태를 남기는 곳이 없다)
 *
 * 로컬 시험: `npm run email` — 비밀 값이 없으면 이름만 알리고 끝난다.
 */

import { analyzeBirth, analyzeFortune } from "../core";
import { EmailConfigError, readEnvironment } from "./env";
import { sendMail, SmtpError } from "./smtp";
import { renderEmail } from "./template";

/**
 * 로그에 남길 수 있는 문장을 정의한다.
 *
 * 여기를 고치면 GitHub Actions 로그에 남는 내용이 정해진다.
 * 개인 정보가 들어갈 자리는 여기에밖에 없다. (테스트가 이 목록을 그대로 검사한다)
 */
const ALLOWED_LOGS = Object.freeze({
  started: "Myeong Core started",
  calculated: "Calculation completed",
  sent: "Email sent successfully",
  failed: "Email sending failed",
});

function log(message: string): void {
  console.log(message);
}

function fail(message: string, reason: string): void {
  // 사유에는 오류 종류 · SMTP 단계 · 코드만 온다. (값이 아니라)
  console.error(`${message}: ${reason}`);
}

/** 오류에서 사람이 볼 만한 문장만 뽑는다. (스택 트레이스 · 값을 숨긴다) */
function reasonOf(error: unknown): string {
  if (error instanceof EmailConfigError) return error.message;
  if (error instanceof SmtpError) return `${error.phase} 단계 · SMTP ${error.code}`;
  // 그 밖의 오류는 종류만 알린다. (메시지에 주소나 값이 섞여 있을 수 있다)
  return error instanceof Error ? error.name : "알 수 없는 오류";
}

async function main(): Promise<void> {
  log(ALLOWED_LOGS.started);

  const env = readEnvironment();

  // ① 계산 — 웹과 같은 `core` 를 부른다.
  const saju = analyzeBirth(env.birth);
  const fortune = analyzeFortune(saju, env.date);
  const { subject, body } = renderEmail(saju, fortune, env.date);
  log(ALLOWED_LOGS.calculated);

  // ② 전송
  await sendMail(
    {
      host: env.smtp.host,
      port: env.smtp.port,
      username: env.smtp.username,
      password: env.smtp.password,
      // 로컬 시험용. 운영에서는 쓰지 않는다. (MYEONG_SMTP_INSECURE 로 명시적으로 켠다)
      insecure: process.env.MYEONG_SMTP_INSECURE === "true",
      authMethod: process.env.MYEONG_SMTP_AUTH === "PLAIN" ? "PLAIN" : "LOGIN",
    },
    { from: env.smtp.username, to: env.smtp.to, subject, body },
  );

  log(ALLOWED_LOGS.sent);
}

// 이 파일이 곧 실행이다. import 만으로는 아무 일도 하지 않는다.
main().catch((error: unknown) => {
  fail(ALLOWED_LOGS.failed, reasonOf(error));
  process.exitCode = 1;
});