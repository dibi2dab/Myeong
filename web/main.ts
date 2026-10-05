/**
 * 진입점.
 *
 * 브라우저에서 이 파일만 실행되고, 나머지는 전부 `core` 와 `web/` 안에서 일어난다.
 * 서버·네트워크 호출은 이 앱 어디에도 없다.
 */

import "./styles.css";
import { boot } from "./app";
import { el } from "./dom";

const root = document.getElementById("app");
if (!root) {
  throw new Error("#app 를 찾을 수 없습니다.");
}

try {
  boot(root as HTMLElement);
} catch (error) {
  // 시작 자체가 실패했을 때도 내부 상태를 그대로 노출하지 않는다.
  console.error("[myeong] 앱을 시작하지 못했습니다:", error);
  root.replaceChildren(
    el("p", {
      class: "notice notice--error",
      role: "alert",
      text: "화면을 시작하지 못했습니다. 브라우저에서 JavaScript가 막혀 있지 않은지 확인해주세요.",
    }),
  );
}
