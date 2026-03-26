import { Timeouts } from "../config/constants";
import * as logger from "./logger";

// リトライすべきでないHTTPステータスコード（クライアントエラー）
// 429（レート制限）と408（タイムアウト）はリトライ対象
const NON_RETRYABLE_STATUS_MIN = 400;
const NON_RETRYABLE_STATUS_MAX = 499;
const RETRYABLE_CLIENT_ERRORS = [408, 429];

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    label?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = Timeouts.API_RETRY_MAX,
    delayMs = Timeouts.API_RETRY_DELAY_MS,
    label = "operation",
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const status: number | undefined = err?.response?.status;

      logger.warn(`${label} 失敗 (試行 ${attempt}/${maxRetries})`, {
        error: lastError.message,
        responseStatus: status,
      });

      // 4xxエラーはリトライしない（408/429を除く）
      if (
        status &&
        status >= NON_RETRYABLE_STATUS_MIN &&
        status <= NON_RETRYABLE_STATUS_MAX &&
        !RETRYABLE_CLIENT_ERRORS.includes(status)
      ) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        // ジッター付きバックオフ
        const jitter = Math.random() * delayMs * 0.5;
        await sleep(delayMs * attempt + jitter);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
