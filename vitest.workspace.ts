import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "apps/web/vitest.config.ts",
  "packages/core/vitest.config.ts",
  "packages/execution/vitest.config.ts",
]);
