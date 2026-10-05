/**
 * 출생 정보 입력 화면.
 *
 * 원칙
 * - 자유 입력을 받지 않는다. 날짜·시진·지역 모두 목록에서 고른다.
 * - 오류는 계산기가 정한 문구를 그대로 보여준다. (내부 상태·스택을 옮기지 않는다)
 * - 음력 입력이면 **양력으로 바꾼 결과를 먼저 보여주고** 확인을 받는다.
 * - 이 화면에 있는 값 외에는 아무것도 저장하지 않는다.
 */

import {
  LUNAR_SUPPORT_END,
  LUNAR_SUPPORT_START,
  MyeongInputError,
  SIDO_LIST,
  STANDARD_TIME_NOTE,
  TIME_BRANCHES,
  convertCalendar,
  leapMonthOfLunarYear,
  validateBirthInput,
  type BirthInput,
  type CalendarConversionResult,
  type Gender,
  type ZiHourMode,
} from "../../core";
import { el, append, div, p, notice, card, type Child } from "../dom";
import { toIso } from "../components";
import { dateKorean } from "../format";
import { saveBirth, toStored, type StoredBirth } from "../state";
import { persistBirth, type App } from "../app";

interface Draft {
  calendar: "solar" | "lunar";
  year: number;
  month: number;
  day: number;
  leapMonth: boolean | null;
  timeKind: "doubleHour" | "unknown";
  branchIndex: number;
  ziMode: ZiHourMode;
  gender: Gender | null;
  sido: string;
}

function emptyDraft(): Draft {
  return {
    calendar: "solar",
    year: 1990,
    month: 5,
    day: 20,
    leapMonth: false,
    timeKind: "doubleHour",
    branchIndex: 6, // 午시
    ziMode: "자정",
    gender: null,
    sido: "",
  };
}

export function renderBirthForm(app: App): HTMLElement {
  return div("stack", [card("출생 정보 입력", [formBody(app, emptyDraft())])]);
}

/**
 * 폼 → 확인 두 단계를 한 컨테이너 안에서 다룬다.
 *
 * 단계 전환은 전체 페이지를 다시 그리지 않고 `stage` 안만 갈아끼운다.
 * 그래야 입력 중이던 값이 살아 있고, 되돌아가기 버튼도 자연스럽다.
 *
 * 조건부 필드(윤달 여부 · 자시 기준)는 보여주는 것이 계산의 전제이므로,
 * 그 조건이 바뀌는 순간 폼을 다시 그린다. (`draft` 하나만 상태로 둔다)
 */
function formBody(app: App, draft: Draft): HTMLElement {
  const stage = div("birth__stage");
  const wrap = div("birth");
  wrap.append(stage);
  showForm();
  return wrap;

  function showForm(): void {
    const errorSlot = div("birth__error", { role: "alert" });
    const body = el("form", { class: "birth__form", novalidate: true });

    /** 조건부 필드가 바뀌면 폼을 다시 그린다. 포커스는 그대로 남긴다. */
    const refresh = (keepFocusId: string): void => {
      const active = document.activeElement;
      const hadFocus = active instanceof HTMLElement && wrap.contains(active);
      showForm();
      if (!hadFocus) return;
      const again = (keepFocusId ? wrap.querySelector<HTMLElement>(`#${CSS.escape(keepFocusId)}`) : null) ?? null;
      (again ?? wrap.querySelector<HTMLElement>("input, select, button"))?.focus();
    };

    append(body, [
      calendarField(draft, refresh),
      ...dateFields(draft, refresh),
      timeField(draft, refresh),
      // 자시일 때만 자시 기준을 묻는다. (선택하지 않으면 일주를 못 정한다)
      ...(draft.timeKind === "doubleHour" && draft.branchIndex === 0 ? [ziModeField(draft)] : []),
      regionField(draft),
      genderField(draft),
    ]);

    body.append(
      div("birth__actions", [
        el("button", { type: "submit", class: "btn btn--primary", text: "사주 계산하기" }),
        el("a", { class: "btn btn--ghost", href: "#/settings", text: "취소" }),
      ]),
    );

    body.addEventListener("submit", (ev) => {
      ev.preventDefault();
      errorSlot.replaceChildren();
      try {
        const input = toBirthInput(draft);
        validateBirthInput(input);
        const conversion = convertCalendar(input);
        stage.replaceChildren(confirmStage(app, draft, input, conversion, showForm));
        stage.querySelector<HTMLElement>("[tabindex]")?.focus();
      } catch (error) {
        errorSlot.replaceChildren(
          notice(
            error instanceof MyeongInputError
              ? error.message
              : "입력 값을 확인해주세요. 날짜나 시간을 다시 봐주세요.",
            "error",
          ),
        );
      }
    });

    stage.replaceChildren(div("stack", [body, errorSlot]));
  }
}

/** 조건부 필드를 다시 그리라는 신호. */
type Refresh = (keepFocusId: string) => void;

/* ------------------------------------------------------------------ 필드 */

function field(labelText: string, control: HTMLElement, id: string, hint?: string): HTMLElement {
  const box = div("field");
  append(box, [
    el("label", { class: "field__label", for: id, text: labelText }),
    control,
  ]);
  if (hint) box.append(p("field__hint", hint));
  return box;
}

function select(
  id: string,
  options: readonly (readonly [string, string])[],
  selected: string,
  onChange: (value: string) => void,
  placeholder: string,
): HTMLSelectElement {
  const sel = el("select", { class: "input", id });
  sel.append(el("option", { value: "", text: placeholder }));
  for (const [value, label] of options) {
    sel.append(el("option", { value, text: label, selected: value === selected || undefined }));
  }
  sel.addEventListener("change", () => onChange(sel.value));
  return sel;
}

/**
 * 라디오 한 묶음. `<legend>` 는 반드시 `<fieldset>` 의 첫 자식이어야 하므로
 * 여기서 한 번에 만든다. (스크린리더가 "무엇을 고르는 묶음인지" 읽을 수 있다)
 *
 * `refresh` 를 넘기면 고른 뒤 폼을 다시 그린다. 조건부 필드가 있는 묶음만 쓴다.
 */
function radioGroup(
  name: string,
  legendText: string,
  options: readonly (readonly [string, string, boolean])[],
  onPick: (value: string) => void,
  hint?: string,
  refresh?: Refresh,
): HTMLElement {
  const fieldset = el("fieldset", { class: "field field--radios" });
  const group = el("div", { class: "radios" });

  for (const [value, label, checked] of options) {
    const id = `${name}-${value}`;
    const input = el("input", { type: "radio", name, value, id, checked });
    input.addEventListener("change", () => {
      if (!input.checked) return;
      onPick(value);
      refresh?.(id);
    });
    group.append(el("label", { class: "radios__item", for: id, children: [input, label] }));
  }

  append(fieldset, [el("legend", { class: "field__label", text: legendText }), group]);
  if (hint) fieldset.append(p("field__hint", hint));
  return fieldset;
}

function calendarField(d: Draft, refresh: Refresh): HTMLElement {
  return radioGroup(
    "calendar",
    "달력",
    [
      ["solar", "양력", d.calendar === "solar"],
      ["lunar", "음력", d.calendar === "lunar"],
    ],
    (value) => {
      d.calendar = value as Draft["calendar"];
      // 양력으로 바꾸면 윤달 선택은 애초에 없다. (계산기가 "윤달 여부를 선택해주세요." 로 막는다)
      if (d.calendar === "solar") d.leapMonth = null;
    },
    undefined,
    refresh,
  );
}

function dateFields(d: Draft, refresh: Refresh): Child[] {
  const out: HTMLElement[] = [];

  if (d.calendar === "solar") {
    const input = el("input", {
      type: "date",
      class: "input",
      id: "birth-date",
      value: toIso({ year: d.year, month: d.month, day: d.day }),
      min: toIso(LUNAR_SUPPORT_START),
      max: toIso(LUNAR_SUPPORT_END),
    });
    input.addEventListener("change", () => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.value);
      if (!m) return;
      d.year = Number(m[1]);
      d.month = Number(m[2]);
      d.day = Number(m[3]);
    });
    out.push(
      field(
        "출생 날짜 (양력)",
        input,
        "birth-date",
        `${LUNAR_SUPPORT_START.year}년 1월 31일 ~ ${LUNAR_SUPPORT_END.year}년 12월 31일 까지 계산합니다.`,
      ),
    );
    return out;
  }

  // 음력: 연 · 월 · 일 을 따로 고르고 윤달 여부를 함께 고른다.
  const years: [string, string][] = [];
  for (let y = LUNAR_SUPPORT_START.year; y <= LUNAR_SUPPORT_END.year; y += 1) {
    const leap = leapMonthOfLunarYear(y);
    years.push([String(y), leap > 0 ? `${y}년 (윤${leap}월 있음)` : `${y}년`]);
  }
  const yearSel = select("lunar-year", years, String(d.year), (v) => {
    d.year = Number(v);
    // 연도가 바뀌면 윤달 여부도 달라진다. (미선택 상태로 되돌린다)
    d.leapMonth = null;
    refresh("lunar-year");
  }, "연도");
  out.push(field("출생 연도 (음력)", yearSel, "lunar-year"));

  const months: [string, string][] = [];
  for (let m = 1; m <= 12; m += 1) months.push([String(m), `${m}월`]);
  const monthSel = select("lunar-month", months, String(d.month), (v) => {
    d.month = Number(v);
    refresh("lunar-month");
  }, "월");
  out.push(field("출생 월 (음력)", monthSel, "lunar-month"));

  const days: [string, string][] = [];
  for (let day = 1; day <= 30; day += 1) days.push([String(day), `${day}일`]);
  const daySel = select("lunar-day", days, String(d.day), (v) => {
    d.day = Number(v);
  }, "일");
  out.push(field("출생 일 (음력)", daySel, "lunar-day"));

  const leap = leapMonthOfLunarYear(d.year);
  const leapGroup = radioGroup(
    "leapMonth",
    "윤달 여부",
    leap > 0
      ? [
          ["false", "평달", d.leapMonth === false],
          ["true", `윤${leap}월`, d.leapMonth === true],
        ]
      : [["false", "이 해는 윤달이 없습니다", true]],
    (value) => {
      d.leapMonth = value === "true";
    },
    leap > 0
      ? `${d.year}년은 윤${leap}월이 있는 해입니다. 평${d.month}월을 고르면 일반 달로 계산합니다.`
      : undefined,
  );
  out.push(leapGroup);

  return out;
}

function timeField(d: Draft, refresh: Refresh): Child[] {
  const out: Child[] = [
    radioGroup(
      "timeKind",
      "출생 시간",
      [
        ["doubleHour", "출생 시간을 앎", d.timeKind === "doubleHour"],
        ["unknown", "출생시간 모름", d.timeKind === "unknown"],
      ],
      (value) => {
        d.timeKind = value as Draft["timeKind"];
      },
      undefined,
      refresh,
    ),
  ];

  if (d.timeKind === "unknown") {
    out.push(
      p("field__hint", "시주를 계산하지 않습니다. 시주에서 나오는 십신·간지 해석은 빠지고, 그 사실을 화면과 이메일에 함께 표시합니다."),
    );
    return out;
  }

  const options = TIME_BRANCHES.map((b, i) => [String(i), `${b.branch}시 (${b.range})`] as const);
  const sel = select("time-branch", options, String(d.branchIndex), (v) => {
    d.branchIndex = Number(v);
    // 자시를 고르면 자시 기준을 추가로 묻는다.
    refresh("time-branch");
  }, "시진 선택");
  out.push(field("출생 시진", sel, "time-branch", "시진 12개를 고릅니다. 1시 ~ 2시 사이가 丑시입니다."));
  return out;
}

function ziModeField(d: Draft): HTMLElement {
  return radioGroup(
    "ziMode",
    "자시(子時) 기준",
    [
      ["자정", "자정 기준 (00:00 起)", d.ziMode === "자정"],
      ["조자시", "조자시 기준 (23:30 起)", d.ziMode === "조자시"],
    ],
    (value) => {
      d.ziMode = value as ZiHourMode;
    },
    "자시는 23:30 ~ 01:00 에 걸쳐 있습니다. 어느 쪽을 0시로 볼지 골라야 일주가 정해집니다. 조자시를 고르면 자시 시간에 태어난 사람은 다음 날 일주로 계산합니다.",
  );
}

/**
 * 출생지 — **시·도만** 고른다.
 *
 * 시·군·구를 묻지 않는 이유: 대한민국은 한 시간대(UTC+9)이고 이 프로젝트는
 * 진태양시 보정을 하지 않는다. 시·군·구를 고른다고 간지가 달라지는 일은 없다.
 * 단계가 늘면 같은 이름이 여러 번 보여 고르기만 어려워진다.
 */
function regionField(d: Draft): HTMLElement {
  const sidoSel = select(
    "region-sido",
    SIDO_LIST.map((s) => [s, s] as const),
    d.sido,
    (v) => {
      d.sido = v;
    },
    "시 · 도 선택",
  );

  return div("stack", [
    field("출생지", sidoSel, "region-sido"),
    p("field__hint", `${STANDARD_TIME_NOTE} 기준 하나로 계산합니다. 시 · 군 · 구까지 고르지 않습니다.`),
  ]);
}

function genderField(d: Draft): HTMLElement {
  return radioGroup(
    "gender",
    "성별 (대운 순 · 역행 판단에 씁니다)",
    [
      ["남", "남", d.gender === "남"],
      ["여", "여", d.gender === "여"],
      ["none", "선택 안 함", d.gender === null],
    ],
    (value) => {
      d.gender = value === "none" ? null : (value as Gender);
    },
    "선택 안 하면 간지순역법으로 대운을 정하고, 그 사실을 결과에 표시합니다. 사주 네 기둥 계산에는 성별이 쓰이지 않습니다.",
  );
}

/* ------------------------------------------------------------------ 확인 단계 */

function confirmStage(
  app: App,
  draft: Draft,
  input: BirthInput,
  conversion: CalendarConversionResult,
  restart: () => void,
): HTMLElement {
  const heading = el("h2", { class: "birth__confirm-title", tabindex: "-1", text: "입력한 내용을 확인해주세요" });

  const rows: [string, string][] = [
    ["달력", draft.calendar === "solar" ? "양력" : `음력${input.leapMonth ? " (윤달)" : ""}`],
    [
      "입력 날짜",
      draft.calendar === "solar"
        ? dateKorean({ year: draft.year, month: draft.month, day: draft.day })
        : `${draft.year}년 ${draft.leapMonth ? "윤" : ""}${draft.month}월 ${draft.day}일`,
    ],
    ["양력 환산", dateKorean(conversion.solarDate)],
  ];
  if (draft.calendar === "lunar") {
    rows.push(["환산 메모", conversion.note ?? "음력 → 양력 변환"]);
  }
  rows.push([
    "출생 시간",
    draft.timeKind === "unknown"
      ? "출생시간 모름 (시주 미상)"
      : `${TIME_BRANCHES[draft.branchIndex].branch}시${draft.branchIndex === 0 ? ` · ${draft.ziMode} 기준` : ""}`,
  ]);
  rows.push(["출생지", draft.sido ? `${draft.sido} (${STANDARD_TIME_NOTE})` : ""]);
  rows.push(["성별", draft.gender ?? "선택 안 함 (간지순역법)"]);

  const dl = el("dl", { class: "deflist" });
  for (const [label, value] of rows) {
    dl.append(el("dt", { text: label }), el("dd", { text: value }));
  }

  const save = (): void => {
    const stored: StoredBirth = toStored(input);
    const problem = saveBirth(stored);
    app.state.storageNotice = problem;
    persistBirth(app, stored);
  };

  const actions = div("birth__actions", [
    el("button", { type: "button", class: "btn btn--primary", text: "이 정보로 사주 보기", onclick: save }),
    el("button", { type: "button", class: "btn btn--ghost", text: "입력 다시 하기", onclick: restart }),
  ]);

  const stack = div("stack", [heading]);
  if (draft.calendar === "lunar") {
    stack.append(notice(`음력으로 입력하셔서 양력으로 바꾸었습니다. 사주는 양력 ${dateKorean(conversion.solarDate)} 를 기준으로 계산합니다.`, "info"));
  }
  if (draft.timeKind === "unknown") {
    stack.append(notice("출생시간을 모른다고 하셨습니다. 시주를 계산하지 않으므로 시주에서 나오는 해석과 간지(合·沖·刑·破·害)가 빠집니다.", "info"));
  }
  append(stack, [dl, actions]);
  return stack;
}

/* ------------------------------------------------------------------ 입력 변환 */

function toBirthInput(draft: Draft): BirthInput {
  return {
    calendar: draft.calendar,
    year: draft.year,
    month: draft.month,
    day: draft.day,
    leapMonth: draft.calendar === "lunar" ? (draft.leapMonth ?? undefined) : undefined,
    time:
      draft.timeKind === "doubleHour"
        ? {
            kind: "doubleHour",
            branchIndex: draft.branchIndex,
            // 자시가 아닐 때는 기준이 쓰이지 않는다. 계산기에도 같은 값을 넘긴다.
            ziMode: draft.branchIndex === 0 ? draft.ziMode : "자정",
          }
        : { kind: "unknown" },
    gender: draft.gender ?? undefined,
    region: { sido: draft.sido },
  };
}
