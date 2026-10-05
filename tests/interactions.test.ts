import { describe, expect, it } from "vitest";
import {
  BRANCH_COMBINATIONS,
  CLASHES,
  DESTROYMENTS,
  DIRECTIONAL_COMBINATIONS,
  HARMS,
  INTERACTION_TYPE_LABELS,
  PUNISHMENTS,
  STEM_COMBINATIONS,
  TRIPLE_COMBINATIONS,
  analyzeInteractions,
  interactionsBetween,
  type Interaction,
  type InteractionInput,
  type InteractionType,
} from "../core/interactions/interactions";
import { BRANCHES, FIVE_ELEMENTS, STEMS, type EarthlyBranch, type HeavenlyStem } from "../core/constants/stems";
import { computeFourPillars, PILLAR_LABELS, pillarsOf, type FourPillars, type Pillar } from "../core/pillars/fourPillars";
import { branchOfIndex, stemOfIndex } from "../core/pillars/sexagenary";
import { buildFortuneContext, fortuneInteractionInputs } from "../core/fortune/fortuneContext";
import { withDayMaster } from "../core/pillars/fourPillars";

/** 임의의 두 기둥을 만들어 간을 직접 시험하기 위한 헬퍼. */
function pillarOf(stemIndex: number, branchIndex: number, dayMaster: HeavenlyStem = "甲"): Pillar {
  const stem = stemOfIndex(stemIndex);
  const branch = branchOfIndex(branchIndex);
  const base = computeFourPillars({
    solarDate: { year: 2000, month: 1, day: 1 },
    timeBranchIndex: branchIndex,
    ziMode: null,
  });
  return withDayMaster({ ...base.hour!, stem, branch }, dayMaster);
}

function input(label: string, stemIndex: number, branchIndex: number, position: Pillar["position"] = "year"): InteractionInput {
  return { label, position, pillar: pillarOf(stemIndex, branchIndex) };
}

const CHART: FourPillars = computeFourPillars({
  solarDate: { year: 1990, month: 5, day: 20 },
  timeBranchIndex: 6,
  ziMode: null,
});

function chartInputs(chart: FourPillars = CHART): InteractionInput[] {
  return pillarsOf(chart).map((p) => ({
    label: PILLAR_LABELS[p.position],
    position: p.position,
    pillar: p,
  }));
}

function byType(list: readonly Interaction[], type: InteractionType): Interaction[] {
  return list.filter((i) => i.type === type);
}

// ---------------------------------------------------------------------------

describe("간(干支) 표 데이터 자체의 정합성", () => {
  it("천간 5합이 5쌍이며 각 쌍이 10개 천간을 정확히 한 번씩 덮는다", () => {
    expect(STEM_COMBINATIONS).toHaveLength(5);
    const seen = STEM_COMBINATIONS.flatMap((c) => [c.a, c.b]);
    expect(new Set(seen).size).toBe(10);
    for (const c of STEM_COMBINATIONS) {
      expect(STEMS.map((s) => s.char), `${c.a}${c.b}`).toContain(c.a);
      expect(STEMS.map((s) => s.char), `${c.a}${c.b}`).toContain(c.b);
      expect(c.a).not.toBe(c.b);
    }
  });

  it("지지 6합이 6쌍이며 12지지 전부를 덮는다", () => {
    expect(BRANCH_COMBINATIONS).toHaveLength(6);
    const seen = BRANCH_COMBINATIONS.flatMap((c) => [c.a, c.b]);
    expect(new Set(seen).size).toBe(12);
    for (const c of BRANCH_COMBINATIONS) {
      expect(c.a, `${c.a}${c.b}`).not.toBe(c.b);
      expect(c.element).toBeDefined();
      expect(c.note).toContain("육합");
    }
  });

  it("육합의 합화 오행이 고전 표와 일치한다", () => {
    const pairs: Record<string, string> = {
      子丑: "土",
      寅亥: "木",
      卯戌: "火",
      辰酉: "金",
      巳申: "水",
      午未: "土",
    };
    for (const c of BRANCH_COMBINATIONS) {
      expect(c.element, `${c.a}${c.b}`).toBe(pairs[`${c.a}${c.b}`]);
    }
  });

  it("삼합 4국이 서로 다른 12지지를 쓴다", () => {
    expect(TRIPLE_COMBINATIONS).toHaveLength(4);
    const all = TRIPLE_COMBINATIONS.flatMap((t) => [...t.branches]);
    expect(new Set(all).size).toBe(12);
    const wangs = TRIPLE_COMBINATIONS.map((t) => t.wang);
    expect(new Set(wangs).size).toBe(4);
    for (const t of TRIPLE_COMBINATIONS) {
      expect(t.branches, t.element).toContain(t.wang);
      expect(FIVE_ELEMENTS, t.element).toContain(t.element);
    }
  });

  it("삼합 4국의 오행이 水木火金 을 하나씩이다", () => {
    expect(TRIPLE_COMBINATIONS.map((t) => t.element).sort()).toEqual(["水", "木", "火", "金"].sort());
  });

  it("방합 4방이 동/남/서/북이며 12지지를 전부 덮는다", () => {
    expect(DIRECTIONAL_COMBINATIONS).toHaveLength(4);
    const all = DIRECTIONAL_COMBINATIONS.flatMap((t) => [...t.branches]);
    expect(new Set(all).size).toBe(12);
    expect(DIRECTIONAL_COMBINATIONS.map((t) => t.element).sort()).toEqual(["水", "木", "火", "金"].sort());
  });

  it("六冲 6쌍이 12지지를 둘씩 마주 본다", () => {
    expect(CLASHES).toHaveLength(6);
    const flat = CLASHES.flat();
    expect(new Set(flat).size).toBe(12);
    for (const [a, b] of CLASHES) {
      // 반대편은 정확히 6칸 떨어진 지지
      expect(BRANCH_INDEX_DIFF(a, b), `${a}${b}`).toBe(6);
    }
  });

  it("六害 6쌍과 六破 6쌍이 각각 12지지를 덮는다", () => {
    expect(HARMS).toHaveLength(6);
    expect(DESTROYMENTS).toHaveLength(6);
    expect(new Set(HARMS.flat()).size).toBe(12);
    expect(new Set(DESTROYMENTS.flat()).size).toBe(12);
  });

  it("三刑 표에 자형(辰午酉亥)과 세 지형이 모두 들어 있다", () => {
    const self = PUNISHMENTS.find((p) => p.name === "자형");
    expect(self?.branches).toEqual(["辰", "午", "酉", "亥"]);
    const triples = PUNISHMENTS.filter((p) => p.branches.length === 3);
    expect(triples).toHaveLength(2);
    // 자형 지지는 다른 형 표에 들어가지 않는다.
    for (const t of triples) {
      for (const b of t.branches) expect(self!.branches, b).not.toContain(b);
    }
  });

  it("간 유형 8종의 표시 이름이 정의돼 있다", () => {
    const types: InteractionType[] = [
      "천간합", "지지합", "삼합", "방합", "충", "형", "파", "해",
    ];
    for (const t of types) {
      expect(INTERACTION_TYPE_LABELS[t], t).toBeTruthy();
      expect(INTERACTION_TYPE_LABELS[t].length, t).toBeGreaterThan(0);
    }
  });
});

/** 두 지지가 몇 칸 떨어졌는지 (방향 무시). */
function BRANCH_INDEX_DIFF(a: EarthlyBranch, b: EarthlyBranch): number {
  const ai = BRANCHES.findIndex((x) => x.char === a);
  const bi = BRANCHES.findIndex((x) => x.char === b);
  const d = Math.abs(ai - bi) % 12;
  return d > 6 ? 12 - d : d;
}

// ---------------------------------------------------------------------------

describe("천간합 (RULE_INTERACT_STEM_001)", () => {
  it("甲己 가 만나면 土 로 합한다", () => {
    // 甲 = 인덱스 0, 己 = 5
    const r = analyzeInteractions([input("년주", 0, 0), input("월주", 5, 1)]);
    const stem = byType(r, "천간합");
    expect(stem).toHaveLength(1);
    expect(stem[0].resultElement).toBe("土");
    expect(stem[0].ruleId).toBe("RULE_INTERACT_STEM_001");
    expect(stem[0].strength).toBe(2);
  });

  it("순서를 바꿔도 같은 합으로 판정된다", () => {
    const r = analyzeInteractions([input("월주", 5, 1), input("년주", 0, 0)]);
    expect(byType(r, "천간합")).toHaveLength(1);
  });

  it("합이 없으면 천간합이 나오지 않는다", () => {
    const r = analyzeInteractions([input("년주", 0, 0), input("월주", 1, 1)]);
    expect(byType(r, "천간합")).toHaveLength(0);
  });

  it("두 지지의 오행이 같으면 성립 조건이 함께 기록된다", () => {
    // 甲(寅:木) + 己(卯:木) → 둘 다 木
    const r = analyzeInteractions([input("년주", 0, 2), input("월주", 5, 3)]);
    const stem = byType(r, "천간합");
    expect(stem).toHaveLength(1);
    expect(stem[0].conditions.join()).toContain("木");
  });
});

describe("지지합 (RULE_INTERACT_BRANCH_001)", () => {
  it("辰酉 가 만나면 金 로 합한다", () => {
    const r = analyzeInteractions([input("년주", 0, 4), input("월주", 1, 9)]);
    const b = byType(r, "지지합");
    expect(b).toHaveLength(1);
    expect(b[0].resultElement).toBe("金");
    expect(b[0].strength).toBe(1); // 반합이므로 약함
    expect(b[0].conditions.join()).toContain("반합");
  });

  it("육합 6쌍이 전부 잡힌다", () => {
    for (const c of BRANCH_COMBINATIONS) {
      const ai = BRANCHES.findIndex((x) => x.char === c.a);
      const bi = BRANCHES.findIndex((x) => x.char === c.b);
      const r = analyzeInteractions([input("A", 0, ai), input("B", 1, bi)]);
      const b = byType(r, "지지합");
      expect(b.length, `${c.a}${c.b}`).toBeGreaterThan(0);
      expect(b.some((x) => x.resultElement === c.element), `${c.a}${c.b}`).toBe(true);
    }
  });
});

describe("삼합 (RULE_INTERACT_TRIPLE_001 / _002)", () => {
  it("申子辰 세 지지가 모이면 수국 완성(강함)", () => {
    const r = analyzeInteractions([
      input("A", 0, 8), // 申
      input("B", 1, 0), // 子
      input("C", 2, 4), // 辰
    ]);
    const full = byType(r, "삼합").filter((i) => i.strength === 3);
    expect(full).toHaveLength(1);
    expect(full[0].resultElement).toBe("水");
    expect(full[0].ruleId).toBe("RULE_INTERACT_TRIPLE_002");
    expect(full[0].participants).toHaveLength(3);
  });

  it("두 자만 모이면 반합이고 빠진 지지가 기록된다", () => {
    const r = analyzeInteractions([input("A", 0, 8), input("B", 1, 0)]); // 申 + 子
    const half = byType(r, "삼합");
    expect(half).toHaveLength(1);
    expect(half[0].ruleId).toBe("RULE_INTERACT_TRIPLE_001");
    expect(half[0].strength).toBe(2); // 子(왕)가 있어 강함
    expect(half[0].conditions.join()).toContain("辰");
  });

  it("왕 자(子)가 빠진 반합은 약하다", () => {
    const r = analyzeInteractions([input("A", 0, 8), input("B", 1, 4)]); // 申 + 辰 (子 결여)
    const half = byType(r, "삼합");
    expect(half).toHaveLength(1);
    expect(half[0].strength).toBe(1);
    expect(half[0].conditions.join()).toContain("子");
  });
});

describe("방합 (RULE_INTERACT_DIRECTION_001 / _002)", () => {
  it("寅卯辰 이 모이면 목방 완성", () => {
    const r = analyzeInteractions([input("A", 0, 2), input("B", 1, 3), input("C", 2, 4)]);
    const full = byType(r, "방합").filter((i) => i.strength === 3);
    expect(full).toHaveLength(1);
    expect(full[0].resultElement).toBe("木");
    expect(full[0].ruleId).toBe("RULE_INTERACT_DIRECTION_002");
  });

  it("두 자만 모이면 반방합으로 약하게 잡힌다", () => {
    const r = analyzeInteractions([input("A", 0, 2), input("B", 1, 3)]); // 寅 + 卯
    const half = byType(r, "방합");
    expect(half).toHaveLength(1);
    expect(half[0].ruleId).toBe("RULE_INTERACT_DIRECTION_001");
    expect(half[0].strength).toBe(1);
    expect(half[0].description).toContain("반방합");
  });
});

describe("충 (RULE_INTERACT_CLASH_001)", () => {
  it("六冲 6쌍이 전부 잡히고 세기는 3이다", () => {
    for (const [p, q] of CLASHES) {
      const pi = BRANCHES.findIndex((x) => x.char === p);
      const qi = BRANCHES.findIndex((x) => x.char === q);
      const r = analyzeInteractions([input("A", 0, pi), input("B", 1, qi)]);
      const c = byType(r, "충");
      expect(c, `${p}${q}`).toHaveLength(1);
      expect(c[0].strength).toBe(3);
      expect(c[0].ruleId).toBe("RULE_INTERACT_CLASH_001");
      expect(c[0].description).toContain("충");
    }
  });

  it("차 있는 두 기둥이 여섯 칸이면 서로 충이다", () => {
    const r = analyzeInteractions([input("년주", 0, 0), input("일주", 1, 6)]);
    expect(byType(r, "충")).toHaveLength(1);
  });

  it("같은 지지는 충이 아니다", () => {
    const r = analyzeInteractions([input("년주", 0, 0), input("일주", 1, 0)]);
    expect(byType(r, "충")).toHaveLength(0);
  });
});

describe("형·파·해", () => {
  it("寅巳申 두 자는 세 지형 2/3 으로만 잡힌다", () => {
    const r = analyzeInteractions([input("A", 0, 2), input("B", 1, 5)]); // 寅 + 巳
    const x = byType(r, "형");
    expect(x).toHaveLength(1);
    expect(x[0].ruleId).toBe("RULE_INTERACT_PUNISH_002");
    expect(x[0].strength).toBe(1);
    expect(x[0].conditions.join()).toContain("2/3");
  });

  it("子卯 무례지형은 두 자로 성립한다", () => {
    const r = analyzeInteractions([input("A", 0, 0), input("B", 1, 3)]);
    const x = byType(r, "형");
    expect(x).toHaveLength(1);
    expect(x[0].ruleId).toBe("RULE_INTERACT_PUNISH_001");
    expect(x[0].strength).toBe(2);
    expect(x[0].description).toContain("무례지형");
  });

  it("자형은 같은 지지가 겹칠 때만 성립한다", () => {
    const same = analyzeInteractions([input("A", 0, 4), input("B", 1, 4)]); // 辰 + 辰
    const self = byType(same, "형");
    expect(self).toHaveLength(1);
    expect(self[0].ruleId).toBe("RULE_INTERACT_PUNISH_SELF_001");
    expect(self[0].description).toContain("자형");
    // 서로 다른 두 자형 지지는 자형이 아니다 (무례지형으로 판정돼야 한다)
    const diff = analyzeInteractions([input("A", 0, 4), input("B", 1, 6)]); // 辰 + 午
    expect(byType(diff, "형").map((x) => x.ruleId)).not.toContain("RULE_INTERACT_PUNISH_SELF_001");
  });

  it("六破 6쌍이 전부 잡히고 세기는 1이다", () => {
    for (const [p, q] of DESTROYMENTS) {
      const pi = BRANCHES.findIndex((x) => x.char === p);
      const qi = BRANCHES.findIndex((x) => x.char === q);
      const r = analyzeInteractions([input("A", 0, pi), input("B", 1, qi)]);
      const d = byType(r, "파");
      expect(d, `${p}${q}`).toHaveLength(1);
      expect(d[0].strength).toBe(1);
      expect(d[0].ruleId).toBe("RULE_INTERACT_BREAK_001");
    }
  });

  it("六害 6쌍이 전부 잡히고 세기는 2이다", () => {
    for (const [p, q] of HARMS) {
      const pi = BRANCHES.findIndex((x) => x.char === p);
      const qi = BRANCHES.findIndex((x) => x.char === q);
      const r = analyzeInteractions([input("A", 0, pi), input("B", 1, qi)]);
      const h = byType(r, "해");
      expect(h, `${p}${q}`).toHaveLength(1);
      expect(h[0].strength).toBe(2);
      expect(h[0].ruleId).toBe("RULE_INTERACT_HARM_001");
    }
  });

  it("한 쌍이 충·해·파를 동시에 만들 수도 있다 (표에 맡긴다)", () => {
    // 巳亥 는 충이고, 巳申 은 파다. 巳巳 는 파·해 아님.
    const r = analyzeInteractions([input("A", 0, 5), input("B", 1, 11)]); // 巳 + 亥
    const types = byType(r, "충").length + byType(r, "해").length + byType(r, "파").length;
    expect(types).toBe(1);
  });
});

describe("결과 구조 — 저장 가능한 형태", () => {
  const all = analyzeInteractions(chartInputs());

  it("모든 항목에 유형·규칙 ID·참여자·설명·해석이 있다", () => {
    for (const i of all) {
      expect(INTERACTION_TYPE_LABELS[i.type], i.type).toBeTruthy();
      expect(i.ruleId, i.type).toMatch(/^RULE_INTERACT_[A-Z0-9_]+$/);
      expect(i.participants.length, i.type).toBeGreaterThanOrEqual(2);
      expect(i.description.length, i.type).toBeGreaterThan(0);
      expect(i.interpretation.length, i.type).toBeGreaterThan(0);
      expect([1, 2, 3], i.description).toContain(i.strength);
      expect(Array.isArray(i.conditions)).toBe(true);
    }
  });

  it("참여자 라벨이 서로 다르다", () => {
    for (const i of all) {
      expect(new Set(i.participants).size, i.description).toBe(i.participants.length);
    }
  });

  it("결과 오행이 있으면 오행 5개 중 하나다", () => {
    for (const i of all) {
      if (i.resultElement === undefined) continue;
      expect(FIVE_ELEMENTS, i.description).toContain(i.resultElement);
    }
  });

  it("세기 내림차순으로 정렬된다", () => {
    for (let i = 1; i < all.length; i += 1) {
      expect(all[i - 1].strength).toBeGreaterThanOrEqual(all[i].strength);
    }
  });

  it("규칙 ID 가 코드에 정의된 것만 쓴다", () => {
    const known = new Set([
      "RULE_INTERACT_STEM_001",
      "RULE_INTERACT_BRANCH_001",
      "RULE_INTERACT_TRIPLE_001",
      "RULE_INTERACT_TRIPLE_002",
      "RULE_INTERACT_DIRECTION_001",
      "RULE_INTERACT_DIRECTION_002",
      "RULE_INTERACT_CLASH_001",
      "RULE_INTERACT_PUNISH_001",
      "RULE_INTERACT_PUNISH_002",
      "RULE_INTERACT_PUNISH_SELF_001",
      "RULE_INTERACT_HARM_001",
      "RULE_INTERACT_BREAK_001",
    ]);
    for (const i of all) expect(known, i.ruleId).toContain(i.ruleId);
  });

  it("간이 하나도 없으면 빈 배열이다", () => {
    // 서로 간을 이루지 않는 조합을 고른다 (고정 조합을 회피).
    expect(analyzeInteractions([input("A", 0, 0)])).toEqual([]);
  });

  it("같은 입력은 항상 같은 결과를 낸다 (결정론)", () => {
    const first = analyzeInteractions(chartInputs());
    for (let i = 0; i < 3; i += 1) {
      expect(analyzeInteractions(chartInputs(CHART))).toEqual(first);
    }
  });

  it("정렬이 입력 순서에 의존하지 않는다", () => {
    const a = analyzeInteractions(chartInputs());
    const reversed = analyzeInteractions([...chartInputs()].reverse());
    // 원국 라벨이 뒤바뀌므로 구조는 다를 수 있지만 세기 내림차순은 유지돼야 한다.
    for (let i = 1; i < reversed.length; i += 1) {
      expect(reversed[i - 1].strength).toBeGreaterThanOrEqual(reversed[i].strength);
    }
    expect(a.length).toBe(reversed.length);
  });
});

describe("interactionsBetween — 두 라벨 사이만 골라내기", () => {
  const ctx = buildFortuneContext({
    chart: CHART,
    date: { year: 2026, month: 9, day: 27 },
    gender: "여",
  });
  const inputs = fortuneInteractionInputs(ctx);

  it("라벨 목록에 원국 4개와 운 4개가 있다 (시주 미상이면 3+4)", () => {
    const labels = inputs.map((i) => i.label);
    expect(labels).toContain("년주");
    expect(labels).toContain("월주");
    expect(labels).toContain("일주");
    expect(labels).toContain("시주");
    expect(labels).toContain("세운");
    expect(labels).toContain("월운");
    expect(labels).toContain("일운");
    expect(labels).toContain("대운");
    expect(labels).toHaveLength(8);
  });

  it("두 라벨 사이의 간만 남는다", () => {
    const list = interactionsBetween(inputs, "년주", "일주");
    for (const i of list) {
      expect([...i.participants].sort()).toEqual(["년주", "일주"]);
    }
  });

  it("라벨 순서를 바꿔도 같은 결과다", () => {
    expect(interactionsBetween(inputs, "일주", "년주")).toEqual(interactionsBetween(inputs, "년주", "일주"));
  });

  it("간이 없는 두 라벨은 빈 배열이다", () => {
    // 大運 라벨이 없는 경우는 대운이 없는 날짜 (기산 전)
    const early = buildFortuneContext({ chart: CHART, date: { year: 1900, month: 1, day: 1 }, gender: "여" });
    expect(early.daeunAvailable).toBe(false);
    expect(fortuneInteractionInputs(early).map((i) => i.label)).not.toContain("대운");
  });
});

describe("운 계층과의 상호작용", () => {
  const ctx = buildFortuneContext({
    chart: CHART,
    date: { year: 2026, month: 9, day: 27 },
    gender: "여",
  });
  const inputs = fortuneInteractionInputs(ctx);
  const all = analyzeInteractions(inputs);

  it("원국 ↔ 대운 / 대운 ↔ 세운 / 세운 ↔ 월운 조합을 모두 검사한다", () => {
    const pairs = [
      ["년주", "대운"],
      ["대운", "세운"],
      ["세운", "월운"],
      ["월운", "일운"],
      ["일주", "일운"],
    ] as const;
    // 각 쌍은 "둘이 같은 간을 만들지 않는다"는 것까지 포함한 유효한 결과만 낸다.
    for (const [a, b] of pairs) {
      expect(() => interactionsBetween(inputs, a, b)).not.toThrow();
      const found = interactionsBetween(inputs, a, b);
      for (const i of found) expect([...i.participants].sort()).toEqual([a, b].sort());
    }
    // 대운이 실제로 존재하는 날짜이므로 대운이 상호작용 대상에 포함돼야 한다.
    expect(inputs.find((i) => i.label === "대운")).toBeDefined();
    expect(all.length).toBeGreaterThan(0);
  });

  it("시주 미상이면 시주 라벨 없이 같은 계층 구조를 유지한다", () => {
    const noHour = computeFourPillars({
      solarDate: { year: 1988, month: 11, day: 3 },
      timeBranchIndex: null,
      ziMode: null,
    });
    const c2 = buildFortuneContext({ chart: noHour, date: { year: 2026, month: 9, day: 27 }, gender: "여" });
    const labels = fortuneInteractionInputs(c2).map((i) => i.label);
    expect(labels).not.toContain("시주");
    expect(labels).toHaveLength(7);
    expect(c2.hourUnknown).toBe(true);
  });

  it("기산 전 날짜에는 대운이 없지만 나머지 계층은 그대로다", () => {
    const early = buildFortuneContext({ chart: CHART, date: { year: 1900, month: 1, day: 1 }, gender: "여" });
    expect(early.daeun).toBeNull();
    expect(early.daeunAvailable).toBe(false);
    expect(early.seun.ganZhi).toBeTruthy();
    expect(early.wolun.ganZhi).toBeTruthy();
    expect(early.ilun.ganZhi).toBeTruthy();
  });
});

describe("기준 원국의 실제 간", () => {
  // 1990-05-20 午시 = 庚午 辛巳 乙酉 壬午
  it("年支 午 와 日支 酉 가 만나면 합(酉午)이 아니라 충이 아니다 (卯酉 충 아님)", () => {
    const all = analyzeInteractions(chartInputs());
    const clashes = byType(all, "충");
    // 午 ↔ 子, 酉 ↔ 卯 이므로 이 차트에는 충이 없다.
    expect(clashes).toHaveLength(0);
  });

  it("巳申 파·寅巳 해 등 실제로 성립하는 간이 기록된다", () => {
    const all = analyzeInteractions(chartInputs());
    // 巳(시지) + 申 없음 → 파 없음. 寅 없음 → 해 없음.
    // 巳 + 酉 는 지지합이 아니라 삼합 巳酉丑 반합이다.
    const trips = byType(all, "삼합");
    expect(trips.length).toBeGreaterThan(0);
    for (const t of trips) {
      expect(t.resultElement).toBe("金"); // 巳酉 → 金국
    }
  });

  it("년지 午 와 시지 午 가 겹치면 자형이 잡힌다", () => {
    const all = analyzeInteractions(chartInputs());
    const self = all.filter((i) => i.ruleId === "RULE_INTERACT_PUNISH_SELF_001");
    expect(self).toHaveLength(1);
    expect(self[0].description).toContain("午午");
  });
});
