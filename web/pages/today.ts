/**
 * 오늘의 운세.
 *
 * 이 화면에서 가장 중요한 약속 두 가지
 *  1. **원국 → 대운 → 세운 → 월운 → 일운** 순으로만 해석한다.
 *     아래 계층만 따로 떼어내지 않는다. (드릴다운으로 좁힐 수는 있지만,
 *     좁혀 보는 것도 같은 계층 위계 안에서만 한다)
 *  2. 해석과 근거를 **항상 함께** 보여준다. 근거 보기 없이는 끝나지 않는다.
 */

import { DISCLAIMER_TEXT, analyzeFortune, todayInKorea } from "../../core";
import { el, div, p, notice, card } from "../dom";
import { dateKorean, periodTable } from "../format";
import {
  dateControls,
  drilldownBox,
  evidenceBlock,
  fortuneSectionCard,
  interactionList,
} from "../components";
import type { App } from "../app";

export function renderToday(app: App): HTMLElement {
  const result = app.result();
  const date = app.state.date;
  const fortune = analyzeFortune(result, date);
  const { context, reading, drilldown } = fortune;

  const stack = div("stack stack--varying");

  /* ---- 날짜 선택 줄 */
  stack.append(
    div("toolbar", [
      dateControls(date, (d) => app.setDate(d), { today: todayInKorea() }),
      el("h1", { class: "page-title", text: "오늘의 운세" }),
      p("muted", `${dateKorean(date)} · ${reading.dateLabel}`),
    ]),
  );

  /* ---- 대운 · 세운 · 월운 · 일운 계층 */
  stack.append(
    card("지금 걸린 운", [
      context.daeun === null
        ? notice(
            "아직 대운 기산 전입니다. 대운이 없으므로 이 시기의 운세는 세운·월운·일운만으로 봅니다.",
            "info",
          )
        : p("muted", `대운 ${context.daeun.ganZhi} (${context.daeun.tenGod})`),
      periodTable(
        [context.daeun, context.seun, context.wolun, context.ilun].filter(
          (x): x is NonNullable<typeof x> => x !== null,
        ),
        `${dateKorean(date)} 에 걸친 운 계층 표`,
      ),
      p("small muted", "원국은 고정값이고 대운·세운·월운·일운만 날짜마다 달라집니다. 아래 모든 해석은 이 계층 위계를 함께 봅니다."),
      context.hourUnknown
        ? notice("시주 미상 상태입니다. 시주에서 나오는 신호는 계산에 들어가지 않습니다.", "info")
        : null,
    ], { id: "layers" }),
  );

  /* ---- 핵심 포인트 */
  stack.append(
    card("핵심 포인트", [
      reading.keyPoints.length === 0
        ? p("muted", "오늘 특별히 두드러지는 지점이 없습니다. 특별한 신호가 잡히지 않았다는 뜻입니다.")
        : evidenceBlock(reading.keyPoints, "오늘의 핵심 포인트"),
    ], { id: "keypoints" }),
  );

  /* ---- 운세 항목 */
  const sections = div("stack");
  for (const section of reading.sections) sections.append(fortuneSectionCard(section));
  stack.append(sections);

  /* ---- 주의점 */
  stack.append(
    card("주의점", [
      reading.cautions.length === 0
        ? p("muted", "오늘 특별히 조심할 신호가 없습니다. 특별한 신호가 잡히지 않았다는 뜻입니다.")
        : evidenceBlock(reading.cautions, "오늘의 주의점"),
    ], { id: "cautions" }),
  );

  /* ---- 드릴다운 */
  stack.append(card("오늘의 운세에서 원국까지", [drilldownBox(drilldown)]));

  /* ---- 간(干支) 목록 */
  stack.append(
    card("원국과 오늘의 운 사이의 간(干支)", [
      p("muted", "원국·대운·세운·월운·일운을 한꺼번에 검사한 결과입니다."),
      interactionList(context.interactions),
    ], { id: "interactions" }),
  );

  /* ---- 제한 안내 */
  if (reading.restrictions.length > 0) {
    stack.append(
      card("이 화면의 한계", [
        el("ul", { class: "restrictions", children: reading.restrictions.map((r) => el("li", { text: r })) }),
      ]),
    );
  }

  stack.append(card("고지", [p("disclaimer-long", DISCLAIMER_TEXT)]));

  return stack;
}
