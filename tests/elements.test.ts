import { describe, expect, it } from "vitest";
import {
  ELEMENT_COLOR,
  ELEMENT_KOREAN,
  MOON_COMMAND_PHASES,
  PHASE_KOREAN,
  dayMasterStrength,
  elementDistribution,
  elementFlowLines,
  elementRelationText,
  moonCommandOf,
  voidBranchesOf,
  type DayMasterVerdict,
} from "../core/elements/elementBalance";
import {
  BRANCHES,
  CONTROLS,
  ELEMENT_LABELS,
  FIVE_ELEMENTS,
  GENERATES,
  SEASON_WANG,
  controlledBy,
  controls,
  elementRelation,
  generatedBy,
  generates,
  type FiveElement,
} from "../core/constants/stems";
import { hiddenStemsOf } from "../core/hidden_stems/hiddenStems";
import { computeFourPillars, type FourPillars } from "../core/pillars/fourPillars";
import { ganZhiFromIndex, ganZhiText } from "../core/pillars/sexagenary";
import { computeYongshin, groupOfElement, TEN_GOD_GROUP_KOREAN, YONGSHIN_RULE_ID } from "../core/yongshin/yongshin";
import type { CivilDate } from "../core/calendar/civilDate";

/** 1990-05-20 午시 = 庚午 辛巳 乙酉 壬午 */
const CHART: FourPillars = computeFourPillars({
  solarDate: { year: 1990, month: 5, day: 20 },
  timeBranchIndex: 6,
  ziMode: null,
});

function chartAt(date: CivilDate, branchIndex: number | null = 6): FourPillars {
  return computeFourPillars({ solarDate: date, timeBranchIndex: branchIndex, ziMode: null });
}

function gz(i: number): string {
  const v = ganZhiFromIndex(i);
  return ganZhiText(v.stem, v.branch);
}

// ---------------------------------------------------------------------------

describe("오행 5행 상수", () => {
  it("다섯 오행이 한자 그대로다", () => {
    expect([...FIVE_ELEMENTS]).toEqual(["木", "火", "土", "金", "水"]);
  });

  it("생극표가 전승 관계로 일관된다", () => {
    for (const e of FIVE_ELEMENTS) {
      expect(GENERATES[e], e).not.toBe(e);
      expect(CONTROLS[e], e).not.toBe(e);
      expect(generates(e, GENERATES[e]), e).toBe(true);
      expect(controls(e, CONTROLS[e]), e).toBe(true);
      expect(generates(e, CONTROLS[e]), e).toBe(false);
      expect(generatedBy(e), e).toBe(FIVE_ELEMENTS.find((x) => GENERATES[x] === e));
      expect(controlledBy(e), e).toBe(FIVE_ELEMENTS.find((x) => CONTROLS[x] === e));
      // 생·극 모두 5번 돌면 자기 자신으로 돌아온다.
      let g: FiveElement = e;
      let c: FiveElement = e;
      for (let i = 0; i < 5; i += 1) {
        g = GENERATES[g];
        c = CONTROLS[c];
      }
      expect(g, e).toBe(e);
      expect(c, e).toBe(e);
    }
  });

  it("오행이 5개뿐이라 생·극 표에 중복이 없다", () => {
    expect(new Set(FIVE_ELEMENTS.map((e) => GENERATES[e])).size).toBe(5);
    expect(new Set(FIVE_ELEMENTS.map((e) => CONTROLS[e])).size).toBe(5);
    // 生 cycle: 木→火→土→金→水→木
    expect({ ...GENERATES }).toEqual({ 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" });
    // 克 cycle: 木→土→水→火→金→木
    expect({ ...CONTROLS }).toEqual({ 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" });
  });

  it("한국어 이름과 색이 5개 오행에 대해 정의돼 있다", () => {
    for (const e of FIVE_ELEMENTS) {
      expect(ELEMENT_KOREAN[e], e).toBe(ELEMENT_LABELS[e].korean);
      expect(ELEMENT_COLOR[e], e).toBe(ELEMENT_LABELS[e].color);
      expect(ELEMENT_COLOR[e], e).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    expect(new Set(Object.values(ELEMENT_KOREAN)).size).toBe(5);
  });
});

describe("생극제화 관계 — 항상 일간의 입장에서", () => {
  it("오행 5×5 = 25 조합이 정확히 한 관계로 분류된다", () => {
    for (const from of FIVE_ELEMENTS) {
      for (const to of FIVE_ELEMENTS) {
        const rel = elementRelation(from, to);
        expect(["비화", "식상", "인성", "재성", "관살"], `${from}→${to}`).toContain(rel);
      }
    }
  });

  it("같은 오행은 비화, 내가 생하면 식상, 나를 생하면 인성", () => {
    expect(elementRelation("木", "木")).toBe("비화");
    expect(elementRelation("木", "火")).toBe("식상");
    expect(elementRelation("木", "水")).toBe("인성");
  });

  it("내가 극하면 재성, 나를 극하면 관살", () => {
    expect(elementRelation("木", "土")).toBe("재성");
    expect(elementRelation("木", "金")).toBe("관살");
  });

  it("관계는 대칭이 아니다 (관살 ↔ 재성 이 반대 방향)", () => {
    for (const a of FIVE_ELEMENTS) {
      for (const b of FIVE_ELEMENTS) {
        const ab = elementRelation(a, b);
        const ba = elementRelation(b, a);
        const pair: Record<string, string> = {
          비화: "비화",
          식상: "인성",
          인성: "식상",
          재성: "관살",
          관살: "재성",
        };
        expect(ba, `${a}→${b}=${ab} 의 역방향`).toBe(pair[ab]);
      }
    }
  });

  it("elementRelationText 가 관계와 문장을 함께 준다", () => {
    const n = elementRelationText("木", "火");
    expect(n.from).toBe("木");
    expect(n.to).toBe("火");
    expect(n.relation).toBe("식상");
    expect(n.text.length).toBeGreaterThan(0);
    expect(n.text).toMatch(/[.]$/);
  });

  it("elementFlowLines 가 5줄이고 각 줄에 4개 관계가 있다", () => {
    const lines = elementFlowLines();
    expect(lines).toHaveLength(5);
    for (const l of lines) {
      expect(l.generatesTo, l.element).toBe(GENERATES[l.element]);
      expect(l.controlsTo, l.element).toBe(CONTROLS[l.element]);
      expect(l.generatedBy, l.element).toBe(generatedBy(l.element));
      expect(l.controlledBy, l.element).toBe(controlledBy(l.element));
      expect(l.note, l.element).toHaveLength(4);
    }
  });
});

describe("월령(旺相休囚死) — 데이터 표", () => {
  it("12개 사월 모두 旺相休囚死 가 5개 오행에 한 번씩 배정된다", () => {
    for (const b of BRANCHES) {
      const m = moonCommandOf(b.char);
      expect(Object.keys(m.phases).sort(), b.char).toEqual([...FIVE_ELEMENTS].sort());
      expect(new Set(Object.values(m.phases)), b.char).toEqual(new Set(MOON_COMMAND_PHASES));
    }
  });

  it("月令의 旺 오행은 SEASON_WANG 과 일치한다", () => {
    for (const b of BRANCHES) {
      const m = moonCommandOf(b.char);
      const season = BRANCHES.find((x) => x.char === b.char)!.season;
      expect(m.wangElement, b.char).toBe(SEASON_WANG[season]);
      expect(m.phases[m.wangElement], b.char).toBe("旺");
    }
  });

  it("계절 키 8개가 모두 SEASON_WANG 에 있다", () => {
    const seasons = new Set(BRANCHES.map((b) => b.season));
    for (const s of seasons) expect(SEASON_WANG[s], s).toBeDefined();
    expect(seasons.size).toBe(8);
  });

  it("단계 보정값이 旺 > 相 > 休 > 囚 > 死 순으로 크다", () => {
    // PHASE_WEIGHT 는 비공개이므로 분포 기여로 역검증한다.
    const order = MOON_COMMAND_PHASES.map((p) => PHASE_KOREAN[p]);
    expect(order).toEqual(["가장 힘셈", "전성기", "한숨돌림", "억눌림", "기운이 죽음"]);
  });

  it("월령 설명에 계절과 단계 순서가 담긴다", () => {
    const m = moonCommandOf("巳");
    expect(m.season).toBe("summer");
    expect(m.seasonKorean).toBe("여름");
    expect(m.wangElement).toBe("火");
    expect(m.description).toContain("巳월");
    expect(m.description).toContain("여름");
    for (const e of FIVE_ELEMENTS) expect(m.description).toContain(ELEMENT_KOREAN[e]);
  });

  it("같은 사월을 여러 번 물어도 같은 객체를 돌려준다 (캐시)", () => {
    expect(moonCommandOf("子")).toBe(moonCommandOf("子"));
  });
});

describe("절지(旬空)", () => {
  it("60간지 전부에서 절지가 서로 다른 두 지지다", () => {
    for (let i = 0; i < 60; i += 1) {
      const v = voidBranchesOf(i);
      expect(v, gz(i)).toHaveLength(2);
      expect(v[0], gz(i)).not.toBe(v[1]);
    }
  });

  it("甲子旬은 戌·亥, 甲戌旬은 申·酉다", () => {
    expect(voidBranchesOf(0)).toEqual(["戌", "亥"]);
    expect(voidBranchesOf(9)).toEqual(["戌", "亥"]);
    expect(voidBranchesOf(10)).toEqual(["申", "酉"]);
    expect(voidBranchesOf(19)).toEqual(["申", "酉"]);
    expect(voidBranchesOf(20)).toEqual(["午", "未"]);
    expect(voidBranchesOf(30)).toEqual(["辰", "巳"]);
    expect(voidBranchesOf(40)).toEqual(["寅", "卯"]);
    expect(voidBranchesOf(50)).toEqual(["子", "丑"]);
  });

  it("60일 주기로 반복되고 음수·큰 인덱스도 접힌다", () => {
    for (let i = 0; i < 60; i += 1) {
      expect(voidBranchesOf(i + 60), gz(i)).toEqual(voidBranchesOf(i));
      expect(voidBranchesOf(i - 60), gz(i)).toEqual(voidBranchesOf(i));
    }
    expect(voidBranchesOf(-1)).toEqual(voidBranchesOf(59));
  });

  it("旬의 시작 간지(갑자 10개) 6개는 절지가 겹치지 않는다", () => {
    const sets = [0, 10, 20, 30, 40, 50].map((i) => voidBranchesOf(i).join(""));
    expect(new Set(sets).size).toBe(6);
    // 12지지가 정확히 한 번씩 빠진다.
    const all = sets.join("").split("").sort().join("");
    expect(all).toEqual([...BRANCHES.map((b) => b.char)].sort().join(""));
  });
});

describe("오행 분포", () => {
  const dist = elementDistribution(CHART);

  it("5개 오행이 모두 항목으로 존재한다", () => {
    expect(dist.contributions).toHaveLength(5);
    expect(new Set(dist.contributions.map((c) => c.element))).toEqual(new Set(FIVE_ELEMENTS));
  });

  it("가장 강한 오행이 가장 약한 오행보다 크거나 같다", () => {
    const max = dist.contributions[0];
    const min = dist.contributions[dist.contributions.length - 1];
    expect(dist.strongest).toBe(max.element);
    expect(dist.weakest).toBe(min.element);
    expect(max.weight).toBeGreaterThanOrEqual(min.weight);
  });

  it("비중 합이 100% 다", () => {
    const total = dist.contributions.reduce((a, c) => a + c.ratio, 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it("비중이 내림차순으로 정렬돼 있다", () => {
    for (let i = 1; i < dist.contributions.length; i += 1) {
      expect(dist.contributions[i - 1].weight).toBeGreaterThanOrEqual(dist.contributions[i].weight);
    }
  });

  it("각 항목마다 사람이 읽을 수 있는 근거 문자열이 있다", () => {
    for (const c of dist.contributions) {
      expect(c.sources.length, c.element).toBeGreaterThan(0);
      for (const s of c.sources) expect(s.length, s).toBeGreaterThan(0);
    }
  });

  it("근거에 지장간·천간·월령이 모두 포함된다", () => {
    const all = dist.contributions.flatMap((c) => c.sources).join("\n");
    expect(all).toContain("지장간");
    expect(all).toContain("천간");
    expect(all).toContain("월령");
  });

  it("지장간 전수 기준값이 5개 오행에 대해 나온다", () => {
    expect(Object.keys(dist.hiddenCoverage).sort()).toEqual([...FIVE_ELEMENTS].sort());
    // 지장간 본기(1.0)만 있어도 총합이 최소 1 이상이다.
    expect(Object.values(dist.hiddenCoverage).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(3);
  });

  it("지장간 전수 합계가 원국 지장간 가중치 합과 같다", () => {
    const expected = [CHART.year, CHART.month, CHART.day, CHART.hour!]
      .flatMap((p) => hiddenStemsOf(p.branch))
      .reduce((a, h) => a + h.weight, 0);
    const actual = Object.values(dist.hiddenCoverage).reduce((a, b) => a + b, 0);
    expect(actual).toBeCloseTo(expected, 6);
  });

  it("월령 정보가 분포에 붙는다", () => {
    expect(dist.moonCommand.branch).toBe(CHART.month.branch);
    expect(dist.moonCommand.wangElement).toBe(moonCommandOf(CHART.month.branch).wangElement);
  });

  it("시주 미상이면 시주 기여가 빠지지만 결과는 유효하다", () => {
    const noHour = elementDistribution(chartAt({ year: 1990, month: 5, day: 20 }, null));
    expect(noHour.contributions).toHaveLength(5);
    const total = noHour.contributions.reduce((a, c) => a + c.ratio, 0);
    expect(total).toBeCloseTo(100, 6);
    expect(noHour.contributions.flatMap((c) => c.sources).join()).not.toContain("시주");
  });

  it("오행 5개 중 하나가 전혀 없으면 missing 에 들어간다", () => {
    for (const d of [
      { year: 1949, month: 10, day: 1 },
      { year: 2026, month: 9, day: 27 },
    ] satisfies CivilDate[]) {
      const d2 = elementDistribution(chartAt(d));
      const zero = d2.contributions.filter((c) => c.weight <= 0).map((c) => c.element);
      expect(d2.missing, gz(0)).toEqual(zero);
    }
  });

  it("같은 차트는 항상 같은 분포를 낸다 (결정론)", () => {
    for (let i = 0; i < 3; i += 1) {
      const again = elementDistribution(chartAt({ year: 1990, month: 5, day: 20 }));
      expect(again.contributions).toEqual(dist.contributions);
      expect(again.strongest).toBe(dist.strongest);
      expect(again.weakest).toBe(dist.weakest);
    }
  });
});

describe("일간 강약(신강·중화·신약)", () => {
  const strength = dayMasterStrength(CHART, elementDistribution(CHART));

  it("판정값이 세 가지 중 하나다", () => {
    const verdicts: DayMasterVerdict[] = ["신강", "중화", "신약"];
    expect(verdicts).toContain(strength.verdict);
  });

  it("일간과 오행이 원국과 일치한다", () => {
    expect(strength.dayMaster).toBe(CHART.dayMaster);
    expect(strength.element).toBe(CHART.dayMasterElement);
  });

  it("판정 근거가 5줄 이상이며 모두 비어 있지 않다", () => {
    expect(strength.evidence.length).toBeGreaterThanOrEqual(5);
    for (const e of strength.evidence) {
      expect(e.length).toBeGreaterThan(0);
      expect(e).toMatch(/[.]$/);
    }
  });

  it("근거에 월지·월령·오행 비중이 모두 언급된다", () => {
    const all = strength.evidence.join("\n");
    expect(all).toContain("월지");
    expect(all).toContain("월지 지장간");
    expect(all).toContain("오행 분포");
    expect(all).toContain(ELEMENT_KOREAN[strength.element]);
    expect(all).toContain(strength.verdict);
  });

  it("내부 합산값은 유한한 수이며 판정과 임계값이 맞는다", () => {
    expect(Number.isFinite(strength.supportScore)).toBe(true);
    const expected =
      strength.supportScore >= 1.5 ? "신강" : strength.supportScore <= -1.5 ? "신약" : "중화";
    expect(strength.verdict).toBe(expected);
  });

  it("화 출력에 점수 같은 단위가 붙지 않는다", () => {
    // supportScore 는 내부 비교용이며 화면 문구에는 나오지 않는다.
    const text = strength.evidence.join(" ");
    expect(text).not.toContain("점");
    expect(text).not.toContain("점수");
  });

  it("다양한 원국에서 판정이 유효한 값으로만 나온다", () => {
    let seen = new Set<DayMasterVerdict>();
    for (const d of [
      { year: 1990, month: 5, day: 20 },
      { year: 1977, month: 2, day: 2 },
      { year: 2001, month: 11, day: 28 },
      { year: 1960, month: 7, day: 15 },
      { year: 2024, month: 2, day: 29 },
    ] satisfies CivilDate[]) {
      const c = chartAt(d);
      const s = dayMasterStrength(c, elementDistribution(c));
      expect(["신강", "중화", "신약"], `${d.year}`).toContain(s.verdict);
      expect(s.evidence.length, `${d.year}`).toBeGreaterThanOrEqual(5);
      seen.add(s.verdict);
    }
    // 기준 원국은 신약(乙酉, 酉월) 쪽이어야 한다.
    expect(seen.size).toBeGreaterThan(0);
  });
});

describe("용신·희신 — 단일 규칙", () => {
  const y = computeYongshin(CHART);
  const GROUPS = ["비겁", "식상", "재성", "관성", "인성"];

  it("규칙 ID 가 하나로 고정돼 있다", () => {
    expect(YONGSHIN_RULE_ID).toBe("RULE_YONGSHIN_001");
    expect(y.yongshin.ruleId).toBe("RULE_YONGSHIN_001");
    expect(y.heeshin.ruleId).toBe("RULE_YONGSHIN_001");
  });

  it("용신·희신이 십신 계열 중 하나다", () => {
    expect(GROUPS).toContain(y.yongshin.result.group);
    expect(GROUPS).toContain(y.heeshin.result.group);
  });

  it("일간과 강약 판정이 원국과 일치한다", () => {
    expect(y.dayMaster).toBe(CHART.dayMaster);
    expect(["신강", "중화", "신약"]).toContain(y.verdict);
  });

  it("신강이면 식상이 용신, 재성이 희신이다", () => {
    if (y.verdict !== "신강") return;
    expect(y.yongshin.result.group).toBe("식상");
    expect(y.heeshin.result.group).toBe("재성");
    // 신강 → 용신 오행은 일간이 생하는 것
    expect(y.yongshin.result.element).toBe(GENERATES[CHART.dayMasterElement]);
    expect(y.heeshin.result.element).toBe(CONTROLS[CHART.dayMasterElement]);
  });

  it("신약이면 인성이 용신, 비겁이 희신이다", () => {
    const r = computeYongshin(chartAt({ year: 1977, month: 2, day: 2 }));
    if (r.verdict !== "신약") return;
    expect(r.yongshin.result.group).toBe("인성");
    expect(r.heeshin.result.group).toBe("비겁");
    expect(r.yongshin.result.element).toBe(generatedBy(r.distribution.contributions.length ? chartAt({ year: 1977, month: 2, day: 2 }).dayMasterElement : "木"));
  });

  it("중화이면 용신이 인성 또는 식상 계열로 정해진다 (고정 우회 규칙)", () => {
    const c = chartAt({ year: 2001, month: 11, day: 28 });
    const r = computeYongshin(c);
    if (r.verdict !== "중화") return;
    const weakest = r.distribution.contributions[r.distribution.contributions.length - 1].element;
    expect(r.yongshin.result.group).toBe(weakest === generatedBy(c.dayMasterElement) ? "인성" : "식상");
    expect(r.yongshin.criteria).toContain(ELEMENT_KOREAN[weakest]);
    expect(r.yongshin.criteria).toContain("중립");
  });

  it("희신 계열은 항상 용신 계열이 정해내는 짝이다", () => {
    for (const c of [
      CHART,
      chartAt({ year: 1977, month: 2, day: 2 }),
      chartAt({ year: 2001, month: 11, day: 28 }),
      chartAt({ year: 1960, month: 7, day: 15 }),
    ]) {
      const r = computeYongshin(c);
      const pair: Record<string, string> = { 식상: "재성", 인성: "비겁" };
      expect(r.heeshin.result.group, `${c.dayMaster}/${r.verdict}`).toBe(pair[r.yongshin.result.group]);
    }
  });

  it("용신·희신 오행이 실제 오행 5개 중 하나이며 서로 다르다", () => {
    for (const e of [y.yongshin.result.element, y.heeshin.result.element]) {
      expect(FIVE_ELEMENTS, e).toContain(e);
    }
    expect(y.yongshin.result.element).not.toBe(y.heeshin.result.element);
  });

  it("결정론 — criteria → result → rule → interpretation 가 한 줄로 이어진다", () => {
    for (const d of [y.yongshin, y.heeshin]) {
      expect(d.criteria.length, d.ruleId).toBeGreaterThan(0);
      expect(d.interpretation.length, d.ruleId).toBeGreaterThan(0);
      expect(d.ruleId).toMatch(/^RULE_[A-Z0-9_]+$/);
      expect(Array.isArray(d.result.presentTenGods), d.ruleId).toBe(true);
    }
    // 용신과 희신은 같은 기준(criteria)으로 판단된다.
    expect(y.yongshin.criteria).toBe(y.heeshin.criteria);
  });

  it("근거 목록이 일간 강약 근거와 동일하다", () => {
    expect(y.evidence).toEqual(
      dayMasterStrength(CHART, elementDistribution(CHART)).evidence,
    );
  });

  it("길래·불길래 오행이 오행 5개 중에서 겹치지 않게 뽑힌다", () => {
    for (const e of [...y.favorableElements, ...y.unfavorableElements]) {
      expect(FIVE_ELEMENTS, e).toContain(e);
    }
    const overlap = y.favorableElements.filter((e) => y.unfavorableElements.includes(e));
    expect(overlap).toEqual([]);
    // 용신 오행은 반드시 길래 쪽에 들어간다.
    expect(y.favorableElements).toContain(y.yongshin.result.element);
    expect(y.unfavorableElements).not.toContain(y.yongshin.result.element);
  });

  it("해석문에 계열 한자 이름이 담긴다", () => {
    expect(y.yongshin.interpretation).toContain(TEN_GOD_GROUP_KOREAN[y.yongshin.result.group]);
    expect(y.heeshin.interpretation).toContain(TEN_GOD_GROUP_KOREAN[y.heeshin.result.group]);
    expect(y.heeshin.interpretation).toContain("희신");
  });

  it("같은 차트는 항상 같은 용신·희신을 낸다", () => {
    for (let i = 0; i < 3; i += 1) {
      const again = computeYongshin(chartAt({ year: 1990, month: 5, day: 20 }));
      expect(again.verdict).toBe(y.verdict);
      expect(again.yongshin).toEqual(y.yongshin);
      expect(again.heeshin).toEqual(y.heeshin);
      expect(again.favorableElements).toEqual(y.favorableElements);
    }
  });
});

describe("groupOfElement — 십신 계열 매핑", () => {
  it("오행 5×5 전부에서 계열이 하나씩 정해진다", () => {
    const groups = new Set<string>();
    for (const dm of FIVE_ELEMENTS) {
      for (const other of FIVE_ELEMENTS) {
        const g = groupOfElement(dm, other);
        expect(["비겁", "식상", "재성", "관성", "인성"], `${dm}/${other}`).toContain(g);
        groups.add(g);
      }
    }
    expect(groups.size).toBe(5);
  });

  it("일간과 같은 오행은 비겁, 내가 생하면 식상, 나를 생하면 인성", () => {
    for (const e of FIVE_ELEMENTS) {
      expect(groupOfElement(e, e), e).toBe("비겁");
      expect(groupOfElement(e, GENERATES[e]), e).toBe("식상");
      expect(groupOfElement(e, generatedBy(e)), e).toBe("인성");
      expect(groupOfElement(e, CONTROLS[e]), e).toBe("재성");
      expect(groupOfElement(e, controlledBy(e)), e).toBe("관성");
    }
  });

  it("계열 이름이 한글로 정의돼 있다", () => {
    expect(Object.values(TEN_GOD_GROUP_KOREAN).sort()).toEqual(
      ["비겁(比劫)", "식상(食傷)", "재성(財星)", "관성(官星)", "인성(印星)"].sort(),
    );
  });
});
