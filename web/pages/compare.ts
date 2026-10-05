/**
 * 기간 비교.
 *
 * 두 날짜를 놓고 **구조가 어디서 다른지**만 나열한다.
 * 좋은 쪽 / 나쁜 쪽을 정하지 않고, 점수도 만들지 않는다.
 * (사용자가 스스로 판단할 수 있도록 근거를 그대로 보여주는 것이 목적이다)
 */

import { comparePeriods, type CivilDate, type PeriodComparison } from "../../core";
import { el, append, div, p, notice, card } from "../dom";
import { dateKorean } from "../format";
import { dateControls } from "../components";
import type { App } from "../app";

export function renderCompare(app: App): HTMLElement {
  const result = app.result();
  const a = app.state.date;
  const b = shiftDays(a, 30);

  const stack = div("stack stack--varying");
  const host = div("stack");

  stack.append(
    div("toolbar", [
      el("h1", { class: "page-title", text: "기간 비교" }),
      p("muted", "두 시점의 구조 차이를 나열합니다. 점수나 좋고 나쁨은 만들지 않습니다."),
    ]),
  );
  stack.append(host);

  render(host, a, b);
  return stack;

  function render(target: HTMLElement, dateA: CivilDate, dateB: CivilDate): void {
    const comparison = comparePeriods(result, dateA, dateB);
    target.replaceChildren(
      card("비교할 두 날짜", [
        div("compare__dates", [
          div("compare__side", [
            el("h2", { class: "compare__sideTitle", text: "A" }),
            dateControls(dateA, (d) => render(host, d, dateB)),
          ]),
          div("compare__side", [
            el("h2", { class: "compare__sideTitle", text: "B" }),
            dateControls(dateB, (d) => render(host, dateA, d)),
          ]),
        ]),
        presets(dateA),
      ]),
      structureCard(comparison),
      interactionCard(comparison),
    );
  }

  /** A 를 기준으로 B 를 옮기는 바로 가기. */
  function presets(dateA: CivilDate): HTMLElement {
    const wrap = div("compare__presets");
    const options: readonly [string, number][] = [
      ["하루 뒤와 비교", 1],
      ["7일 뒤와 비교", 7],
      ["1달 뒤와 비교", 30],
      ["1년 뒤와 비교", 365],
    ];
    for (const [label, days] of options) {
      wrap.append(
        el("button", {
          type: "button",
          class: "btn btn--ghost",
          text: label,
          onclick: () => render(host, dateA, shiftDays(dateA, days)),
        }),
      );
    }
    return wrap;
  }
}

/* ------------------------------------------------------------------ 조각 */

function structureCard(c: PeriodComparison): HTMLElement {
  const table = el("table", { class: "compare" });
  append(table, [el("caption", { class: "visually-hidden", text: "두 기간의 구조 비교 표" })]);

  const head = el("tr");
  append(head, [
    el("th", { scope: "col", text: "항목" }),
    el("th", { scope: "col", text: `A · ${dateKorean(c.aDate)}` }),
    el("th", { scope: "col", text: `B · ${dateKorean(c.bDate)}` }),
  ]);
  append(table, [el("thead", { children: [head] })]);

  const body = el("tbody");
  for (const row of c.rows) {
    const tr = el("tr", { class: row.same ? "compare__row--same" : "compare__row--diff" });
    append(tr, [
      el("th", { scope: "row", text: row.label }),
      el("td", { text: row.a }),
      el("td", { text: row.b }),
    ]);
    body.append(tr);
  }
  append(table, [body]);

  return card("구조 차이", [
    p("muted", c.note),
    table,
    p("small muted", "회색으로 흐린 행은 두 시점이 같습니다."),
  ], { id: "compare" });
}

function interactionCard(c: PeriodComparison): HTMLElement {
  const stack = div("stack");
  stack.append(p("muted", "두 기간에 걸친 간(干支)을 공통과 각자 한쪽에만 있는 것으로 나눕니다."));

  stack.append(
    subCard(`두 기간 모두 있는 간 (${c.sharedInteractions.length})`, interactionListOr(c.sharedInteractions)),
  );
  stack.append(
    subCard(`A 에만 있는 간 (${c.onlyA.length})`, interactionListOr(c.onlyA)),
  );
  stack.append(
    subCard(`B 에만 있는 간 (${c.onlyB.length})`, interactionListOr(c.onlyB)),
  );
  return card("간(干支) 비교", [stack], { id: "compare-interactions" });
}

function subCard(title: string, body: HTMLElement): HTMLElement {
  return div("subcard", [el("h3", { class: "subcard__title", text: title }), body]);
}

function interactionListOr(
  items: PeriodComparison["sharedInteractions"],
): HTMLElement {
  if (items.length === 0) return notice("없음", "info");
  const ul = el("ul", { class: "interactions" });
  for (const i of items) {
    const li = el("li", { class: "interactions__item", "data-type": i.type });
    append(li, [
      el("span", { class: "interactions__desc", text: i.description }),
      el("span", { class: "tag tag--detail", text: i.participants.join(" · ") }),
      el("span", { class: "tag tag--rule", text: i.ruleId }),
      p("interactions__interpretation", i.interpretation),
    ]);
    ul.append(li);
  }
  return ul;
}

function shiftDays(d: CivilDate, days: number): CivilDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day) + days * 86_400_000);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}
