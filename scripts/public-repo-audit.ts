import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export interface PublicRepoAudit {
  localEnvFiles: string[];
  nestedGitDirs: string[];
}

const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "dist",
  "out",
  "artifacts",
  "cache",
  "broadcast",
]);

function isLocalEnvFile(name: string): boolean {
  if (!name.startsWith(".env")) {
    return false;
  }

  return name !== ".env.example";
}

function walk(rootDir: string, currentDir: string, audit: PublicRepoAudit): void {
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath) || ".";

    if (entry.isDirectory()) {
      if (entry.name === ".git" && relativePath !== ".git") {
        audit.nestedGitDirs.push(relativePath);
        continue;
      }

      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      walk(rootDir, absolutePath, audit);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (isLocalEnvFile(entry.name)) {
      audit.localEnvFiles.push(relativePath);
    }
  }
}

export function runPublicRepoAudit(rootDir: string): PublicRepoAudit {
  const resolvedRoot = path.resolve(rootDir);
  const rootStat = statSync(resolvedRoot);

  if (!rootStat.isDirectory()) {
    throw new Error(`Expected a directory: ${resolvedRoot}`);
  }

  const audit: PublicRepoAudit = {
    localEnvFiles: [],
    nestedGitDirs: [],
  };

  walk(resolvedRoot, resolvedRoot, audit);

  audit.localEnvFiles.sort();
  audit.nestedGitDirs.sort();

  return audit;
}

function printSection(title: string, items: string[]): void {
  if (items.length === 0) {
    console.log(`${title}: none`);
    return;
  }

  console.log(`${title}:`);
  for (const item of items) {
    console.log(`- ${item}`);
  }
}

function main(): void {
  const rootDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const audit = runPublicRepoAudit(rootDir);

  printSection("Local env files", audit.localEnvFiles);
  printSection("Nested git directories", audit.nestedGitDirs);

  if (!existsSync(path.join(rootDir, ".git"))) {
    console.error("Root git repository missing");
    process.exitCode = 1;
    return;
  }

  if (audit.localEnvFiles.length > 0 || audit.nestedGitDirs.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("Public repo audit passed.");
}

if (process.argv[1]?.endsWith("public-repo-audit.ts")) {
  main();
}
