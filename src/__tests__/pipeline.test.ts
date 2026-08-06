import { describe, it, expect } from "vitest";
import { Pipeline, createPipelineContext } from "../application/pipeline.js";
import type { PipelineContext, PipelineStage } from "../application/pipeline.js";

describe("Pipeline", () => {
  const createStage = (name: string, delay = 0): PipelineStage => ({
    name,
    description: `Stage ${name}`,
    execute: async (ctx: PipelineContext) => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return { ...ctx, [name]: true };
    },
  });

  it("executes stages in order", async () => {
    const order: string[] = [];

    const stageA: PipelineStage = {
      name: "a",
      description: "A",
      execute: async (ctx) => {
        order.push("a");
        return { ...ctx, a: true };
      },
    };

    const stageB: PipelineStage = {
      name: "b",
      description: "B",
      execute: async (ctx) => {
        order.push("b");
        return { ...ctx, b: true };
      },
    };

    const pipeline = new Pipeline().addStage(stageA).addStage(stageB);
    const result = await pipeline.execute(
      createPipelineContext("/test", "/test/shitenno")
    );

    expect(order).toEqual(["a", "b"]);
    expect((result as unknown as Record<string, unknown>).a).toBe(true);
    expect((result as unknown as Record<string, unknown>).b).toBe(true);
  });

  it("continues after stage error", async () => {
    const failingStage: PipelineStage = {
      name: "fail",
      description: "Failing stage",
      execute: async () => {
        throw new Error("stage failed");
      },
    };

    const successStage: PipelineStage = {
      name: "success",
      description: "Success stage",
      execute: async (ctx) => ({ ...ctx, success: true }),
    };

    const pipeline = new Pipeline().addStage(failingStage).addStage(successStage);
    const result = await pipeline.execute(
      createPipelineContext("/test", "/test/shitenno")
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.stage).toBe("fail");
    expect((result as unknown as Record<string, unknown>).success).toBe(true);
  });

  it("records stage results", async () => {
    const stage: PipelineStage = {
      name: "test",
      description: "Test stage",
      execute: async (ctx) => ctx,
    };

    const pipeline = new Pipeline().addStage(stage);
    const result = await pipeline.execute(
      createPipelineContext("/test", "/test/shitenno")
    );

    expect(result.stageResults).toHaveLength(1);
    expect(result.stageResults[0]!.stage).toBe("test");
    expect(result.stageResults[0]!.status).toBe("success");
    expect(result.stageResults[0]!.duration).toBeGreaterThanOrEqual(0);
  });

  it("sets completedAt when done", async () => {
    const pipeline = new Pipeline();
    const result = await pipeline.execute(
      createPipelineContext("/test", "/test/shitenno")
    );

    expect(result.completedAt).toBeDefined();
  });

  it("getStages returns copy of stages", () => {
    const pipeline = new Pipeline()
      .addStage(createStage("a"))
      .addStage(createStage("b"));

    const stages = pipeline.getStages();
    expect(stages).toHaveLength(2);
    expect(stages[0]!.name).toBe("a");
    expect(stages[1]!.name).toBe("b");
  });

  it("createPipelineContext initializes correctly", () => {
    const ctx = createPipelineContext("/project", "/project/shitenno");

    expect(ctx.projectRoot).toBe("/project");
    expect(ctx.shitennoDir).toBe("/project/shitenno");
    expect(ctx.errors).toHaveLength(0);
    expect(ctx.stageResults).toHaveLength(0);
    expect(ctx.startedAt).toBeDefined();
  });
});
