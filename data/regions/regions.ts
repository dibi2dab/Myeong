/**
 * 출생지(시/도) 선택용 데이터.
 *
 * - 자유 입력(자유 텍스트)을 받지 않는다. 아래 구조화 목록에서만 고른다.
 * - **시/도 17개만 고른다.** 시/군/구·읍·면·동 단위를 물지 않는다.
 *   명리 계산에 필요하지 않고, 단계가 늘어날수록 같은 이름이 여러 번 보여 헷갈린다.
 *   (예: "경기도 → 화성시 → 화성동" 중 어느 하나만 고르면 나머지 둘의 정보는 버려진다)
 * - 데이터 출처: cosmosfarm/korea-administrative-district (2024-12-09 스냅샷,
 *   대한민국 행정구역 JSON, 공개 데이터). 라이선스: MIT.
 *   출처 표기는 docs/data-sources.md 참조.
 * - 이 목록은 표기에만 쓰인다. 대한민국은 한 시간대(UTC+9)이고 이 프로젝트는
 *   진태양시 보정을 하지 않으므로, 출생지가 간지 계산에 영향을 주지 않는다.
 *   (단, 표준 시간대는 아래 STANDARD_TIME_NOTE 로 명시한다)
 */

/** 대한민국 표준 시간대. */
export const STANDARD_TIME_NOTE = "대한민국 표준 시간대 (UTC+9)";

/** 시/도 목록 (17개). 지시된 순서를 그대로 따른다. */
export const SIDO_LIST: readonly string[] = Object.freeze([
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
] as const);

/** 사람이 읽는 표기. 등록된 시/도이면 이름을, 아니면 빈 문자열. */
export function sidoText(sido: string): string {
  return isValidSido(sido) ? sido : "";
}

/** 등록된 시/도만 참. 앞뒤 공백은 인정하지 않는다. */
export function isValidSido(sido: string): boolean {
  return SIDO_LIST.includes(sido);
}
