/**
 * 화면 공통 표기 규칙.
 *
 * 계산(Core)과 화면(UI)이 같은 값을 다르게 보이지 않도록,
 * 오행·십신·간지·날짜 같은 표기를 **한 곳에서만** 만든다.
 * 이 파일에는 명리학 계산이 없다. 이미 계산된 값을 글자로 바꿀 뿐이다.
 * (십신처럼 파생 값이 필요한 경우에만 `core` 의 순수 표 함수를 빌려 쓴다.)
 */

import {
  ELEMENT_KOREAN,
  formatCivilDate,
  type CivilDate,
  type FiveElement,
  type HeavenlyStem,
} from "../core";
import type { Pillar, PillarPosition } from "../core";
import type { PeriodPillar } from "../core/periods/period";
import type { HiddenStem } from "../core/hidden_stems/hiddenStems";
import { tenGodOfStem, type TenGod } from "../core/ten_gods/tenGods";
import { el, append, type Child } from "./dom";

/* ------------------------------------------------------------------ 오행 */

/** 오행 한 글자를 화면용 조각으로. 색은 `data-element` 속성 → CSS 규칙으로 정한다. */
export function elementTag(element: FiveElement): HTMLElement {
  return el("span", { class: "el", "data-element": element, text: ELEMENT_KOREAN[element] });
}

/** 오행 여러 개를 "목 · 화 · 토" 형태로. */
export function elementList(elements: readonly FiveElement[]): DocumentFragment {
  const f = document.createDocumentFragment();
  elements.forEach((e, i) => {
    if (i > 0) f.append(document.createTextNode(" · "));
    f.append(elementTag(e));
  });
  return f;
}

/* ------------------------------------------------------------------ 간지 글자 */

/** 천간 한 글자. 천간의 오행 색을 쓴다. */
export function stemCell(stem: HeavenlyStem, element: FiveElement): HTMLElement {
  return el("span", {
    class: "gz gz--stem",
    "data-element": element,
    "aria-label": `${stem} · ${ELEMENT_KOREAN[element]}`,
    text: stem,
  });
}

/** 지지 한 글자. 지지의 본기 오행 색을 쓴다. */
export function branchCell(branch: string, element: FiveElement): HTMLElement {
  return el("span", {
    class: "gz gz--branch",
    "data-element": element,
    "aria-label": `${branch} · ${ELEMENT_KOREAN[element]}`,
    text: branch,
  });
}

/** 천간+지지를 나란히. */
export function ganZhiPair(stem: HeavenlyStem, stemEl: FiveElement, branch: string, branchEl: FiveElement): HTMLElement {
  const span = el("span", { class: "gz-pair" });
  append(span, [stemCell(stem, stemEl), branchCell(branch, branchEl)]);
  return span;
}

/* ------------------------------------------------------------------ 지장간 */

/**
 * 지장간 목록. 본기 / 중기 / 여기 층을 함께 보여준다.
 * `tenGods` 를 주면 지장간 천간의 십신도 함께 붙인다. (원국·운 표기 모두 길이 = hidden.length)
 */
export function hiddenList(hidden: readonly HiddenStem[], tenGods?: readonly string[]): HTMLElement {
  const ul = el("ul", { class: "hidden-stems" });
  hidden.forEach((h, i) => {
    const parts: Child[] = [elementTag(h.element), el("span", { class: "hs-stem", text: h.stem })];
    if (tenGods) parts.push(el("span", { class: "tg", text: tenGods[i] ?? "" }));
    parts.push(el("span", { class: "hs-layer", text: h.layer }));
    ul.append(el("li", { class: "hidden-stems__item", children: parts }));
  });
  return ul;
}

/** 원국의 지장간 십신. (Pillar 에는 지장간만 있고 십신은 따로 계산된다) */
export function hiddenTenGodsOf(pillar: Pillar, dayMaster: HeavenlyStem): string[] {
  return pillar.hidden.map((h) => tenGodOfStem(dayMaster, h.stem));
}

/* ------------------------------------------------------------------ 원국 4기둥 표 */

const PILLAR_LABELS: Readonly<Record<PillarPosition, string>> = Object.freeze({
  year: "년주",
  month: "월주",
  day: "일주",
  hour: "시주",
});

export function pillarLabel(position: PillarPosition): string {
  return PILLAR_LABELS[position];
}

/** 원국의 년·월·일·시 네 기둥 표. (시주 미상이면 세 칸만 그린다) */
export function pillarTable(pillars: readonly Pillar[], dayMaster: HeavenlyStem, caption: string): HTMLElement {
  const table = el("table", { class: "pillars" });
  append(table, [el("caption", { class: "visually-hidden", text: caption })]);

  const head = el("tr");
  append(head, [el("th", { scope: "col", class: "pillars__corner", text: "구분" })]);
  for (const p of pillars) {
    const th = el("th", { scope: "col", class: "pillars__head" });
    th.append(el("span", { class: "pillars__label", text: PILLAR_LABELS[p.position] }));
    if (p.position === "day") th.append(el("span", { class: "pillars__badge", text: "일간" }));
    append(head, [th]);
  }
  append(table, [el("thead", { children: [head] })]);

  const body = el("tbody");
  append(body, [
    pillarRow("천간", pillars, (p) => stemCell(p.stem, p.element)),
    pillarRow("천간 십신", pillars, (p) => el("span", { class: "tg", text: p.tenGod })),
    pillarRow("지지", pillars, (p) => branchCell(p.branch, p.branchElement)),
    pillarRow("지장간", pillars, (p) => hiddenList(p.hidden, hiddenTenGodsOf(p, dayMaster))),
    pillarRow("지지 십이운성", pillars, (p) => el("span", { class: "stage", text: p.stage.key })),
  ]);
  append(table, [body]);
  return table;
}

function pillarRow(
  label: string,
  pillars: readonly Pillar[],
  cell: (p: Pillar) => Child,
): HTMLTableRowElement {
  const tr = el("tr");
  append(tr, [el("th", { scope: "row", class: "pillars__rowhead", text: label })]);
  for (const p of pillars) append(tr, [el("td", { class: "pillars__cell", children: [cell(p)] })]);
  return tr;
}

/* ------------------------------------------------------------------ 운(대운·세운·월운·일운) 표 */

const PERIOD_LABELS: Readonly<Record<PeriodPillar["kind"], string>> = Object.freeze({
  daeun: "대운",
  seun: "연운",
  wolun: "월운",
  ilun: "일운",
});

export function periodLabel(kind: PeriodPillar["kind"]): string {
  return PERIOD_LABELS[kind];
}

/** 여러 운 계층을 한 표로 비교해 보여준다. */
export function periodTable(periods: readonly PeriodPillar[], caption: string): HTMLElement {
  const table = el("table", { class: "periods" });
  append(table, [el("caption", { class: "visually-hidden", text: caption })]);

  const head = el("tr");
  append(head, [el("th", { scope: "col", class: "pillars__corner", text: "구분" })]);
  for (const p of periods) append(head, [el("th", { scope: "col", text: PERIOD_LABELS[p.kind] })]);
  append(table, [el("thead", { children: [head] })]);

  const body = el("tbody");
  append(body, [
    periodRow("간지", periods, (p) => ganZhiPair(p.stem, p.element, p.branch, p.branchElement)),
    periodRow("천간 십신", periods, (p) => el("span", { class: "tg", text: p.tenGod })),
    periodRow("십신 계열", periods, (p) => el("span", { class: "tg-group", text: p.tenGodGroup })),
    periodRow("십이운성", periods, (p) => el("span", { class: "stage", text: p.stage.key })),
    periodRow("지장간", periods, (p) => hiddenList(p.hidden, p.hiddenTenGods)),
  ]);
  append(table, [body]);
  return table;
}

function periodRow(
  label: string,
  periods: readonly PeriodPillar[],
  cell: (p: PeriodPillar) => Child,
): HTMLTableRowElement {
  const tr = el("tr");
  append(tr, [el("th", { scope: "row", text: label })]);
  for (const p of periods) append(tr, [el("td", { children: [cell(p)] })]);
  return tr;
}

/* ------------------------------------------------------------------ 날짜 · 시각 */

export function dateText(d: CivilDate): string {
  return formatCivilDate(d);
}

export function dateKorean(d: CivilDate): string {
  return `${d.year}년 ${d.month}월 ${d.day}일`;
}

/** KST 벽시계 시각. 절기 시각 같은 "정확한 순간" 표기에 쓴다. */
export function kstTimeText(t: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.year}-${p(t.month)}-${p(t.day)} ${p(t.hour)}:${p(t.minute)} (KST)`;
}

/* ------------------------------------------------------------------ misc */

export function tenGodTag(god: TenGod): HTMLElement {
  return el("span", { class: "tg", text: god });
}
