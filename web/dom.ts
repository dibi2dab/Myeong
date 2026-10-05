/**
 * 화면을 만들 때 쓰는 아주 작은 DOM 헬퍼.
 *
 *innerHTML 로 문자열을 끼워 넣지 않는다. 사용자가 입력한 값(출생지 등)을
 * 그대로 텍스트 노드로 넣으므로 XSS 나 주입을 걱정할 필요가 없고,
 * 장황한 문자열 조립용 HTML 템플릿도 사라진다.
 */

export type Child = Node | string | number | null | undefined | false;

/** 두 번째 자리의 값. 자식이거나, 추가 속성이거나, 없거나. */
export type Children = Child | readonly Child[] | ElementOptions | undefined;

function isOptions(value: unknown): value is ElementOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Node)
  );
}

/** 자식 하나든 배열이든, 속성 객체면 빈 배열로 펴 준다. */
function split(second: Children): { children: (Child | readonly Child[])[] | undefined; attrs: ElementOptions } {
  if (isOptions(second)) return { children: undefined, attrs: second };
  if (second === undefined) return { children: undefined, attrs: {} };
  return { children: Array.isArray(second) ? second : [second as Child], attrs: {} };
}

/** 자식들을 넣는다. 문자열·숫자는 항상 텍스트 노드로 취급한다. 배열은 한 단계 더 펴 준다. */
export function append(
  el: HTMLElement | DocumentFragment,
  children: readonly (Child | readonly Child[])[],
): void {
  for (const child of children) {
    if (isChildList(child)) append(el, child);
    else if (child !== null && child !== undefined && child !== false) {
      el.append(typeof child === "object" ? child : document.createTextNode(String(child)));
    }
  }
}

function isChildList(value: Child | readonly Child[]): value is readonly Child[] {
  return Array.isArray(value);
}

export interface ElementOptions {
  class?: string;
  text?: string;
  children?: readonly (Child | readonly Child[])[];
  /** `on*` 접두 이벤트 핸들러. 예: { onclick: fn } */
  [key: string]: unknown;
}

/**
 * 요소를 만든다.
 *
 * ```
 * div({ class: "card", children: [h2({ text: "내 사주" }), "내용"] })
 * ```
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: className, text, children, ...rest } = options;
  if (className) node.className = className;
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2), value as EventListener);
    } else if (key === "value" && node instanceof HTMLInputElement) {
      node.value = String(value);
    } else if (key === "checked" && node instanceof HTMLInputElement) {
      node.checked = Boolean(value);
    } else if (key === "disabled" && node instanceof HTMLButtonElement) {
      node.disabled = Boolean(value);
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  if (text !== undefined) node.textContent = text;
  if (children) append(node, children);
  return node;
}

/** container 를 비우고 새 자식들로 채운다. 중첩 배열은 `append` 가 펴 준다. */
export function mount(container: HTMLElement, ...children: readonly (Child | readonly Child[])[]): void {
  container.replaceChildren();
  append(container, children);
}

export function frag(children: readonly (Child | readonly Child[])[]): DocumentFragment {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

/* ------------------------------------------------------------------ 공통 조각 */

/** 섹션 카드. `title` 이 있으면 머리글을 붙인다. */
export function card(
  title: string | undefined,
  children: readonly Child[],
  options: { id?: string; describedBy?: string } = {},
): HTMLElement {
  const head = title
    ? el("h2", { class: "card__title", text: title, id: options.id ? `${options.id}-title` : undefined })
    : null;
  const section = el("section", {
    class: "card",
    "aria-labelledby": head && options.id ? `${options.id}-title` : undefined,
    id: options.id,
  });
  append(section, [head, el("div", { class: "card__body", children })]);
  return section;
}

/** 정의 목록 한 줄. */
export function row(label: string, value: Child): HTMLElement {
  const wrap = el("div", { class: "row" });
  wrap.append(el("dt", { text: label }), el("dd", { children: [value] }));
  return wrap;
}

/** 목록을 `<ul>` 로 감싼다. */
export function list(items: readonly Child[], className = ""): HTMLUListElement {
  const ul = el("ul", { class: className });
  append(ul, items.map((i) => el("li", { children: [i] })));
  return ul;
}

/* ------------------------------------------------------------------ 짧은 별칭 */

/**
 * `<div class="…">` 를 만든다. 화면 코드가 대부분 이 형태로 끝난다.
 * 자식은 하나만 줘도 되고 배열로 줘도 된다. 속성 객체를 주면 그것도 함께 넣는다.
 */
export function div(className: string, second?: Children): HTMLDivElement {
  const { children, attrs } = split(second);
  return el("div", { ...attrs, class: className, children });
}

/** `<span class="…">` 를 만든다. */
export function span(className: string, second?: Children): HTMLSpanElement {
  const { children, attrs } = split(second);
  return el("span", { ...attrs, class: className, children });
}

/** `<p class="…">` 를 만든다. */
export function p(className: string, second?: Children): HTMLParagraphElement {
  const { children, attrs } = split(second);
  return el("p", { ...attrs, class: className, children });
}

/** 사용자에게 보여줄 오류 / 안내 박스. */
export function notice(message: string, kind: "error" | "info" = "info"): HTMLElement {
  return el("p", {
    class: `notice notice--${kind}`,
    role: kind === "error" ? "alert" : "status",
    text: message,
  });
}
