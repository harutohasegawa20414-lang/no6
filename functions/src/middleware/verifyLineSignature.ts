import * as crypto from "crypto";
import { Request, Response } from "express";
import * as logger from "../utils/logger";

/**
 * LINE Messaging API の署名検証ミドルウェア
 * Channel Secretを使用してHMAC-SHA256署名を検証（timing-safe）
 */
export function createLineSignatureVerifier(channelSecret: string) {
  return function verifyLineSignature(
    req: Request,
    res: Response,
    next: () => void
  ): void {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const signature = req.headers["x-line-signature"] as string | undefined;
    if (!signature) {
      logger.warn("LINE webhook: 署名ヘッダーが見つかりません");
      res.status(401).send("Unauthorized");
      return;
    }

    // rawBodyを使用（Firebase Functions v2が提供）- フォールバックなし
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      logger.error("LINE webhook: rawBody が取得できません");
      res.status(500).send("Internal Server Error");
      return;
    }

    const expectedSignature = crypto
      .createHmac("SHA256", channelSecret)
      .update(rawBody)
      .digest("base64");

    // timing-safe比較
    const sigBuffer = Buffer.from(signature, "base64");
    const expectedBuffer = Buffer.from(expectedSignature, "base64");

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      logger.warn("LINE webhook: 署名が不一致");
      res.status(401).send("Unauthorized");
      return;
    }

    next();
  };
}
