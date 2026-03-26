import { onRequest } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { allSecrets } from "../config";
import { ensureIdempotent } from "../middleware/idempotency";
import { createLineSignatureVerifier } from "../middleware/verifyLineSignature";
import { getConfig } from "../config";
import * as firestoreService from "../services/firestore.service";
import * as lineService from "../services/line.service";
import { processCustomerReply } from "../handlers/phaseB/processCustomerReply";
import { FunctionConfig } from "../config/constants";
import { validateLineWebhookBody } from "../utils/validation";
import * as logger from "../utils/logger";

if (getApps().length === 0) initializeApp();

export const onLineWebhook = onRequest(
  {
    secrets: allSecrets,
    region: FunctionConfig.REGION,
    maxInstances: FunctionConfig.MAX_INSTANCES_DEFAULT,
  },
  async (req, res) => {
    // LINE署名検証
    const config = getConfig();
    const verifier = createLineSignatureVerifier(config.line.channelSecret);
    let verified = false;
    verifier(req, res, () => { verified = true; });
    if (!verified) return;

    try {
      const body = validateLineWebhookBody(req.body);

      if (!body.events || body.events.length === 0) {
        // LINE Webhookの検証リクエスト
        res.status(200).send("OK");
        return;
      }

      for (const event of body.events) {
        if (event.type !== "message" || event.message?.type !== "text" || !event.message.text) {
          continue;
        }

        const userId = event.source.userId;
        const replyText = event.message.text;
        const replyToken = event.replyToken;

        // 冪等性チェック
        const idempotencyKey = `line-${event.message.id}`;
        try {
          await ensureIdempotent(idempotencyKey);
        } catch {
          continue; // 重複メッセージはスキップ
        }

        // お客様確認待ちのレコードを検索
        const result = await firestoreService.findRecordByCustomerLineUserId(userId);

        if (!result) {
          logger.info("No pending record for LINE user", { userId });
          continue;
        }

        const recordId = result.id;

        // お客様返信処理
        const choice = await processCustomerReply(recordId, replyText);

        // 返信メッセージ
        if (choice === "OK") {
          await lineService.replyMessage(replyToken, "ありがとうございます。工事日程が確定しました。当日よろしくお願いいたします。");
        } else if (choice === "NG") {
          await lineService.replyMessage(replyToken, "承知いたしました。工事日程を再調整いたします。改めてご連絡いたします。");
        } else {
          await lineService.replyMessage(replyToken, "申し訳ございません。「1」（はい）または「2」（いいえ）でご返信ください。");
        }
      }

      res.status(200).send("OK");
    } catch (err) {
      logger.error("LINE webhook error", err);
      res.status(500).send("Internal Server Error");
    }
  }
);
