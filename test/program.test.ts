import { describe, expect, it } from "vitest";
import { createProgram } from "../src/program.js";

describe("createProgram", () => {
  it("registers the standalone Hub workflow", () => {
    expect(createProgram().commands.map((command) => command.name())).toEqual([
      "list",
      "search",
      "show",
      "preview",
      "call",
      "sdk",
      "skill"
    ]);
  });
});
