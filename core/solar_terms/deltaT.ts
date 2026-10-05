/**
 * ΔT = TT − UT (초) 근사.
 *
 * 절기 계산은 태양의 겉보기황도를 천체력시(TT)로 계산하므로, 그 결과를
 * 한국 표준시(KST) 같은 지구시계로 옮길 때 ΔT 만큼 빼야 한다.
 *
 * 출처: Espenak & Meeus, "Polynomial Expressions for Delta T"
 *       (NASA Eclipse Web Site, Polyex 3.2 / 3.1 표)
 * 결정 규칙: 이 프로젝트는 단일 식군(Espenak–Meeus)만 사용하며 다른
 * ΔT 근사를 섞지 않는다. (docs/calculation-rules.md 절기 기준 참조)
 */

/** Julian centuries since J2000.0 (TT) for the given decimal year. */
function centuriesSinceJ2000(year: number): number {
  return (year - 2000) / 100;
}

export function deltaTSeconds(year: number): number {
  const y = year;
  if (y < -500) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (y < 500) {
    const u = y / 100;
    return (
      10583.6 - 1014.41 * u + 33.78311 * u ** 2 - 5.952053 * u ** 3 -
      0.1798452 * u ** 4 + 0.022174192 * u ** 5 + 0.0090316521 * u ** 6
    );
  }
  if (y < 1600) {
    const u = (y - 1000) / 100;
    return (
      1574.2 - 556.01 * u + 71.23472 * u ** 2 + 0.319781 * u ** 3 -
      0.8503463 * u ** 4 - 0.005050998 * u ** 5 + 0.0083572073 * u ** 6
    );
  }
  if (y < 1700) {
    const t = y - 1600;
    return 120 - 0.9808 * t - 0.01532 * t ** 2 + t ** 3 / 7129;
  }
  if (y < 1800) {
    const t = y - 1700;
    return 8.83 + 0.1603 * t - 0.0059285 * t ** 2 + 0.00013336 * t ** 3 - t ** 4 / 1174000;
  }
  if (y < 1860) {
    const t = y - 1800;
    return (
      13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 -
      0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7
    );
  }
  if (y < 1900) {
    const t = y - 1860;
    return (
      7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 -
      0.0004473624 * t ** 4 + t ** 5 / 233174
    );
  }
  if (y < 1920) {
    const t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (y < 1941) {
    const t = y - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (y < 1961) {
    const t = y - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (y < 1986) {
    const t = y - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (y < 2005) {
    const t = y - 2000;
    return (
      63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 +
      0.000651814 * t ** 4 + 0.00002373599 * t ** 5
    );
  }
  if (y < 2050) {
    const t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  }
  if (y < 2150) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u - 0.5628 * (2150 - y);
  }
  const u = (y - 1820) / 100;
  return -20 + 32 * u * u;
}

/** Julian centuries from J2000 for a decimal year (TT 근사용). */
export function julianCenturies(year: number): number {
  return centuriesSinceJ2000(year);
}
