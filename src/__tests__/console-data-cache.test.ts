import { describe, it, expect, beforeEach } from "vitest";
import {
  getOrCollectConsoleData,
  clearConsoleDataCache,
} from "../console/data-collector.js";

describe("Console Data Cache", () => {
  beforeEach(() => {
    clearConsoleDataCache();
  });

  it("should return data on first call", async () => {
    const data = await getOrCollectConsoleData("/tmp", "/tmp/.shugo");
    expect(data).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });

  it("should return cached data on second call within TTL", async () => {
    const data1 = await getOrCollectConsoleData("/tmp", "/tmp/.shugo", 5000);
    const data2 = await getOrCollectConsoleData("/tmp", "/tmp/.shugo", 5000);
    expect(data1.timestamp).toBe(data2.timestamp);
  });

  it("should return fresh data after cache is cleared", async () => {
    clearConsoleDataCache();
    const data2 = await getOrCollectConsoleData("/tmp", "/tmp/.shugo", 5000);
    expect(data2).toBeDefined();
  });

  it("should return fresh data after TTL expires", async () => {
    const data1 = await getOrCollectConsoleData("/tmp", "/tmp/.shugo", 1);
    await new Promise((r) => setTimeout(r, 10));
    const data2 = await getOrCollectConsoleData("/tmp", "/tmp/.shugo", 1);
    expect(data1).toBeDefined();
    expect(data2).toBeDefined();
  });

  it("should use different cache keys for different project roots", async () => {
    const data1 = await getOrCollectConsoleData("/tmp/project1", "/tmp/project1/.shugo");
    const data2 = await getOrCollectConsoleData("/tmp/project2", "/tmp/project2/.shugo");
    expect(data1.projectRoot).toBe("/tmp/project1");
    expect(data2.projectRoot).toBe("/tmp/project2");
  });

  it("should clear all cache entries", async () => {
    await getOrCollectConsoleData("/tmp", "/tmp/.shugo");
    clearConsoleDataCache();
    const data = await getOrCollectConsoleData("/tmp", "/tmp/.shugo");
    expect(data).toBeDefined();
  });
});
