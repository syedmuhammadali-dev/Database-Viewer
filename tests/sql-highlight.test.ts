import { describe, it, expect } from "vitest";
import { highlightSql } from "@/lib/sql/highlight";

describe("highlightSql", () => {
  it("wraps keywords and types", () => {
    expect(highlightSql("SELECT id FROM users")).toContain(
      '<span class="text-sky-300">SELECT</span>',
    );
    expect(highlightSql("SELECT x AS y")).toContain(
      '<span class="text-sky-300">AS</span>',
    );
    expect(highlightSql("SELECT CAST(a AS VARCHAR)")).toContain(
      '<span class="text-sky-300">VARCHAR</span>',
    );
  });

  it("is case-insensitive for keywords", () => {
    expect(highlightSql("select * from x")).toContain(
      '<span class="text-sky-300">select</span>',
    );
  });

  it("wraps numbers", () => {
    expect(highlightSql("SELECT 42, 3.14, 1e3")).toContain(
      '<span class="text-amber-300">42</span>',
    );
    expect(highlightSql("SELECT 3.14")).toContain(
      '<span class="text-amber-300">3.14</span>',
    );
  });

  it("wraps string literals and quoted identifiers", () => {
    expect(highlightSql("'hello'")).toContain(
      '<span class="text-emerald-300">\'hello\'</span>',
    );
    expect(highlightSql('"my table"')).toContain(
      '<span class="text-emerald-300">&quot;my table&quot;</span>',
    );
  });

  it("escapes HTML in content before highlighting", () => {
    const html = highlightSql("SELECT '<b>&amp;</b>'");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&amp;amp;");
  });

  it("wraps line and block comments", () => {
    expect(highlightSql("-- note")).toContain(
      '<span class="italic text-zinc-500">-- note</span>',
    );
    expect(highlightSql("/* block */")).toContain(
      '<span class="italic text-zinc-500">/* block */</span>',
    );
  });

  it("leaves identifiers and punctuation plain when unescaped", () => {
    expect(highlightSql("a, b.c")).toContain("a, b.c");
  });

  it("preserves punctuation and layout of the source", () => {
    const source = "SELECT a, b FROM t\nWHERE x = 1;";
    const html = highlightSql(source);
    expect(html).toContain("a, b ");
    expect(html).toContain("= ");
    expect(html).toContain(";");
    expect(html).toContain("\n");
    expect(html).not.toContain("<SELECT");
  });

  it("returns empty string for empty input", () => {
    expect(highlightSql("")).toBe("");
    expect(highlightSql("   ")).toBe("   ");
  });
});