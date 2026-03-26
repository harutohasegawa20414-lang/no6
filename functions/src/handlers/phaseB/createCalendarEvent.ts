import * as calendarService from "../../services/calendar.service";
import * as firestoreService from "../../services/firestore.service";
import { toISOStringJST, getEndDateTime } from "../../utils/dateUtils";
import { Defaults } from "../../config/constants";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "../../utils/logger";

export async function createCalendarEvent(recordId: string): Promise<string> {
  const record = await firestoreService.getRecord(recordId);
  if (!record) {
    throw new Error(`Record ${recordId} not found`);
  }

  const {
    customerName,
    contractorName,
    constructionDate,
    constructionStartTime,
    staffName,
  } = record;

  if (!customerName || !constructionDate) {
    throw new Error(`Record ${recordId}: missing required fields for calendar event`);
  }

  const startTime = constructionStartTime || Defaults.CONSTRUCTION_START_TIME;
  const startDateTime = toISOStringJST(constructionDate, startTime);
  const endDateTime = getEndDateTime(startDateTime, Defaults.CALENDAR_EVENT_DURATION_HOURS);

  const { officeStaffName } = record;

  const result = await calendarService.createEvent({
    summary: `${customerName}_${staffName || "未定"}_${officeStaffName || "未定"}`,
    description: [
      `お客様名: ${customerName}`,
      `業者名: ${contractorName || "未定"}`,
      `担当者: ${staffName || "未定"}`,
      `事務担当者: ${officeStaffName || "未定"}`,
      `Kintone レコードID: ${recordId}`,
    ].join("\n"),
    startDateTime,
    endDateTime,
  });

  await firestoreService.updateRecord(recordId, {
    calendarEventId: result.eventId,
    calendarEventCreatedAt: FieldValue.serverTimestamp(),
  });

  logger.info("Calendar event created", { recordId, eventId: result.eventId });

  return result.eventId;
}
