import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runPublicRepoAudit } from "./public-repo-audit";

const tempDirs: string[] = [];

function createTempRepo(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "public-repo-audit-"));
  tempDirs.push(dir);
  mkdirSync(path.join(dir, ".git"));
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("runPublicRepoAudit", () => {
  it("passes when only example env files exist", () => {
    const repoDir = createTempRepo();
    writeFileSync(path.join(repoDir, ".env.example"), "EXAMPLE=1\n");

    expect(runPublicRepoAudit(repoDir)).toEqual({
      localEnvFiles: [],
      nestedGitDirs: [],
    });
  });

  it("flags local env files and nested git directories", () => {
    const repoDir = createTempRepo();
    mkdirSync(path.join(repoDir, "apps", "web", ".git"), { recursive: true });
    writeFileSync(path.join(repoDir, ".env.local"), "SECRET=1\n");
    writeFileSync(path.join(repoDir, ".env.test-wallets.local"), "SECRET=2\n");

    expect(runPublicRepoAudit(repoDir)).toEqual({
      localEnvFiles: [".env.local", ".env.test-wallets.local"],
      nestedGitDirs: ["apps/web/.git"],
    });
  });

  it("ignores generated directories while scanning", () => {
    const repoDir = createTempRepo();
    mkdirSync(path.join(repoDir, "apps", "web", "coverage"), { recursive: true });
    writeFileSync(path.join(repoDir, "apps", "web", "coverage", ".env.local"), "SHOULD_NOT_COUNT=1\n");

    expect(runPublicRepoAudit(repoDir)).toEqual({
      localEnvFiles: [],
      nestedGitDirs: [],
    });
  });
});
