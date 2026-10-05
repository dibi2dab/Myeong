/**
 * 여러 화면이 함께 쓰는 조각.
 *
 * 여기에는 "조립"만 있다.
 *  - 계산은 `core`
 *  - 표기는 `web/format`
 *  - 구조는 `web/dom`
 * 이 파일은 셋을 이어 붙이는 역할만 한다.
 */

import {
  DRILLDOWN_CHAIN,
  INTENSITY_LABELS,
  RULES,
  TERMS,
  ruleById,
  termByName,
  type Caution,
  type CivilDate,
  type Evidence,
  type FiveElement,
  type FortuneSection,
  type Intensity,
  type KeyPoint,
  type Layer,
  type RuleDoc,
  type TermDoc,
} from "../core";
import type { DrilldownStep } from "../core/interpretation/reading";
import type { Interaction } from "../core/interactions/interactions";
import { el, append, card, list, div, span, p, notice, type Child } from "./dom";
import { elementList, elementTag } from "./format";

/* ------------------------------------------------------------------ 용어 · 규칙 */

/**
 * 클릭하면 설명이 열리는 요소.
 * 링크처럼 보이지만 실제로는 `<button>` 다. (키보드 접근·스크린리더)
 */
export function termLink(name: string): HTMLElement {
  const doc = termByName(name);
  const button = el("button", {
    type: "button",
    class: doc ? "term-link" : "term-link term-link--plain",
    "aria-label": doc ? `${name} — 용어 설명 보기` : name,
    text: name,
    disabled: !doc,
  });
  if (doc) button.addEventListener("click", () => openTermDialog(doc));
  return button;
}

/** 용어 설명 팝오버. 한 번에 하나만 떠 있다. */
export function openTermDialog(doc: TermDoc): void {
  const body = div("dialog__body", [
    p("dialog__meta", `${doc.category} · ${doc.hanja}`),
    p("dialog__short", doc.short),
    p("dialog__detail", doc.detail),
  ]);

  if (doc.seeAlso.length > 0) {
    const see = p("dialog__seealso");
    see.append(el("span", { class: "dialog__label", text: "같이 보기: " }));
    doc.seeAlso.forEach((name, i) => {
      if (i > 0) see.append(el("span", { text: " · " }));
      see.append(termLink(name));
    });
    body.append(see);
  }

  openDialog({ title: doc.term, ariaLabel: `${doc.term} 용어 설명`, body });
}

/** 규칙 설명 팝오버. (규칙 ID 를 눌렀을 때) */
export function openRuleDialog(rule: RuleDoc): void {
  const dl = el("dl", { class: "deflist" });
  const add = (dt: string, dd: string): void => {
    dl.append(el("dt", { text: dt }), el("dd", { text: dd }));
  };
  add("정의", rule.definition);
  add("기준", rule.criteria);
  add("해석", rule.interpretation);

  openDialog({
    title: rule.title,
    ariaLabel: `${rule.id} 규칙 설명`,
    body: div("dialog__body", [p("dialog__meta", rule.category), dl]),
  });
}

/**
 * 설명 팝오버를 띄운다. 한 번에 하나만 떠 있다.
 * `Escape` 와 배경 클릭으로 닫고, 열자마자 닫기 버튼에 포커스를 준다.
 */
function openDialog(options: { title: string; ariaLabel: string; body: HTMLElement }): void {
  const existing = document.querySelector(".dialog-backdrop");
  if (existing) existing.remove();

  const close = (): void => {
    dialog.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") close();
  };

  const closeButton = el("button", { type: "button", class: "btn", text: "닫기", onclick: close });
  const box = el("div", {
    class: "dialog",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": options.ariaLabel,
  });
  append(box, [el("h2", { class: "dialog__title", text: options.title }), options.body, closeButton]);

  const dialog = el("div", {
    class: "dialog-backdrop",
    onclick: (ev: Event) => {
      if (ev.target === dialog) close();
    },
  });
  dialog.append(box);
  document.body.append(dialog);
  closeButton.focus();
  document.addEventListener("keydown", onKey);
}

/**
 * 규칙 ID 태그. 눌러서 그 규칙의 정의 · 기준 · 해석을 그대로 보여준다.
 * (조건을 다시 만들어 내지 않는다. `data/rules/rules.ts` 에 적힌 문장을 쓴다)
 */
export function ruleTag(ruleId: string): HTMLElement {
  const rule = ruleById(ruleId);
  const button = el("button", {
    type: "button",
    class: "term-link",
    "aria-label": rule ? `${ruleId} — 규칙 설명 보기` : ruleId,
    text: ruleId,
    disabled: !rule,
  });
  if (rule) button.addEventListener("click", () => openRuleDialog(rule));
  return span("tag tag--rule", [button]);
}

/* ------------------------------------------------------------------ 분석 근거 */

/**
 * "근거 보기" — 규칙 ID · 계층 · 위치가 붙은 근거 목록을 접이식으로 보여준다.
 *
 * Myeong 의 핵심 약속: 해석(해석)과 근거(근거)를 **항상 함께** 내놓는다.
 * 사용자가 기세 하나만 믿고 넘어가지 않도록, 근거는 기본값으로 접어 둔다.
 */
export function evidenceBlock(items: readonly EvidenceLike[], label = "근거 보기"): HTMLElement {
  if (items.length === 0) {
    return p("muted", "이 항목에서 두드러지는 근거가 없습니다. 특별한 신호가 잡히지 않았다는 뜻입니다.");
  }

  const listEl = el("ul", { class: "evidence" });
  for (const item of items) {
    const li = el("li", { class: "evidence__item" });
    li.append(p("evidence__text", item.text));
    li.append(
      span("evidence__meta", [
        span("tag tag--layer", item.layer),
        span("tag tag--detail", item.detail),
        ruleTag(item.ruleId),
      ]),
    );

    if ("interaction" in item && item.interaction) {
      const interaction = item.interaction;
      li.append(p("evidence__explain", interaction.interpretation));
      if (interaction.conditions.length > 0) {
        const cond = p("evidence__cond");
        cond.append(el("span", { class: "muted", text: "성립 조건: " }));
        cond.append(document.createTextNode(interaction.conditions.join(" · ")));
        li.append(cond);
      }
    }

    if ("severity" in item) {
      li.append(span("tag tag--severity", `주의 강도 ${item.severity}/3`));
    }

    if ("topics" in item && item.topics.length > 0) {
      li.append(p("evidence__topics", `이 요약이 끌어올린 항목: ${item.topics.join(", ")}`));
    }

    listEl.append(li);
  }

  const details = el("details", { class: "evidence-box" });
  append(details, [
    el("summary", { class: "evidence-box__summary", text: `${label} (${items.length}건)` }),
    listEl,
  ]);
  return details;
}

/** 근거로 표시할 수 있는 세 종류(근거 · 주의점 · 핵심 포인트)의 공통 부분. */
type EvidenceLike = Evidence | Caution | KeyPoint;

/* ------------------------------------------------------------------ 운세 항목 */

/** 기세 배지. 숫자나 점수 없이 다섯 단계 범주만 쓴다. */
export function intensityBadge(intensity: Intensity): HTMLElement {
  return el("span", {
    class: "badge badge--intensity",
    "data-intensity": intensity,
    text: INTENSITY_LABELS[intensity],
  });
}

/** 운세 8개 항목 카드 하나. */
export function fortuneSectionCard(section: FortuneSection): HTMLElement {
  const badges = span("section__badges", [
    intensityBadge(section.intensity),
    span("badge", section.direction),
  ]);

  return card(undefined, [
    div("section__head", [
      el("h3", { class: "section__title", text: section.topic }),
      badges,
    ]),
    p("section__label", "[해석]"),
    p("section__interpretation", section.interpretation),
    p("section__label", "[분석 근거]"),
    evidenceBlock(section.evidence, "이 항목의 근거"),
  ]);
}

/** 오늘의 운세 → 일운 → 월운 → 세운 → 대운 → 원국. */
export function drilldownBox(steps: readonly DrilldownStep[]): HTMLElement {
  const ol = el("ol", { class: "drilldown" });
  for (const step of steps) {
    const li = el("li", { class: "drilldown__step", "data-layer": step.layer });
    append(li, [
      span("drilldown__layer", step.layer),
      span("drilldown__gz", step.ganZhi),
      span("drilldown__meta", `${step.tenGod} · ${step.element} · ${step.stage}`),
      span("drilldown__count", step.evidenceCount > 0 ? `근거 ${step.evidenceCount}건` : "근거 없음"),
    ]);
    ol.append(li);
  }
  return div("drilldown-box", [
    p("muted", `${DRILLDOWN_CHAIN.join(" → ")} 순으로 좁혀 봅니다.`),
    ol,
  ]);
}

/* ------------------------------------------------------------------ 오행 분포 */

/** 오행 세력 막대. 비율(%)만 보여주고 점수·등급은 만들지 않는다. */
export function elementBars(
  contributions: readonly {
    element: FiveElement;
    ratio: number;
    sources: readonly string[];
  }[],
): HTMLElement {
  const wrap = div("elements");
  for (const c of contributions) {
    const bar = div("elements__bar");
    bar.dataset.element = c.element;
    bar.style.width = `${Math.max(1.5, c.ratio).toFixed(1)}%`;

    const src = el("details", { class: "elements__src" });
    append(src, [
      el("summary", { text: "이 값의 출처" }),
      el("ul", { children: c.sources.map((s) => el("li", { text: s })) }),
    ]);

    wrap.append(
      div("elements__row", [
        elementTag(c.element),
        div("elements__track", [bar]),
        span("elements__ratio", `${c.ratio.toFixed(1)}%`),
        src,
      ]),
    );
  }
  return wrap;
}

/** 오행 분포 한 줄 요약 (가장 강함 · 가장 약함 · 아예 없는 오행). */
export function elementSummary(distribution: {
  strongest: FiveElement;
  weakest: FiveElement;
  missing: readonly FiveElement[];
}): HTMLElement {
  const wrap = div("elements__summary");
  const line = (label: string, elements: readonly FiveElement[]): HTMLElement => {
    const row = span("elements__summary-line");
    row.append(el("span", { class: "muted", text: `${label}: ` }));
    row.append(elementList(elements));
    return row;
  };
  wrap.append(line("가장 강함", [distribution.strongest]));
  wrap.append(line("가장 약함", [distribution.weakest]));
  if (distribution.missing.length > 0) {
    wrap.append(line("사주에 한 번도 나오지 않는 오행", distribution.missing));
  }
  return wrap;
}

/* ------------------------------------------------------------------ 절지 · 월령 */

export function voidBranchesLine(branchPair: readonly string[]): HTMLElement {
  const pEl = p("inline-note");
  append(pEl, [
    el("span", { class: "muted", text: "절지(旬空) " }),
    el("strong", { text: branchPair.join(" · ") }),
    document.createTextNode(" — 이 두 자리는 기운이 비어 있다고 봅니다."),
  ]);
  return pEl;
}

export function moonCommandLine(moonCommand: {
  branch: string;
  seasonKorean: string;
  wangElement: FiveElement;
  description: string;
}): HTMLElement {
  const pEl = p("inline-note");
  append(pEl, [
    el("span", { class: "muted", text: "월령 " }),
    el("strong", { text: `${moonCommand.branch}월 (${moonCommand.seasonKorean})` }),
    document.createTextNode(" — 이 계절에 가장 실한 오행은 "),
    elementTag(moonCommand.wangElement),
    document.createTextNode(`. ${moonCommand.description}`),
  ]);
  return pEl;
}

/* ------------------------------------------------------------------ 간(干支) 목록 */

/** 합 · 충 · 형 · 파 · 해 를 간지로 보여준다. */
export function interactionList(interactions: readonly Interaction[]): HTMLElement {
  if (interactions.length === 0) {
    return p("muted", "붙어 있는 간(干支)이 없습니다.");
  }
  const ul = el("ul", { class: "interactions" });
  for (const i of interactions) {
    const li = el("li", { class: "interactions__item", "data-type": i.type });
    append(li, [
      span("interactions__desc", i.description),
      span("tag tag--detail", i.participants.join(" · ")),
      ruleTag(i.ruleId),
      p("interactions__interpretation", i.interpretation),
    ]);
    if (i.conditions.length > 0) {
      const cond = p("interactions__cond");
      cond.append(el("span", { class: "muted", text: "성립 조건: " }));
      cond.append(document.createTextNode(i.conditions.join(" · ")));
      li.append(cond);
    }
    ul.append(li);
  }
  return ul;
}

/* ------------------------------------------------------------------ 용어집 · 규칙 카탈로그 */

export function glossaryView(): HTMLElement {
  const listWrap = div("glossary__list");
  const count = p("muted glossary__count", { role: "status" });

  const render = (query: string): void => {
    const q = query.trim();
    const matched = q === "" ? TERMS : TERMS.filter((t) => t.term.includes(q) || t.hanja.includes(q));
    count.textContent = q === "" ? `전체 ${TERMS.length}개` : `${matched.length}개 일치`;

    if (matched.length === 0) {
      listWrap.replaceChildren(notice(`"${q}" 에 해당하는 용어가 없습니다.`, "info"));
      return;
    }

    const entries = matched.map((t) => {
      const head = el("h3", { class: "glossary__term" });
      append(head, [
        el("span", { class: "glossary__name", text: t.term }),
        el("span", { class: "glossary__hanja", text: t.hanja }),
      ]);
      const cat = p("glossary__cat");
      append(cat, [el("span", { class: "muted", text: "분류: " }), el("span", { text: t.category })]);
      return el("li", {
        class: "glossary__entry",
        children: [head, p("glossary__short", t.short), p("glossary__detail", t.detail), cat],
      });
    });
    listWrap.replaceChildren(list(entries, "glossary__items"));
  };

  const search = el("input", {
    type: "search",
    class: "input",
    id: "glossary-search",
    placeholder: "예: 용신, 자시, 십이운성, 대설",
    autocomplete: "off",
  });
  search.addEventListener("input", () => render(search.value));
  render("");

  return div("stack", [
    card("용어 찾기", [
      el("label", { class: "field__label", for: "glossary-search", text: "용어 검색" }),
      search,
      count,
    ], { id: "glossary-find" }),
    card("용어집", [listWrap], { id: "glossary" }),
  ]);
}

export function ruleCatalogView(): HTMLElement {
  const byCategory = new Map<string, RuleDoc[]>();
  for (const r of RULES) {
    const bucket = byCategory.get(r.category) ?? [];
    bucket.push(r);
    byCategory.set(r.category, bucket);
  }

  const cards: HTMLElement[] = [];
  for (const [category, rules] of byCategory) {
    const items = rules.map((r) => {
      const head = el("h3", { class: "rule__title" });
      append(head, [el("code", { class: "rule__id", text: r.id }), el("span", { text: ` ${r.title}` })]);
      const dl = el("dl", { class: "rule__body" });
      const add = (dt: string, dd: string): void => {
        dl.append(el("dt", { text: dt }), el("dd", { text: dd }));
      };
      add("정의", r.definition);
      add("기준", r.criteria);
      add("해석", r.interpretation);
      return el("li", { class: "rule", children: [head, dl] });
    });
    cards.push(card(`${category} (${rules.length})`, [list(items, "rules")]));
  }

  return div("stack", [
    notice(`Myeong은 아래 ${RULES.length}개 규칙만 사용합니다. 화면에 나오는 모든 규칙 ID 는 이 목록에 있습니다.`),
    ...cards,
  ]);
}

/* ------------------------------------------------------------------ 날짜 컨트롤 */

/** 하루씩 옮기는 버튼 + 날짜 입력. */
export function dateControls(
  date: CivilDate,
  onChange: (d: CivilDate) => void,
  options: { today?: CivilDate; label?: string } = {},
): HTMLElement {
  const input = el("input", {
    type: "date",
    class: "input daystepper__input",
    value: toIso(date),
    min: "1900-01-01",
    max: "2100-12-31",
    "aria-label": options.label ?? "날짜 선택",
  });
  input.addEventListener("change", () => {
    const parsed = fromIso(input.value);
    if (parsed) onChange(parsed);
    else input.value = toIso(date);
  });

  const shift = (days: number) => () => onChange(addDays(date, days));
  const wrap = div("daystepper");
  append(wrap, [
    el("button", { type: "button", class: "btn", text: "◀ 어제", onclick: shift(-1) }),
    input,
    el("button", { type: "button", class: "btn", text: "내일 ▶", onclick: shift(1) }),
  ]);
  if (options.today) {
    wrap.append(
      el("button", {
        type: "button",
        class: "btn",
        text: "오늘로",
        onclick: () => onChange(options.today!),
      }),
    );
  }
  return wrap;
}

export function toIso(d: CivilDate): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
}

export function fromIso(value: string): CivilDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  return d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= 31 ? d : null;
}

/** 날짜에 일수를 더한다. 달력 계산(Core)과 같은 규칙. */
export function addDays(d: CivilDate, days: number): CivilDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day) + days * 86_400_000);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/* ------------------------------------------------------------------ 작은 조각 */

/** 표의 정의 목록을 만든다. */
export function defList(entries: readonly (readonly [string, Child])[]): HTMLElement {
  const dl = el("dl", { class: "deflist" });
  for (const [label, value] of entries) {
    dl.append(el("dt", { text: label }), el("dd", { children: [value] }));
  }
  return dl;
}

/** `표시: 값` 형태의 한 줄. */
export function line(label: string, value: Child): HTMLElement {
  return div("line", [el("span", { class: "line__label", text: label }), span("line__value", [value])]);
}

export { card, list, div, span, p, el, append, notice };
export type { Child, Layer, Intensity };
