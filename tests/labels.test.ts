/**
 * 한자 병기 감시 테스트.
 *
 * 지시: **한자를 단독으로 표시하지 않는다.** 글자가 나오는 자리에는 반드시
 * 한국어 설명이 함께 붙는다. (예: `庚` ✗ → `경금(庚金)` ○)
 *
 * 이 테스트는 그 규칙이 앞으로 무너지지 않게 막는다. 표기 함수를 하나씩
 * 확인하고, 반환 문자열이 "한자만 있는 조각"으로 나뉘지 않는지 본다.
 */
import { describe, expect, it } from "vitest";
import {
  ELEMENT_LABELS,
  FIVE_ELEMENTS,
  branchParts,
  elementParts,
  ganZhiParts,
  joinParts,
  stemParts,
  tenGodParts,
  tenGodLabel,
  twelveStageParts,
  twelveStageLabel,
  type LabelParts,
} from "../core";
import { BRANCHES, STEMS } from "../core/constants/stems";
import { TEN_GODS } from "../core/ten_gods/tenGods";
import { TWELVE_STAGES } from "../core/twelve_stages/twelveStages";

/** 한글(한글 음절)만 있는가. 조각마다 최소 한 글자는 있어야 한국어로 읽힌다. */
function hasHangul(s: string): boolean {
  return /[가-힣]/.test(s);
}

/** 조각이 '한자만'으로는 이루어져 있는가. (=설명 없이 홀로 노출될 글자) */
function isBareHanja(s: string): boolean {
  return /^[一-鿿]+$/.test(s);
}

const ALL_STEMS = STEMS.map((s) => s.char);
const ALL_BRANCHES = BRANCHES.map((b) => b.char);
const ALL_GANZHI = ALL_STEMS.flatMap((s) => ALL_BRANCHES.map((b) => s + b));
const ALL_TEN_GODS = TEN_GODS.map((g) => g.key);

describe("한자 조각에는 항상 한국어가 붙는다", () => {
  it("천간: 모든 글자에 한국어 앞부분이 있다", () => {
    for (const char of ALL_STEMS) {
      const parts = stemParts(char);
      expect(hasHangul(parts.main), `${char} 앞부분에 한글이 없다`).toBe(true);
      expect(isBareHanja(parts.main), `${char} 앞부분이 한자뿐이다`).toBe(false);
    }
  });

  it("지지: 모든 글자에 한국어 앞부분이 있다", () => {
    for (const char of ALL_BRANCHES) {
      const parts = branchParts(char);
      expect(hasHangul(parts.main), `${char} 앞부분에 한글이 없다`).toBe(true);
      expect(isBareHanja(parts.main), `${char} 앞부분이 한자뿐이다`).toBe(false);
    }
  });

  it("간지: 모든 조합에 한국어 앞부분이 있다", () => {
    for (const gz of ALL_GANZHI) {
      expect(hasHangul(ganZhiParts(gz).main), `${gz} 에 한글이 없다`).toBe(true);
    }
  });

  it("십신 · 십이운성 · 오행도 같다", () => {
    for (const el of FIVE_ELEMENTS) {
      expect(hasHangul(elementParts(el).main), `${el}`).toBe(true);
    }
    for (const key of ALL_TEN_GODS) {
      expect(hasHangul(tenGodParts(key).main), key).toBe(true);
    }
    for (const stage of TWELVE_STAGES) {
      expect(hasHangul(twelveStageParts(stage.key).main), stage.key).toBe(true);
    }
  });
});

describe("괄호 안에는 한자가 들어간다 (소리로는 구분 안 되는 것을 구별)", () => {
  it("괄호 조각이 한자로 시작하고 한글이 섞이지 않는다", () => {
    const parts: LabelParts[] = [
      ...ALL_STEMS.map(stemParts),
      ...ALL_BRANCHES.map(branchParts),
      ...ALL_GANZHI.map(ganZhiParts),
    ];
    for (const p of parts) {
      expect(p.hanja.startsWith("("), p.hanja).toBe(true);
      expect(p.hanja.endsWith(")"), p.hanja).toBe(true);
      const inner = p.hanja.slice(1, -1);
      expect(/^[一-鿿]+$/.test(inner), `괄호 안이 한자뿐이 아니다: ${p.hanja}`).toBe(true);
    }
  });

  /** 같은 소리(신)인데 다른 글자라 괄호 한자가 반드시 달라야 한다. */
  it("소리가 같은 천간·지지는 괄호 한자가 다르다", () => {
    expect(stemParts("辛").hanja).toBe("(辛金)");
    expect(branchParts("申").hanja).toBe("(申金)");
    expect(stemParts("辛").main).not.toBe(branchParts("申").main.length === 3 ? "신" : "");
    // 앞부분 소리는 둘 다 "신" 으로 시작한다.
    expect(stemParts("辛").main.startsWith("신")).toBe(true);
    expect(branchParts("申").main.startsWith("신")).toBe(true);
  });
});

describe("지정된 표기 형식", () => {
  it("지시서가 든 예시를 그대로 따른다", () => {
    expect(joinParts(stemParts("庚"))).toBe("경금(庚金)");
    expect(joinParts(stemParts("辛"))).toBe("신금(辛金)");
    expect(joinParts(stemParts("甲"))).toBe("갑목(甲木)");
    expect(joinParts(branchParts("亥"))).toBe("해수(亥水)");
    expect(joinParts(branchParts("子"))).toBe("자수(子水)");
    expect(joinParts(ganZhiParts("庚子"))).toBe("경자(庚子)");
    expect(tenGodLabel("편재")).toBe("편재(偏財)");
    expect(tenGodLabel("정관")).toBe("정관(正官)");
    expect(twelveStageLabel("장생")).toBe("장생(長生)");
  });

  it("간지를 이을 때는 오행을 덧붙이지 않는다 (경금자수가 되지 않는다)", () => {
    const parts = ganZhiParts("庚子");
    expect(parts.main).toBe("경자");
    expect(parts.hanja).toBe("(庚子)");
    expect(joinParts(parts)).not.toContain("금");
    expect(joinParts(parts)).not.toContain("수");
  });

  it("천간·지지는 각각 오행을 덧붙인다", () => {
    expect(joinParts(stemParts("庚"))).toContain("금");
    expect(joinParts(branchParts("子"))).toContain("수");
  });
});

describe("오행 표기", () => {
  it("오행 다섯 개가 모두 한글로 읽힌다", () => {
    expect(joinParts(elementParts("木"))).toBe("목(木)");
    expect(joinParts(elementParts("火"))).toBe("화(火)");
    expect(joinParts(elementParts("土"))).toBe("토(土)");
    expect(joinParts(elementParts("金"))).toBe("금(金)");
    expect(joinParts(elementParts("水"))).toBe("수(水)");
  });

  it("한글 부분이 ELEMENT_LABELS 와 어긋나지 않는다", () => {
    for (const el of FIVE_ELEMENTS) {
      expect(elementParts(el).main).toBe(ELEMENT_LABELS[el].korean);
    }
  });
});

describe("알 수 없는 글자는 조용히 넘어가지 않는다", () => {
  it("잘못된 간지는 오류를 던진다 (빈 문자열로 새어나오지 않는다)", () => {
    expect(() => stemParts("甲X")).toThrow();
    expect(() => branchParts("子X")).toThrow();
    expect(() => ganZhiParts("庚")).toThrow();
    expect(() => ganZhiParts("庚子丑")).toThrow();
  });
});