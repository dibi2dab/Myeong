/**
 * 연운 · 월운 · 일운.
 *
 * 세 화면이 같은 계산기를 쓴다. 어느 계층을 보는지만 다르다.
 * 어느 화면이든 **원국 → 대운 → 세운 → 월운 → 일운** 위계를 함께 보여준다.
 * 아래 계층만 따로 해석하지 않는다.
 */

import {
  DISCLAIMER_SHORT,
  analyzeFortune,
  type FortuneSection,
  type FortuneTopic,
  type PeriodKind,
  type PeriodPillar,
} from "../../core";
import { el, div, p, notice, card } from "../dom";
import { dateKorean, periodTable } from "../format";
import { dateControls, evidenceBlock, fortuneSectionCard, interactionList, toIso } from "../components";
import type { App } from "../app";

const PERIOD_META: Readonly<
  Record<"seun" | "wolun" | "ilun", { kind: PeriodKind; title: string; blurb: string }>
> = Object.freeze({
  seun: {
    kind: "seun",
    title: "연운",
    blurb: "1년 단위. 양력 1월 1일부터 다음 해 1월 1일까지가 아니라, 입춘에서 다음 입춘까지를 1년으로 셉니다.",
  },
  wolun: {
    kind: "wolun",
    title: "월운",
    blurb: "한 달 단위. 12절기(入春·驚蟄·淸明·立夏·芒種·小暑·立秋·白露·寒露·立冬·大雪·小寒)로 나뉘며 양력 1일 경계가 아닙니다.",
  },
  ilun: {
    kind: "ilun",
    title: "일운",
    blurb: "하루 단위. 한국 시간 자정(UTC+9) 00:00 에 바뀝니다. 웹과 이메일이 같은 기준을 씁니다.",
  },
});

export function renderPeriod(app: App, route: string): HTMLElement {
  const meta = PERIOD_META[route as keyof typeof PERIOD_META];
  if (!meta) throw new Error(`알 수 없는 운 화면입니다: ${route}`);

  const result = app.result();
  const date = app.state.date;
  const fortune = analyzeFortune(result, date);
  const ctx = fortune.context;

  const periods =
    meta.kind === "seun"
      ? [ctx.daeun, ctx.seun].filter((x): x is PeriodPillar => x !== null)
      : [ctx.daeun, ctx.seun, ctx.wolun, ctx.ilun].filter((x): x is PeriodPillar => x !== null);

  const stack = div("stack stack--varying");

  stack.append(
    div("toolbar", [
      dateControls(date, (d) => app.setDate(d)),
      el("h1", { class: "page-title", text: meta.title }),
      p("muted", dateKorean(date)),
    ]),
  );

  stack.append(
    card(`${meta.title}이 걸린 자리`, [
      p("muted", meta.blurb),
      periodTable(periods, `${meta.title}와 위 계층들`),
      periodDl(meta.kind, fortune),
    ], { id: "period" }),
  );

  if (ctx.daeun === null) {
    stack.append(notice("아직 대운 기산 전입니다. 대운이 빠진 상태로 계산합니다.", "info"));
  }

  /* ---- 8개 항목: 이 계층을 중심으로 보되 위 계층을 함께 반영한다 */
  const sections = div("stack");
  for (const section of fortune.reading.sections) {
    sections.append(fortuneSectionCard(withLayerNote(section.topic, meta.title, fortune)));
  }
  stack.append(sections);

  stack.append(
    card("주의점", [
      fortune.reading.cautions.length === 0
        ? p("muted", "이 시기에 특별히 조심할 신호가 없습니다.")
        : evidenceBlock(fortune.reading.cautions, "이 시기의 주의점"),
    ]),
  );

  stack.append(
    card("간(干支)", [
      interactionList(ctx.interactions),
    ]),
  );

  stack.append(p("disclaimer", DISCLAIMER_SHORT));

  return stack;
}

function periodDl(kind: PeriodKind, fortune: ReturnType<typeof analyzeFortune>): HTMLElement {
  const dl = el("dl", { class: "deflist" });
  const rows: [string, string][] = [];

  if (kind === "seun") {
    const r = fortune.seunRange;
    rows.push(["세운 기둥", fortune.context.seun.ganZhi]);
    rows.push(["기간", `${toIso(r.start)} ~ ${toIso(r.endExclusive)} (입춘 ~ 다음 입춘, 끝 날짜 제외)`]);
  }
  if (kind === "wolun") {
    const r = fortune.wolunRange;
    rows.push(["월운 기둥", fortune.context.wolun.ganZhi]);
    rows.push(["기간", `${toIso(r.start)} ~ ${toIso(r.endExclusive)} (끝 날짜 제외)`]);
    rows.push(["경계 절기", `${r.termName} — 양력 ${toIso(r.start)} 기준`]);
  }
  if (kind === "ilun") {
    rows.push(["일운 기둥", fortune.context.ilun.ganZhi]);
    rows.push(["기간", `${toIso(fortune.context.date)} 00:00 ~ 익일 00:00 (한국 시간, 끝 제외)`]);
  }

  for (const [label, value] of rows) dl.append(el("dt", { text: label }), el("dd", { text: value }));
  return dl;
}

/**
 * 각 항목 옆에 "이 항목은 어느 층위까지 봤다"를 붙인다.
 * 사용자가 대운 없이 연운만 보고 있다는 오해를 막기 위한 한 줄 표기다.
 */
function withLayerNote(
  topic: FortuneTopic,
  layerLabel: string,
  fortune: ReturnType<typeof analyzeFortune>,
): FortuneSection {
  const base = fortune.reading.sections.find((s) => s.topic === topic);
  if (!base) throw new Error(`항목을 찾을 수 없습니다: ${topic}`);
  if (base.evidence.length === 0) return base;
  const layers = [...new Set(base.evidence.map((e) => e.layer))].join(" · ");
  return {
    ...base,
    interpretation: `${base.interpretation} (근거가 닿은 층위: ${layers} · 중심 층위: ${layerLabel})`,
  };
}
