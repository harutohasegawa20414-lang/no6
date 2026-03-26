import * as firestoreService from "../../services/firestore.service";
import * as kintoneService from "../../services/kintone.service";
import * as calendarService from "../../services/calendar.service";
import { States, KintoneFields, KintoneProgressStatus } from "../../config/constants";
import { extractCustomerChoice } from "../../utils/validation";
import * as logger from "../../utils/logger";

export async function processCustomerReply(
  recordId: string,
  replyText: string
): Promise<"OK" | "NG" | null> {
  const record = await firestoreService.getRecord(recordId);
  if (!record) {
    throw new Error(`Record ${recordId} not found`);
  }

  const choice = extractCustomerChoice(replyText);

  if (!choice) {
    logger.warn("Could not determine customer choice", { recordId, replyText });
    await firestoreService.updateRecord(recordId, {
      customerRawReply: replyText,
    });
    return null;
  }

  if (choice === "OK") {
    // お客様OK → 完了
    await firestoreService.transitionState(
      recordId,
      States.CUSTOMER_CONFIRMED,
      "processCustomerReply",
      {
        customerChoice: "OK",
        customerRawReply: replyText,
      }
    );

    logger.info("Customer confirmed OK", { recordId });
  } else {
    // お客様NG → 再調整
    // Googleカレンダーのイベントを削除
    if (record.calendarEventId) {
      try {
        await calendarService.deleteEvent(record.calendarEventId);
      } catch (err) {
        logger.error("Failed to delete calendar event", err, { recordId });
      }
    }

    // Kintoneの進捗を再調整に更新
    if (record.kintoneAppId) {
      await kintoneService.updateKintoneRecord(record.kintoneAppId, recordId, {
        [KintoneFields.PROGRESS_STATUS]: KintoneProgressStatus.CONSTRUCTION_DATE_RESCHEDULING,
      });
    }

    await firestoreService.transitionState(
      recordId,
      States.CONSTRUCTION_DATE_RESCHEDULING,
      "processCustomerReply",
      {
        customerChoice: "NG",
        customerRawReply: replyText,
        // リセット
        constructionDate: null,
        constructionStartTime: null,
        constructionDateUpdatedInKintone: false,
        calendarEventId: null,
        calendarEventCreatedAt: null,
        orderRequestSentAt: null,
        customerMessageSentAt: null,
        customerMessageType: null,
        aiJudgment: null,
        contractorRawReply: null,
      }
    );

    logger.info("Customer requested rescheduling", { recordId });
  }

  return choice;
}
