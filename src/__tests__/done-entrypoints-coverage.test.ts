import { describe, it, expect } from "vitest";
import { LIFECYCLE_CHECK_NAMES } from "../plan/checks.js";

const PIPELINE_GATES = ["tests", "lint", "documentation", "backlog", "plan_status"];

describe("cobertura das duas portas de entrada para done", () => {
  it("snapshot dos conjuntos de gate — mudança exige atualizar o comentário cruzado", () => {
    expect(PIPELINE_GATES).toMatchSnapshot();
    expect([...LIFECYCLE_CHECK_NAMES]).toMatchSnapshot();
  });
});
