/**
 * 설정.
 *
 * 출생 정보 수정 · 삭제와 화면 설정만 여기에 모은다.
 * 저장된 값은 이 브라우저의 localStorage 안에만 있고, 어디로도 보내지 않는다.
 */

import { el, append, div, p, notice, card } from "../dom";
import { dateKorean } from "../format";
import { persistBirth, persistSettings, type App } from "../app";
import type { Settings, StoredBirth } from "../state";

export function renderSettings(app: App): HTMLElement {
  const stack = div("stack");

  stack.append(card("저장된 출생 정보", [birthCard(app)]));
  stack.append(card("화면 설정", [displayCard(app)]));
  stack.append(card("개인정보", [privacyCard()]));

  return stack;
}

/* ------------------------------------------------------------------ 출생 정보 */

function birthCard(app: App): HTMLElement {
  const birth = app.state.birth;
  if (!birth) {
    return div("stack", [
      p("muted", "이 브라우저에 저장된 출생 정보가 없습니다."),
      el("a", { class: "btn btn--primary", href: "#/birth", text: "출생 정보 입력하기" }),
    ]);
  }

  const wrap = div("stack");
  const dl = el("dl", { class: "deflist" });
  const rows: [string, string][] = [
    ["달력", birth.calendar === "solar" ? "양력" : "음력"],
    ["날짜", birthInputDateText(birth)],
    [
      "출생 시간",
      birth.timeKind === "unknown"
        ? "출생시간 모름 (시주 미상)"
        : birth.ziMode && birth.branchIndex === 0
          ? `자시 · ${birth.ziMode} 기준`
          : "시진 선택함",
    ],
    ["출생지", regionTextOf(birth)],
    ["성별", birth.gender ?? "선택 안 함 (간지순역법)"],
  ];
  for (const [label, value] of rows) dl.append(el("dt", { text: label }), el("dd", { text: value }));
  wrap.append(dl);

  const deleteBox = div("danger");
  const confirm = el("button", {
    type: "button",
    class: "btn btn--danger",
    text: "저장된 출생 정보 지우기",
    onclick: () => {
      if (deleteBox.dataset.armed === "1") {
        persistBirth(app, null);
        return;
      }
      deleteBox.dataset.armed = "1";
      deleteBox.replaceChildren(
        p("muted", "이 브라우저에 저장된 출생 정보만 지웁니다. 되돌릴 수 없습니다. 계속할까요?"),
        div("birth__actions", [
          el("button", {
            type: "button",
            class: "btn btn--danger",
            text: "네, 지워주세요",
            onclick: () => persistBirth(app, null),
          }),
          el("button", {
            type: "button",
            class: "btn btn--ghost",
            text: "아니오",
            onclick: () => {
              deleteBox.dataset.armed = "0";
              app.refresh();
            },
          }),
        ]),
      );
    },
  });

  append(wrap, [
    el("a", { class: "btn", href: "#/birth", text: "다시 입력하기 (덮어쓰기)" }),
    deleteBox,
    confirm,
  ]);
  return wrap;
}

function birthInputDateText(b: StoredBirth): string {
  const iso = `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`;
  return b.calendar === "solar" ? `${dateKorean(b)} (${iso})` : `음력 ${b.year}년 ${b.leapMonth ? "윤" : ""}${b.month}월 ${b.day}일`;
}

function regionTextOf(b: StoredBirth): string {
  return b.sigungu ? `${b.sido} ${b.sigungu}` : b.sido;
}

/* ------------------------------------------------------------------ 화면 설정 */

function displayCard(app: App): HTMLElement {
  const s = app.state.settings;
  const wrap = div("stack");

  wrap.append(toggle(
    "고지 문구 항상 보기",
    "전통 명리학이며 과학적으로 검증되지 않았다는 고지를 화면마다 띄웁니다.",
    s.showDisclaimer,
    (v) => persistSettings(app, { ...s, showDisclaimer: v }),
  ));

  wrap.append(toggle(
    "높은 대비",
    "회색·옅은 글자의 명도를 올려 대비를 강하게 합니다.",
    s.highContrast,
    (v) => persistSettings(app, { ...s, highContrast: v }),
  ));

  const fontField = div("field");
  const select = el("select", { class: "input", id: "font-scale" });
  for (const [value, label] of [
    ["normal", "보통"],
    ["large", "크게"],
    ["xlarge", "아주 크게"],
  ] as const) {
    select.append(el("option", { value, text: label, selected: s.fontScale === value || undefined }));
  }
  select.addEventListener("change", () => {
    persistSettings(app, { ...app.state.settings, fontScale: select.value as Settings["fontScale"] });
  });
  append(fontField, [
    el("label", { class: "field__label", for: "font-scale", text: "본문 글자 크기" }),
    select,
  ]);
  wrap.append(fontField);

  return wrap;
}

function toggle(
  title: string,
  hint: string,
  checked: boolean,
  onChange: (value: boolean) => void,
): HTMLElement {
  const id = `toggle-${title.replace(/\s+/g, "-")}`;
  const input = el("input", { type: "checkbox", id, checked });
  input.addEventListener("change", () => onChange(input.checked));
  const box = div("field field--check");
  append(box, [
    el("label", { class: "check", for: id, children: [input, el("span", { text: title })] }),
    p("field__hint", hint),
  ]);
  return box;
}

/* ------------------------------------------------------------------ 개인정보 */

function privacyCard(): HTMLElement {
  return div("stack", [
    p("muted", "이 화면에서 저장하는 것:"),
    el("ul", { class: "privacy__list", children: [
      el("li", { text: "출생 정보 (달력 · 날짜 · 시진 · 자시 기준 · 출생지 · 성별)" }),
      el("li", { text: "화면 설정 (고지 · 대비 · 글자 크기)" }),
    ] }),
    p("muted", "저장하지 않는 것: 계산 결과. 사주도 운세도 저장하지 않습니다. 언제든 다시 계산할 수 있습니다."),
    p("muted", "저장 위치: 이 브라우저의 localStorage. 서버로 보내는 단계가 없고, 계정도 로그인도 없습니다."),
    p("muted", "서로 다른 브라우저나 다른 기기로는 옮겨지지 않습니다."),
    notice("브라우저의 '사이트 데이터 삭제'를 실행하면 함께 지워집니다.", "info"),
  ]);
}
