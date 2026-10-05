/**
 * 香港天文台(HKO) 24절기 기준 자료로 테스트 픽스처를 다시 만든다.
 *
 * 왜 필요한가
 * - 절기 엔진의 정확도를 확인할 때 **독립된** 기준이 있어야 한다.
 *   같은 코드를 두 번 돌려 비교하면 같은 오차가 두 번 나올 뿐이다.
 * - 이 스크립트가 받아 두는 JSON 이 그 독립 기준이다. (저장소에 함께 둔다)
 *
 * 주의: HKO 자료는 **HKT(UTC+8)** 기준이다. 한국 표준시(KST = UTC+9)로 보려면 1시간을 더한다.
 *       이 차이를 빼먹으면 최대 60분의 어긋남으로 보인다.
 *
 * 다시 만들려면 네트워크가 필요하다. (평소에는 필요 없다)
 *
 *   npm run tools:hko
 */

import { writeFileSync } from "node:fs";

/** 검증할 해. 2020–2027. (8년 × 24절기 = 192건) */
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027] as const;

const DEST = "tests/fixtures/hko-solar-terms-2020-2027.json";

/**
 * 픽스처 배열의 24칸이 각각 어떤 절기인지.
 *
 * 순서는 **그 해 1월 소한부터 12월 동지까지** 다. (다음 해 절기는 없다)
 * 순서를 바꾸면 절기 비교 테스트가 조용히 엉뚱한 것을 비교하게 된다.
 */
const MONTH_NAMES = [
  "소한", "입춘", "우수", "춘분",
  "청명", "곡식", "입하", "소만",
  "망종", "하지", "소서", "대추",
  "백로", "소추", "입동", "경서",
  "백로", "추분", "한로", "입동",
  "서한", "소설", "대설", "동지",
] as const;

/** `20240204 1727` 형태에서 시각만 뽑는다. */
function timeOf(value: string): string {
  const m = /(\d{2}):?(\d{2})?/.exec(value);
  if (!m) throw new Error(`시각 형식이 예상과 다릅니다: ${value}`);
  return `${m[1]}:${m[2] ?? "00"}`;
}

/** HKO XML 한 해를 파싱해 `[월, 일, "HH:MM"]` 24개 배열로 만든다. */
async function fetchYear(year: number): Promise<Array<[number, number, string]>> {
  const url = `https://www.hko.gov.hk/en/gts/astronomy/data/files/24SolarTerms_${year}.xml`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${year} 자료 받는 데 실패했습니다: HTTP ${response.status}`);

  const xml = await response.text();
  const rows = [...xml.matchAll(/<yearname>([^<]+)<\/yearname>[\s\S]*?<data>([^<]*)<\/data>/g)];
  if (rows.length !== 1) throw new Error(`${year} 의 <data> 를 찾지 못했습니다.`);

  // 예) 20240204 1727, 20240219 1232, ...  (24개, 1월 소한부터 12월 동지까지)
  const raw = (rows[1][2] ?? "").trim().split(/\s+/).filter(Boolean);
  if (raw.length !== 24) throw new Error(`${year} 절기 개수가 24 가 아닙니다: ${raw.length}`);

  return raw.map((token) => {
    const date = token.slice(0, 8);
    const month = Number(date.slice(4, 6));
    const day = Number(date.slice(6, 8));
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`${year} 의 날짜 형식이 예상과 다릅니다: ${token}`);
    }
    return [month, day, timeOf(token.slice(8))];
  }) as Array<[number, number, string]>;
}

async function main(): Promise<void> {
  const data: Array<[number, Array<[number, number, string]>]> = [];
  for (const year of YEARS) {
    data.push([year, await fetchYear(year)]);
    console.error(`${year} 받았습니다.`);
  }

  const fixture = {
    _meta: {
      description: "香港天文台(HKO) 24절기 기준 시각. 절기 엔진 정확도 검증용 테스트 픽스처.",
      source: "https://www.hko.gov.hk/en/gts/astronomy/data/files/24SolarTerms_YYYY.xml",
      timezone: "HKT = UTC+8 (홍콩 현지시). 한국 표준시(KST = UTC+9)로 보려면 1시간을 더한다.",
      format: "data = [year, [[월, 일, 'HH:MM'] × 24]] — 1월 소한부터 12월 동지 순서",
      order: MONTH_NAMES,
      years: YEARS,
    },
    data,
  };

  writeFileSync(DEST, `${JSON.stringify(fixture, null, 1)}\n`, "utf8");
  console.error(`${DEST} 에 ${YEARS.length * 24}건을 넣었습니다.`);
}

await main();