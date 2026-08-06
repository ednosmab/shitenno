/**
 * daemon-resources.test.ts — Tests for BoundedQueue and LRUCache
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BoundedQueue, LRUCache } from "../domain/types/daemon-resources.js";

// ── BoundedQueue ──────────────────────────────────────────────────────────────

describe("BoundedQueue", () => {
  it("accepts items up to capacity", () => {
    const q = new BoundedQueue<number>(3);
    q.push(1);
    q.push(2);
    q.push(3);
    expect(q.size()).toBe(3);
    expect(q.toArray()).toEqual([1, 2, 3]);
  });

  it("evicts oldest item when over capacity", () => {
    const q = new BoundedQueue<number>(3);
    q.push(1);
    q.push(2);
    q.push(3);
    q.push(4); // evicts 1
    expect(q.size()).toBe(3);
    expect(q.toArray()).toEqual([2, 3, 4]);
  });

  it("evicts multiple oldest items correctly", () => {
    const q = new BoundedQueue<number>(2);
    q.push(1);
    q.push(2);
    q.push(3); // evicts 1
    q.push(4); // evicts 2
    expect(q.toArray()).toEqual([3, 4]);
  });

  it("size never exceeds maxSize", () => {
    const q = new BoundedQueue<number>(5);
    for (let i = 0; i < 20; i++) q.push(i);
    expect(q.size()).toBeLessThanOrEqual(5);
  });

  it("load trims to cap", () => {
    const q = new BoundedQueue<number>(3);
    q.load([1, 2, 3, 4, 5]);
    expect(q.size()).toBe(3);
    expect(q.toArray()).toEqual([3, 4, 5]); // keeps most recent
  });

  it("isFull returns true at capacity", () => {
    const q = new BoundedQueue<number>(2);
    q.push(1);
    expect(q.isFull()).toBe(false);
    q.push(2);
    expect(q.isFull()).toBe(true);
  });

  it("drain removes matching items and returns them", () => {
    const q = new BoundedQueue<number>(10);
    q.push(1); q.push(2); q.push(3); q.push(4);
    const drained = q.drain((n) => n % 2 === 0);
    expect(drained).toEqual([2, 4]);
    expect(q.toArray()).toEqual([1, 3]);
  });

  it("clear empties the queue", () => {
    const q = new BoundedQueue<number>(5);
    q.push(1); q.push(2);
    q.clear();
    expect(q.size()).toBe(0);
  });

  it("filter is non-destructive", () => {
    const q = new BoundedQueue<number>(5);
    q.push(1); q.push(2); q.push(3);
    const result = q.filter((n) => n > 1);
    expect(result).toEqual([2, 3]);
    expect(q.size()).toBe(3); // unchanged
  });

  it("throws if maxSize < 1", () => {
    expect(() => new BoundedQueue<number>(0)).toThrow(RangeError);
  });

  it("is iterable", () => {
    const q = new BoundedQueue<number>(5);
    q.push(10); q.push(20);
    const result: number[] = [];
    for (const item of q) result.push(item);
    expect(result).toEqual([10, 20]);
  });
});

// ── LRUCache ──────────────────────────────────────────────────────────────────

describe("LRUCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("stores and retrieves values", () => {
    const c = new LRUCache<string, number>(3);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
  });

  it("evicts LRU entry when over capacity", () => {
    const c = new LRUCache<string, number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3); // should evict "a" (LRU)
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
  });

  it("recent access prevents LRU eviction", () => {
    const c = new LRUCache<string, number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a"); // access "a" → now most recently used
    c.set("c", 3); // should evict "b" (now LRU)
    expect(c.get("a")).toBe(1); // "a" survives
    expect(c.get("b")).toBeUndefined();
  });

  it("size never exceeds maxSize", () => {
    const c = new LRUCache<string, number>(3);
    for (let i = 0; i < 10; i++) c.set(`k${i}`, i);
    expect(c.size()).toBeLessThanOrEqual(3);
  });

  it("TTL expiry returns undefined", () => {
    const c = new LRUCache<string, number>(5, 1_000);
    c.set("x", 42);
    expect(c.get("x")).toBe(42);
    vi.advanceTimersByTime(1_001);
    expect(c.get("x")).toBeUndefined();
  });

  it("has() returns false for expired entries", () => {
    const c = new LRUCache<string, number>(5, 500);
    c.set("y", 7);
    vi.advanceTimersByTime(501);
    expect(c.has("y")).toBe(false);
  });

  it("evictExpired removes expired entries and returns count", () => {
    const c = new LRUCache<string, number>(5, 300);
    c.set("a", 1);
    c.set("b", 2);
    vi.advanceTimersByTime(301);
    c.set("c", 3); // fresh
    const count = c.evictExpired();
    expect(count).toBe(2); // "a" and "b"
    expect(c.size()).toBe(1);
  });

  it("delete removes a key", () => {
    const c = new LRUCache<string, number>(5);
    c.set("a", 1);
    c.delete("a");
    expect(c.get("a")).toBeUndefined();
  });

  it("clear empties the cache", () => {
    const c = new LRUCache<string, number>(5);
    c.set("a", 1); c.set("b", 2);
    c.clear();
    expect(c.size()).toBe(0);
  });

  it("throws if maxSize < 1", () => {
    expect(() => new LRUCache<string, number>(0)).toThrow(RangeError);
  });

  it("no TTL = entries live forever", () => {
    const c = new LRUCache<string, number>(5);
    c.set("z", 99);
    vi.advanceTimersByTime(999_999);
    expect(c.get("z")).toBe(99);
  });
});
