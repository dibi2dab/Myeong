/**
 * 출생지(시/도 → 시/군/구) 선택용 데이터.
 *
 * - 자유 입력(자유 텍스트)을 받지 않는다. 아래 구조화 목록에서만 고른다.
 * - 데이터 출처: cosmosfarm/korea-administrative-district (2024-12-09 스냅샷,
 *   대한민국 행정구역 JSON, 공개 데이터). 시/도 17개 · 시/군/구 228개.
 *   라이선스: MIT. 출처 표기는 docs/data-sources.md 참조.
 * - 세종특별자치시는 하위 시/군/구가 없으므로 목록이 비어 있다.
 *   (화면에서는 시/도 자체만 고를 수 있게 처리한다)
 * - 이 목록은 표기에만 쓰인다. 본 프로젝트는 진태양시 보정을 하지 않으므로
 *   출생지 좌표가 간지 계산에 영향을 주지 않는다.
 */

export interface Region {
  /** 시/도 */
  sido: string;
  /** 시/군/구. 세종특별자치시는 빈 문자열. */
  sigungu: string;
}

export const REGIONS: readonly Region[] = [
  { sido: "서울특별시", sigungu: "종로구" },
  { sido: "서울특별시", sigungu: "중구" },
  { sido: "서울특별시", sigungu: "용산구" },
  { sido: "서울특별시", sigungu: "성동구" },
  { sido: "서울특별시", sigungu: "광진구" },
  { sido: "서울특별시", sigungu: "동대문구" },
  { sido: "서울특별시", sigungu: "중랑구" },
  { sido: "서울특별시", sigungu: "성북구" },
  { sido: "서울특별시", sigungu: "강북구" },
  { sido: "서울특별시", sigungu: "도봉구" },
  { sido: "서울특별시", sigungu: "노원구" },
  { sido: "서울특별시", sigungu: "은평구" },
  { sido: "서울특별시", sigungu: "서대문구" },
  { sido: "서울특별시", sigungu: "마포구" },
  { sido: "서울특별시", sigungu: "양천구" },
  { sido: "서울특별시", sigungu: "강서구" },
  { sido: "서울특별시", sigungu: "구로구" },
  { sido: "서울특별시", sigungu: "금천구" },
  { sido: "서울특별시", sigungu: "영등포구" },
  { sido: "서울특별시", sigungu: "동작구" },
  { sido: "서울특별시", sigungu: "관악구" },
  { sido: "서울특별시", sigungu: "서초구" },
  { sido: "서울특별시", sigungu: "강남구" },
  { sido: "서울특별시", sigungu: "송파구" },
  { sido: "서울특별시", sigungu: "강동구" },
  { sido: "부산광역시", sigungu: "중구" },
  { sido: "부산광역시", sigungu: "서구" },
  { sido: "부산광역시", sigungu: "동구" },
  { sido: "부산광역시", sigungu: "영도구" },
  { sido: "부산광역시", sigungu: "부산진구" },
  { sido: "부산광역시", sigungu: "동래구" },
  { sido: "부산광역시", sigungu: "남구" },
  { sido: "부산광역시", sigungu: "북구" },
  { sido: "부산광역시", sigungu: "강서구" },
  { sido: "부산광역시", sigungu: "해운대구" },
  { sido: "부산광역시", sigungu: "사하구" },
  { sido: "부산광역시", sigungu: "금정구" },
  { sido: "부산광역시", sigungu: "연제구" },
  { sido: "부산광역시", sigungu: "수영구" },
  { sido: "부산광역시", sigungu: "사상구" },
  { sido: "부산광역시", sigungu: "기장군" },
  { sido: "인천광역시", sigungu: "중구" },
  { sido: "인천광역시", sigungu: "동구" },
  { sido: "인천광역시", sigungu: "미추홀구" },
  { sido: "인천광역시", sigungu: "연수구" },
  { sido: "인천광역시", sigungu: "남동구" },
  { sido: "인천광역시", sigungu: "부평구" },
  { sido: "인천광역시", sigungu: "계양구" },
  { sido: "인천광역시", sigungu: "서구" },
  { sido: "인천광역시", sigungu: "강화군" },
  { sido: "인천광역시", sigungu: "옹진군" },
  { sido: "대구광역시", sigungu: "중구" },
  { sido: "대구광역시", sigungu: "동구" },
  { sido: "대구광역시", sigungu: "서구" },
  { sido: "대구광역시", sigungu: "남구" },
  { sido: "대구광역시", sigungu: "북구" },
  { sido: "대구광역시", sigungu: "수성구" },
  { sido: "대구광역시", sigungu: "달서구" },
  { sido: "대구광역시", sigungu: "달성군" },
  { sido: "대구광역시", sigungu: "군위군" },
  { sido: "광주광역시", sigungu: "동구" },
  { sido: "광주광역시", sigungu: "서구" },
  { sido: "광주광역시", sigungu: "남구" },
  { sido: "광주광역시", sigungu: "북구" },
  { sido: "광주광역시", sigungu: "광산구" },
  { sido: "대전광역시", sigungu: "동구" },
  { sido: "대전광역시", sigungu: "중구" },
  { sido: "대전광역시", sigungu: "서구" },
  { sido: "대전광역시", sigungu: "유성구" },
  { sido: "대전광역시", sigungu: "대덕구" },
  { sido: "울산광역시", sigungu: "중구" },
  { sido: "울산광역시", sigungu: "남구" },
  { sido: "울산광역시", sigungu: "동구" },
  { sido: "울산광역시", sigungu: "북구" },
  { sido: "울산광역시", sigungu: "울주군" },
  { sido: "세종특별자치시", sigungu: "" },
  { sido: "경기도", sigungu: "가평군" },
  { sido: "경기도", sigungu: "고양시" },
  { sido: "경기도", sigungu: "과천시" },
  { sido: "경기도", sigungu: "광명시" },
  { sido: "경기도", sigungu: "광주시" },
  { sido: "경기도", sigungu: "구리시" },
  { sido: "경기도", sigungu: "군포시" },
  { sido: "경기도", sigungu: "김포시" },
  { sido: "경기도", sigungu: "남양주시" },
  { sido: "경기도", sigungu: "동두천시" },
  { sido: "경기도", sigungu: "부천시" },
  { sido: "경기도", sigungu: "성남시" },
  { sido: "경기도", sigungu: "수원시" },
  { sido: "경기도", sigungu: "시흥시" },
  { sido: "경기도", sigungu: "안산시" },
  { sido: "경기도", sigungu: "안성시" },
  { sido: "경기도", sigungu: "안양시" },
  { sido: "경기도", sigungu: "양주시" },
  { sido: "경기도", sigungu: "양평군" },
  { sido: "경기도", sigungu: "여주시" },
  { sido: "경기도", sigungu: "연천군" },
  { sido: "경기도", sigungu: "오산시" },
  { sido: "경기도", sigungu: "용인시" },
  { sido: "경기도", sigungu: "의왕시" },
  { sido: "경기도", sigungu: "의정부시" },
  { sido: "경기도", sigungu: "이천시" },
  { sido: "경기도", sigungu: "파주시" },
  { sido: "경기도", sigungu: "평택시" },
  { sido: "경기도", sigungu: "포천시" },
  { sido: "경기도", sigungu: "하남시" },
  { sido: "경기도", sigungu: "화성시" },
  { sido: "강원특별자치도", sigungu: "원주시" },
  { sido: "강원특별자치도", sigungu: "춘천시" },
  { sido: "강원특별자치도", sigungu: "강릉시" },
  { sido: "강원특별자치도", sigungu: "동해시" },
  { sido: "강원특별자치도", sigungu: "속초시" },
  { sido: "강원특별자치도", sigungu: "삼척시" },
  { sido: "강원특별자치도", sigungu: "홍천군" },
  { sido: "강원특별자치도", sigungu: "태백시" },
  { sido: "강원특별자치도", sigungu: "철원군" },
  { sido: "강원특별자치도", sigungu: "횡성군" },
  { sido: "강원특별자치도", sigungu: "평창군" },
  { sido: "강원특별자치도", sigungu: "영월군" },
  { sido: "강원특별자치도", sigungu: "정선군" },
  { sido: "강원특별자치도", sigungu: "인제군" },
  { sido: "강원특별자치도", sigungu: "고성군" },
  { sido: "강원특별자치도", sigungu: "양양군" },
  { sido: "강원특별자치도", sigungu: "화천군" },
  { sido: "강원특별자치도", sigungu: "양구군" },
  { sido: "충청북도", sigungu: "청주시" },
  { sido: "충청북도", sigungu: "충주시" },
  { sido: "충청북도", sigungu: "제천시" },
  { sido: "충청북도", sigungu: "보은군" },
  { sido: "충청북도", sigungu: "옥천군" },
  { sido: "충청북도", sigungu: "영동군" },
  { sido: "충청북도", sigungu: "증평군" },
  { sido: "충청북도", sigungu: "진천군" },
  { sido: "충청북도", sigungu: "괴산군" },
  { sido: "충청북도", sigungu: "음성군" },
  { sido: "충청북도", sigungu: "단양군" },
  { sido: "충청남도", sigungu: "천안시" },
  { sido: "충청남도", sigungu: "공주시" },
  { sido: "충청남도", sigungu: "보령시" },
  { sido: "충청남도", sigungu: "아산시" },
  { sido: "충청남도", sigungu: "서산시" },
  { sido: "충청남도", sigungu: "논산시" },
  { sido: "충청남도", sigungu: "계룡시" },
  { sido: "충청남도", sigungu: "당진시" },
  { sido: "충청남도", sigungu: "금산군" },
  { sido: "충청남도", sigungu: "부여군" },
  { sido: "충청남도", sigungu: "서천군" },
  { sido: "충청남도", sigungu: "청양군" },
  { sido: "충청남도", sigungu: "홍성군" },
  { sido: "충청남도", sigungu: "예산군" },
  { sido: "충청남도", sigungu: "태안군" },
  { sido: "경상북도", sigungu: "포항시" },
  { sido: "경상북도", sigungu: "경주시" },
  { sido: "경상북도", sigungu: "김천시" },
  { sido: "경상북도", sigungu: "안동시" },
  { sido: "경상북도", sigungu: "구미시" },
  { sido: "경상북도", sigungu: "영주시" },
  { sido: "경상북도", sigungu: "영천시" },
  { sido: "경상북도", sigungu: "상주시" },
  { sido: "경상북도", sigungu: "문경시" },
  { sido: "경상북도", sigungu: "경산시" },
  { sido: "경상북도", sigungu: "의성군" },
  { sido: "경상북도", sigungu: "청송군" },
  { sido: "경상북도", sigungu: "영양군" },
  { sido: "경상북도", sigungu: "영덕군" },
  { sido: "경상북도", sigungu: "청도군" },
  { sido: "경상북도", sigungu: "고령군" },
  { sido: "경상북도", sigungu: "성주군" },
  { sido: "경상북도", sigungu: "칠곡군" },
  { sido: "경상북도", sigungu: "예천군" },
  { sido: "경상북도", sigungu: "봉화군" },
  { sido: "경상북도", sigungu: "울진군" },
  { sido: "경상북도", sigungu: "울릉군" },
  { sido: "경상남도", sigungu: "창원시" },
  { sido: "경상남도", sigungu: "김해시" },
  { sido: "경상남도", sigungu: "진주시" },
  { sido: "경상남도", sigungu: "양산시" },
  { sido: "경상남도", sigungu: "거제시" },
  { sido: "경상남도", sigungu: "통영시" },
  { sido: "경상남도", sigungu: "사천시" },
  { sido: "경상남도", sigungu: "밀양시" },
  { sido: "경상남도", sigungu: "함안군" },
  { sido: "경상남도", sigungu: "거창군" },
  { sido: "경상남도", sigungu: "창녕군" },
  { sido: "경상남도", sigungu: "고성군" },
  { sido: "경상남도", sigungu: "하동군" },
  { sido: "경상남도", sigungu: "합천군" },
  { sido: "경상남도", sigungu: "남해군" },
  { sido: "경상남도", sigungu: "함양군" },
  { sido: "경상남도", sigungu: "산청군" },
  { sido: "경상남도", sigungu: "의령군" },
  { sido: "전북특별자치도", sigungu: "전주시" },
  { sido: "전북특별자치도", sigungu: "익산시" },
  { sido: "전북특별자치도", sigungu: "군산시" },
  { sido: "전북특별자치도", sigungu: "정읍시" },
  { sido: "전북특별자치도", sigungu: "완주군" },
  { sido: "전북특별자치도", sigungu: "김제시" },
  { sido: "전북특별자치도", sigungu: "남원시" },
  { sido: "전북특별자치도", sigungu: "고창군" },
  { sido: "전북특별자치도", sigungu: "부안군" },
  { sido: "전북특별자치도", sigungu: "임실군" },
  { sido: "전북특별자치도", sigungu: "순창군" },
  { sido: "전북특별자치도", sigungu: "진안군" },
  { sido: "전북특별자치도", sigungu: "장수군" },
  { sido: "전북특별자치도", sigungu: "무주군" },
  { sido: "전라남도", sigungu: "여수시" },
  { sido: "전라남도", sigungu: "순천시" },
  { sido: "전라남도", sigungu: "목포시" },
  { sido: "전라남도", sigungu: "광양시" },
  { sido: "전라남도", sigungu: "나주시" },
  { sido: "전라남도", sigungu: "무안군" },
  { sido: "전라남도", sigungu: "해남군" },
  { sido: "전라남도", sigungu: "고흥군" },
  { sido: "전라남도", sigungu: "화순군" },
  { sido: "전라남도", sigungu: "영암군" },
  { sido: "전라남도", sigungu: "영광군" },
  { sido: "전라남도", sigungu: "완도군" },
  { sido: "전라남도", sigungu: "담양군" },
  { sido: "전라남도", sigungu: "장성군" },
  { sido: "전라남도", sigungu: "보성군" },
  { sido: "전라남도", sigungu: "신안군" },
  { sido: "전라남도", sigungu: "장흥군" },
  { sido: "전라남도", sigungu: "강진군" },
  { sido: "전라남도", sigungu: "함평군" },
  { sido: "전라남도", sigungu: "진도군" },
  { sido: "전라남도", sigungu: "곡성군" },
  { sido: "전라남도", sigungu: "구례군" },
  { sido: "제주특별자치도", sigungu: "제주시" },
  { sido: "제주특별자치도", sigungu: "서귀포시" },
];

/** 시/도 목록 (17개). 행정구역 관공서 일반 표기 순서를 그대로 따른다. */
export const SIDO_LIST: readonly string[] = Object.freeze(
  Array.from(new Set(REGIONS.map((r) => r.sido))),
);

/**
 * 하위 시/군/구가 없는 시/도 목록.
 * 세종특별자치시가 여기에 들어가므로 화면에서는 시/군/구 선택칸을 감춘다.
 */
export const SIDO_WITHOUT_SIGUNGU: readonly string[] = Object.freeze(
  SIDO_LIST.filter((sido) => !REGIONS.some((r) => r.sido === sido && r.sigungu !== "")),
);

/** 시·군/구 목록 캐시. 같은 시/도를 여러 번 물어도 같은 배열(동결됨)을 돌려준다. */
const SIGUNGU_CACHE = new Map<string, readonly string[]>();

/**
 * 특정 시/도의 시/군/구 목록.
 * 하위 구역이 없는 시·도(세종)나 모르는 시·도는 **빈 배열**을 돌려준다 —
 * 빈 문자열 항목이 select 의 빈 옵션으로 새어나가지 않도록 한다.
 */
export function sigunguListOf(sido: string): readonly string[] {
  const cached = SIGUNGU_CACHE.get(sido);
  if (cached) return cached;
  const list = Object.freeze(
    Array.from(
      new Set(REGIONS.filter((r) => r.sido === sido).map((r) => r.sigungu)),
    ).filter((s) => s !== ""),
  );
  SIGUNGU_CACHE.set(sido, list);
  return list;
}

/** 사람이 읽는 표기. 세종처럼 하위 구역이 없으면 시·도 이름만. */
export function regionText(region: Region | undefined): string {
  if (!region) return "";
  const sido = region.sido.trim();
  const sigungu = region.sigungu.trim();
  return sigungu ? `${sido} ${sigungu}` : sido;
}

/** 등록된 (시·도, 시·군/구) 쌍만 참. 앞뒤 공백은 인정하지 않는다. */
export function isValidRegion(sido: string, sigungu: string): boolean {
  return REGIONS.some((r) => r.sido === sido && r.sigungu === sigungu);
}
