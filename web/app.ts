/**
 * 앱 껍데기 — 메뉴, 고지 문구, 화면 전환.
 *
 * 여기에는 명리학 계산이 없다.
 * `core` 의 공개 API 를 호출하고 `web/pages/*` 가 만든 노드를 제자리에 넣는 것만 한다.
 */

import { DISCLAIMER_SHORT, analyzeBirth, todayInKorea, type CivilDate, type SajuResult } from "../core";
import { el, append, div, p, notice, type Child } from "./dom";
import {
  clearBirth,
  loadBirth,
  loadSettings,
  readRoute,
  saveSettings,
  toBirthInput,
  writeRoute,
  type AppState,
  type Settings,
  type StoredBirth,
} from "./state";
import { renderToday } from "./pages/today";
import { renderNatal } from "./pages/natal";
import { renderDaeun } from "./pages/daeun";
import { renderPeriod } from "./pages/period";
import { renderCalendar } from "./pages/calendar";
import { renderCompare } from "./pages/compare";
import { renderBirthForm } from "./pages/birth";
import { renderSettings } from "./pages/settings";
import { glossaryScreen, ruleCatalogView } from "./pages/glossary";

/* ------------------------------------------------------------------ 메뉴 */

interface MenuItem {
  route: string;
  label: string;
  /** 출생 정보가 있어야 열 수 있는 메뉴인가 */
  needsBirth: boolean;
}

export const MENU: readonly MenuItem[] = Object.freeze([
  { route: "today", label: "오늘의 운세", needsBirth: true },
  { route: "natal", label: "내 사주", needsBirth: true },
  { route: "daeun", label: "대운", needsBirth: true },
  { route: "seun", label: "연운", needsBirth: true },
  { route: "wolun", label: "월운", needsBirth: true },
  { route: "ilun", label: "일운", needsBirth: true },
  { route: "calendar", label: "운세 캘린더", needsBirth: true },
  { route: "compare", label: "기간 비교", needsBirth: true },
  { route: "glossary", label: "용어집", needsBirth: false },
  { route: "rules", label: "규칙 카탈로그", needsBirth: false },
  { route: "settings", label: "설정", needsBirth: false },
]);

/* ------------------------------------------------------------------ 앱 */

export interface App {
  state: AppState;
  /** 원국 계산 결과. 무겁기 때문에 입력 값이 같을 때만 다시 만든다. */
  result(): SajuResult;
  setDate(d: CivilDate): void;
  refresh(): void;
  /** 계산 결과 캐시를 비운다. (출생 정보가 바뀐 뒤 호출) */
  invalidate(): void;
}

let cachedInputKey = "";
let cachedResult: SajuResult | null = null;

export function boot(root: HTMLElement): App {
  const stored = loadBirth();
  const state: AppState = {
    birth: stored,
    settings: loadSettings(),
    date: todayInKorea(),
    storageNotice: null,
  };

  const app: App = {
    state,

    result() {
      const birth = state.birth;
      if (!birth) throw new Error("출생 정보가 없습니다.");
      const key = JSON.stringify(birth);
      if (key !== cachedInputKey || cachedResult === null) {
        cachedResult = analyzeBirth(toBirthInput(birth));
        cachedInputKey = key;
      }
      return cachedResult;
    },

    setDate(d) {
      state.date = d;
      draw();
    },

    refresh() {
      applySettings();
      draw();
    },

    invalidate() {
      cachedInputKey = "";
      cachedResult = null;
    },
  };

  function applySettings(): void {
    const root0 = document.documentElement;
    root0.dataset.fontScale = state.settings.fontScale;
    root0.dataset.contrast = state.settings.highContrast ? "high" : "normal";
  }

  function draw(): void {
    const route = readRoute();
    const hasBirth = state.birth !== null;
    const main = el("main", { class: "main", id: "main", tabindex: "-1" });
    const body: Child[] = [];

    if (state.storageNotice) body.push(notice(state.storageNotice, "error"));
    else if (state.settings.showDisclaimer) body.push(p("disclaimer", DISCLAIMER_SHORT));

    if (!hasBirth && MENU.find((m) => m.route === route)?.needsBirth) {
      body.push(emptyState());
    } else {
      body.push(safeRoute(app, route));
    }

    append(main, body);
    root.replaceChildren(header(route, hasBirth), main, footer());
    main.focus({ preventScroll: true });
  }

  applySettings();
  window.addEventListener("hashchange", draw);
  draw();
  return app;
}

/** 계산 중 예기치 못한 오류가 나도 내부 상태(스택·경로)를 그대로 보여주지 않는다. */
function safeRoute(app: App, route: string): Child {
  try {
    return renderRoute(app, route);
  } catch (error) {
    console.warn("[myeong] 화면을 그리지 못했습니다:", error);
    return div("stack", [
      notice("화면을 그리지 못했습니다. 입력 값을 다시 확인해주세요.", "error"),
    ]);
  }
}

function renderRoute(app: App, route: string): Child {
  switch (route) {
    case "birth":
      return renderBirthForm(app);
    case "today":
      return renderToday(app);
    case "natal":
      return renderNatal(app);
    case "daeun":
      return renderDaeun(app);
    case "seun":
    case "wolun":
    case "ilun":
      return renderPeriod(app, route);
    case "calendar":
      return renderCalendar(app);
    case "compare":
      return renderCompare(app);
    case "glossary":
      return glossaryScreen();
    case "rules":
      return ruleCatalogView();
    case "settings":
      return renderSettings(app);
    default:
      return div("stack", [
        notice("없는 화면입니다.", "error"),
        el("a", { class: "btn", href: "#/today", text: "오늘의 운세로" }),
      ]);
  }
}

/* ------------------------------------------------------------------ 머리글 · 바닥글 */

function header(route: string, hasBirth: boolean): HTMLElement {
  const brand = el("a", { class: "brand", href: "#/today" });
  append(brand, [
    el("span", { class: "brand__hanja", text: "命" }),
    el("span", { class: "brand__name", text: "Myeong" }),
    el("span", { class: "brand__sub", text: "사주팔자 · 전통 명리학 계산" }),
  ]);

  const ul = el("ul", { class: "nav__list" });
  for (const item of MENU) {
    if (item.needsBirth && !hasBirth) continue;
    const isCurrent = item.route === route;
    const link = el("a", {
      class: `nav__link${isCurrent ? " nav__link--current" : ""}`,
      href: `#/${item.route}`,
      text: item.label,
      "aria-current": isCurrent ? "page" : undefined,
    });
    ul.append(el("li", { children: [link] }));
  }

  const nav = el("nav", { class: "nav", "aria-label": "주요 메뉴" });
  nav.append(ul);

  const head = el("header", { class: "header" });
  append(head, [brand, nav]);
  return head;
}

function footer(): HTMLElement {
  const foot = el("footer", { class: "footer" });
  append(foot, [
    p("footer__note", "모든 계산은 이 브라우저 안에서만 이루어집니다. 서버로 보내는 단계가 없습니다."),
    p("footer__note", "같은 날짜를 넣으면 웹 화면과 이메일이 같은 결과를 냅니다."),
  ]);
  return foot;
}

function emptyState(): HTMLElement {
  return div("empty", [
    el("h2", { class: "empty__title", text: "아직 출생 정보가 없습니다." }),
    p("muted", "출생 정보를 입력하면 내 사주와 운세를 볼 수 있습니다. 입력한 값은 이 브라우저에만 저장됩니다."),
    el("a", { class: "btn btn--primary", href: "#/birth", text: "출생 정보 입력하기" }),
  ]);
}

/* ------------------------------------------------------------------ 저장 헬퍼 (화면들이 함께 쓴다) */

export function persistSettings(app: App, settings: Settings): void {
  app.state.settings = settings;
  const problem = saveSettings(settings);
  app.state.storageNotice = problem;
  app.refresh();
}

export function persistBirth(app: App, birth: StoredBirth | null): void {
  app.state.birth = birth;
  app.invalidate();
  app.state.storageNotice = birth === null ? clearBirth() : null;
  writeRoute("today");
  app.refresh();
}

export { writeRoute };
