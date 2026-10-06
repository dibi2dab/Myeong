/**
 * 내 사주 — 출생 시점에 고정된 원국.
 *
 * 내 사주는 시간이 지나도 변하지 않는다. (운세와 달리)
 * 그래서 이 화면을 운세 화면과 아예 다르게 꾸민다.
 */

import { DISCLAIMER_TEXT, ELEMENT_KOREAN, VERDICT_MEANING, stemLabel, type SajuResult } from "../../core";
import { el, append, div, p, notice, card } from "../dom";
import { dateKorean, kstTimeText, pillarTable } from "../format";
import {
  elementBars,
  elementSummary,
  evidenceBlock,
  interactionList,
  moonCommandLine,
  voidBranchesLine,
  whyBlock,
} from "../components";
import type { App } from "../app";

/** 일간 강약 규칙 ID. (data/rules/rules.ts 의 RULE_DAYMASTER_001) */
const RULE_DAYMASTER = "RULE_DAYMASTER_001";
/** 용신 규칙 ID. (RULE_YONGSHIN_001) */
const RULE_YONGSHIN = "RULE_YONGSHIN_001";

export function renderNatal(app: App): HTMLElement {
  const result = app.result();
  const { chart, pillars, distribution, moonCommand, voidBranches, interactions } = result.natal;

  return div("stack stack--fixed", [
    card("원국 — 네 기둥", [
      p("muted", "출생 순간의 기둥입니다. 시간이 지나도 변하지 않습니다."),
      pillarTable(pillars, chart.dayMaster, "원국 년주·월주·일주·시주 표"),
      chart.hour === null
        ? notice(
            "출생시간을 모른다고 하셨습니다. 시주를 계산하지 않았으므로 세 기둥만 나옵니다. 시주에서 나오는 십신·십이운성·간지(合·沖·刑·破·害)가 빠집니다.",
            "info",
          )
        : null,
      p("small muted", `일간 ${chart.dayMaster} (${ELEMENT_KOREAN[chart.dayMasterElement]})`),
    ], { id: "chart" }),

    card("이 사주를 만든 기준", [basisTable(result)]),

    card("오행 세력", [
      elementBars(distribution.contributions),
      elementSummary(distribution),
      moonCommandLine(moonCommand),
      p("small muted", "천간은 1, 지장간은 본기 1.0 · 중기 0.5 · 여기 0.3, 월령(旺相休囚死)은 계절별로 가중해 합산합니다."),
      p("small muted", "비율은 다섯 오행을 100%로 나눈 값입니다. 점수나 등급이 아닙니다."),
    ], { id: "elements" }),

    card("일간 강약", [strengthBlock(result)]),

    card("용신 · 희신", [yongshinBlock(result)]),

    card("합 · 충 · 형 · 파 · 해", [
      p("muted", "원국의 네 기둥끼리 붙어 있는 간(干支)입니다."),
      interactionList(interactions),
    ], { id: "interactions" }),

    card("절지(旬空)", [voidBranchesLine(voidBranches)]),

    card("고지", [p("disclaimer-long", DISCLAIMER_TEXT)]),
  ]);
}

/* ------------------------------------------------------------------ 조각 */

function basisTable(result: SajuResult): HTMLElement {
  const b = result.natal.basis;
  const rows: [string, string][] = [
    ["입력", result.conversion.summary],
    ["사주 기준 날짜 (양력 KST)", dateKorean(b.solarDate)],
    ["절기 연도 (입춘 기준)", `${b.solarYear}년`],
    ["월주 경계 절기", b.monthBoundaryTerm],
    ["월지", `사월 ${b.monthBranchIndex}번째 자리`],
    ["일주 기준 날짜", dateKorean(b.dayPillarDate)],
    ["대표 시각", kstTimeText(b.representativeKoreaTime)],
    ["시각 결정 규칙", b.ziMode === null ? "자시 외 시진 — 시진 중앙 시각을 대표로 삼음" : `${b.ziMode} 기준`],
    ["시주 미상", b.hourUnknown ? "예" : "아니오"],
    ["대운 순역", `${result.daeun.direction} (${result.daeun.directionRule})`],
  ];

  const dl = el("dl", { class: "deflist" });
  for (const [label, value] of rows) dl.append(el("dt", { text: label }), el("dd", { text: value }));
  return dl;
}

/**
 * 일간 강약 (지시 §15)
 *
 * 순서를 뒤집는다. `신강` 이라는 글자만 먼저 보여주면 "그래서 무엇이 좋은가" 를
 * 되묻게 된다. 그래서 **무엇을 판단했는지 → 왜 그렇게 판단했는지 → 규칙 번호** 순으로
 * 놓는다. 규칙 번호는 맨 아래 접힌 자리에만 둔다.
 */
function strengthBlock(result: SajuResult): HTMLElement {
  const s = result.natal.strength;
  const wrap = div("stack");

  // 1) 결론
  wrap.append(
    div("verdict-grid", [
      div("verdict-grid__item", [
        el("span", { class: "verdict-grid__label", text: "일간" }),
        el("strong", { class: "verdict-grid__value", text: stemLabel(s.dayMaster) }),
      ]),
      div("verdict-grid__item", [
        el("span", { class: "verdict-grid__label", text: "강약" }),
        el("strong", { class: "verdict-grid__value", text: s.verdict }),
      ]),
    ]),
  );

  // 2) 강약이라는 말이 무엇인지 — 첫 등장 용어를 여기서 풀어 준다.
  wrap.append(p("muted", VERDICT_MEANING[s.verdict]));

  // 3) 왜 그렇게 판단했는지 — 전문용어를 한국어로 풀어 쓴다.
  wrap.append(
    whyBlock(
      "왜 그렇게 판단하나요?",
      [
        "태어난 달의 기운(월령)이 일간을 돕는지, 빼앗는지 봅니다.",
        "월지 안의 지장간이 일간에게 어떤 힘이 되는지 기(氣)의 무게로 합산합니다.",
        "연지·일지·시지가 일간을 돕는지 제약하는지 함께 봅니다.",
        "절지(空亡)에 빠져 기운이 반감되는 자리가 있는지도 봅니다.",
        "다섯 오행의 분포에서 일간의 오행이 얼마나 차지하는지 더합니다.",
      ],
    ),
  );

  // 4) 계산 근거
  wrap.append(evidenceBlock(
    s.evidence.map((text, i) => ({
      ruleId: RULE_DAYMASTER,
      text,
      layer: "원국" as const,
      detail: `근거 ${i + 1}`,
    })),
    "상세 계산 근거 보기",
  ));
  return wrap;
}

function yongshinBlock(result: SajuResult): HTMLElement {
  const y = result.natal.yongshin;
  const wrap = div("stack");

  wrap.append(p("muted",
    `용신·희신은 ${RULE_YONGSHIN} 한 벌의 규칙으로만 정합니다. 다른 조합의 용신법을 섞지 않습니다.`));

  const table = el("table", { class: "yongshin" });
  append(table, [el("caption", { class: "visually-hidden", text: "용신·희신 판단 표" })]);

  const head = el("tr");
  append(head, [
    el("th", { scope: "col", text: "구분" }),
    el("th", { scope: "col", text: "규칙" }),
    el("th", { scope: "col", text: "오행" }),
    el("th", { scope: "col", text: "해석" }),
  ]);
  append(table, [el("thead", { children: [head] })]);

  const body = el("tbody");
  for (const [label, decision] of [
    ["용신", y.yongshin],
    ["희신", y.heeshin],
  ] as const) {
    const tr = el("tr");
    append(tr, [
      el("th", { scope: "row", children: [el("strong", { text: label })] }),
      el("td", { children: [el("code", { class: "rule__id", text: decision.ruleId })] }),
      el("td", { text: decision.result.group }),
      el("td", { text: decision.interpretation }),
    ]);
    body.append(tr);

    const crit = el("tr", { class: "yongshin__criteria" });
    append(crit, [
      el("th", { scope: "row", text: "기준" }),
      el("td", { colspan: "3", text: decision.criteria }),
    ]);
    body.append(crit);

    if (decision.result.presentTenGods.length > 0) {
      const used = el("tr", { class: "yongshin__criteria" });
      append(used, [
        el("th", { scope: "row", text: "원국에 쓰인 십신" }),
        el("td", { colspan: "3", text: decision.result.presentTenGods.join(", ") }),
      ]);
      body.append(used);
    }
  }
  append(table, [body]);
  wrap.append(table);

  wrap.append(evidenceBlock(
    y.evidence.map((text, i) => ({
      ruleId: RULE_YONGSHIN,
      text,
      layer: "원국" as const,
      detail: `근거 ${i + 1}`,
    })),
    "용신 판단에 쓴 근거",
  ));

  return wrap;
}
