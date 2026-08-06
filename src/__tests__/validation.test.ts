import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import {
  safeJsonParse,
  safeJsonParseFile,
  validateRequiredFields,
  validateStringId,
  validateFileExists,
  validateYamlHasSections,
  validateJsonConfig,
  escapeRegex,
  isSafeFieldName,
  sanitizeForYaml,
  sanitizeIdentifier,
} from "../infrastructure/validation.js";

const TEST_DIR = join(tmpdir(), "shitenno-validation-test");

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
  });

  it("returns fallback on invalid JSON", () => {
    expect(safeJsonParse("not json", [])).toEqual([]);
  });

  it("returns fallback on empty string", () => {
    expect(safeJsonParse("", null)).toBe(null);
  });
});

describe("safeJsonParseFile", () => {
  const dir = join(TEST_DIR, "json-parse-file");

  beforeAll(() => mkdirSync(dir, { recursive: true }));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("reads and parses a JSON file", () => {
    const path = join(dir, "valid.json");
    writeFileSync(path, '{"x":42}');
    expect(safeJsonParseFile(path, {})).toEqual({ x: 42 });
  });

  it("returns fallback if file missing", () => {
    expect(safeJsonParseFile(join(dir, "nope.json"), "default")).toBe("default");
  });

  it("returns fallback if file invalid", () => {
    const path = join(dir, "bad.json");
    writeFileSync(path, "{bad");
    expect(safeJsonParseFile(path, [])).toEqual([]);
  });
});

describe("validateRequiredFields", () => {
  it("passes for valid object", () => {
    const result = validateRequiredFields(
      { name: "test", count: 5 },
      [
        { key: "name", type: "string" },
        { key: "count", type: "number" },
      ],
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails for missing fields", () => {
    const result = validateRequiredFields({}, [
      { key: "name", type: "string" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("name");
  });

  it("fails for wrong type", () => {
    const result = validateRequiredFields(
      { name: 123 },
      [{ key: "name", type: "string" }],
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("string");
  });

  it("allows optional fields", () => {
    const result = validateRequiredFields({}, [
      { key: "opt", type: "string", required: false },
    ]);
    expect(result.valid).toBe(true);
  });

  it("fails for non-object input", () => {
    const result = validateRequiredFields(null, []);
    expect(result.valid).toBe(false);
  });

  it("validates array type", () => {
    const result = validateRequiredFields(
      { items: "not-array" },
      [{ key: "items", type: "array" }],
    );
    expect(result.valid).toBe(false);
  });
});

describe("validateStringId", () => {
  it("accepts valid IDs", () => {
    expect(validateStringId("my-rule-1")).toBe(true);
    expect(validateStringId("test_rule")).toBe(true);
    expect(validateStringId("ABC123")).toBe(true);
  });

  it("rejects invalid IDs", () => {
    expect(validateStringId("")).toBe(false);
    expect(validateStringId("has spaces")).toBe(false);
    expect(validateStringId("special!chars")).toBe(false);
    expect(validateStringId(null)).toBe(false);
    expect(validateStringId(123)).toBe(false);
  });

  it("respects maxLength", () => {
    expect(validateStringId("a".repeat(101))).toBe(false);
    expect(validateStringId("a".repeat(100))).toBe(true);
  });

  it("accepts custom pattern", () => {
    expect(validateStringId("ABC", { pattern: /^[A-Z]+$/ })).toBe(true);
    expect(validateStringId("abc", { pattern: /^[A-Z]+$/ })).toBe(false);
  });
});

describe("validateFileExists", () => {
  const dir = join(TEST_DIR, "file-exists");

  beforeAll(() => mkdirSync(dir, { recursive: true }));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("returns exists: true for existing file", () => {
    const path = join(dir, "exists.txt");
    writeFileSync(path, "hi");
    expect(validateFileExists(path).exists).toBe(true);
  });

  it("returns exists: false for missing file", () => {
    expect(validateFileExists(join(dir, "nope.txt")).exists).toBe(false);
  });
});

describe("validateYamlHasSections", () => {
  const dir = join(TEST_DIR, "yaml-sections");

  beforeAll(() => mkdirSync(dir, { recursive: true }));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("passes when all sections present", () => {
    const path = join(dir, "full.yaml");
    writeFileSync(path, "reminders:\n  - a\nagents:\n  - b\n");
    const result = validateYamlHasSections(path, ["reminders", "agents"]);
    expect(result.status).toBe("pass");
  });

  it("warns on missing sections", () => {
    const path = join(dir, "partial.yaml");
    writeFileSync(path, "reminders:\n  - a\n");
    const result = validateYamlHasSections(path, ["reminders", "agents"]);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("agents");
  });

  it("fails if file missing", () => {
    const result = validateYamlHasSections(join(dir, "nope.yaml"), []);
    expect(result.status).toBe("fail");
  });
});

describe("validateJsonConfig", () => {
  const dir = join(TEST_DIR, "json-config");

  beforeAll(() => mkdirSync(dir, { recursive: true }));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("passes for valid config", () => {
    const path = join(dir, "good.json");
    writeFileSync(path, '{"model":"gpt-4","agent":"test"}');
    const result = validateJsonConfig(path, ["model", "agent"]);
    expect(result.status).toBe("pass");
  });

  it("warns on missing keys", () => {
    const path = join(dir, "incomplete.json");
    writeFileSync(path, '{"model":"gpt-4"}');
    const result = validateJsonConfig(path, ["model", "agent"]);
    expect(result.status).toBe("warn");
  });

  it("fails on invalid JSON", () => {
    const path = join(dir, "bad.json");
    writeFileSync(path, "{bad");
    const result = validateJsonConfig(path, []);
    expect(result.status).toBe("fail");
  });

  it("fails if file missing", () => {
    const result = validateJsonConfig(join(dir, "nope.json"), []);
    expect(result.status).toBe("fail");
  });
});

describe("escapeRegex", () => {
  it("escapes special characters", () => {
    expect(escapeRegex("a.b*c+d")).toBe("a\\.b\\*c\\+d");
  });

  it("escapes brackets", () => {
    expect(escapeRegex("[test]")).toBe("\\[test\\]");
  });

  it("returns empty for empty string", () => {
    expect(escapeRegex("")).toBe("");
  });
});

describe("isSafeFieldName", () => {
  it("allows normal fields", () => {
    expect(isSafeFieldName("name")).toBe(true);
    expect(isSafeFieldName("field_1")).toBe(true);
  });

  it("blocks dangerous keys", () => {
    expect(isSafeFieldName("__proto__")).toBe(false);
    expect(isSafeFieldName("constructor")).toBe(false);
    expect(isSafeFieldName("prototype")).toBe(false);
    expect(isSafeFieldName("toString")).toBe(false);
    expect(isSafeFieldName("valueOf")).toBe(false);
  });
});

describe("sanitizeForYaml", () => {
  it("escapes quotes and backslashes", () => {
    expect(sanitizeForYaml('say "hi"')).toBe('say \\"hi\\"');
  });

  it("escapes newlines", () => {
    expect(sanitizeForYaml("line1\nline2")).toBe("line1\\nline2");
  });

  it("truncates to maxLen", () => {
    expect(sanitizeForYaml("a".repeat(300), 100)).toHaveLength(100);
  });
});

describe("sanitizeIdentifier", () => {
  it("replaces non-alphanumeric chars", () => {
    expect(sanitizeIdentifier("hello world!")).toBe("hello_world_");
  });

  it("truncates to maxLen", () => {
    expect(sanitizeIdentifier("a".repeat(60), 50)).toHaveLength(50);
  });
});
