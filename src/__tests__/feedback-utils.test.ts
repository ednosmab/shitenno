import { describe, it, expect } from "vitest";
import { parseUserRating, parseUserTags } from "../domain/rules/feedback-utils.js";

describe("parseUserRating", () => {
  it("returns undefined when input is undefined", () => {
    expect(parseUserRating(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseUserRating("")).toBeUndefined();
  });

  it("returns undefined for non-numeric input", () => {
    expect(parseUserRating("abc")).toBeUndefined();
  });

  it("returns undefined for NaN", () => {
    expect(parseUserRating("NaN")).toBeUndefined();
  });

  it("returns undefined for values below 1", () => {
    expect(parseUserRating("0")).toBeUndefined();
  });

  it("returns undefined for values above 5", () => {
    expect(parseUserRating("9")).toBeUndefined();
  });

  it("rounds decimal values", () => {
    expect(parseUserRating("3.6")).toBe(3);
  });

  it("accepts valid integers 1-5", () => {
    expect(parseUserRating("1")).toBe(1);
    expect(parseUserRating("3")).toBe(3);
    expect(parseUserRating("5")).toBe(5);
  });
});

describe("parseUserTags", () => {
  it("returns undefined when input is undefined", () => {
    expect(parseUserTags(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseUserTags("")).toBeUndefined();
  });

  it("splits comma-separated tags and trims whitespace", () => {
    expect(parseUserTags(" bug , ui ,perf")).toEqual(["bug", "ui", "perf"]);
  });

  it("returns single tag as array", () => {
    expect(parseUserTags("security")).toEqual(["security"]);
  });

  it("filters out empty segments", () => {
    expect(parseUserTags("a,,b,")).toEqual(["a", "b"]);
  });
});
