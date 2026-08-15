import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  assertSkillBundleIntegrity,
  resolveSkillFilePath,
  sha256,
  skillContentHash
} from "../src/skill.js";
import type { HubPublishedSkillBundle } from "../src/types.js";

const files = [
  {
    path: "SKILL.md",
    sha256: "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03",
    content: "hello\n"
  },
  {
    path: "agents/openai.yaml",
    sha256: "8789e7eabb7ba5922a5087c25d315a1e5fbb6b0f97510862579d348428dbd9d4",
    content: "name: demo\n"
  }
];

const bundle: HubPublishedSkillBundle = {
  name: "pontx-demo",
  apiSlug: "demo",
  version: "1.0.0",
  description: "Demo Skill",
  license: "MIT-0",
  contentHash: "b11591fbcfcbd85fe887a74b1c0ef8ab15fb1e17d0c3783fca7b39cd88a9c92b",
  files
};

describe("Skill bundle integrity", () => {
  it("uses the canonical UTF-8 SHA-256 algorithm", () => {
    expect(sha256("hello\n")).toBe(files[0]!.sha256);
    expect(skillContentHash(files)).toBe(bundle.contentHash);
    expect(() => assertSkillBundleIntegrity(bundle)).not.toThrow();
  });

  it("rejects a file whose content does not match its digest", () => {
    expect(() => assertSkillBundleIntegrity({
      ...bundle,
      files: [{ ...files[0]!, content: "tampered\n" }, files[1]!]
    })).toThrow("Skill file hash mismatch: SKILL.md");
  });

  it("rejects a bundle whose aggregate content hash does not match", () => {
    expect(() => assertSkillBundleIntegrity({
      ...bundle,
      contentHash: "0".repeat(64)
    })).toThrow("Skill content hash mismatch for pontx-demo");
  });

  it("rejects duplicate or unsorted file paths", () => {
    expect(() => assertSkillBundleIntegrity({
      ...bundle,
      files: [files[0]!, files[0]!]
    })).toThrow("Duplicate skill file path: SKILL.md");
    expect(() => assertSkillBundleIntegrity({
      ...bundle,
      files: [files[1]!, files[0]!]
    })).toThrow("Skill files must be sorted by path");
  });

  it("rejects a bundle name that could escape the default install directory", () => {
    expect(() => assertSkillBundleIntegrity({
      ...bundle,
      name: "../../outside"
    })).toThrow("Unsafe Skill name: ../../outside");
  });

  it("rejects an empty bundle before installation", () => {
    expect(() => assertSkillBundleIntegrity({
      ...bundle,
      contentHash: sha256(""),
      files: []
    })).toThrow("Skill bundle is missing SKILL.md: pontx-demo");
  });
});

describe("Skill file paths", () => {
  const target = resolve("/tmp", "pontx-skill-test");

  it("resolves nested files below the selected installation directory", () => {
    expect(resolveSkillFilePath(target, "agents/openai.yaml")).toBe(
      resolve(target, "agents/openai.yaml")
    );
  });

  it.each([
    "../outside",
    "nested/../../outside",
    "/absolute/SKILL.md",
    "C:\\absolute\\SKILL.md",
    "./SKILL.md",
    "nested//SKILL.md",
    "nested\\SKILL.md",
    ""
  ])("rejects unsafe path %j", (filePath) => {
    expect(() => resolveSkillFilePath(target, filePath)).toThrow(
      `Unsafe skill file path: ${filePath}`
    );
  });
});
