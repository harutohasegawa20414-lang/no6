import * as crypto from "crypto";
import { Request, Response } from "express";
import { kintoneWebhookToken } from "../config";
import * as logger from "../utils/logger";

/**
 * Kintone Webhookの認証検証ミドルウェア
 * カスタムヘッダー `X-Kintone-Webhook-Token` による認証を実施
 */
export function verifyKintoneWebhook(
  req: Request,
  res: Response,
  next: () => void
): void {
  if (req.method !== "POST") {
    logger.warn("Kintone webhook: 不正なメソッド", { method: req.method });
    res.status(405).send("Method Not Allowed");
    return;
  }

  if (!req.body || !req.body.type || !req.body.record) {
    logger.warn("Kintone webhook: 不正なリクエストボディ");
    res.status(400).send("Bad Request");
    return;
  }

  // Kintone Webhook認証トークンの検証
  // Kintone側のWebhook設定で「認証トークン」を設定し、ヘッダーで送信される
  const expectedToken = kintoneWebhookToken.value();
  if (!expectedToken) {
    logger.error("Kintone webhook: KINTONE_WEBHOOK_TOKEN が未設定です");
    res.status(500).send("Internal Server Error");
    return;
  }

  const token = req.headers["x-cybozu-webhook-token"] as string | undefined;
  if (!token) {
    logger.warn("Kintone webhook: 認証トークンヘッダーなし");
    res.status(401).send("Unauthorized");
    return;
  }

  // タイミング攻撃対策: crypto.timingSafeEqual を使用
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedToken);
  if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    logger.warn("Kintone webhook: 認証トークン不一致");
    res.status(401).send("Unauthorized");
    return;
  }

  next();
}
