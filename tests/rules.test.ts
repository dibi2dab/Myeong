/**
 * 규칙 카탈로그(`data/rules/rules.ts`)와 용어집(`data/rules/terms.ts`)의 정합성.
 *
 * 이 파일이 잡아야 하는 것:
 *  1. 규칙 ID 는 유일하고, 코드가 실제로 쓰는 규칙은 **모두** 카탈로그에 있어야 한다.
 *  2. 한 개념에 두 학교를 섞지 않는다. (카탈로그에 규칙이 두 벌이면 그것 자체가 결함이다)
 *  3. 고지 문구에 "과학적으로 검증되지 않았다"는 내용이 포함된다.
 *  4. 용어집은 순수 데이터다. 해석 로직이 이 파일을 참조해 문장을 만들지 않는다.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DISCLAIMER_SHORT,
  DISCLAIMER_TEXT,
  RULES,
  ruleById,
  rulesOfCategory,
  type RuleCategory,
  type RuleDoc,
} from "../data/rules/rules";
import {
  TERM_CATEGORIES,
  TERMS,
  termByName,
  termsOfCategory,
} from "../data/rules/terms";

const ROOT = join(import.meta.dirname, "..");

/** 저장소 안의 모든 TypeScript 소스 파일. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (["node_modules", "dist", ".git"].includes(name)) continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const ALL_SOURCES = [...sourceFiles(join(ROOT, "core")), ...sourceFiles(join(ROOT, "data"))];

/** 코드가 참조하는 `RULE_*` 식별자 전수. (주석 속 예시 표기는 제외한다) */
function ruleIdsUsedInSource(): Map<string, string[]> {
  const used = new Map<string, string[]>();
  for (const file of ALL_SOURCES) {
    const text = readFileSync(file, "utf8");
    // 블록 주석과 줄 주석을 걷어 낸 뒤에만 찾는다.
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const m of code.matchAll(/"(RULE_[A-Z0-9_]+)"/g)) {
      const id = m[1];
      const list = used.get(id) ?? [];
      list.push(relative(ROOT, file));
      used.set(id, list);
    }
  }
  return used;
}

// ---------------------------------------------------------------------------

describe("규칙 카탈로그 구조", () => {
  it("규칙 ID 가 모두 유일하다", () => {
    const ids = RULES.map((r) => r.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
    expect(new Set(ids).size).toBe(RULES.length);
  });

  it("ID 형식이 RULE_<영역>_<번호> 다", () => {
    for (const r of RULES) {
      // 영역 이름은 한 단어일 수도 두 단어일 수도 있다 (INTERACT_STEM, DAYMASTER …)
    expect(r.id, r.title).toMatch(/^RULE_[A-Z]+(_[A-Z]+)*_\d{3}$/);
    }
  });

  it("모든 항목이 5개 필드를 다 채운다", () => {
    for (const r of RULES) {
      for (const key of ["id", "category", "title", "definition", "criteria", "interpretation"]) {
        expect(typeof r[key as keyof RuleDoc], `${r.id}.${key}`).toBe("string");
        expect((r[key as keyof RuleDoc] as string).trim().length, `${r.id}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("마침표가 없는 짧은 문장도 없이 각 문장이 완결돼 있다", () => {
    for (const r of RULES) {
      expect(r.definition.trim(), r.id).toMatch(/[.]$/);
      expect(r.criteria.trim(), r.id).toMatch(/[.]$/);
      expect(r.interpretation.trim(), r.id).toMatch(/[.]$/);
    }
  });

  it("한 개념에 두 학교를 섞지 않는다 (기준·해석이 하나로 고정)", () => {
    // 같은 title 을 가진 규칙이 둘 이상이면 산출법이 섞인 것이다.
    const titles = RULES.map((r) => r.title);
    const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect(dupes).toEqual([]);
  });

  it("어떤 카테고리도 비어 있지 않다", () => {
    const seen = new Set(RULES.map((r) => r.category));
    for (const c of seen) {
      expect(rulesOfCategory(c).length, c).toBeGreaterThan(0);
    }
  });

  it("카테고리가 RuleCategory 합집합 안에만 있다", () => {
    const known = new Set<RuleCategory>([
      "절기",
      "사주",
      "오행",
      "십신",
      "대운",
      "간(干支)",
      "용신",
      "해석",
    ]);
    for (const r of RULES) expect(known.has(r.category), r.id).toBe(true);
  });

  it("요구된 12개 기준이 모두 카탈로그에 존재한다", () => {
    // 절기 기준 · 년주 · 월주 · 자시 · 일주 · 대운 산출/시작/순역 · 십신 · 십이운성 ·
    // 합충형파해 · 오행 강약 · 용신/희신
    const required = [
      "RULE_TERM_001",
      "RULE_TERM_002",
      "RULE_TERM_003",
      "RULE_SUNLONG_001",
      "RULE_YEAR_001",
      "RULE_MONTH_001",
      "RULE_DAY_001",
      "RULE_HOUR_001",
      "RULE_ZI_001",
      "RULE_TZ_001",
      "RULE_TENGOD_001",
      "RULE_HIDDEN_001",
      "RULE_STAGE_001",
      "RULE_DAEUN_001",
      "RULE_DAEUN_002",
      "RULE_DAEUN_003",
      "RULE_SEUN_001",
      "RULE_WOLUN_001",
      "RULE_ILUN_001",
      "RULE_ELEMENT_001",
      "RULE_MOONCMD_001",
      "RULE_DAYMASTER_001",
      "RULE_VOID_001",
      "RULE_FLOW_001",
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
      "RULE_INTERACT_BREAK_001",
      "RULE_INTERACT_HARM_001",
      "RULE_YONGSHIN_001",
      "RULE_HIERARCHY_001",
      "RULE_INTENSITY_001",
      "RULE_NEUTRAL_001",
      "RULE_DISCLAIMER_001",
    ];
    for (const id of required) {
      expect(ruleById(id), id).toBeDefined();
    }
  });

  it("오늘의 운세 9개 항목이 각각 자기 규칙을 갖는다", () => {
    for (const id of [
      "RULE_TOTAL_001",
      "RULE_MONEY_001",
      "RULE_CAREER_001",
      "RULE_LOVE_001",
      "RULE_RELATION_001",
      "RULE_STUDY_001",
      "RULE_HEALTH_001",
      "RULE_MOVE_001",
    ]) {
      expect(ruleById(id)?.category, id).toBe("해석");
    }
  });

  it("용신 규칙은 정확히 하나다", () => {
    const yongshin = rulesOfCategory("용신");
    expect(yongshin.map((r) => r.id)).toEqual(["RULE_YONGSHIN_001"]);
  });

  it("절기 오차 수치가 실제 검증값과 일치한다", () => {
    const rule = ruleById("RULE_TERM_002")!;
    expect(rule.definition).toContain("13.93");
    expect(rule.definition).toContain("3.60");
    expect(rule.definition).toContain("192");
    // HKO 는 UTC+8 로公开发한다는 사실을 규칙 문서에 못 박아 둔다.
    expect(`${rule.definition}${rule.criteria}${rule.interpretation}`).toMatch(/UTC\+8|HKT/);
  });
});

describe("ruleById / rulesOfCategory", () => {
  it("찾으면 같은 객체를 돌려준다", () => {
    const id = RULES[0].id;
    expect(ruleById(id)).toBe(ruleById(id));
  });

  it("모르는 ID 는 undefined 다 (조용히 빈 값을 만들지 않는다)", () => {
    expect(ruleById("RULE_없음_001")).toBeUndefined();
    expect(ruleById("")).toBeUndefined();
    expect(ruleById("term_001")).toBeUndefined(); // 대소문자 구분
  });

  it("카테고리 합이 전체 규칙 수와 같다", () => {
    const total = TERM_CATEGORIES.length; // 목록 길이만 sanity check 용으로 빌림
    expect(total).toBeGreaterThan(0);
    const known: RuleCategory[] = [
      "절기",
      "사주",
      "오행",
      "십신",
      "대운",
      "간(干支)",
      "용신",
      "해석",
    ];
    const sum = known.reduce((a, c) => a + rulesOfCategory(c).length, 0);
    expect(sum).toBe(RULES.length);
  });
});

describe("코드가 쓰는 규칙은 카탈로그에 모두 있다", () => {
  const used = ruleIdsUsedInSource();

  it("코드에서 RULE_* 를 실제로 하나 이상 참조한다", () => {
    expect(used.size).toBeGreaterThan(20);
  });

  it("참조된 모든 규칙 ID 가 카탈로그에 정의돼 있다", () => {
    const missing: string[] = [];
    for (const [id, files] of used) {
      if (!ruleById(id)) missing.push(`${id} (${files[0]})`);
    }
    expect(missing).toEqual([]);
  });

  it("카탈로그의 모든 규칙이 최소 한 곳에서 쓰인다 (죽은 규칙 없음)", () => {
    const orphans = RULES.filter((r) => !used.has(r.id)).map((r) => r.id);
    expect(orphans).toEqual([]);
  });

  it("용신 규칙은 계산 결과에 실제로 붙는다", () => {
    expect(used.get("RULE_YONGSHIN_001")?.some((f) => f.startsWith("core"))).toBe(true);
  });
});

describe("고지 문구", () => {
  it("과학적으로 검증되지 않았음을 밝힌다", () => {
    expect(DISCLAIMER_TEXT).toContain("과학적으로 검증된");
    expect(DISCLAIMER_TEXT).toContain("전통 명리학");
    expect(DISCLAIMER_SHORT).toContain("과학적으로 검증된 예측이 아닙니다");
  });

  it("중요한 결정은 전문가 상담을 함께 권한다", () => {
    expect(DISCLAIMER_TEXT).toContain("전문가");
  });

  it("점수나 순위를 약속하지 않는다", () => {
    for (const text of [DISCLAIMER_TEXT, DISCLAIMER_SHORT]) {
      expect(text).not.toContain("100점");
      expect(text).not.toContain("점수");
    }
  });

  it("고지 규칙이 카탈로그에 있다", () => {
    expect(ruleById("RULE_DISCLAIMER_001")?.category).toBe("해석");
  });
});

// ---------------------------------------------------------------------------

describe("용어집은 순수 데이터다", () => {
  it("용어 이름이 모두 유일하다", () => {
    const names = TERMS.map((t) => t.term);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });

  it("70개 용어가 모두 채워져 있다", () => {
    expect(TERMS).toHaveLength(70);
  });

  it("모든 항목이 설명·상세·읽기를 갖는다", () => {
    for (const t of TERMS) {
      expect(t.term.trim().length, t.term).toBeGreaterThan(0);
      expect(t.korean.trim().length, t.term).toBeGreaterThan(0);
      expect(t.short.trim().length, t.term).toBeGreaterThan(0);
      expect(t.detail.trim().length, t.term).toBeGreaterThan(0);
      expect(Array.isArray(t.seeAlso), t.term).toBe(true);
    }
  });

  it("짧은 설명과 자세한 설명이 서로 다르다", () => {
    for (const t of TERMS) {
      expect(t.short, t.term).not.toBe(t.detail);
    }
  });

  it("짧은 설명은 한 문장으로 끝난다", () => {
    for (const t of TERMS) {
      expect(t.short.trim(), t.term).toMatch(/[.]$/);
    }
  });

  it("seeAlso 는 전부 용어집에 있는 이름이다", () => {
    for (const t of TERMS) {
      for (const ref of t.seeAlso) {
        expect(termByName(ref), `${t.term} → ${ref}`).toBeDefined();
      }
    }
  });

  it("자기자신은 seeAlso 로 참조하지 않는다", () => {
    for (const t of TERMS) {
      expect(t.seeAlso, t.term).not.toContain(t.term);
    }
  });

  it("카테고리가 TermCategory 안에만 있다", () => {
    const known = new Set<string>(TERM_CATEGORIES);
    for (const t of TERMS) expect(known.has(t.category), t.term).toBe(true);
  });

  it("모든 카테고리에 용어가 하나 이상 있다", () => {
    for (const c of TERM_CATEGORIES) {
      expect(termsOfCategory(c).length, c).toBeGreaterThan(0);
    }
  });

  it("카테고리 합이 전체 용어 수와 같다", () => {
    const sum = TERM_CATEGORIES.reduce((a, c) => a + termsOfCategory(c).length, 0);
    expect(sum).toBe(TERMS.length);
  });

  it("계산·해석 모듈은 용어집을 읽지 않는다 (데이터와 로직의 분리)", () => {
    // 용어집은 화면(웹/이메일)이 직접 가져다 쓰는 데이터다.
    // 계산이나 해석 모듈이 용어집 설명을 끼워 넣으면 문장이 두 벌이 된다.
    // 공개 API 배럴(core/index.ts)의 재수출만 허용한다.
    const importers: string[] = [];
    for (const file of sourceFiles(join(ROOT, "core"))) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      if (/from\s+"[^"]*\/terms"/.test(code)) {
        importers.push(relative(ROOT, file).split(/[\\/]/).join("/"));
      }
    }
    expect(importers).toEqual(["core/index.ts"]);
  });

  it("해석 모듈은 해석 문장을 하드코딩하지 않고 신호 규칙에서 만든다", () => {
    // interpretation 안에서 용어집 본문을 복사해 붙인 흔적이 없는지 확인한다.
    const detail = termByName("일간")!.detail;
    for (const file of sourceFiles(join(ROOT, join("core", "interpretation")))) {
      const code = readFileSync(file, "utf8");
      expect(code.includes(detail), file).toBe(false);
    }
  });

  it("termByName 은 없는 이름을 조용히 만들지 않는다", () => {
    expect(termByName("없는용어")).toBeUndefined();
    expect(termByName("")).toBeUndefined();
  });

  it("화면에 나올 핵심 용어가 모두 담겨 있다", () => {
    const required = [
      "사주팔자",
      "원국",
      "일간",
      "월령",
      "용신",
      "희신",
      "대운",
      "세운",
      "월운",
      "일운",
      "시주",
      "자시",
      "시진",
      "지장간",
      "십이운성",
      "십신",
      "합",
      "충",
      "형",
      "파",
      "해",
      "절지",
      "출생시간 모름",
    ];
    for (const name of required) {
      expect(termByName(name)?.short.length, name).toBeGreaterThan(0);
    }
  });
});
