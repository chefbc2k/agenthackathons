export interface CoverageGateStatus {
  readonly floor: number;
  readonly target: number;
  readonly enforceTarget: boolean;
}

export const coverageGateStatus = (
  currentCoverage: number,
): CoverageGateStatus => {
  if (currentCoverage < 95) {
    return {
      floor: 95,
      target: 100,
      enforceTarget: true,
    };
  }

  return {
    floor: 95,
    target: 100,
    enforceTarget: currentCoverage < 100,
  };
};

export * from "./core/a2a.js";
export * from "./core/parse-result.js";
export * from "./core/stable-json.js";
export * from "./core/x402-http.js";
export * from "./core/x402.js";
export * from "./api/index.js";
export * from "./config/index.js";
export * from "./db/index.js";
export * from "./ingest/index.js";
export * from "./linking/index.js";
export * from "./metrics/index.js";
export * from "./observability/index.js";
export * from "./scoring/index.js";
export * from "./scheduler/index.js";
export * from "./worker/index.js";
