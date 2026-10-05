/**
 * 태양 겉보기황도 (Sun apparent geocentric ecliptic longitude).
 *
 * 규칙 (RULE_SUNLONG_001, docs/calculation-rules.md)
 * - 근사 위치: Meeus, "Astronomical Algorithms" 2판 25장 저정밀도 식
 *   (태양의 지구 중심 황도경도, 정밀도 약 0.01° ≈ 15분).
 * - 이 식에 Meeus 25장의 행성 摄動 보정항(A~E 항)을 더해 잔차를 줄인다.
 * - 겉보기황도 = 기하황도 − 수차(0.00569°) − 岁差·章동 근사(0.00478°·sinΩ).
 *
 * 이 모듈은 규칙(어떤 공식을 쓰는지)과 표 데이터를 분리해 두며,
 * 다른 천문 알고리즘을 섞지 않는다. 정확도 검증은 tests/solarTerms.test.ts.
 */

const DEG = Math.PI / 180;

function sin(deg: number): number {
  return Math.sin(deg * DEG);
}

function cos(deg: number): number {
  return Math.cos(deg * DEG);
}

function norm360(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

export const J2000_JD = 2451545.0;
const DAYS_PER_JULIAN_YEAR = 365.25;

export interface SunPosition {
  /** 기하평균황도 (도) */
  meanLongitude: number;
  /** 태양 근점각 M (도) */
  meanAnomaly: number;
  /** 지구 중심 기하황도 (도) */
  geometricLongitude: number;
  /** 겉보기황도 (도), 0-360 */
  apparentLongitude: number;
  /** 지구-태양 거리 (AU) */
  radiusVector: number;
}

/**
 * Julian Day (TT) 에서의 태양 위치.
 * @param jde Julian Day (역서시, TT)
 */
export function sunPosition(jde: number): SunPosition {
  const T = (jde - J2000_JD) / (DAYS_PER_JULIAN_YEAR * 100);

  const meanLongitude = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const meanAnomaly = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);

  // 이심률 진법 (equation of the centre)
  const c =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(meanAnomaly) +
    (0.019993 - 0.000101 * T) * sin(2 * meanAnomaly) +
    0.000289 * sin(3 * meanAnomaly);

  let lambda = norm360(meanLongitude + c);

  // 행성 섭동 보정 (Meeus 25장, 화성·금성·지구·토성·수성의 지구 반대편 운동)
  const a1 = norm360(153.23 + 22518.7541 * T);
  const a2 = norm360(216.57 + 45037.5082 * T);
  const a3 = norm360(312.69 + 32964.3577 * T);
  const a4 = norm360(350.74 + 445267.1142 * T);
  const a5 = norm360(231.19 + 20.2 * T);
  lambda +=
    0.00134 * sin(a1) +
    0.00154 * sin(a2) +
    0.002 * sin(a3) +
    0.00179 * sin(a4) +
    0.00178 * sin(a5);

  // 지구-태양 거리
  const radiusVector =
    1.000001018 * (1 - 0.016708634 * 0.016708634) / (1 + 0.016708634 * cos(meanAnomaly));

  // 수차 + 장동·진동 근사 → 겉보기황도
  const omega = norm360(125.04 - 1934.136 * T);
  const apparentLongitude = norm360(lambda - 0.00569 - 0.00478 * sin(omega));

  return { meanLongitude, meanAnomaly, geometricLongitude: norm360(lambda), apparentLongitude, radiusVector };
}
