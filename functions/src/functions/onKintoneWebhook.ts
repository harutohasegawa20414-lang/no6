import { onRequest } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getStringValue, getUserDisplayName } from "../types/kintone";
import { KintoneFields, KintoneProgressStatus, States, FunctionConfig } from "../config/constants";
import { allSecrets } from "../config";
import { verifyKintoneWebhook } from "../middleware/verifyKintoneWebhook";
import { ensureIdempotent } from "../middleware/idempotency";
import * as firestoreService from "../services/firestore.service";
import { sendCandidateDates } from "../handlers/phaseA/sendCandidateDates";
import * as crypto from "crypto";
import { parseKintoneDateTime } from "../utils/dateUtils";
import { validateKintoneWebhookBody } from "../utils/validation";
import * as logger from "../utils/logger";

if (getApps().length === 0) initializeApp();

export const onKintoneWebhook = onRequest(
  {
    secrets: allSecrets,
    region: FunctionConfig.REGION,
    maxInstances: FunctionConfig.MAX_INSTANCES_DEFAULT,
  },
  async (req, res) => {
    // ミドルウェア検証
    let verified = false;
    verifyKintoneWebhook(req, res, () => {
      verified = true;
    });
    if (!verified) return;

    try {
      const body = validateKintoneWebhookBody(req.body);
      const record = body.record;
      const recordId = getStringValue(record, KintoneFields.RECORD_ID);

      if (!recordId) {
        res.status(400).send("Missing record ID");
        return;
      }

      // 要件5-1: 進捗レコードが「工事日日程調整」の場合のみ発火
      const progressStatus = getStringValue(record, KintoneFields.PROGRESS_STATUS);
      if (progressStatus !== KintoneProgressStatus.CONSTRUCTION_DATE_SCHEDULING) {
        logger.info("Kintoneウェブフック: 進捗ステータスが対象外のためスキップ", { recordId, progressStatus });
        res.status(200).send("OK - skipped (wrong status)");
        return;
      }

      // 候補日4項目のチェック
      const candidateDate1Raw = getStringValue(record, KintoneFields.CANDIDATE_DATE_1);
      const candidateDate2Raw = getStringValue(record, KintoneFields.CANDIDATE_DATE_2);
      const candidateDate3Raw = getStringValue(record, KintoneFields.CANDIDATE_DATE_3);
      const contractorName = getStringValue(record, KintoneFields.CONTRACTOR_NAME);

      if (!candidateDate1Raw || !candidateDate2Raw || !candidateDate3Raw || !contractorName) {
        logger.info("Kintoneウェブフック: 候補日が未入力のためスキップ", { recordId });
        res.status(200).send("OK - skipped (incomplete)");
        return;
      }

      // Kintone DATETIME (UTC ISO) → JST日付 + 時刻に分解
      const cd1 = parseKintoneDateTime(candidateDate1Raw);
      const cd2 = parseKintoneDateTime(candidateDate2Raw);
      const cd3 = parseKintoneDateTime(candidateDate3Raw);

      logger.info("Kintone候補日をJSTに変換", {
        recordId,
        raw: [candidateDate1Raw, candidateDate2Raw, candidateDate3Raw],
        parsed: [cd1, cd2, cd3],
      });

      // 冪等性チェック（候補日の組み合わせ＋サーバー時刻でハッシュ化）
      const rawKey = `kintone-webhook-${recordId}-${cd1.date}-${cd2.date}-${cd3.date}-${contractorName}`;
      const idempotencyKey = crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 40);
      await ensureIdempotent(idempotencyKey);

      // Firestoreにレコード作成 or 更新
      const existing = await firestoreService.getRecord(recordId as string);

      if (existing) {
        // 再調整の場合（既存レコードがある）
        await firestoreService.updateRecord(recordId, {
          candidateDate1: cd1.date,
          candidateDate2: cd2.date,
          candidateDate3: cd3.date,
          candidateDate1Time: cd1.time,
          candidateDate2Time: cd2.time,
          candidateDate3Time: cd3.time,
          contractorName,
          contractorLineWorksId: getStringValue(record, KintoneFields.CONTRACTOR_LINE_WORKS_ID) || existing.contractorLineWorksId,
          state: States.CANDIDATE_DATES_SENT,
          previousState: existing.state,
        });
      } else {
        // 新規レコード
        await firestoreService.createRecord(recordId, {
          state: States.CANDIDATE_DATES_SENT,
          candidateDate1: cd1.date,
          candidateDate2: cd2.date,
          candidateDate3: cd3.date,
          candidateDate1Time: cd1.time,
          candidateDate2Time: cd2.time,
          candidateDate3Time: cd3.time,
          contractorName,
          contractorLineWorksId: getStringValue(record, KintoneFields.CONTRACTOR_LINE_WORKS_ID) || null,
          customerName: getStringValue(record, KintoneFields.CUSTOMER_NAME) || null,
          customerLineUserId: getStringValue(record, KintoneFields.CUSTOMER_LINE_USER_ID) || null,
          staffName: getUserDisplayName(record, KintoneFields.STAFF_NAME) || null,
          officeStaffName: getUserDisplayName(record, KintoneFields.OFFICE_STAFF_NAME) || null,
          kintoneAppId: body.app.id,
          proposalCategory: getStringValue(record, KintoneFields.PROPOSAL_CATEGORY) || null,
        });
      }

      // 候補日送信処理
      await sendCandidateDates(recordId);

      logger.info("Kintoneウェブフック処理完了", { recordId });
      res.status(200).send("OK");
    } catch (err) {
      logger.error("Kintoneウェブフックエラー", err);
      res.status(500).send("Internal Server Error");
    }
  }
);
