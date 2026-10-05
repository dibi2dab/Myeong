/**
 * 최소 SMTP 클라이언트. (암호화 연결 + AUTH LOGIN / PLAIN)
 *
 * 왜 직접 쓰나
 * - SMTP 는 텍스트 프로토콜이라 이 정도면 충분하다.
 * - 의존성을 하나 늘리지 않는 것이 이 프로젝트의 원칙이다. (번들 크기 · 유지보수 · 감사)
 * - 무엇이 전송되는지 전부 이 파일 안에 보인다.
 *
 * 무엇을 하지 않나
 * - **STARTTLS 업그레이드는 하지 않는다.** 아래 `sendMail` 은 처음부터 TLS 로 붙는다.
 *   (587 포트의 평문 구간에 비밀번호가 노출되는 경로를 만들지 않기 위해서다)
 * - 메일 저장 · 전달 · 재시도 · 큐잉은 하지 않는다. 보낸 뒤 끝난다.
 *
 * ── 개인정보 규칙 (docs/privacy.md) ──────────────────────────────────
 * - 로그에는 **단계 이름과 SMTP 코드**만 남긴다. 서버 응답의 **내용** 은 남기지 않는다.
 *   (서버가 받은 발신자 · 수신자를 그대로 되풀이하는 곳이 되기 때문이다)
 * - 오류 메시지에 주소 · 본문 · 비밀번호가 들어가지 않게 만든다.
 */

import { createConnection } from "node:net";
import { connect, type TLSSocket } from "node:tls";

/** 응답을 기다리는 최대 시간. (밀린 연결로 Actions 가 붙잡히지 않게) */
const REPLY_TIMEOUT_MS = 20_000;

const CRLF = "\r\n";
/** WHATWG Encoding 표준의 `max-line-length` 권고값과 같은 자리. */
const MAX_LINE_BYTES = 998;

export type AuthMethod = "LOGIN" | "PLAIN";

export interface SmtpConfig {
  host: string;
  port: number;
  /** 로그인 계정 */
  username: string;
  password: string;
  /** 기본은 LOGIN. 서버가 PLAIN 만 허용하면 "PLAIN". */
  authMethod?: AuthMethod;
  /** TLS 를 건너뛰고 평문으로 붙는다. (로컬 시험 한정 · 운영에서 쓰지 않는다) */
  insecure?: boolean;
}

export interface Message {
  from: string;
  to: string;
  subject: string;
  /** 줄바꿈은 무엇이든 받아 정규화한다. */
  body: string;
}

/** SMTP 의 응답 코드만 알리는 오류. (본문은 새지 않는다) */
export class SmtpError extends Error {
  constructor(
    readonly phase: string,
    readonly code: number,
    detail: string,
  ) {
    super(`${phase} 단계 실패 (SMTP ${code}): ${detail}`);
    this.name = "SmtpError";
  }
}

/* ------------------------------------------------------------------ 인코딩 */

/** 헤더 값에 ASCII 가 아니면 MIME BASE64 인코딩을 건다. */
export function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex -- ASCII 판별이 목적이므로 제어문자를 함께 본다.
  const asciiOnly = /^[\x20-\x7e]*$/;
  return asciiOnly.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** 헤더 값에 줄바꿈이 있으면 버린다. (헤더 주입 방지) */
export function headerValue(value: string, name: string, phase: string): string {
  if (/[\r\n]/.test(value)) throw new SmtpError(phase, -1, `${name} 값에 줄바꿈이 들어 있습니다.`);
  return encodeHeader(value);
}

/**
 * 명령 인자에 넣을 한 줄.
 *
 * 줄바꿈이 있으면 버린다. (명령 주입 방지)
 * 공백도 버린다. (주소에 공백이 있으면 헤더가 아니라 여러 토큰으로 읽힌다)
 */
export function commandArg(value: string, phase: string): string {
  if (/[\r\n]/.test(value)) throw new SmtpError(phase, -1, "명령 인자에 줄바꿈이 들어 있습니다.");
  if (/[\s<>()[\]]/.test(value)) {
    throw new SmtpError(phase, -1, "명령 인자에 공백이나 구분 문자가 들어 있습니다.");
  }
  return value;
}

function base64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

/* ------------------------------------------------------------------ 본문 */

/**
 * RFC 5322 줄 길이 제한에 맞춘다. (998 바이트)
 *
 * 한국어는 1자 = 3바이트라 화면 폭과 무관하게 **바이트**로 재야 한다.
 * 문자 경계를 깨지 않게 한 글자씩 옮긴다.
 */
export function foldLines(text: string, limit: number): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    if (Buffer.byteLength(raw, "utf8") <= limit) {
      out.push(raw);
      continue;
    }
    let current = "";
    for (const ch of raw) {
      if (current !== "" && Buffer.byteLength(current + ch, "utf8") > limit) {
        out.push(current);
        current = ` ${ch}`; // 접는 지점 앞에는 공백을 둔다. (이메일 관례)
      } else {
        current += ch;
      }
    }
    if (current !== "") out.push(current);
  }
  return out;
}

/**
 * DATA 안의 본문. (`.` 홀로 시작하는 줄은 `..` 로 바꿔야 한다)
 *
 * 마침표 하나만 있는 줄은 "메시지 끝" 으로 읽히므로 두 배로 늘린다.
 */
function prepareBody(body: string): string {
  return foldLines(body, MAX_LINE_BYTES)
    .map((l) => (l.startsWith(".") ? `.${l}` : l))
    .join(CRLF);
}

/* ------------------------------------------------------------------ 대화 */

function writeLine(socket: TLSSocket, value: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    socket.write(`${value}${CRLF}`, (error) => (error ? reject(error) : resolve()));
  });
}

function withTimeout<T>(promise: Promise<T>, phase: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new SmtpError(phase, -1, `응답이 ${REPLY_TIMEOUT_MS / 1000}초 안에 오지 않았습니다.`));
    }, REPLY_TIMEOUT_MS);
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * 서버의 응답을 읽고, 응답 **코드**만 확인한다.
 *
 * 여러 줄이 한 번에 올 수 있다. 끝줄(`NNN ` + 내용)이 나올 때까지 기다린다.
 * (`NNN-` 으로 시작하는 줄은 "다음 줄이 이어진다" 는 뜻이므로 계속 읽는다)
 */
async function expectCode(
  socket: TLSSocket,
  expect: readonly number[],
  phase: string,
): Promise<number> {
  let pending = "";
  for (;;) {
    const chunk = await withTimeout(
      new Promise<string>((resolve, reject) => {
        const onData = (data: Buffer): void => {
          cleanup();
          resolve(data.toString("utf8"));
        };
        // 끊긴 이유(인증 실패 등)는 서버가 말해 주는 것이고 개인 정보가 아니라,
        // 그래도 원문을 로그에 남기지 않는다.
        const onError = (): void => {
          cleanup();
          reject(new SmtpError(phase, -1, "연결이 끊겼습니다."));
        };
        const onTimeout = (): void => {
          cleanup();
          reject(new SmtpError(phase, -1, "응답이 오지 않았습니다."));
        };
        const cleanup = (): void => {
          socket.off("data", onData);
          socket.off("error", onError);
          socket.off("timeout", onTimeout);
        };
        socket.once("data", onData);
        socket.once("error", onError);
        socket.setTimeout(REPLY_TIMEOUT_MS, onTimeout);
      }),
      phase,
    );

    pending += chunk;
    const parts = pending.split(CRLF);
    pending = parts.pop() ?? ""; // 마지막 조각은 아직 줄이 덜 찼을 수 있다.
    const last = parts[parts.length - 1];
    if (last === undefined) continue;

    const matched = /^(\d{3}) /.exec(last);
    if (!matched) continue; // 아직 진행 중. (또는 비-ASCII 로 쪼개진 경우)
    const code = Number(matched[1]);
    if (!expect.includes(code)) {
      throw new SmtpError(phase, code, `기대한 코드 ${expect.join("/")} 와 다릅니다.`);
    }
    socket.setTimeout(0);
    return code;
  }
}

async function send(socket: TLSSocket, value: string, expect: readonly number[], phase: string) {
  await writeLine(socket, value);
  await expectCode(socket, expect, phase);
}

/* ------------------------------------------------------------------ 인증 */

async function authenticate(socket: TLSSocket, config: SmtpConfig): Promise<void> {
  const method = config.authMethod ?? "LOGIN";
  if (method === "PLAIN") {
    // "\0사용자명\0비밀번호" — 빈 인증자 식별자(authorization-id)로 시작한다.
    await send(socket, `AUTH PLAIN ${base64(`\0${config.username}\0${config.password}`)}`, [235], "auth");
    return;
  }
  // LOGIN 은 서버가 사용자명 · 비밀번호를 차례로 묻는다.
  await send(socket, "AUTH LOGIN", [334], "auth-start");
  await send(socket, base64("Username:"), [334], "auth-ask-username");
  await send(socket, base64(commandArg(config.username, "auth-username")), [334], "auth-username");
  await send(socket, base64(config.password), [235], "auth-password");
}

/* ------------------------------------------------------------------ 본 함수 */

/** 메일 하나를 보낸다. 끝나면 연결을 닫는다. */
export async function sendMail(config: SmtpConfig, message: Message): Promise<void> {
  // 주소는 인코딩하지 않는다. (MIME 헤더 인코딩은 값에만 건다)
  const from = commandArg(message.from, "mail-from");
  const to = commandArg(message.to, "rcpt-to");
  const subject = headerValue(message.subject, "제목", "subject");

  const socket = await openSocket(config);

  try {
    await expectCode(socket, [220], "greeting");
    // HELO 이름은 상수다. (사용자 입력 · 비밀 값이 들어갈 자리를 만들지 않는다)
    await send(socket, "EHLO myeong.invalid", [250], "ehlo");

    if (!config.insecure) await authenticate(socket, config);

    await send(socket, `MAIL FROM:<${from}>`, [250], "mail-from");
    await send(socket, `RCPT TO:<${to}>`, [250, 251], "rcpt-to");
    await send(socket, "DATA", [354], "data");

    const payload = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Message-ID: <${messageId()}@myeong.invalid>`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      `X-Mailer: ${MAILER_NAME}`,
      "",
      prepareBody(message.body),
      ".",
    ].join(CRLF);

    await writeLine(socket, payload);
    await expectCode(socket, [250], "data-end");

    await send(socket, "QUIT", [221], "quit");
  } finally {
    socket.destroy();
  }
}

/** `X-Mailer` 에 쓰는 이름. 바꿀 필요 없다. */
export const MAILER_NAME = "Myeong";

/**
 * `Message-ID` 에 쓸 값.
 *
 * 개인 정보가 들어가지 않도록 시간만 쓴다. (랜덤 값이 필요 없다)
 */
function messageId(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const stamp = kst.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "");
  return `${stamp}.${process.pid}`;
}

function openSocket(config: SmtpConfig): Promise<TLSSocket> {
  return new Promise<TLSSocket>((resolve, reject) => {
    // 평문 연결은 로컬 시험용뿐이다. 운영 경로에는 쓰지 않는다.
    const socket = config.insecure
      ? (createConnection({ host: config.host, port: config.port }) as unknown as TLSSocket)
      : connect({ host: config.host, port: config.port, servername: config.host });

    const fail = (error: Error): void => {
      socket.destroy();
      reject(new SmtpError("connect", -1, error.message));
    };
    socket.once("error", fail);
    socket.once(config.insecure ? "connect" : "secureConnect", () => {
      socket.off("error", fail);
      resolve(socket);
    });
  });
}