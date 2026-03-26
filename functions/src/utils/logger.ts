import * as functions from "firebase-functions";

const logger = functions.logger;

// 機密情報をマスキングするキーのパターン
const SENSITIVE_KEYS = /token|secret|password|apikey|api_key|private_key|accesstoken|authorization/i;

/**
 * ログデータから機密情報をマスキングする
 */
function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.test(key) && typeof value === "string") {
      result[key] = "****";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitize(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function info(message: string, data?: Record<string, unknown>): void {
  if (data) {
    logger.info(message, sanitize(data));
  } else {
    logger.info(message);
  }
}

export function error(
  message: string,
  err?: unknown,
  data?: Record<string, unknown>
): void {
  const errorData = {
    ...sanitize(data || {}),
    error: err instanceof Error ? { message: err.message } : String(err),
  };
  logger.error(message, errorData);
}

export function warn(message: string, data?: Record<string, unknown>): void {
  if (data) {
    logger.warn(message, sanitize(data));
  } else {
    logger.warn(message);
  }
}

export function debug(message: string, data?: Record<string, unknown>): void {
  if (data) {
    logger.debug(message, sanitize(data));
  } else {
    logger.debug(message);
  }
}
