import * as crypto from "crypto";
import { Request, Response } from "express";
import * as logger from "../utils/logger";

/**
 * LINE WORKS Bot Callback の署名検証ミドルウェア
 * Bot Secretを使用してHMAC-SHA256署名を検証
 */
export function createLineWorksSignatureVerifier(botSecret: string) {
  return function verifyLineWorksSignature(
    req: Request,
    res: Response,
    next: () => void
  ): void {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    if (!req.body || !req.body.type) {
      logger.warn("LINE WORKS callback: 不正なリクエストボディ");
      res.status(400).send("Bad Request");
      return;
    }

    // 署名検証（必須）
    const signature = req.headers["x-works-signature"] as string | undefined;
    if (!signature) {
      logger.warn("LINE WORKS callback: 署名ヘッダーが見つかりません");
      res.status(401).send("Unauthorized");
      return;
    }

    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      logger.error("LINE WORKS callback: rawBody が取得できません");
      res.status(500).send("Internal Server Error");
      return;
    }

    const expectedSignature = crypto
      .createHmac("SHA256", botSecret)
      .update(rawBody)
      .digest("base64");

    const sigBuffer = Buffer.from(signature, "base64");
    const expectedBuffer = Buffer.from(expectedSignature, "base64");

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      logger.warn("LINE WORKS callback: 署名が不一致");
      res.status(401).send("Unauthorized");
      return;
    }

    next();
  };
}
