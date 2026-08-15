import { createHash } from "node:crypto";
import { lstat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep, win32 } from "node:path";
import type {
  HubPublishedSkillBundle,
  HubSkillFile
} from "./types.js";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function compareSkillPaths(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function skillContentHash(files: HubSkillFile[]): string {
  const hash = createHash("sha256");
  const sorted = [...files].sort((left, right) =>
    compareSkillPaths(left.path, right.path)
  );
  for (const file of sorted) {
    hash.update(file.path, "utf8");
    hash.update("\0", "utf8");
    hash.update(file.content, "utf8");
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function assertSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 hex digest`);
  }
}

export function assertSkillBundleIntegrity(
  bundle: HubPublishedSkillBundle
): void {
  if (!SKILL_NAME_PATTERN.test(bundle.name)) {
    throw new Error(`Unsafe Skill name: ${bundle.name}`);
  }
  if (!bundle.files.some((file) => file.path === "SKILL.md")) {
    throw new Error(`Skill bundle is missing SKILL.md: ${bundle.name}`);
  }
  assertSha256(bundle.contentHash, "Skill contentHash");
  const paths = new Set<string>();
  let previousPath: string | undefined;

  for (const file of bundle.files) {
    if (paths.has(file.path)) {
      throw new Error(`Duplicate skill file path: ${file.path}`);
    }
    if (
      previousPath !== undefined &&
      compareSkillPaths(previousPath, file.path) > 0
    ) {
      throw new Error("Skill files must be sorted by path");
    }
    paths.add(file.path);
    previousPath = file.path;

    assertSha256(file.sha256, `Skill file hash for ${file.path}`);
    const actual = sha256(file.content);
    if (actual !== file.sha256) {
      throw new Error(`Skill file hash mismatch: ${file.path}`);
    }
  }

  const actualContentHash = skillContentHash(bundle.files);
  if (actualContentHash !== bundle.contentHash) {
    throw new Error(`Skill content hash mismatch for ${bundle.name}`);
  }
}

export function resolveSkillFilePath(target: string, filePath: string): string {
  const segments = filePath.split("/");
  if (
    !filePath ||
    filePath.includes("\\") ||
    filePath.includes("\0") ||
    isAbsolute(filePath) ||
    win32.isAbsolute(filePath) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe skill file path: ${filePath}`);
  }

  const destination = resolve(target, filePath);
  if (destination !== target && !destination.startsWith(`${target}${sep}`)) {
    throw new Error(`Unsafe skill file path: ${filePath}`);
  }
  return destination;
}

export async function assertNoSkillPathSymlinks(
  target: string,
  destinations: string[]
): Promise<void> {
  const checked = new Set<string>();
  for (const destination of destinations) {
    const relativePath = relative(target, destination);
    let current = target;
    const segments = relativePath ? ["", ...relativePath.split(sep)] : [""];
    for (const segment of segments) {
      if (segment) current = resolve(current, segment);
      if (checked.has(current)) continue;
      checked.add(current);
      try {
        const stats = await lstat(current);
        if (stats.isSymbolicLink()) {
          throw new Error(
            `Unsafe Skill installation path contains a symbolic link: ${current}`
          );
        }
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          break;
        }
        throw error;
      }
    }
  }
}
