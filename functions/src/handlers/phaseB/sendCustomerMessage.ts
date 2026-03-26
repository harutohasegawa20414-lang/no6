import * as lineService from "../../services/line.service";
import * as firestoreService from "../../services/firestore.service";
import { MessageTemplates, Defaults } from "../../config/constants";
import { formatDateTimeForDisplay } from "../../utils/dateUtils";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "../../utils/logger";

export async function sendCustomerMessage(recordId: string): Promise<"パターンA" | "パターンB"> {
  const record = await firestoreService.getRecord(recordId);
  if (!record) {
    throw new Error(`Record ${recordId} not found`);
  }

  const {
    customerLineUserId,
    customerName,
    constructionDate,
    constructionStartTime,
    candidateDate1,
    candidateDate2,
    candidateDate3,
  } = record;

  if (!customerLineUserId || !customerName || !constructionDate) {
    throw new Error(`Record ${recordId}: missing required fields for customer message`);
  }

  const startTime = constructionStartTime || Defaults.CONSTRUCTION_START_TIME;
  const displayDate = formatDateTimeForDisplay(constructionDate);

  // 要件7-3: 工事日が候補日と一致するかどうかで分岐
  const isPatternA = [candidateDate1, candidateDate2, candidateDate3].includes(constructionDate);
  const messageType = isPatternA ? "パターンA" as const : "パターンB" as const;

  const message = isPatternA
    ? MessageTemplates.CUSTOMER_NOTIFICATION_PATTERN_A(customerName, displayDate, startTime)
    : MessageTemplates.CUSTOMER_NOTIFICATION_PATTERN_B(customerName, displayDate, startTime);

  await lineService.pushMessage(customerLineUserId, message);

  await firestoreService.updateRecord(recordId, {
    customerMessageSentAt: FieldValue.serverTimestamp(),
    customerMessageType: messageType,
  });

  logger.info("お客様メッセージ送信完了", { recordId, messageType });

  return messageType;
}
