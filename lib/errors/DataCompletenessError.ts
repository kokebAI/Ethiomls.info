export type CompletenessIssue = {
  path: string;
  message: string;
  code?: string;
};

/**
 * Thrown when a property payload fails strict completeness / structure checks.
 * Always maps to HTTP 400.
 */
export class DataCompletenessError extends Error {
  readonly statusCode = 400 as const;
  readonly issues: CompletenessIssue[];

  constructor(message: string, issues: CompletenessIssue[] = []) {
    super(message);
    this.name = "DataCompletenessError";
    this.issues = issues;
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      issues: this.issues,
    };
  }
}

export function isDataCompletenessError(
  error: unknown,
): error is DataCompletenessError {
  return error instanceof DataCompletenessError;
}
