/**
 * 간의 합·충·형·파·해 + 삼합·방합.
 *
 * 규칙 (RULE_INTERACT_STEM_001 · RULE_INTERACT_BRANCH_001 · RULE_INTERACT_TRIPLE_001/002 ·
 *        RULE_INTERACT_DIRECTION_001/002 · RULE_INTERACT_CLASH_001 ·
 *        RULE_INTERACT_PUNISH_001/002 · RULE_INTERACT_PUNISH_SELF_001 ·
 *        RULE_INTERACT_BREAK_001 · RULE_INTERACT_HARM_001, docs/calculation-rules.md)
 * - 아래 표 하나만 사용한다. (다른 표를 섞지 않는다)
 * - 결과는 (유형, 근거, 해석) 구조로 저장해 두어 나중에 그대로 보여준다.
 * - 원국 내부, 원국 ↔ 운(대운/세운/월운/일운), 운끼리 모든 조합을 같은 함수로 검사한다.
 */

import type { Pillar, PillarPosition } from "../pillars/fourPillars";
import type { EarthlyBranch, FiveElement, HeavenlyStem } from "../constants/stems";

export type InteractionType =
  | "천간합"
  | "지지합"
  | "삼합"
  | "방합"
  | "충"
  | "형"
  | "파"
  | "해";

export const INTERACTION_TYPE_LABELS: Readonly<Record<InteractionType, string>> = Object.freeze({
  천간합: "천간합",
  지지합: "지지합",
  삼합: "삼합",
  방합: "방합",
  충: "충",
  형: "형",
  파: "파",
  해: "해",
});

/** 신호 세기. 내부에서만 비교용으로 쓰고 화면에 점수로 노출하지 않는다. */
export type InteractionStrength = 1 | 2 | 3;

export interface Interaction {
  type: InteractionType;
  /** 고유 규칙 ID (해석 화면에 그대로 노출) */
  ruleId: string;
  /** 참여 기둥 라벨 (예: ["월지", "대운"]) */
  participants: readonly string[];
  /** 합화 결과 오행 (천간합·지지합·삼합·방합) */
  resultElement?: FiveElement;
  /** 지장간을 함께 쓰는 경우 본기가 같은지 등 성립 조건 */
  conditions: readonly string[];
  /** 구조 설명 (예: "巳申 반합 → 水") */
  description: string;
  strength: InteractionStrength;
  /** 전통 명리학 해석 */
  interpretation: string;
}

export interface InteractionInput {
  /** 화면·해석에 쓰는 이름 (예: "월지", "대운") */
  label: string;
  position: PillarPosition | "daeun" | "seun" | "wolun" | "ilun";
  pillar: Pillar;
}

/* ------------------------------------------------------------------ 표 데이터 */

/** 천간 5합. 甲己 → 土, 乙庚 → 金, 丙辛 → 水, 丁壬 → 木, 戊癸 → 火 */
export const STEM_COMBINATIONS: ReadonlyArray<{
  a: HeavenlyStem;
  b: HeavenlyStem;
  element: FiveElement;
}> = [
  { a: "甲", b: "己", element: "土" },
  { a: "乙", b: "庚", element: "金" },
  { a: "丙", b: "辛", element: "水" },
  { a: "丁", b: "壬", element: "木" },
  { a: "戊", b: "癸", element: "火" },
];

/** 지지 6합. 子丑 → 土, 寅亥 → 木, 卯戌 → 火, 辰酉 → 金, 巳申 → 水, 午未 → 土/火 */
export const BRANCH_COMBINATIONS: ReadonlyArray<{
  a: EarthlyBranch;
  b: EarthlyBranch;
  element: FiveElement;
  note: string;
}> = [
  { a: "子", b: "丑", element: "土", note: "육합" },
  { a: "寅", b: "亥", element: "木", note: "육합" },
  { a: "卯", b: "戌", element: "火", note: "육합" },
  { a: "辰", b: "酉", element: "金", note: "육합" },
  { a: "巳", b: "申", element: "水", note: "육합" },
  { a: "午", b: "未", element: "土", note: "육합 (午未 합화는 土·火 설이 함께 있다)" },
];

/** 삼합국. 申子辰 → 水, 亥卯未 → 木, 寅午戌 → 火, 巳酉丑 → 金 */
export const TRIPLE_COMBINATIONS: ReadonlyArray<{
  branches: readonly [EarthlyBranch, EarthlyBranch, EarthlyBranch];
  element: FiveElement;
  wang: EarthlyBranch;
}> = [
  { branches: ["申", "子", "辰"], element: "水", wang: "子" },
  { branches: ["亥", "卯", "未"], element: "木", wang: "卯" },
  { branches: ["寅", "午", "戌"], element: "火", wang: "午" },
  { branches: ["巳", "酉", "丑"], element: "金", wang: "酉" },
];

/** 방합. 寅卯辰 → 木, 巳午未 → 火, 申酉戌 → 金, 亥子丑 → 水 */
export const DIRECTIONAL_COMBINATIONS: ReadonlyArray<{
  branches: readonly [EarthlyBranch, EarthlyBranch, EarthlyBranch];
  element: FiveElement;
}> = [
  { branches: ["寅", "卯", "辰"], element: "木" },
  { branches: ["巳", "午", "未"], element: "火" },
  { branches: ["申", "酉", "戌"], element: "金" },
  { branches: ["亥", "子", "丑"], element: "水" },
];

/** 六冲. 子午, 丑未, 寅申, 卯酉, 辰戌, 巳亥 */
export const CLASHES: ReadonlyArray<readonly [EarthlyBranch, EarthlyBranch]> = [
  ["子", "午"],
  ["丑", "未"],
  ["寅", "申"],
  ["卯", "酉"],
  ["辰", "戌"],
  ["巳", "亥"],
];

/** 相刑. 무은지형(寅巳申), 무축지형(丑戌未), 무례지형(子卯), 자형(辰午酉亥) */
export const PUNISHMENTS: ReadonlyArray<{
  branches: readonly EarthlyBranch[];
  name: string;
  hanja: string;
  strength: InteractionStrength;
  description: string;
}> = [
  {
    branches: ["寅", "巳", "申"],
    name: "무은지형",
    hanja: "無恩之刑",
    strength: 3,
    description: "무은지형(無恩之刑) — 세 지지가 모두 모이면 성립",
  },
  {
    branches: ["丑", "戌", "未"],
    name: "무축지형",
    hanja: "無軸之刑",
    strength: 3,
    description: "무축지형(無軸之刑) — 세 지지가 모두 모이면 성립",
  },
  { branches: ["子", "卯"], name: "무례지형", hanja: "無禮之刑", strength: 2, description: "무례지형(無禮之刑) — 예의 바르지 못한 감정·소통의 혼란" },
  { branches: ["辰", "午", "酉", "亥"], name: "자형", hanja: "自刑", strength: 1, description: "자형(自刑) — 같은 지지가 겹칠 때 성립" },
];

/** 六害 (해). 子未, 丑午, 寅巳, 卯辰, 申亥, 酉戌 */
export const HARMS: ReadonlyArray<readonly [EarthlyBranch, EarthlyBranch]> = [
  ["子", "未"],
  ["丑", "午"],
  ["寅", "巳"],
  ["卯", "辰"],
  ["申", "亥"],
  ["酉", "戌"],
];

/** 六破 (파). 子酉, 午卯, 巳申, 寅亥, 辰丑, 未戌 */
export const DESTROYMENTS: ReadonlyArray<readonly [EarthlyBranch, EarthlyBranch]> = [
  ["子", "酉"],
  ["午", "卯"],
  ["巳", "申"],
  ["寅", "亥"],
  ["辰", "丑"],
  ["未", "戌"],
];

const same = (a: EarthlyBranch, b: EarthlyBranch) => a === b;

/* ------------------------------------------------------------------ 검사 로직 */

function pairCandidates(inputs: readonly InteractionInput[]): Array<[InteractionInput, InteractionInput]> {
  const out: Array<[InteractionInput, InteractionInput]> = [];
  for (let i = 0; i < inputs.length; i += 1) {
    for (let j = i + 1; j < inputs.length; j += 1) {
      out.push([inputs[i], inputs[j]]);
    }
  }
  return out;
}

/** 천간합 검사. */
function detectStemCombinations(inputs: readonly InteractionInput[]): Interaction[] {
  const out: Interaction[] = [];
  for (const [x, y] of pairCandidates(inputs)) {
    for (const c of STEM_COMBINATIONS) {
      const matched =
        (x.pillar.stem === c.a && y.pillar.stem === c.b) || (x.pillar.stem === c.b && y.pillar.stem === c.a);
      if (!matched) continue;
      const otherHidden = sharedBranchElement(x, y);
      out.push({
        type: "천간합",
        ruleId: "RULE_INTERACT_STEM_001",
        participants: [x.label, y.label],
        resultElement: c.element,
        conditions: otherHidden ? [`인접 지지에 ${otherHidden} 이 함께 있어 합화가 완전히 이루어진다.`] : [],
        description: `${x.pillar.stem}${y.pillar.stem} 합 → ${c.element}`,
        strength: 2,
        interpretation: `두 천간이 서로 합의해 ${c.element}으로 모여든다. 협력이나 결합의 기운이 강해지고, 서로의 판단이 가까워진다.`,
      });
    }
  }
  return out;
}

/** 두 기둥의 지지가 같은 오행이면 그 오행을, 아니면 null. (천간합의 성립 조건 보조) */
function sharedBranchElement(x: InteractionInput, y: InteractionInput): FiveElement | null {
  return x.pillar.branchElement === y.pillar.branchElement ? x.pillar.branchElement : null;
}

/** 지지합 · 반합(삼합 2개) 검사. */
function detectBranchCombinations(inputs: readonly InteractionInput[]): Interaction[] {
  const out: Interaction[] = [];
  for (const [x, y] of pairCandidates(inputs)) {
    for (const c of BRANCH_COMBINATIONS) {
      const matched = (same(x.pillar.branch, c.a) && same(y.pillar.branch, c.b)) || (same(x.pillar.branch, c.b) && same(y.pillar.branch, c.a));
      if (!matched) continue;
      out.push({
        type: "지지합",
        ruleId: "RULE_INTERACT_BRANCH_001",
        participants: [x.label, y.label],
        resultElement: c.element,
        conditions: [`${c.note}. 인접한 세 번째 지지(局的)가 없으면 반합(半合)으로 약하게 작용한다.`],
        description: `${x.pillar.branch}${y.pillar.branch} ${c.a}${c.b}합 → ${c.element}`,
        strength: 1,
        interpretation: `두 지지가 합을 이루어 ${c.element} 쪽으로 기운이 모인다. 관계가 붙고 서로에게 끌리는 형태가 강해진다.`,
      });
    }
    // 삼합 두 자 (반합)
    for (const t of TRIPLE_COMBINATIONS) {
      const has = t.branches.filter((b) => x.pillar.branch === b || y.pillar.branch === b);
      if (has.length === 2) {
        const missing = t.branches.find((b) => !has.includes(b))!;
        const isWan = has.includes(t.wang);
        out.push({
          type: "삼합",
          ruleId: "RULE_INTERACT_TRIPLE_001",
          participants: [x.label, y.label],
          resultElement: t.element,
          conditions: [`${missing} 이 함께 있으면 ${t.branches.join("")} 세합( 삼합)이 되어 힘이 강해진다. 현재는 반합 상태.`],
          description: `${has.join("")} 반합(半合) → ${t.element} (${missing} 결여)`,
          strength: isWan ? 2 : 1,
          interpretation: `두 지지가 ${t.element}국(局)의 반합을 이룬다. 기운이 ${t.element} 쪽에 모이므로 관련 일이 강하게 드러난다.`,
        });
      }
    }
    // 방합 두 자
    for (const t of DIRECTIONAL_COMBINATIONS) {
      const has = t.branches.filter((b) => x.pillar.branch === b || y.pillar.branch === b);
      if (has.length === 2) {
        out.push({
          type: "방합",
          ruleId: "RULE_INTERACT_DIRECTION_001",
          participants: [x.label, y.label],
          resultElement: t.element,
          conditions: [`방합(方合)은 세 지지가 모여야 완성된다. 현재는 반합 상태.`],
          description: `${has.join("")} 반방합(半方合) → ${t.element}`,
          strength: 1,
          interpretation: `같은 방합(方合)의 두 지지가 만나 ${t.element} 기운이 두드러진다. 같은 방향의 일이 겹친다.`,
        });
      }
    }
  }
  return out;
}

/** 충 · 형 · 파 · 해 검사. */
function detectConflicts(inputs: readonly InteractionInput[]): Interaction[] {
  const out: Interaction[] = [];
  for (const [x, y] of pairCandidates(inputs)) {
    const a = x.pillar.branch;
    const b = y.pillar.branch;
    for (const [p, q] of CLASHES) {
      if ((a === p && b === q) || (a === q && b === p)) {
        out.push({
          type: "충",
          ruleId: "RULE_INTERACT_CLASH_001",
          participants: [x.label, y.label],
          conditions: [],
          description: `${a}${b} 충(冲)`,
          strength: 3,
          interpretation: `두 지지가 정면으로 충돌한다. 관련한 일이 흔들리고 이동·변화가 생기기 쉽다.`,
        });
      }
    }
    for (const [p, q] of HARMS) {
      if ((a === p && b === q) || (a === q && b === p)) {
        out.push({
          type: "해",
          ruleId: "RULE_INTERACT_HARM_001",
          participants: [x.label, y.label],
          conditions: [],
          description: `${a}${b} 해(害)`,
          strength: 2,
          interpretation: `서로의 사이에 소모와 오해가 끼어든다. 의도치 않게 다치거나 방해받는 형태가 나타난다.`,
        });
      }
    }
    for (const [p, q] of DESTROYMENTS) {
      if ((a === p && b === q) || (a === q && b === p)) {
        out.push({
          type: "파",
          ruleId: "RULE_INTERACT_BREAK_001",
          participants: [x.label, y.label],
          conditions: [],
          description: `${a}${b} 파(破)`,
          strength: 1,
          interpretation: `기존 틀에 작은 금이 간다. 전체로는 유지되지만 계획의 일부가 깨지거나 미세하게 흔들린다.`,
        });
      }
    }
    for (const p of PUNISHMENTS) {
      const set = new Set(p.branches);
      if (p.name === "자형") {
        if (a === b && set.has(a)) {
          out.push({
            type: "형",
            ruleId: "RULE_INTERACT_PUNISH_SELF_001",
            participants: [x.label, y.label],
            conditions: [],
            description: `${a}${a} 자형(自刑)`,
            strength: 1,
            interpretation: `같은 지지가 겹치면서 스스로를 괴롭힌다. 생각의 반복, 자기 검증에 과한다.`,
          });
        }
        continue;
      }
      // 자형이 아닌 형은 **서로 다른 두 지지**가 함께 있어야 성립한다.
      if (a === b || !set.has(a) || !set.has(b)) continue;
      if (p.branches.length === 2) {
        out.push({
          type: "형",
          ruleId: "RULE_INTERACT_PUNISH_001",
          participants: [x.label, y.label],
          conditions: [],
          description: `${a}${b} ${p.name}(${p.hanja})`,
          strength: p.strength,
          interpretation: `${p.description} — 감정적으로 어긋나거나 예의를 벗어난 일이 끼어든다.`,
        });
        continue;
      }
      // 세 지형: 두 개만 모이면 조건 미충족, 세 개 모두일 때 성립
      out.push({
        type: "형",
        ruleId: "RULE_INTERACT_PUNISH_002",
        participants: [x.label, y.label],
        conditions: [`${p.branches.join("")} 세 지지가 모두 모여야 완전히 성립한다. 현재는 2/3 모임.`],
        description: `${a}${b} ${p.name} 2/3 모임`,
        strength: 1,
        interpretation: `${p.description} 중 두 지지만 모인 상태다. 관련 갈등의 씨가 약하게 깔려 있다.`,
      });
    }
  }
  return out;
}

/** 세 지합(삼합 완성) · 방합 완성 검사. */
function detectCompleteTriples(inputs: readonly InteractionInput[]): Interaction[] {
  const out: Interaction[] = [];
  for (const t of TRIPLE_COMBINATIONS) {
    const matched = t.branches.map((b) => inputs.find((i) => i.pillar.branch === b));
    if (matched.some((m) => !m)) continue;
    out.push({
      type: "삼합",
      ruleId: "RULE_INTERACT_TRIPLE_002",
      participants: matched.map((m) => m!.label),
      resultElement: t.element,
      conditions: [],
      description: `${t.branches.join("")} 삼합(三合) → ${t.element}국 완성`,
      strength: 3,
      interpretation: `세 지지가 ${t.element}국(三合)을 완성했다. ${t.element}에 해당하는 일이 매우 강하게 드러난다.`,
    });
  }
  for (const t of DIRECTIONAL_COMBINATIONS) {
    const matched = t.branches.map((b) => inputs.find((i) => i.pillar.branch === b));
    if (matched.some((m) => !m)) continue;
    out.push({
      type: "방합",
      ruleId: "RULE_INTERACT_DIRECTION_002",
      participants: matched.map((m) => m!.label),
      resultElement: t.element,
      conditions: [],
      description: `${t.branches.join("")} 방합(方合) → ${t.element} 완성`,
      strength: 3,
      interpretation: `세 지지가 같은 방(方)을 이뤄 ${t.element} 기운으로 모여든다. 관련된 일이 큰 흐름으로 이어진다.`,
    });
  }
  return out;
}

/**
 * 주어진 기둥 집합에서 모든 간(干支 관계)를 찾아낸다.
 * 결과는 신호 세기 내림차순, 같은 세기면 설명 순으로 정렬된다.
 */
export function analyzeInteractions(inputs: readonly InteractionInput[]): Interaction[] {
  const all = [
    ...detectCompleteTriples(inputs),
    ...detectStemCombinations(inputs),
    ...detectBranchCombinations(inputs),
    ...detectConflicts(inputs),
  ];
  return all.sort((a, b) => b.strength - a.strength || a.ruleId.localeCompare(b.ruleId));
}

/** 특정 라벨 두 개 사이의 간만 골라낸다. (원국 ↔ 운, 운 ↔ 운 비교용) */
export function interactionsBetween(
  context: readonly InteractionInput[],
  labelA: string,
  labelB: string,
): Interaction[] {
  const pair = `${labelA}\u0000${labelB}`;
  return analyzeInteractions(context).filter((i) => {
    const key = `${i.participants[0]}\u0000${i.participants[1]}`;
    return key === pair || `${i.participants[1]}\u0000${i.participants[0]}` === pair;
  });
}
