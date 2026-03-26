import * as crypto from "crypto";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { allSecrets, adminApiToken } from "../config";
import * as firestoreService from "../services/firestore.service";
import { sendCandidateDates } from "../handlers/phaseA/sendCandidateDates";
import { updateConstructionDate } from "../handlers/phaseA/updateConstructionDate";
import { sendOrderRequest } from "../handlers/phaseB/sendOrderRequest";
import { sendCustomerMessage } from "../handlers/phaseB/sendCustomerMessage";
import { createCalendarEvent } from "../handlers/phaseB/createCalendarEvent";
import { FunctionConfig } from "../config/constants";
import { validateManualRetryBody } from "../utils/validation";
import * as logger from "../utils/logger";

if (getApps().length === 0) initializeApp();

const actionHandlers: Record<string, (recordId: string) => Promise<void>> = {
  sendCandidateDates: async (recordId) => {
    await sendCandidateDates(recordId);
  },
  updateConstructionDate: async (recordId) => {
    await updateConstructionDate(recordId);
  },
  sendOrderRequest: async (recordId) => {
    await sendOrderRequest(recordId);
  },
  sendCustomerMessage: async (recordId) => {
    await sendCustomerMessage(recordId);
  },
  createCalendarEvent: async (recordId) => {
    await createCalendarEvent(recordId);
  },
};

export const onManualRetry = onRequest(
  {
    secrets: allSecrets,
    region: FunctionConfig.REGION,
    maxInstances: FunctionConfig.MAX_INSTANCES_ADMIN,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // 管理者認証: X-Admin-Tokenヘッダーで認証（必須）
    const adminToken = adminApiToken.value();
    if (!adminToken) {
      logger.error("ADMIN_API_TOKEN が未設定です");
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }

    const providedToken = req.headers["x-admin-token"] as string | undefined;
    if (!providedToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // タイミング攻撃対策: crypto.timingSafeEqual を使用
    const providedBuf = Buffer.from(providedToken);
    const expectedBuf = Buffer.from(adminToken);
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let recordId: string;
    let action: string;
    try {
      ({ recordId, action } = validateManualRetryBody(req.body));
    } catch {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const handler = actionHandlers[action];
    if (!handler) {
      res.status(400).json({ error: "Invalid action" });
      return;
    }

    try {
      const record = await firestoreService.getRecord(recordId);
      if (!record) {
        res.status(404).json({ error: "Record not found" });
        return;
      }

      logger.info("Manual retry started", { recordId, action });
      await handler(recordId);

      res.status(200).json({
        success: true,
        message: "Action completed successfully",
      });
    } catch (err) {
      logger.error("Manual retry failed", err, { recordId, action });

      await firestoreService.addError(
        recordId,
        `manualRetry:${action}`,
        err instanceof Error ? err.message : String(err)
      );

      res.status(500).json({
        error: "Internal Server Error",
      });
    }
  }
);
