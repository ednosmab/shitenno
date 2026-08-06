import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../infrastructure/briefing-cache.js", () => ({
  readCache: vi.fn(),
}));

vi.mock("../infrastructure/session-feedback.js", () => ({
  recordOutcome: vi.fn(),
  createFileStorage: vi.fn(),
}));

import { readCache } from "../infrastructure/briefing-cache.js";
import { recordOutcome, createFileStorage } from "../infrastructure/session-feedback.js";
import { handleSubmitFeedback } from "../mcp-handlers/context.js";

const mockReadCache = vi.mocked(readCache);
const mockRecordOutcome = vi.mocked(recordOutcome);
const mockCreateFileStorage = vi.mocked(createFileStorage);

const BASE_ARGS = { outcome: "success", notes: "works" };

describe("handleSubmitFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFileStorage.mockReturnValue({ record: vi.fn() } as never);
  });

  it("records feedback using briefing cache hash and timestamp when cache exists", () => {
    mockReadCache.mockReturnValue({
      version: 1,
      entry: {
        inputHash: "abc123",
        computedAt: "2026-08-05T00:00:00Z",
        briefing: {} as never,
      },
    });

    const result = handleSubmitFeedback("/project", "/project/.shitenno", BASE_ARGS);

    expect(mockRecordOutcome).toHaveBeenCalledWith(expect.anything(), {
      briefingHash: "abc123",
      briefingTimestamp: "2026-08-05T00:00:00Z",
      outcome: "success",
      notes: "works",
    });
    expect(result.content[0]!.text).toBe("Feedback submitted successfully.");
  });

  it("records feedback with empty briefing hash when no cache exists (no daemon/cache dependency)", () => {
    mockReadCache.mockReturnValue(null);

    const result = handleSubmitFeedback("/project", "/project/.shitenno", BASE_ARGS);

    expect(mockRecordOutcome).toHaveBeenCalledWith(expect.anything(), {
      briefingHash: "",
      briefingTimestamp: "",
      outcome: "success",
      notes: "works",
    });
    expect(result.content[0]!.text).toBe("Feedback submitted successfully.");
  });

  it("returns error and records nothing when outcome or notes are missing", () => {
    mockReadCache.mockReturnValue(null);

    const result = handleSubmitFeedback("/project", "/project/.shitenno", { outcome: "success" });

    expect(result.isError).toBe(true);
    expect(mockRecordOutcome).not.toHaveBeenCalled();
  });
});
