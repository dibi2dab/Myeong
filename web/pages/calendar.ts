/**
 * 운세 캘린더.
 *
 * 하루를 칸 하나, 한 달을 달력 하나로 그린다.
 * 각 칸에는 그날의 일진과 총운 기세만 아주 작게 넣는다. (읽히는 정보를 늘리지 않는다)
 * 어떤 칸이든 눌러 그날의 전체 운세(오늘의 운세 화면)로 넘어간다.
 */

import { analyzeFortune, todayInKorea, type CivilDate } from "../../core";
import { el, append, div, p, card } from "../dom";
import { dateKorean } from "../format";
import { intensityBadge } from "../components";
import type { App } from "../app";

/** 요일 이름 (일요일 부터). */
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function renderCalendar(app: App): HTMLElement {
  const anchor = app.state.date;
  const stack = div("stack stack--varying");

  stack.append(
    div("toolbar", [
      monthNav(app, anchor),
      el("h1", { class: "page-title", text: "운세 캘린더" }),
      p("muted", `${anchor.year}년 ${anchor.month}월 · 일진은 한국 시간 자정 기준`),
    ]),
  );

  stack.append(card("달력", [monthGrid(app, anchor)]));

  const today = todayInKorea();
  if (today.year !== anchor.year || today.month !== anchor.month) {
    stack.append(
      el("a", {
        class: "btn",
        href: "#/today",
        text: "오늘로 돌아가기",
        onclick: () => app.setDate(today),
      }),
    );
  }

  return stack;
}

/* ------------------------------------------------------------------ 조각 */

function monthNav(app: App, anchor: CivilDate): HTMLElement {
  const prev = shiftMonth(anchor, -1);
  const next = shiftMonth(anchor, 1);
  return div("calnav", [
    el("button", { type: "button", class: "btn", text: "◀ 이전 달", onclick: () => app.setDate({ ...prev, day: 1 }) }),
    el("span", { class: "calnav__label", text: `${anchor.year}년 ${anchor.month}월` }),
    el("button", { type: "button", class: "btn", text: "다음 달 ▶", onclick: () => app.setDate({ ...next, day: 1 }) }),
    monthInput(app, anchor),
  ]);
}

function monthInput(app: App, anchor: CivilDate): HTMLElement {
  const input = el("input", {
    type: "month",
    class: "input calnav__input",
    value: `${anchor.year}-${String(anchor.month).padStart(2, "0")}`,
    "aria-label": "달 선택",
  });
  input.addEventListener("change", () => {
    const m = /^(\d{4})-(\d{2})$/.exec(input.value);
    if (m) app.setDate({ year: Number(m[1]), month: Number(m[2]), day: 1 });
  });
  return input;
}

function shiftMonth(d: CivilDate, delta: number): CivilDate {
  const m = d.month + delta;
  if (m < 1) return { year: d.year - 1, month: 12, day: 1 };
  if (m > 12) return { year: d.year + 1, month: 1, day: 1 };
  return { year: d.year, month: m, day: 1 };
}

function monthGrid(app: App, anchor: CivilDate): HTMLElement {
  const result = app.result();
  const first = { year: anchor.year, month: anchor.month, day: 1 };
  const today = todayInKorea();

  // 그 달의 첫날이 무슨 요일인지. 1970-01-01 이 목요일(4) 이 기준.
  const firstWeekday = weekdayOf(first);
  const daysInMonth = new Date(Date.UTC(anchor.year, anchor.month, 0)).getUTCDate();

  const table = el("table", { class: "cal", "aria-label": `${anchor.year}년 ${anchor.month}월 운세 캘린더` });
  const head = el("tr");
  for (const w of WEEKDAYS) head.append(el("th", { scope: "col", class: "cal__wd", text: w }));
  append(table, [el("thead", { children: [head] })]);

  const body = el("tbody");
  let row = el("tr");
  for (let i = 0; i < firstWeekday; i += 1) row.append(el("td", { class: "cal__cell cal__cell--empty" }));

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = { year: anchor.year, month: anchor.month, day };
    row.append(dayCell(app, result, date, isSame(date, today), isSame(date, app.state.date)));

    if ((firstWeekday + day) % 7 === 0) {
      body.append(row);
      row = el("tr");
    }
  }
  // 마지막 줄을 채운다. (빈 칸은 접근성 때문에 aria-hidden 이 아니라 그냥 비어 둔다)
  while (row.childElementCount > 0 && row.childElementCount < 7) {
    row.append(el("td", { class: "cal__cell cal__cell--empty" }));
  }
  if (row.childElementCount > 0) body.append(row);
  append(table, [body]);
  return table;
}

function dayCell(
  app: App,
  result: ReturnType<App["result"]>,
  date: CivilDate,
  isToday: boolean,
  isSelected: boolean,
): HTMLElement {
  const fortune = analyzeFortune(result, date);
  const total = fortune.reading.sections.find((s) => s.topic === "총운");

  const classes = ["cal__cell"];
  if (isToday) classes.push("cal__cell--today");
  if (isSelected) classes.push("cal__cell--selected");

  const button = el("button", {
    type: "button",
    class: classes.join(" "),
    "aria-label": `${dateKorean(date)} 일진 ${fortune.context.ilun.ganZhi}${total ? `, 총운 ${total.intensity}` : ""}`,
    "aria-current": isSelected ? "date" : undefined,
    onclick: () => {
      app.setDate(date);
      window.location.hash = "#/ilun";
    },
  });

  const keyPoint = readingKeyPoint(fortune);

  append(button, [
    el("span", { class: "cal__day", text: String(date.day) }),
    el("span", { class: "cal__ilun", text: fortune.context.ilun.ganZhi }),
    total ? intensityBadge(total.intensity) : null,
    keyPoint ? el("span", { class: "cal__key", text: keyPoint }) : null,
    (fortune.reading.cautions.length > 0 || fortune.reading.sections.some((s) => s.evidence.length > 0))
      ? el("span", { class: "cal__dot", "aria-hidden": "true", title: "변화 신호 있음" })
      : null,
  ]);

  const td = el("td", { class: "cal__td" });
  td.append(button);
  return td;
}

function readingKeyPoint(fortune: ReturnType<typeof analyzeFortune>): string | null {
  if (fortune.reading.cautions.length > 0) return "주의";
  const topics = fortune.reading.sections.filter((s) => s.evidence.length > 0 && s.topic !== "총운");
  if (topics.length === 0) return null;
  // 가장 강한 기세가 있는 항목을 대표로 뽑는다
  const rank: Record<string, number> = { 매우두드러짐: 5, 뚜렷함: 4, 보통: 3, 약함: 2, 미미함: 1 };
  topics.sort((a, b) => (rank[b.intensity] ?? 0) - (rank[a.intensity] ?? 0));
  const top = topics[0].topic;
  const map: Record<string, string> = {
    재물운: "재물",
    "직업·사업운": "직업",
    애정운: "애정",
    대인관계운: "대인",
    "학업·성장운": "학업",
    건강운: "건강",
    "이동·변화운": "이동",
  };
  return map[top] ?? top.replace("운", "");
}

function weekdayOf(d: CivilDate): number {
  const t = Date.UTC(d.year, d.month - 1, d.day);
  return new Date(t).getUTCDay();
}

function isSame(a: CivilDate, b: CivilDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}
