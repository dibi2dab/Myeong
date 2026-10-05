/**
 * 대운 — 10년 운의 시간줄.
 *
 * 지금 들어 있는 대운을 강조하고, 아무 대운이나 눌러 그 기간 안으로 날짜를 옮길 수 있다.
 * 대운 기산 전이면 그 사실을 먼저 보여준다. (빈칸으로 두지 않는다)
 */

import {
  analyzeFortune,
  daeunOfDate,
  type CivilDate,
  type Daeun,
  type DaeunTimeline,
} from "../../core";
import { el, append, div, p, notice, card, list } from "../dom";
import { dateKorean, kstTimeText, pillarTable, periodTable } from "../format";
import { dateControls, toIso } from "../components";
import type { App } from "../app";

export function renderDaeun(app: App): HTMLElement {
  const result = app.result();
  const timeline = result.daeun;

  const strip = div("daeun-strip", { role: "list", "aria-label": "대운 목록" });
  for (const d of timeline.daeun) strip.append(daeunItem(app, d));

  const now = analyzeFortune(result, app.state.date);

  return div("stack stack--fixed", [
    card("대운 기산", [
      p("muted", "순행이면 다음 절기까지, 역행이면 이전 절기까지의 날짜를 3일 = 1년으로 바꿉니다."),
      basisDl(timeline),
      timeline.daeun.length === 0
        ? notice("기산한 해가 아직 지나지 않아 대운이 하나도 없습니다.", "info")
        : null,
    ], { id: "daeun-basis" }),

    card("대운 시간줄", [
      strip,
      p("small muted", "아무 대운이나 누르면 그 10년의 첫날로 날짜를 옮깁니다. 그 시기의 세운·월운·일운을 함께 계산합니다."),
    ], { id: "daeun-strip" }),

    nowCard(app, now),
  ]);
}

/* ------------------------------------------------------------------ 조각 */

function basisDl(timeline: DaeunTimeline): HTMLElement {
  const dl = el("dl", { class: "deflist" });
  const rows: [string, string][] = [
    ["진행 방향", `${timeline.direction} · ${timeline.directionRule}`],
    ["기준 절기", `${timeline.startTerm.definition.name} ${kstTimeText(timeline.startTerm.koreaTime)}`],
    ["생일 → 기준 절기", `${timeline.daysToStartTerm}일`],
    ["기산 시작 나이", `${timeline.startAgeYears.toFixed(2)}세 (${timeline.daeun[0] ? toIso(timeline.daeun[0].startDate) : "—"})`],
  ];
  for (const [label, value] of rows) dl.append(el("dt", { text: label }), el("dd", { text: value }));
  return dl;
}

function daeunItem(app: App, d: Daeun): HTMLElement {
  const date = app.state.date;
  const isCurrent = date.year >= d.startYear && date.year < d.endYear;
  const isPast = date.year >= d.endYear;

  const button = el("button", {
    type: "button",
    class: `daeun${isCurrent ? " daeun--current" : ""}${isPast ? " daeun--past" : ""}`,
    "aria-current": isCurrent ? "true" : undefined,
    onclick: () => app.setDate(midYear(d.startDate)),
  });
  append(button, [
    el("span", { class: "daeun__order", text: `${d.order}대운` }),
    el("span", { class: "daeun__gz", text: `${d.stem}${d.branch}` }),
    el("span", { class: "daeun__tenGod", text: d.tenGod }),
    el("span", { class: "daeun__stage", text: d.stage.key }),
    el("span", { class: "daeun__years", text: `${d.startYear}–${d.endYear - 1}` }),
    el("span", { class: "daeun__age", text: `${d.startAge.toFixed(1)}–${d.endAge.toFixed(1)}세` }),
    isCurrent ? el("span", { class: "daeun__now", text: "지금" }) : null,
  ]);

  const cell = el("div", { class: "daeun-cell", role: "listitem" });
  cell.append(button);
  return cell;
}

/** 10년 기간의 가운데 해 7월 1일로 이동한다. (그 대운 안에서의 세운·월운을 보기 좋다) */
function midYear(start: CivilDate): CivilDate {
  return { year: start.year + 5, month: 7, day: 1 };
}

function nowCard(app: App, fortune: ReturnType<typeof analyzeFortune>): HTMLElement {
  const ctx = fortune.context;
  const result = app.result();

  const toolbar = div("toolbar", [dateControls(app.state.date, (d) => app.setDate(d))]);

  if (ctx.daeun === null) {
    return card("지금 시점", [
      notice("아직 대운 기산 전입니다. 이 시기는 세운·월운·일운만으로 봅니다.", "info"),
      toolbar,
      p("muted", `${dateKorean(app.state.date)} 기준 세운 ${ctx.seun.ganZhi} · 월운 ${ctx.wolun.ganZhi} · 일운 ${ctx.ilun.ganZhi}`),
    ]);
  }

  const d = ctx.daeun;
  const entry = daeunOfDate(result.daeun, app.state.date);
  const stack = div("stack", [
    p("muted", `${dateKorean(app.state.date)} 에 걸린 대운 · ${d.pillar.stem}${d.pillar.branch}`),
    entry === null ? null : currentDl(entry),
    toolbar,
  ]);

  stack.append(periodTable([d, ctx.seun, ctx.wolun, ctx.ilun], `${dateKorean(app.state.date)} 의 운 계층`));

  stack.append(
    card("이 대운에서의 세운", [
      p("muted", "대운 위에 얹히는 것이 세운입니다. 대운을 건너뛰고 세운만 보지 않습니다."),
      list([
        el("li", { children: [`세운 ${ctx.seun.ganZhi} · ${ctx.seun.tenGod} (${ctx.seun.tenGodGroup})`] }),
        el("li", { children: [`월운 ${ctx.wolun.ganZhi} · ${ctx.wolun.tenGod} (${ctx.wolun.tenGodGroup})`] }),
        el("li", { children: [`일운 ${ctx.ilun.ganZhi} · ${ctx.ilun.tenGod} (${ctx.ilun.tenGodGroup})`] }),
      ]),
      el("a", { class: "btn", href: "#/seun", text: "연운 운세 보기" }),
    ]),
  );

  stack.append(card("이 시점의 지장간 · 십이운성", [pillarTable([d.pillar], result.natal.chart.dayMaster, "대운 한 기둥")]));

  return card("지금 시점", [stack]);
}

/** 대운 한 개의 기간 · 나이. (`ctx.daeun` 에는 기간이 없으므로 타임라인에서 찾는다) */
function currentDl(d: Daeun): HTMLElement {
  const dl = el("dl", { class: "deflist" });
  const rows: [string, string][] = [
    ["간지", `${d.stem}${d.branch}`],
    ["십신", d.tenGod],
    ["십이운성", `${d.stage.key} (${d.stage.korean})`],
    ["나이", `${d.startAge.toFixed(1)}–${d.endAge.toFixed(1)}세`],
    ["기간", `${toIso(d.startDate)} ~ ${toIso(d.endDate)} (끝 날짜는 포함하지 않음)`],
  ];
  for (const [label, value] of rows) dl.append(el("dt", { text: label }), el("dd", { text: value }));
  return dl;
}
