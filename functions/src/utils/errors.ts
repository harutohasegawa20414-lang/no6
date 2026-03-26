export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ExternalApiError extends AppError {
  constructor(
    service: string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(`${service} API error: ${message}`, `${service}_API_ERROR`, statusCode, details);
    this.name = "ExternalApiError";
  }
}

export class StateTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(
      `Invalid state transition: ${from} → ${to}`,
      "INVALID_STATE_TRANSITION",
      400
    );
    this.name = "StateTransitionError";
  }
}

export class IdempotencyError extends AppError {
  constructor(key: string) {
    super(
      `Duplicate request detected: ${key}`,
      "DUPLICATE_REQUEST",
      409
    );
    this.name = "IdempotencyError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}
