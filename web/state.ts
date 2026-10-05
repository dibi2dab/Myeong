/**
 * 화면 상태와 브라우저 저장소.
 *
 * 개인정보 보호 규칙 (docs/privacy.md)
 * - 출생 정보는 **이 브라우저의 localStorage 에만** 남는다. 서버로 나가지 않는다.
 * - 저장소에 남기는 값은 계산에 꼭 필요한 다섯 가지뿐이다.
 *   (결과물 — 사주, 운세, 간지 — 은 저장하지 않는다. 언제든 다시 계산할 수 있다.)
 * - 사용자가 설정에서 언제든지 수정하거나 지울 수 있다.
 * - 저장 실패(사생활 모드, 용량 초과 등)는 조용히 무시하지 않고 화면에 알린다.
 */

import type { BirthInput, CivilDate, Gender } from "../core";

const STORAGE_KEY = "myeong.birth.v2";
/** 시/군/구 를 받던 때의 키. 값만 읽어 지우고 새로 저장한다. */
const LEGACY_STORAGE_KEY = "myeong.birth.v1";
const SETTINGS_KEY = "myeong.settings.v1";

/** localStorage 에 남기는 형태. 계산 결과는 담지 않는다. */
export interface StoredBirth {
  calendar: "solar" | "lunar";
  year: number;
  month: number;
  day: number;
  leapMonth?: boolean;
  timeKind: "doubleHour" | "unknown";
  branchIndex: number | null;
  ziMode: "조자시" | "자정" | null;
  gender?: Gender;
  /** 출생지 — 시·도만. 시/군/구는 묻지 않는다. */
  sido: string;
}

export interface Settings {
  /** 고지 문구를 항상 펼친 상태로 보여준다. */
  showDisclaimer: boolean;
  /** 대비가 부족한 화면 환경을 위한 설정. (자동 감지하지 않고 사용자가 고른다) */
  highContrast: boolean;
  /** 본문 글자 크기 배율. */
  fontScale: "normal" | "large" | "xlarge";
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  showDisclaimer: true,
  highContrast: false,
  fontScale: "normal",
});

export interface AppState {
  birth: StoredBirth | null;
  settings: Settings;
  /** 화면에서 보고 있는 날짜. 오늘의 운세 · 캘린더 · 대운이 함께 쓴다. */
  date: CivilDate;
  /** 저장 실패 등 사용자에게 알려야 할 상태. */
  storageNotice: string | null;
}

/* ------------------------------------------------------------------ localStorage */

function storage(): Storage | null {
  try {
    // 사생활 모드 등에서는 접근 자체가 예외를 던진다.
    const s = window.localStorage;
    const probe = "__myeong_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function loadBirth(): StoredBirth | null {
  const s = storage();
  if (!s) return null;
  const raw = s.getItem(STORAGE_KEY);
  if (!raw) return migrateLegacyBirth(s);
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredBirth(parsed) ? parsed : null;
  } catch {
    // 손상된 값은 조용히 지우고 처음부터 다시 시작한다.
    s.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * 시/군/구 를 받던 v1 값을 읽어 시·도만 남기고 새 형식으로 옮긴다.
 * 사용자가 다시 입력하지 않도록 하는 것이 목적이다. (계산 결과는 달라지지 않는다)
 */
function migrateLegacyBirth(s: Storage): StoredBirth | null {
  const raw = s.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  s.removeItem(LEGACY_STORAGE_KEY);
  try {
    const legacy: unknown = JSON.parse(raw);
    if (!isLegacyBirth(legacy)) return null;
    const migrated: StoredBirth = {
      calendar: legacy.calendar,
      year: legacy.year,
      month: legacy.month,
      day: legacy.day,
      leapMonth: legacy.leapMonth,
      timeKind: legacy.timeKind,
      branchIndex: legacy.branchIndex,
      ziMode: legacy.ziMode,
      gender: legacy.gender,
      sido: legacy.sido,
    };
    s.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return null;
  }
}

export function saveBirth(birth: StoredBirth): string | null {
  const s = storage();
  if (!s) return "이 브라우저는 저장을 허용하지 않습니다. 정보를 저장하지 않고 계산만 진행합니다.";
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(birth));
    return null;
  } catch {
    return "출생 정보를 저장하지 못했습니다. 브라우저 저장 공간을 확인해주세요.";
  }
}

export function clearBirth(): string | null {
  const s = storage();
  if (!s) return null;
  try {
    s.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return "저장된 정보를 지우지 못했습니다.";
  }
}

export function loadSettings(): Settings {
  const s = storage();
  if (!s) return { ...DEFAULT_SETTINGS };
  const raw = s.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      showDisclaimer: parsed.showDisclaimer ?? DEFAULT_SETTINGS.showDisclaimer,
      highContrast: parsed.highContrast ?? DEFAULT_SETTINGS.highContrast,
      fontScale: parsed.fontScale ?? DEFAULT_SETTINGS.fontScale,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): string | null {
  const s = storage();
  if (!s) return null;
  try {
    s.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return null;
  } catch {
    return "설정을 저장하지 못했습니다.";
  }
}

/* ------------------------------------------------------------------ 검증 */

/** 저장된 값이 기대한 형태인지 확인한다. (구버전 값·손상 값 걸러내기) */
function isStoredBirth(value: unknown): value is StoredBirth {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Record<string, unknown>;
  if (b.calendar !== "solar" && b.calendar !== "lunar") return false;
  if (!Number.isInteger(b.year) || !Number.isInteger(b.month) || !Number.isInteger(b.day)) return false;
  if (b.timeKind !== "doubleHour" && b.timeKind !== "unknown") return false;
  if (b.timeKind === "doubleHour" && !Number.isInteger(b.branchIndex)) return false;
  if (b.gender !== undefined && b.gender !== "남" && b.gender !== "여") return false;
  if (typeof b.sido !== "string") return false;
  return true;
}

/** v1(시/군/구 를 받던) 값의 형태. */
interface LegacyStoredBirth extends Omit<StoredBirth, "sido"> {
  sido: string;
  sigungu: string;
}

function isLegacyBirth(value: unknown): value is LegacyStoredBirth {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Record<string, unknown>;
  return isStoredBirth({ ...b, sido: b.sido }) && typeof b.sigungu === "string";
}

/** 저장 형태 → 계산기가 받는 입력. */
export function toBirthInput(stored: StoredBirth): BirthInput {
  return {
    calendar: stored.calendar,
    year: stored.year,
    month: stored.month,
    day: stored.day,
    leapMonth: stored.leapMonth,
    time:
      stored.timeKind === "doubleHour" && stored.branchIndex !== null
        ? { kind: "doubleHour", branchIndex: stored.branchIndex, ziMode: stored.ziMode ?? "자정" }
        : { kind: "unknown" },
    gender: stored.gender,
    region: { sido: stored.sido },
  };
}

/** 계산기 입력을 → 저장 형태. (계산 결과는 버린다) */
export function toStored(input: BirthInput): StoredBirth {
  return {
    calendar: input.calendar,
    year: input.year,
    month: input.month,
    day: input.day,
    leapMonth: input.leapMonth,
    timeKind: input.time.kind,
    branchIndex: input.time.kind === "doubleHour" ? input.time.branchIndex : null,
    ziMode: input.time.kind === "doubleHour" ? input.time.ziMode : null,
    gender: input.gender,
    sido: input.region.sido,
  };
}

/* ------------------------------------------------------------------ 화면 상태 */

/** 해시(#)로 주소를 바꾼다. 계산 결과는 주소에 싣지 않는다. */
export function readRoute(): string {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path] = raw.split("?");
  return path === "" ? "today" : path;
}

export function writeRoute(path: string): void {
  const next = `#/${path}`;
  if (window.location.hash !== next) window.location.hash = next;
}
