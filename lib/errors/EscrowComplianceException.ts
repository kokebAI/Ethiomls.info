export type EscrowComplianceIssue = {
  path: string;
  message: string;
  code: string;
};

/**
 * Thrown when unfinished / off-plan properties fail Proclamation 1357/2024
 * escrow requirements. Maps to HTTP 422.
 */
export class EscrowComplianceException extends Error {
  readonly statusCode = 422 as const;
  readonly issues: EscrowComplianceIssue[];
  readonly proclamation = "1357/2024" as const;

  constructor(message: string, issues: EscrowComplianceIssue[] = []) {
    super(message);
    this.name = "EscrowComplianceException";
    this.issues = issues;
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      proclamation: this.proclamation,
      issues: this.issues,
    };
  }
}

export function isEscrowComplianceException(
  error: unknown,
): error is EscrowComplianceException {
  return error instanceof EscrowComplianceException;
}
