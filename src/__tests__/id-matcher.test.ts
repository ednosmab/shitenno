import { describe, it, expect } from "vitest";
import { matchesTaskId } from "../id-matcher.js";

describe("matchesTaskId — sem colisão por prefixo numérico", () => {
  it("não casa TASK-1 com TASK-10", () => {
    expect(matchesTaskId("TASK-10", "TASK-1")).toBe(false);
    expect(matchesTaskId("TASK-1", "TASK-10")).toBe(false);
  });

  it("não casa TASK-1 com TASK-100", () => {
    expect(matchesTaskId("TASK-100", "TASK-1")).toBe(false);
    expect(matchesTaskId("TASK-1", "TASK-100")).toBe(false);
  });

  it("casa TASK-1 com ele mesmo, case-insensitive", () => {
    expect(matchesTaskId("task-1", "TASK-1")).toBe(true);
    expect(matchesTaskId("TASK-1", "TASK-1")).toBe(true);
  });

  it("casa TASK-1 com TASK-1-retry (fronteira de separador)", () => {
    expect(matchesTaskId("TASK-1-retry", "TASK-1")).toBe(true);
    expect(matchesTaskId("TASK-1", "TASK-1-retry")).toBe(true);
  });

  it("casa com underscore como separador", () => {
    expect(matchesTaskId("TASK-1_extra", "TASK-1")).toBe(true);
  });

  it("casa com ponto como separador", () => {
    expect(matchesTaskId("TASK-1.extra", "TASK-1")).toBe(true);
  });

  it("casa com espaço como separador", () => {
    expect(matchesTaskId("TASK-1 extra", "TASK-1")).toBe(true);
  });

  it("não casa TASK-1 com TASK-11", () => {
    expect(matchesTaskId("TASK-11", "TASK-1")).toBe(false);
  });

  it("não casa IDs completamente diferentes", () => {
    expect(matchesTaskId("TASK-2", "TASK-1")).toBe(false);
    expect(matchesTaskId("FEATURE-1", "TASK-1")).toBe(false);
  });
});
