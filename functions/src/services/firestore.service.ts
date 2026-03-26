import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { Collections, States, State } from "../config/constants";
import { RecordDocument, RecordError, StateHistoryDocument } from "../types/firestore";
import { canTransition } from "../state/machine";
import { StateTransitionError } from "../utils/errors";
import * as logger from "../utils/logger";

const db = () => getFirestore();

// Firestoreに書き込み可能なフィールドのホワイトリスト
const ALLOWED_RECORD_FIELDS = new Set<string>([
  "state", "previousState", "stateUpdatedAt",
  "candidateDate1", "candidateDate2", "candidateDate3",
  "candidateDate1Time", "candidateDate2Time", "candidateDate3Time",
  "contractorName", "contractorLineWorksId",
  "candidateDatesSentAt", "contractorRawReply", "aiJudgment",
  "constructionDate", "constructionStartTime", "constructionDateUpdatedInKintone",
  "orderRequestSentAt", "customerMessageSentAt", "customerMessageType",
  "calendarEventId", "calendarEventCreatedAt",
  "customerName", "customerLineUserId", "customerChoice", "customerRawReply",
  "staffName", "officeStaffName", "kintoneAppId", "proposalCategory",
  "errors", "createdAt", "updatedAt",
]);

/**
 * 許可されたフィールドのみを通すフィルター
 */
function filterAllowedFields(data: Partial<RecordDocument>): Partial<RecordDocument> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (ALLOWED_RECORD_FIELDS.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered as Partial<RecordDocument>;
}

// ===== Records =====

export async function getRecord(recordId: string): Promise<RecordDocument | null> {
  const doc = await db().collection(Collections.RECORDS).doc(recordId).get();
  return doc.exists ? (doc.data() as RecordDocument) : null;
}

export async function createRecord(
  recordId: string,
  data: Partial<RecordDocument>
): Promise<void> {
  const now = FieldValue.serverTimestamp();
  const record: RecordDocument = {
    state: States.CONSTRUCTION_DATE_SCHEDULING,
    previousState: null,
    stateUpdatedAt: now,
    candidateDate1: null,
    candidateDate2: null,
    candidateDate3: null,
    candidateDate1Time: null,
    candidateDate2Time: null,
    candidateDate3Time: null,
    contractorName: null,
    contractorLineWorksId: null,
    candidateDatesSentAt: null,
    contractorRawReply: null,
    aiJudgment: null,
    constructionDate: null,
    constructionStartTime: null,
    constructionDateUpdatedInKintone: false,
    orderRequestSentAt: null,
    customerMessageSentAt: null,
    customerMessageType: null,
    calendarEventId: null,
    calendarEventCreatedAt: null,
    customerName: null,
    customerLineUserId: null,
    customerChoice: null,
    customerRawReply: null,
    staffName: null,
    officeStaffName: null,
    kintoneAppId: null,
    proposalCategory: null,
    errors: [],
    createdAt: now,
    updatedAt: now,
    ...filterAllowedFields(data),
  };

  await db().collection(Collections.RECORDS).doc(recordId).set(record);
  logger.info("レコード作成完了", { recordId });
}

export async function updateRecord(
  recordId: string,
  data: Partial<RecordDocument>
): Promise<void> {
  await db()
    .collection(Collections.RECORDS)
    .doc(recordId)
    .update({
      ...filterAllowedFields(data),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function transitionState(
  recordId: string,
  toState: State,
  action: string,
  additionalData?: Partial<RecordDocument>
): Promise<void> {
  const recordRef = db().collection(Collections.RECORDS).doc(recordId);

  await db().runTransaction(async (tx) => {
    const doc = await tx.get(recordRef);
    if (!doc.exists) {
      throw new Error(`Record ${recordId} not found`);
    }

    const currentState = doc.data()!.state as State;

    if (!canTransition(currentState, toState)) {
      throw new StateTransitionError(currentState, toState);
    }

    tx.update(recordRef, {
      state: toState,
      previousState: currentState,
      stateUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(additionalData ? filterAllowedFields(additionalData) : {}),
    });

    // 状態遷移履歴の記録
    const historyRef = db().collection(Collections.STATE_HISTORY).doc();
    const history: StateHistoryDocument = {
      recordId,
      fromState: currentState,
      toState,
      action,
      timestamp: FieldValue.serverTimestamp(),
    };
    tx.set(historyRef, history);
  });

  logger.info("ステート遷移完了", { recordId, toState, action });
}

export async function addError(
  recordId: string,
  action: string,
  message: string,
  details?: string
): Promise<void> {
  const errorEntry: RecordError = {
    timestamp: new Date().toISOString(),
    action,
    message,
    details,
  };

  await db()
    .collection(Collections.RECORDS)
    .doc(recordId)
    .update({
      errors: FieldValue.arrayUnion(errorEntry),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function findRecordByContractorId(
  contractorLineWorksId: string
): Promise<{ id: string; data: RecordDocument } | null> {
  const snapshot = await db()
    .collection(Collections.RECORDS)
    .where("contractorLineWorksId", "==", contractorLineWorksId)
    .where("state", "==", States.WAITING_CONTRACTOR_REPLY)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, data: doc.data() as RecordDocument };
}

export async function findRecordByCustomerLineUserId(
  customerLineUserId: string
): Promise<{ id: string; data: RecordDocument } | null> {
  const snapshot = await db()
    .collection(Collections.RECORDS)
    .where("customerLineUserId", "==", customerLineUserId)
    .where("state", "==", States.CUSTOMER_CONFIRMATION_SENT)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, data: doc.data() as RecordDocument };
}
