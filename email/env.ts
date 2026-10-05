/**
 * GitHub Actions 의 환경변수(비밀 값)에서 입력값을 읽는다.
 *
 * ── 개인정보 규칙 (docs/privacy.md) ─────────────────────────────────
 * - 이 모듈은 **값을 로그에 남기지 않는다.** 변수 이름과 이유만 남긴다.
 * - 읽은 값은 이 실행이 끝날 때까지 **메모리에만** 있고, 어디에도 기록되지 않는다.
 *   (파일 · 아티팩트 · 캐시 · 커밋 어디에도 쓰지 않는다)
 *
 * 비밀 값을 GitHub 로그의 마스킹 기능에 기대지 않는다.
 * 마스킹은 실수로 놓칠 수 있고, 파생된 형태(기둥 간지 · 요약문)는 마스킹되지 않는다.
 */

import { isValidSido, todayInKorea, type BirthInput, type CivilDate, type Gender, type ZiHourMode } from "../core";

/** 이 실행에 필요한 입력값 전부. */
export interface EmailEnvironment {
  birth: BirthInput;
  smtp: { host: string; port: number; username: string; password: string; to: string };
  /** 이메일을 계산할 날짜. */
  date: CivilDate;
}

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigError";
  }
}

/** 값이 아니라 **이름**만 로그에 남긴다. */
function read(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new EmailConfigError(`환경변수 ${name} 이(가) 없습니다.`);
  }
  return value.trim();
}

function readOptional(name: string): string | null {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? null : value.trim();
}

/** `YYYY-MM-DD` 한 줄. */
function readIsoDate(name: string): CivilDate {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(read(name));
  if (!m) throw new EmailConfigError(`환경변수 ${name} 형식이 YYYY-MM-DD 가 아닙니다.`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function readCalendar(): BirthInput["calendar"] {
  const raw = read("BIRTH_CALENDAR");
  if (raw === "solar" || raw === "lunar") return raw;
  throw new EmailConfigError(`환경변수 BIRTH_CALENDAR 은(는) "solar" 또는 "lunar" 여야 합니다.`);
}

/** 시진 번호. 없거나 비었으면 "출생시간 모름". */
function readTime(): BirthInput["time"] {
  const raw = readOptional("BIRTH_TIME");
  if (raw === null) return { kind: "unknown" };

  const branchIndex = Number(raw);
  if (!Number.isInteger(branchIndex) || branchIndex < 0 || branchIndex > 11) {
    throw new EmailConfigError("환경변수 BIRTH_TIME 은(는) 0 ~ 11 의 시진 번호여야 합니다. (0 = 자시)");
  }

  const modeRaw = readOptional("BIRTH_ZI_MODE");
  if (modeRaw !== null && modeRaw !== "자정" && modeRaw !== "조자시") {
    throw new EmailConfigError(`환경변수 BIRTH_ZI_MODE 은(는) "자정" 또는 "조자시" 여야 합니다.`);
  }
  const ziMode: ZiHourMode = modeRaw ?? "자정";
  return { kind: "doubleHour", branchIndex, ziMode };
}

function readGender(): Gender | undefined {
  const raw = readOptional("BIRTH_GENDER");
  if (raw === null) return undefined;
  if (raw === "남" || raw === "여") return raw;
  throw new EmailConfigError(`환경변수 BIRTH_GENDER 은(는) "남" 또는 "여" 여야 합니다.`);
}

/** 시·도 이름 하나. 계산에는 쓰이지 않고 표기에만 쓰인다. */
function readRegion(): BirthInput["region"] {
  const raw = read("BIRTH_PLACE").trim();
  if (raw === "") {
    throw new EmailConfigError(`환경변수 BIRTH_PLACE 가 비어 있습니다. 시·도 이름을 적어주세요.`);
  }
  if (!isValidSido(raw)) {
    throw new EmailConfigError(
      `환경변수 BIRTH_PLACE 가 대한민국의 시·도 17개 중 하나가 아닙니다: ${raw}`,
    );
  }
  return { sido: raw };
}

function readPort(): number {
  const raw = readOptional("SMTP_PORT");
  if (raw === null) return 465;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EmailConfigError("환경변수 SMTP_PORT 은(는) 1 ~ 65535 사이의 정수여야 합니다.");
  }
  return port;
}

/**
 * 윤달 여부.
 * - 음력 입력이면 반드시 필요하다. 없으면 "없습니다" 오류.
 * - 양력 입력은 윤달이 없으므로 `false` 로 고정한다. (값이 실려 있어도 무시한다)
 */
function readLeapMonth(calendar: BirthInput["calendar"]): boolean {
  if (calendar === "solar") return false;
  const raw = readOptional("BIRTH_LEAP_MONTH");
  if (raw === null) {
    throw new EmailConfigError("환경변수 BIRTH_LEAP_MONTH 이(가) 없습니다. (음력 입력에는 필요합니다)");
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new EmailConfigError(`환경변수 BIRTH_LEAP_MONTH 은(는) "true" 또는 "false" 여야 합니다.`);
}

/** 환경변수를 모두 읽어 입력값으로 바꾼다. (계산은 아직 하지 않는다) */
export function readEnvironment(): EmailEnvironment {
  const calendar = readCalendar();
  const birthDate = readIsoDate("BIRTH_DATE");
  const gender = readGender();

  return {
    birth: {
      calendar,
      year: birthDate.year,
      month: birthDate.month,
      day: birthDate.day,
      leapMonth: readLeapMonth(calendar),
      time: readTime(),
      region: readRegion(),
      ...(gender === undefined ? {} : { gender }),
    },
    smtp: {
      host: read("SMTP_HOST"),
      port: readPort(),
      username: read("EMAIL_USERNAME"),
      password: read("EMAIL_PASSWORD"),
      to: readOptional("EMAIL_TO") ?? read("EMAIL_USERNAME"),
    },
    // 이메일이 다른 날짜를 계산할 일이 없으므로 항상 "오늘". 웹과 같은 함수.
    date: todayInKorea(),
  };
}