import * as lineWorksService from "../../services/lineworks.service";
import * as firestoreService from "../../services/firestore.service";
import { MessageTemplates, Defaults } from "../../config/constants";
import { formatDateTimeForDisplay } from "../../utils/dateUtils";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "../../utils/logger";

export async function sendOrderRequest(recordId: string): Promise<void> {
  const record = await firestoreService.getRecord(recordId);
  if (!record) {
    throw new Error(`Record ${recordId} not found`);
  }

  const {
    contractorLineWorksId,
    contractorName,
    customerName,
    constructionDate,
    constructionStartTime,
  } = record;

  if (!contractorLineWorksId || !contractorName || !customerName || !constructionDate) {
    throw new Error(`Record ${recordId}: missing required fields for order request`);
  }

  const startTime = constructionStartTime || Defaults.CONSTRUCTION_START_TIME;
  const displayDate = formatDateTimeForDisplay(constructionDate);

  const message = MessageTemplates.ORDER_REQUEST(
    contractorName,
    customerName,
    displayDate,
    startTime
  );

  await lineWorksService.sendMessage(contractorLineWorksId, message);

  await firestoreService.updateRecord(recordId, {
    orderRequestSentAt: FieldValue.serverTimestamp(),
  });

  logger.info("発注依頼送信完了", { recordId });
}
