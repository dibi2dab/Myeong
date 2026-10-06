/**
 * 오행 분석 화면 (지시 §5–12, §29–31, §49–50)
 *
 * 비율 그 자체만 보여주는 게 아니라, 각 오행의 역할·상태·장점·주의를
 * 관계 중심으로 풀어 쓴다. 월령·계절·일간 강약·운의 영향을 자연어로 적는다.
 */

import { analyzeElements, ELEMENT_KOREAN, type ElementRole, type SajuResult } from "../../core";
import { el, div, p, card } from "../dom";
import { whyBlock } from "../components";
import { ganZhiParts } from "../../core/text/labels";
import type { App } from "../app";

export function renderElements(app: App): HTMLElement {
  const result = app.result();
  const { chart, distribution } = result.natal;
  const analysis = analyzeElements(chart, distribution);

  const stack = div("stack");

  stack.append(
    card("오행 해석 요약", [
      p("muted", "단순 비율(%)이 아니라, 월령·계절·일간 강약·원국 구조를 종합해 관계 중심으로 설명합니다."),
      p("summary", analysis.summary),
      p("muted", analysis.verdictNote),
    ]),
  );

  const list = div("stack stack--dense");
  for (const role of analysis.roles) {
    list.append(elementRoleCard(role, result));
  }
  stack.append(card("오행별 상태와 역할", [list]));

  stack.append(
    card("오행 해석 원칙", [
      whyBlock("어떻게 판단하나요?", [
        "비율은 출발점일 뿐, 일간과의 관계(비화·인성·식상·재성·관살·상생·상극)를 우선 봅니다.",
        "월령과 계절이 오행의 실제 세력을 좌우합니다.",
        "일간 강약(신강/중화/신약)에 따라 '필요한 것'과 '과한 것'의 의미가 달라집니다.",
        "대운·연운·월운·일운이 들어오면서 같은 오행도 역할이 바뀔 수 있습니다.",
        "부족한 오행을 무조건 보충하는 건 정답이 아닙니다. 들어오는 경로와 시기가 더 중요합니다.",
      ]),
    ]),
  );

  return stack;
}

function elementRoleCard(role: ElementRole, _result: SajuResult): HTMLElement {
  const parts = ganZhiParts(`${_result.natal.chart.day.stem}${_result.natal.chart.day.branch}`);
  const dm = `${parts.main}${parts.hanja}`;
  return card(undefined, [
    div("elrole__head", [
      el("h3", { class: "elrole__title", text: `${ELEMENT_KOREAN[role.element]}(${role.element})` }),
      el("span", { class: "elrole__state", text: `상태: ${role.state}` }),
      el("span", { class: "elrole__ratio", text: `비율 ${role.ratio.toFixed(1)}%` }),
    ]),
    p("elrole__section", "[역할]"),
    p("elrole__text", role.role.replace("일간", dm)),
    p("elrole__section", "[도움이 되는 방향]"),
    p("elrole__text", role.help.replace("일간", dm)),
    p("elrole__section", "[주의할 방향]"),
    p("elrole__text", role.caution.replace("일간", dm)),
    p("elrole__section", "[판단 근거]"),
    p("elrole__text", role.note.replace("일간", dm)),
  ]);
}