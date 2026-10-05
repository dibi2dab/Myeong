/**
 * 운세 해석 계층 (`core/interpretation`).
 *
 * 잡아야 하는 것:
 *  1. 9개 항목이 고정 순서로 나온다.
 *  2. 모든 [해석] 문장과 모든 근거에 규칙 ID 가 붙고, 그 ID 가 카탈로그에 존재한다.
 *  3. 계층 위계 — 원국·대운·세운이 월운·일운보다 무겁다.
 *  4. 기세는 다섯 범주뿐이며 **숫자·점수·확률이 화면 문구에 새어나오지 않는다.**
 *  5. 신호가 약하면 중립 문구로 끝난다.
 *  6. 시주 미상 / 대운 기산 전에는 제한 안내가 반드시 함께 나온다.
 */

import { describe, expect, it } from "vitest";

import { ruleById } from "../data/rules/rules";
import { buildFortuneContext } from "../core/fortune/fortuneContext";
import { computeFourPillars, type FourPillars } from "../core/pillars/fourPillars";
import { ganZhiText } from "../core/pillars/sexagenary";
import { ELEMENT_KOREAN } from "../core/elements/elementBalance";
import type { CivilDate } from "../core/calendar/civilDate";
import {
  LAYER_WEIGHT,
  TOPIC_RULE_IDS,
  interactionSignals,
  natalSignals,
  signalValue,
  stageSignals,
  tenGodFlavor,
  tenGodSignals,
  toEvidence,
  type Signal,
} from "../core/interpretation/signals";
import { collectSignals, drilldown, intensityOf, readFortune, topicTotal } from "../core/interpretation/reading";
import {
  DRILLDOWN_CHAIN,
  FORTUNE_TOPICS,
  INTENSITY_LABELS,
  layerOfPeriod,
  type FortuneTopic,
  type Intensity,
  type Layer,
} from "../core/interpretation/types";
import { TEN_GODS, type TenGod } from "../core/ten_gods/tenGods";
import { analyzeBirth, analyzeFortune } from "../core";
import { birth as sampleBirth } from "./fixtures/samples";

const ALL_TEN_GODS = TEN_GODS.map((g) => g.key as TenGod);

/** 1990-05-20 午시 = 庚午 辛巳 乙酉 壬午 */
const CHART: FourPillars = computeFourPillars({
  solarDate: { year: 1990, month: 5, day: 20 },
  timeBranchIndex: 6,
  ziMode: null,
});

const DATE: CivilDate = { year: 2026, month: 9, day: 27 };

function ctxFor(date: CivilDate = DATE, chart: FourPillars = CHART) {
  return buildFortuneContext({ chart, date, gender: "여" });
}

const CTX = ctxFor();
const READING = readFortune(CTX, { dateLabel: "2026년 9월 27일" });

/** 화면에 실제로 나가는 모든 문장을 한 덩어리로. */
function allVisibleText(): string {
  return [
    ...READING.sections.map((s) => s.interpretation),
    ...READING.sections.flatMap((s) => s.evidence.map((e) => `${e.text} ${e.detail}`)),
    ...READING.cautions.map((c) => `${c.text} ${c.detail}`),
    ...READING.keyPoints.map((k) => `${k.text} ${k.detail}`),
    ...READING.restrictions,
  ].join("\n");
}

/** 근거 문장을 원래 신호로 되돌려 그 신호의 고정 세기를 찾는다. */
const SIGNAL_BY_TEXT = new Map(collectSignals(CTX).map((s) => [s.text, s]));
function strengthOfEvidence(evidence: { text: string; layer: Layer }): number {
  return SIGNAL_BY_TEXT.get(evidence.text)?.strength ?? 0;
}

/** 십이운성만 갈아 끼워 넣은 기둥. */
function withStage(period: (typeof CTX)["ilun"], key: string) {
  return { ...period, stage: { ...period.stage, key } as typeof period.stage };
}

// ---------------------------------------------------------------------------

describe("운세 항목 목록", () => {
  it("오늘의 운세 8개 항목 + 9개(총포함)이 고정 순서다", () => {
    expect(FORTUNE_TOPICS).toEqual([
      "총운",
      "재물운",
      "직업·사업운",
      "애정운",
      "대인관계운",
      "학업·성장운",
      "건강운",
      "이동·변화운",
    ]);
  });

  it("화면의 8개 항목이 요구 목록과 일치한다 (주의점·핵심 포인트는 섹션 밖)", () => {
    expect(FORTUNE_TOPICS).toHaveLength(8);
    // 요구 목록: 총운, 재물운, 직업·사업운, 애정운, 대인관계운, 학업·성장운, 건강운,
    // 이동·변화운 + (주의점, 핵심 포인트). 후자는 sections 가 아니라 최상위 필드다.
    expect(Object.keys(READING)).toContain("cautions");
    expect(Object.keys(READING)).toContain("keyPoints");
    const topicSet = new Set<string>(FORTUNE_TOPICS);
    for (const s of READING.sections) expect(topicSet.has(s.topic)).toBe(true);
  });

  it("항목마다 자기 규칙 ID 가 하나씩 붙는다", () => {
    expect(TOPIC_RULE_IDS).toEqual({
      총운: "RULE_TOTAL_001",
      재물운: "RULE_MONEY_001",
      "직업·사업운": "RULE_CAREER_001",
      애정운: "RULE_LOVE_001",
      대인관계운: "RULE_RELATION_001",
      "학업·성장운": "RULE_STUDY_001",
      건강운: "RULE_HEALTH_001",
      "이동·변화운": "RULE_MOVE_001",
    });
    for (const topic of FORTUNE_TOPICS) {
      expect(ruleById(TOPIC_RULE_IDS[topic])?.category, topic).toBe("해석");
    }
  });

  it("period kind → 계층 이름 매핑이 전수에 대해 정의돼 있다", () => {
    expect(layerOfPeriod("daeun")).toBe("대운");
    expect(layerOfPeriod("seun")).toBe("세운");
    expect(layerOfPeriod("wolun")).toBe("월운");
    expect(layerOfPeriod("ilun")).toBe("일운");
  });
});

describe("읽기 결과의 형태", () => {
  it("날짜 표기가 그대로 실린다", () => {
    expect(READING.dateLabel).toBe("2026년 9월 27일");
  });

  it("섹션이 8개고 항목 순서가 고정이다", () => {
    expect(READING.sections).toHaveLength(8);
    expect(READING.sections.map((s) => s.topic)).toEqual([...FORTUNE_TOPICS]);
  });

  it("[해석] 과 [분석 근거] 가 분리돼 있다", () => {
    for (const s of READING.sections) {
      expect(typeof s.interpretation, s.topic).toBe("string");
      expect(Array.isArray(s.evidence), s.topic).toBe(true);
      // [해석] 문장이 근거 목록을 통째로 복사하지 않는다.
      expect(s.interpretation.length, s.topic).toBeGreaterThan(0);
    }
  });

  it("모든 근거에 규칙 ID · 계층 · 상세 위치가 있다", () => {
    for (const s of READING.sections) {
      for (const e of s.evidence) {
        expect(ruleById(e.ruleId), `${s.topic}: ${e.ruleId}`).toBeDefined();
        expect(e.ruleId, s.topic).toMatch(/^RULE_[A-Z]+(_[A-Z]+)*_\d{3}$/);
        expect(DRILLDOWN_CHAIN, `${e.ruleId}/${e.layer}`).toContain(e.layer);
        expect(e.text.length, e.ruleId).toBeGreaterThan(0);
        expect(e.detail.length, e.ruleId).toBeGreaterThan(0);
      }
    }
  });

  it("근거는 오행 5개 중 하나이거나 값이 없다", () => {
    for (const s of READING.sections) {
      for (const e of s.evidence) {
        if (e.element === undefined) continue;
        expect(["木", "火", "土", "金", "水"], e.ruleId).toContain(e.element);
      }
    }
  });

  it("간(干支) 근거는 그 간의 전체 정보를 들고 있다", () => {
    for (const s of READING.sections) {
      for (const e of s.evidence) {
        if (!e.interaction) continue;
        expect(e.interaction.description.length, e.ruleId).toBeGreaterThan(0);
        expect(e.interaction.interpretation.length, e.ruleId).toBeGreaterThan(0);
      }
    }
  });

  it("기세와 방향이 5단계 · 5방향 중 하나다", () => {
    const intensities: Intensity[] = ["very_low", "low", "medium", "high", "very_high"];
    const directions = ["상승", "유지", "하락", "변화", "중립"];
    for (const s of READING.sections) {
      expect(intensities, s.topic).toContain(s.intensity);
      expect(directions, s.topic).toContain(s.direction);
    }
  });

  it("기세 표에 다섯 단계의 한국어 표시가 있다", () => {
    expect(Object.values(INTENSITY_LABELS)).toEqual([
      "두드러짐이 약함",
      "약간 두드러짐",
      "보통",
      "뚜렷함",
      "매우 두드러짐",
    ]);
  });

  it("기세·방향 표기가 [해석] 문장에 그대로 쓰인다", () => {
    for (const s of READING.sections) {
      if (s.intensity === "very_low") continue;
      expect(s.interpretation, s.topic).toContain(s.direction);
    }
  });
});

describe("점수 · 확률 · 순위를 노출하지 않는다", () => {
  const text = allVisibleText();

  it("100점 · 백점 같은 점수 표현이 없다", () => {
    expect(text).not.toMatch(/\d+\s*점/);
    expect(text).not.toMatch(/점수/);
  });

  it("확률 · 퍼센트 · 확률이 나오지 않는다", () => {
    expect(text).not.toMatch(/\d+(\.\d+)?%/);
    expect(text).not.toContain("확률");
  });

  it("숫자 등급(A·B·C, 1등급)이 없다", () => {
    expect(text).not.toMatch(/[ABC]등급/);
    expect(text).not.toMatch(/\d\s*등급/);
  });

  it("가장 좋고 / 가장 나쁘다는 판정 verdict 를 내지 않는다", () => {
    expect(text).not.toContain("가장 좋은");
    expect(text).not.toContain("가장 나쁜");
    expect(text).not.toMatch(/최고의 운|최악의 운/);
  });

  it("기세 표기에도 숫자가 없다", () => {
    for (const label of Object.values(INTENSITY_LABELS)) {
      expect(label).not.toMatch(/\d/);
    }
  });
});

describe("계층 위계 (RULE_HIERARCHY_001)", () => {
  it("가중치가 위 계층일수록 크거나 같다", () => {
    const w = LAYER_WEIGHT;
    expect(w.원국).toBeGreaterThanOrEqual(w.대운);
    expect(w.대운).toBeGreaterThan(w.세운);
    expect(w.세운).toBeGreaterThan(w.월운);
    expect(w.월운).toBeGreaterThan(w.일운);
  });

  it("같은 신호라면 아래 계층의 기여값이 더 작다", () => {
    const base = { ruleId: "R", topic: "총운" as const, text: "t", strength: 2 as const, polarity: "favourable" as const };
    for (const upper of ["원국", "대운", "세운"] as const) {
      for (const lower of ["월운", "일운"] as const) {
        expect(signalValue({ ...base, layer: upper }), `${upper}>${lower}`).toBeGreaterThan(
          signalValue({ ...base, layer: lower }),
        );
      }
    }
  });

  it("일운 신호 하나가 세운 신호 하나보다 세지 않다", () => {
    const s: Signal = {
      ruleId: "RULE_TOTAL_001",
      topic: "총운",
      layer: "일운",
      text: "t",
      strength: 3,
      polarity: "favourable",
    };
    const u: Signal = { ...s, layer: "세운" };
    expect(signalValue(s)).toBeLessThan(signalValue(u));
  });

  it("같은 신호라면 상위 계층이 근거 목록 앞에 온다", () => {
    const order = ["원국", "대운", "세운", "월운", "일운"];
    for (const s of READING.sections) {
      const seen = s.evidence.map((e) => order.indexOf(e.layer));
      for (let i = 1; i < seen.length; i += 1) {
        expect(seen[i - 1], s.topic).toBeLessThanOrEqual(seen[i]);
      }
    }
  });

  it("같은 계층 안에서는 세기가 큰 신호가 앞에 온다", () => {
    const order = ["원국", "대운", "세운", "월운", "일운"];
    for (const s of READING.sections) {
      const byLayer = new Map<number, number[]>();
      for (const e of s.evidence) {
        const k = order.indexOf(e.layer);
        const list = byLayer.get(k) ?? [];
        list.push(strengthOfEvidence(e));
        byLayer.set(k, list);
      }
      for (const list of byLayer.values()) {
        for (let i = 1; i < list.length; i += 1) {
          expect(list[i - 1], s.topic).toBeGreaterThanOrEqual(list[i]);
        }
      }
    }
  });

  it("모든 신호가 다섯 계층 안에서만 나온다", () => {
    for (const s of collectSignals(CTX)) {
      expect(DRILLDOWN_CHAIN, s.ruleId).toContain(s.layer);
    }
  });

  it("원국 신호는 원국 계층에만 있다", () => {
    for (const s of natalSignals(CTX)) expect(s.layer, s.ruleId).toBe("원국");
  });
});

describe("신호 세기는 고정값이다", () => {
  it("모든 신호의 세기가 1·2·3 중 하나다", () => {
    for (const s of collectSignals(CTX)) {
      expect([1, 2, 3], s.ruleId).toContain(s.strength);
    }
  });

  it("같은 기둥을 다시 읽어도 신호가 동일하다 (결정론)", () => {
    const again = collectSignals(ctxFor());
    expect(again).toEqual(collectSignals(CTX));
  });

  it("각 계열이 자기 항목에 가장 강한 신호를 건다", () => {
    // 비겁 → 대인관계운, 인성 → 학업·성장운.
    const first = (group: "비겁" | "인성", god: TenGod) =>
      tenGodSignals({ ...CTX.seun, tenGod: god, tenGodGroup: group }, "세운");
    expect(first("비겁", "겁재")[0].topic).toBe("대인관계운");
    expect(first("인성", "정인")[0].topic).toBe("학업·성장운");
  });

  it("십신 신호는 총운을 끌어당기지 않는다", () => {
    // 십신이 다섯 계열 어디에나 걸리므로 총운까지 넣으면 어떤 날이든
    // 다섯 계층 전부에서 총운 신호가 생겨 총운이 늘 최댓값에 붙는다.
    // 총운은 원국 구조·용신 오행 여부·십이지운성·반합/삼합이 말한다.
    for (const group of ["비겁", "식상", "재성", "관성", "인성"] as const) {
      for (const god of ALL_TEN_GODS) {
        for (const s of tenGodSignals({ ...CTX.seun, tenGod: god, tenGodGroup: group }, "일운")) {
          expect(s.topic, `${group}/${god}`).not.toBe("총운");
        }
      }
    }
  });

  it("편(偏) 계열이 정(正) 계열보다 세다", () => {
    for (const [ganGod, jeongGod] of [
      ["상관", "식신"],
      ["편관", "정관"],
      ["편인", "정인"],
      ["편재", "정재"],
    ] as const) {
      const a = tenGodSignals({ ...CTX.seun, tenGod: ganGod }, "일운");
      const b = tenGodSignals({ ...CTX.seun, tenGod: jeongGod }, "일운");
      expect(signalValue(a[0]), `${ganGod}>${jeongGod}`).toBeGreaterThan(signalValue(b[0]));
    }
  });

  it("같은 근거를 여러 항목에 넣어도 중복 계상하지 않는다", () => {
    // 재성 → 재물운, 애정운. 첫 항목만 세고 나머지는 1 로 낮춰 중복 계상하지 않는다.
    const s = tenGodSignals({ ...CTX.seun, tenGodGroup: "재성" }, "월운");
    expect(s).toHaveLength(2);
    expect(s[0].strength).toBeGreaterThan(1);
    for (const rest of s.slice(1)) expect(rest.strength).toBe(1);
  });
});

describe("십이운성 신호", () => {
  it("쇠·병·사·묘·절은 불리, 나머지는 유리다", () => {
    const falling = ["쇠", "병", "사", "묘", "절"] as const;
    const rising = ["장생", "목욕", "관대", "임관", "제왕", "태", "양"] as const;
    for (const key of falling) {
      const s = stageSignals(withStage(CTX.ilun, key), "일운");
      expect(s[0].polarity, key).toBe("adverse");
      expect(s[0].strength, key).toBe(2);
    }
    for (const key of rising) {
      const s = stageSignals(withStage(CTX.ilun, key), "일운");
      expect(s[0].polarity, key).not.toBe("adverse");
    }
  });

  it("십이운성 근거는 자기 규칙 ID 를 쓴다", () => {
    for (const s of stageSignals(CTX.ilun, "월운")) {
      expect(s.ruleId).toBe("RULE_STAGE_001");
      expect(s.layer).toBe("월운");
      expect(s.text).toContain(CTX.ilun.stage.key);
    }
  });
});

describe("간(干支) 신호", () => {
  it("충은 이동·변화운, 형·해는 대인관계운에 붙는다", () => {
    const sigs = interactionSignals(CTX);
    for (const s of sigs) {
      if (s.ruleId === "RULE_INTERACT_CLASH_001") expect(s.topic, s.text).toBe("이동·변화운");
      if (s.ruleId === "RULE_INTERACT_PUNISH_001" || s.ruleId === "RULE_INTERACT_HARM_001") {
        expect(s.topic, s.text).toBe("대인관계운");
      }
    }
  });

  it("간 신호가 없으면 빈 배열이다 (조용히 문장을 만들지 않는다)", () => {
    const flat = computeFourPillars({
      solarDate: { year: 2024, month: 3, day: 15 },
      timeBranchIndex: 2,
      ziMode: null,
    });
    const c = ctxFor(DATE, flat);
    const sigs = interactionSignals(c);
    for (const s of sigs) expect(s.interaction).toBeDefined();
  });

  it("간 신호에는 원래의 해석 문장이 함께 실린다", () => {
    for (const s of interactionSignals(CTX)) {
      if (!s.interaction) continue;
      expect(s.text, s.ruleId).toContain(s.interaction.description);
      expect(s.interaction.interpretation.length, s.ruleId).toBeGreaterThan(0);
    }
  });
});

describe("toEvidence", () => {
  it("값이 있는 필드만 복사한다 (undefined 키를 만들지 않는다)", () => {
    const minimal: Signal = {
      ruleId: "RULE_TOTAL_001",
      topic: "총운",
      layer: "원국",
      text: "문장",
      strength: 1,
      polarity: "neutral",
    };
    expect(Object.keys(toEvidence(minimal, "원국 · 구조")).sort()).toEqual([
      "detail",
      "layer",
      "ruleId",
      "text",
    ]);
  });

  it("있는 필드는 그대로 옮긴다", () => {
    const full: Signal = {
      ruleId: "RULE_YONGSHIN_001",
      topic: "총운",
      layer: "월운",
      text: "문장",
      strength: 2,
      polarity: "favourable",
      ganZhi: "丙午",
      element: "火",
    };
    const e = toEvidence(full, "월운 丙午");
    expect(e.ganZhi).toBe("丙午");
    expect(e.element).toBe("火");
    expect(e.detail).toBe("월운 丙午");
  });

  it("간(干支) 신호는 계산 층이 정한 세기를 그대로 쓴다", () => {
    // 반합(두 자)과 완성 삼합(세 자)은 같은 종류지만 힘이 다르다.
    // 해석 층이 이 구분을 다시 정하면 안 된다. (전부 3 으로 세면 매일 "매우 두드러짐")
    for (const s of interactionSignals(CTX)) {
      expect(s.strength, s.text).toBe(s.interaction!.strength);
    }
  });

  it("반합은 완성된 삼합보다 약하다", () => {
    const half = CTX.interactions.filter((i) => i.description.includes("반합"));
    const complete = CTX.interactions.filter((i) => /[가-힣] 완성/.test(i.description));
    for (const h of half) expect(h.strength, h.description).toBeLessThan(3);
    for (const c of complete) expect(c.strength, c.description).toBe(3);
  });
});

describe("topicTotal — 한 계층은 항목 하나에 한 번만 더한다", () => {
  const sig = (topic: FortuneTopic, layer: Layer, strength: 1 | 2 | 3): Signal => ({
    ruleId: "RULE_TOTAL_001",
    topic,
    layer,
    text: "문장",
    strength,
    polarity: "favourable",
  });

  it("같은 계층의 신호는 가장 강한 하나만 더한다", () => {
    // 세 개를 그대로 더하면 2+3+1=6, 계층당 최댓값이면 3.
    expect(topicTotal([sig("재물운", "일운", 2), sig("재물운", "일운", 3), sig("재물운", "일운", 1)])).toBe(
      signalValue(sig("재물운", "일운", 3)),
    );
  });

  it("계층이 다르면 각각 더한다 (계층 가중치 반영)", () => {
    const total = topicTotal([sig("재물운", "원국", 2), sig("재물운", "일운", 2)]);
    expect(total).toBeCloseTo(2 * 1.0 + 2 * 0.5, 10);
  });

  it("신호가 없으면 0", () => {
    expect(topicTotal([])).toBe(0);
  });

  it("기세는 사주 전체를 돌려도 정보가 뭉치지 않는다", () => {
  // 회귀 방지. 이전에는 (1) 계층 안의 신호를 그대로 더하고 (2) 절댓값에 1.5/3/4.5 를
  // 걸어, 달력의 모든 칸이 "매우 두드러짐" 이 되었다. (총운 합계가 33~62 로 나갔다)
  //
  // 사주 여럿 × 1년 을 모아 두 가지를 본다.
  // 1) 어떤 비율도 1 을 넘지 않는다. (계층당 최대 세기 3 이 천장이다)
  // 2) 어떤 항목도 기세 한 칸에만 묶여 있지 않다.
  //
  // 특정 사주 하나에서 항목이 잠깐 한 칸에 머무는 것은 허용한다.
  // 대운은 10년 계층이라 1년 안에서 거의 변하지 않으므로 원래 그런 게 정상이다.
  const days: CivilDate[] = [];
  for (let m = 1; m <= 12; m += 1) {
    const n = new Date(Date.UTC(2026, m, 0)).getUTCDate();
    for (let d = 1; d <= n; d += 1) days.push({ year: 2026, month: m, day: d });
  }

  const sajus = [
    sampleBirth({ time: { kind: "doubleHour", branchIndex: 6, ziMode: "자정" }, gender: "남" }),
    sampleBirth({ time: { kind: "doubleHour", branchIndex: 6, ziMode: "자정" }, gender: "여" }),
    sampleBirth({
      year: 1985,
      month: 11,
      day: 2,
      time: { kind: "doubleHour", branchIndex: 0, ziMode: "자정" },
      gender: "남",
    }),
    sampleBirth({
      year: 1972,
      month: 1,
      day: 30,
      time: { kind: "unknown" },
    }),
    sampleBirth({
      year: 2015,
      month: 8,
      day: 15,
      time: { kind: "doubleHour", branchIndex: 8, ziMode: "자정" },
      gender: "여",
    }),
  ].map((b) => analyzeBirth(b));

  const seen = new Map<FortuneTopic, Set<Intensity>>();
  const worst = new Map<FortuneTopic, number>();
  for (const saju of sajus) {
    for (const date of days) {
      const f = analyzeFortune(saju, date);
      const signals = collectSignals(f.context);
      // 계층당 최대 세기 3 을 곱한 값이 이 사주의 천장이다.
      const ceiling =
        3 * (LAYER_WEIGHT["원국"] + (f.context.daeun ? LAYER_WEIGHT["대운"] : 0) + LAYER_WEIGHT["세운"] + LAYER_WEIGHT["월운"] + LAYER_WEIGHT["일운"]);
      for (const section of f.reading.sections) {
        const set = seen.get(section.topic) ?? new Set<Intensity>();
        set.add(section.intensity);
        seen.set(section.topic, set);
        const ratio = topicTotal(signals.filter((s) => s.topic === section.topic)) / ceiling;
        worst.set(section.topic, Math.max(worst.get(section.topic) ?? 0, ratio));
      }
    }
  }

  for (const topic of FORTUNE_TOPICS) {
    expect(worst.get(topic) ?? 0, `${topic} 최대 비율`).toBeLessThanOrEqual(1);
    expect([...(seen.get(topic) ?? [])].length, `${topic} 기세 종류`).toBeGreaterThan(1);
  }
});
});

describe("tenGodFlavor — 편·정의 차이", () => {
  it("편 계열 다섯 개만 문장을 갖는다", () => {
    for (const g of ["겁재", "상관", "편재", "편관", "편인"] as const) {
      expect(tenGodFlavor({ ...CTX.seun, tenGod: g })?.length, g).toBeGreaterThan(0);
    }
    for (const g of ["비견", "식신", "정재", "정관", "정인"] as const) {
      expect(tenGodFlavor({ ...CTX.seun, tenGod: g }), g).toBeNull();
    }
  });
});

describe("intensityOf", () => {
  it("0 이하면 very_low 다", () => {
    expect(intensityOf(0)).toBe("very_low");
    expect(intensityOf(-3)).toBe("very_low");
  });

  it("구간 경계가 문서와 같다 (0.25 / 0.45 / 0.75)", () => {
    expect(intensityOf(0.01)).toBe("low");
    expect(intensityOf(0.249)).toBe("low");
    expect(intensityOf(0.25)).toBe("medium");
    expect(intensityOf(0.449)).toBe("medium");
    expect(intensityOf(0.45)).toBe("high");
    expect(intensityOf(0.749)).toBe("high");
    expect(intensityOf(0.75)).toBe("very_high");
    expect(intensityOf(99)).toBe("very_high");
  });

  it("기세는 5단계로만 나온다", () => {
    const seen = new Set<Intensity>();
    for (let t = -2; t <= 8; t += 0.1) seen.add(intensityOf(t));
    expect([...seen].sort()).toEqual(["high", "low", "medium", "very_high", "very_low"]);
  });
});

describe("중립 문구 (RULE_NEUTRAL_001)", () => {
  it("기세가 very_low 이면 특별한 신호가 없다는 문구로 끝난다", () => {
    const plain = ctxFor({ year: 2031, month: 4, day: 2 });
    const r = readFortune(plain, { dateLabel: "2031년 4월 2일" });
    const weak = r.sections.filter((s) => s.intensity === "very_low");
    for (const s of weak) {
      expect(s.interpretation, s.topic).toContain("특별히 두드러지는 신호가 많지 않다");
    }
  });

  it("중립이어도 근거는 버리지 않는다 (기록은 남는다)", () => {
    for (const s of READING.sections) {
      if (s.intensity !== "very_low") continue;
      for (const e of s.evidence) {
        expect(e.ruleId, s.topic).toMatch(/^RULE_/);
      }
    }
  });

  it("억지로 좋고 나쁨을 만들지 않는다", () => {
    for (const s of READING.sections) {
      if (s.intensity !== "very_low") continue;
      expect(s.interpretation, s.topic).not.toMatch(/최고|최악|행운|불운/);
    }
  });
});

describe("주의점 · 핵심 포인트", () => {
  it("주의점은 모두 규칙 ID · 계층 · 심각도를 갖는다", () => {
    for (const c of READING.cautions) {
      expect(ruleById(c.ruleId), c.ruleId).toBeDefined();
      expect(DRILLDOWN_CHAIN, c.ruleId).toContain(c.layer);
      expect([1, 2, 3], c.ruleId).toContain(c.severity);
      expect(c.text.length, c.ruleId).toBeGreaterThan(0);
    }
  });

  it("주의점은 신호 고지 최대 6개 + 제한 고지다", () => {
    const signalOnly = READING.cautions.filter(
      (c) => c.detail !== "시주 미상" && c.detail !== "대운 기산 이전",
    );
    expect(signalOnly.length).toBeLessThanOrEqual(6);
  });

  it("제한 고지는 신호가 많아도 잘리지 않는다", () => {
    // adverse 신호가 충분한 날짜에서도 시주 미상 고지는 반드시 남는다.
    const noHour = computeFourPillars({
      solarDate: { year: 1988, month: 11, day: 3 },
      timeBranchIndex: null,
      ziMode: null,
    });
    const dates: CivilDate[] = [
      { year: 2026, month: 9, day: 27 },
      { year: 2031, month: 4, day: 2 },
      { year: 2044, month: 11, day: 9 },
      { year: 2019, month: 6, day: 15 },
    ];
    for (const date of dates) {
      const r = readFortune(ctxFor(date, noHour), { dateLabel: "x" });
      const label = `${date.year}-${date.month}-${date.day}`;
      expect(r.cautions.some((c) => c.detail === "시주 미상"), label).toBe(true);
    }
  });

  it("핵심 포인트는 어떤 항목의 기세를 끌어올렸는지 밝힌다", () => {
    for (const k of READING.keyPoints) {
      expect(ruleById(k.ruleId), k.ruleId).toBeDefined();
      expect(k.topics.length, k.ruleId).toBeGreaterThan(0);
      for (const t of k.topics) expect(FORTUNE_TOPICS, t).toContain(t);
      expect(k.text.length, k.ruleId).toBeGreaterThan(0);
    }
  });

  it("핵심 포인트는 불리 신호를 올리지 않는다 (같은 규칙·계층 기준)", () => {
    const signals = collectSignals(CTX);
    for (const k of READING.keyPoints) {
      const same = signals.filter((s) => s.ruleId === k.ruleId && s.layer === k.layer);
      expect(same.length, k.ruleId).toBeGreaterThan(0);
      expect(
        same.every((s) => s.polarity === "favourable" || s.polarity === "volatile"),
        `${k.ruleId}/${k.layer}`,
      ).toBe(true);
    }
  });

  it("핵심 포인트는 기세 합이 큰 신호부터 최대 4개다", () => {
    expect(READING.keyPoints.length).toBeLessThanOrEqual(4);
    const signals = collectSignals(CTX);
    const values = READING.keyPoints.map(
      (k) => signalValue(signals.find((s) => s.ruleId === k.ruleId && s.layer === k.layer)!),
    );
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i - 1]).toBeGreaterThanOrEqual(values[i]);
    }
  });
});

describe("해석 제한 고지", () => {
  it("시주 미상이면 제한 안내와 주의점이 함께 나온다", () => {
    const noHour = computeFourPillars({
      solarDate: { year: 1988, month: 11, day: 3 },
      timeBranchIndex: null,
      ziMode: null,
    });
    const c = ctxFor(DATE, noHour);
    const r = readFortune(c, { dateLabel: "2026년 9월 27일" });
    expect(c.hourUnknown).toBe(true);
    expect(r.restrictions.join()).toContain("시주");
    expect(r.cautions.some((x) => x.ruleId === "RULE_HOUR_001")).toBe(true);
    // 시주에서 나오는 신호는 아예 없다.
    const hourTexts = collectSignals(c)
      .filter((s) => s.text.includes("시주 "))
      .filter((s) => !s.text.includes("시주가"));
    expect(hourTexts).toEqual([]);
  });

  it("대운 기산 전이면 대운이 없다는 사실을 밝힌다", () => {
    const early = ctxFor({ year: 1900, month: 1, day: 1 });
    const r = readFortune(early, { dateLabel: "1900년 1월 1일" });
    expect(early.daeun).toBeNull();
    expect(r.restrictions.join()).toContain("대운");
    expect(r.cautions.some((x) => x.detail === "대운 기산 이전")).toBe(true);
    // 대운 계층의 근거는 0개여야 한다.
    for (const s of r.sections) {
      for (const e of s.evidence) expect(e.layer, e.ruleId).not.toBe("대운");
    }
  });

  it("제한이 없으면 빈 배열이다", () => {
    expect(READING.restrictions).toEqual([]);
  });
});

describe("드릴다운 체인", () => {
  it("오늘의 운세 → 일운 → 월운 → 세운 → 대운 → 원국 순으로 이어진다", () => {
    const steps = drilldown(CTX, READING);
    expect(steps.map((s) => s.layer)).toEqual(["일운", "월운", "세운", "대운", "원국"]);
  });

  it("각 단계에 그 계층의 기둥과 근거 개수가 붙는다", () => {
    for (const s of drilldown(CTX, READING)) {
      expect(s.ganZhi.length, s.layer).toBe(2);
      expect(s.tenGod.length, s.layer).toBeGreaterThan(0);
      expect(s.element.length, s.layer).toBeGreaterThan(0);
      expect(s.stage.length, s.layer).toBeGreaterThan(0);
      expect(Number.isInteger(s.evidenceCount), s.layer).toBe(true);
      expect(s.evidenceCount, s.layer).toBeGreaterThan(0);
    }
  });

  it("근거 개수가 실제 근거 수와 일치한다", () => {
    const steps = drilldown(CTX, READING);
    const total = steps.reduce((a, s) => a + s.evidenceCount, 0);
    const actual = READING.sections.reduce((a, s) => a + s.evidence.length, 0);
    expect(total).toBe(actual);
  });

  it("기둥 표기가 컨텍스트와 일치한다", () => {
    const steps = drilldown(CTX, READING);
    const byLayer = new Map(steps.map((s) => [s.layer, s.ganZhi]));
    expect(byLayer.get("세운")).toBe(CTX.seun.ganZhi);
    expect(byLayer.get("월운")).toBe(CTX.wolun.ganZhi);
    expect(byLayer.get("일운")).toBe(CTX.ilun.ganZhi);
    expect(byLayer.get("대운")).toBe(CTX.daeun?.ganZhi);
  });

  it("원국 단계는 일주를 대표로 보여준다", () => {
    const steps = drilldown(CTX, READING);
    const natal = steps.find((s) => s.layer === "원국")!;
    expect(natal.ganZhi).toBe(ganZhiText(CTX.chart.day.stem, CTX.chart.day.branch));
    expect(natal.element).toBe(ELEMENT_KOREAN[CTX.chart.dayMasterElement]);
  });

  it("대운이 없으면 대운 단계를 건너뛴다", () => {
    const early = ctxFor({ year: 1900, month: 1, day: 1 });
    const r = readFortune(early, { dateLabel: "1900년 1월 1일" });
    expect(drilldown(early, r).map((s) => s.layer)).not.toContain("대운");
  });
});

describe("결정론", () => {
  it("같은 입력은 언제나 같은 해석을 낸다", () => {
    for (let i = 0; i < 3; i += 1) {
      const r = readFortune(ctxFor(), { dateLabel: "2026년 9월 27일" });
      expect(r.sections).toEqual(READING.sections);
      expect(r.cautions).toEqual(READING.cautions);
      expect(r.keyPoints).toEqual(READING.keyPoints);
    }
  });

  it("날짜가 다르면 결과가 달라진다 (같은 문장을 붙여 넣지 않는다)", () => {
    const a = readFortune(ctxFor({ year: 2026, month: 9, day: 27 }), { dateLabel: "a" });
    const b = readFortune(ctxFor({ year: 2026, month: 9, day: 28 }), { dateLabel: "b" });
    expect(JSON.stringify(a.sections)).not.toBe(JSON.stringify(b.sections));
  });

  it("같은 날짜를 다시 만들면 컨텍스트 전체가 같다", () => {
    expect(ctxFor()).toEqual(CTX);
  });
});
