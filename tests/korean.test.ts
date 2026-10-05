/**
 * 한국어 문장 조립 (`core/text/korean.ts`).
 *
 * 조사(를·를, 이·가, 은·는)는 받침에 따라 달라지므로 **계산** 이 아니라
 * **표기** 에 해당한다. 그만큼 잘못 쓰면 결과물 전체가 어색해지므로 테스트한다.
 *
 * 함께 확인하는 것
 * - 오행 다섯 글자 (목·화·토·금·수) 의 조사가 규칙대로 붙는지
 * - 물음표를 붙이지 않는 표기가 `core` 어느 곳에도 다시 등장하지 않는지
 */

import { describe, expect, it } from "vitest";

import { analyzeBirth, analyzeFortune, RULES, TERMS } from "../core";
import { hasBatchim, object, subject, topic, withParticle } from "../core/text/korean";
import { birth, REFERENCE_DATE } from "./fixtures/samples";

/** "이(가)" 처럼 읽는 사람이 고르게 만든 표기. 남아 있으면 실패로 본다. */
const AMBIGUOUS = /[가은를이]\((?:가|는|를|이)\)/;

describe("hasBatchim", () => {
  it("받침이 있는 한글은 참, 없는 한글은 거짓", () => {
    for (const word of ["금", "목", "비견", "식신", "인성", "관성", "장생", "절장"]) {
      expect(hasBatchim(word), word).toBe(true);
    }
    // 첫 음절이 아니라 **마지막** 글자만 본다. (귀는 ㄱ 받침이 아니라 ㄱ 받침이 아니다)
    expect(hasBatchim("논")).toBe(true);
    expect(hasBatchim("귀")).toBe(false);
    for (const word of ["화", "토", "수", "너", "히"]) {
      expect(hasBatchim(word), word).toBe(false);
    }
    for (const word of ["논", "봄", "옷", "바람"]) expect(hasBatchim(word), word).toBe(true);
  });

  it("한자(천간 · 지지는 전부 받침 있음으로 본다)", () => {
    for (const hanja of ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]) {
      expect(hasBatchim(hanja), hanja).toBe(true);
    }
  });

  it("빈 문자열은 거짓 (NaN 가드는 예외를 던지지 않는다)", () => {
    expect(hasBatchim("")).toBe(false);
  });
});

describe("조사 선택", () => {
  it("오행 다섯 글자 (목·금 만 받침이 있다)", () => {
    for (const word of ["목", "금"]) {
      expect(subject(word), word).toBe("이");
      expect(object(word), word).toBe("을");
      expect(topic(word), word).toBe("은");
    }
    for (const word of ["화", "토", "수"]) {
      expect(subject(word), word).toBe("가");
      expect(object(word), word).toBe("를");
      expect(topic(word), word).toBe("는");
    }
  });

  it("withParticle 는 종류를 골라 붙인다", () => {
    expect(withParticle("목")).toBe("목이");
    expect(withParticle("화")).toBe("화가");
    expect(withParticle("수", "object")).toBe("수를");
    expect(withParticle("목", "topic")).toBe("목은");
  });
});

describe("탐색적 표기가 남아 있지 않다", () => {
  it("용어집 · 규칙 카탈로그 문안", () => {
    for (const term of TERMS) {
      for (const field of [term.short, term.detail]) {
        expect(field, term.term).not.toMatch(AMBIGUOUS);
      }
    }
    for (const rule of RULES) {
      for (const field of [rule.title, rule.definition, rule.criteria, rule.interpretation]) {
        expect(field, rule.id).not.toMatch(AMBIGUOUS);
      }
    }
  });

  it("오늘의 운세 해석 전체 (근거 문장 포함)", () => {
    const result = analyzeBirth(birth());
    const { reading } = analyzeFortune(result, REFERENCE_DATE);

    const texts: string[] = [];
    for (const section of reading.sections) {
      texts.push(section.interpretation);
      for (const evidence of section.evidence) texts.push(evidence.text, evidence.detail);
    }
    for (const point of reading.keyPoints) texts.push(point.text);
    for (const caution of reading.cautions) texts.push(caution.text);

    expect(texts.length).toBeGreaterThan(20);
    for (const text of texts) expect(text).not.toMatch(AMBIGUOUS);
  });

  it("내 사주 원국 근거에도 남아 있지 않다", () => {
    const result = analyzeBirth(birth());
    const texts = [
      result.natal.strength.verdict,
      ...result.natal.strength.evidence,
      ...result.natal.yongshin.evidence,
    ];
    expect(texts.length).toBeGreaterThan(5);
    for (const text of texts) expect(text).not.toMatch(AMBIGUOUS);
  });
});