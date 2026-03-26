import { onRequest } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import * as crypto from "crypto";
import { allSecrets, lineWorksBotSecret } from "../config";
import { ensureIdempotent } from "../middleware/idempotency";
import { createLineWorksSignatureVerifier } from "../middleware/verifyLineWorksSignature";
import * as firestoreService from "../services/firestore.service";
import { processContractorReply } from "../handlers/phaseA/processContractorReply";
import { updateConstructionDate } from "../handlers/phaseA/updateConstructionDate";
import { executePhaseB } from "./onStateChange";
import { FunctionConfig } from "../config/constants";
import { validateLineWorksCallbackBody } from "../utils/validation";
import * as logger from "../utils/logger";

if (getApps().length === 0) initializeApp();

export const onLineWorksCallback = onRequest(
  {
    secrets: allSecrets,
    region: FunctionConfig.REGION,
    maxInstances: FunctionConfig.MAX_INSTANCES_DEFAULT,
  },
  async (req, res) => {
    // LINE WORKS署名検証（必須）
    const botSecret = lineWorksBotSecret.value();
    if (!botSecret) {
      logger.error("LINEWORKS_BOT_SECRET が未設定です");
      res.status(500).send("Internal Server Error");
      return;
    }

    let verified = false;
    const verifier = createLineWorksSignatureVerifier(botSecret);
    verifier(req, res, () => { verified = true; });
    if (!verified) return;

    try {
      const body = validateLineWorksCallbackBody(req.body);

      // テキストメッセージのみ処理
      if (body.type !== "message" || body.content?.type !== "text" || !body.content.text) {
        res.status(200).send("OK - ignored");
        return;
      }

      const contractorUserId = body.source.userId;
      const replyText = body.content.text;

      // 冪等性チェック（ハッシュ化してキーの予測を困難に）
      const rawKey = `lineworks-${contractorUserId}-${body.issuedTime}-${replyText}`;
      const idempotencyKey = crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 40);
      await ensureIdempotent(idempotencyKey);

      // 業者返信待ちのレコードを検索
      const result = await firestoreService.findRecordByContractorId(contractorUserId);

      if (!result) {
        logger.warn("No pending record found for contractor", { contractorUserId });
        res.status(200).send("OK - no matching record");
        return;
      }

      const recordId = result.id;

      // AI判定処理
      const judgment = await processContractorReply(recordId, replyText);

      // 工事日更新処理（判定不能でない場合）
      if (judgment.constructionDate) {
        await updateConstructionDate(recordId);

        // Phase B: エミュレーターではFirestoreトリガーの外部ネットワークがモックされるため
        // HTTPトリガー内から直接実行する
        const record = await firestoreService.getRecord(recordId);
        if (record) {
          await executePhaseB(recordId, record);
        }
      }

      logger.info("LINE WORKS callback processed", { recordId, pattern: judgment.pattern });
      res.status(200).send("OK");
    } catch (err) {
      logger.error("LINE WORKS callback error", err);
      res.status(500).send("Internal Server Error");
    }
  }
);
