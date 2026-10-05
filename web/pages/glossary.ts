/**
 * 용어집 · 규칙 카탈로그 화면.
 *
 * 설명 데이터(`data/rules/terms.ts`, `data/rules/rules.ts`)는 계산 코드와 분리되어
 * 있고, 이 화면은 `core` 의 공개 API 로 그것만 읽어 온다.
 * 해석을 새로 만들어 내지 않는다. 저장된 설명을 그대로 보여준다.
 */

import { el, div, card } from "../dom";
import { glossaryView, ruleCatalogView } from "../components";

export function glossaryScreen(): HTMLElement {
  return div("stack", [
    el("h1", { class: "page-title", text: "용어집" }),
    glossaryView(),
  ]);
}

export { glossaryView, ruleCatalogView, card };
