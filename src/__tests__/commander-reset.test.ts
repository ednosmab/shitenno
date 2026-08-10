import { describe, it, expect } from "vitest";
import { Command } from "commander";
import { resetCommanderOptions } from "../interface/cli/commander-reset.js";

/**
 * SA17 — Commander singleton retains _optionValues between .parse() calls.
 * Regression test: re-parse of the same Command must not leak option
 * values from the previous parse.
 */
describe("commander state persistence (SA17)", () => {
  it("does not retain option values between parse calls", () => {
    const cmd = new Command("demo");
    cmd.option("-d, --dir <path>", "dir option");
    cmd.action(() => {});

    cmd.parse(["node", "test", "-d", "/first"], { from: "user" });
    expect(cmd.opts()).toEqual({ dir: "/first" });

    resetCommanderOptions(cmd);
    cmd.parse(["node", "test"], { from: "user" });
    expect(cmd.opts()).toEqual({});
  });

  it("resets option values on the root command after parse", () => {
    const cmd = new Command("demo");
    cmd.option("--quiet", "quiet mode");
    cmd.option("-o, --output <file>", "output file");
    cmd.action(() => {});

    cmd.parse(["node", "test", "--quiet", "-o", "a.txt"], { from: "user" });
    expect(cmd.opts()).toEqual({ quiet: true, output: "a.txt" });

    resetCommanderOptions(cmd);
    cmd.parse(["node", "test"], { from: "user" });
    expect(cmd.opts()).toEqual({});
  });

  it("resets subcommand option values recursively", () => {
    const cmd = new Command("demo");
    const sub = new Command("status");
    sub.option("--json", "json output");
    sub.action(() => {});
    cmd.addCommand(sub);

    cmd.parse(["status", "--json"], { from: "user" });
    expect(sub.opts()).toEqual({ json: true });

    resetCommanderOptions(cmd);
    cmd.parse(["status"], { from: "user" });
    expect(sub.opts()).toEqual({});
  });
});
