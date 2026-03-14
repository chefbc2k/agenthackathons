import { type ZodIssue, type ZodType } from "zod";

export interface ParseFailure {
  readonly success: false;
  readonly issues: readonly string[];
}

export interface ParseSuccess<TData> {
  readonly success: true;
  readonly data: TData;
}

export type ParseResult<TData> = ParseFailure | ParseSuccess<TData>;

const formatIssuePath = (path: readonly PropertyKey[]): string => {
  if (path.length === 0) {
    return "input";
  }

  return path.join(".");
};

const toIssueMessage = (issue: ZodIssue): string =>
  `${formatIssuePath(issue.path)}: ${issue.message}`;

export const createParser = <TRaw, TNormalized>(
  schema: ZodType<TRaw>,
  normalize: (value: TRaw) => TNormalized,
) => {
  return (input: unknown): ParseResult<TNormalized> => {
    const parsed = schema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        issues: parsed.error.issues.map(toIssueMessage),
      };
    }

    return {
      success: true,
      data: normalize(parsed.data),
    };
  };
};
