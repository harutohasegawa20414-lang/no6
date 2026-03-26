import { State } from "../config/constants";
import { AiJudgmentPattern } from "./ai";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export interface RecordDocument {
  // 状態管理
  state: State;
  previousState: State | null;
  stateUpdatedAt: Timestamp | FieldValue;

  // フェーズA
  candidateDate1: string | null;
  candidateDate2: string | null;
  candidateDate3: string | null;
  candidateDate1Time: string | null;
  candidateDate2Time: string | null;
  candidateDate3Time: string | null;
  contractorName: string | null;
  contractorLineWorksId: string | null;
  candidateDatesSentAt: Timestamp | FieldValue | null;
  contractorRawReply: string | null;
  aiJudgment: AiJudgmentPattern | null;

  // 工事日
  constructionDate: string | null;
  constructionStartTime: string | null;
  constructionDateUpdatedInKintone: boolean;

  // フェーズB
  orderRequestSentAt: Timestamp | FieldValue | null;
  customerMessageSentAt: Timestamp | FieldValue | null;
  customerMessageType: "パターンA" | "パターンB" | null;
  calendarEventId: string | null;
  calendarEventCreatedAt: Timestamp | FieldValue | null;

  // お客様
  customerName: string | null;
  customerLineUserId: string | null;
  customerChoice: "OK" | "NG" | null;
  customerRawReply: string | null;

  // メタデータ
  staffName: string | null;
  officeStaffName: string | null;
  kintoneAppId: string | null;
  proposalCategory: string | null;

  // エラー
  errors: RecordError[];

  // タイムスタンプ
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

export interface RecordError {
  timestamp: string;
  action: string;
  message: string;
  details?: string;
}

export interface IdempotencyKeyDocument {
  createdAt: Timestamp | FieldValue;
  processedAt: Timestamp | FieldValue | null;
  result: string | null;
}

export interface StateHistoryDocument {
  recordId: string;
  fromState: State | null;
  toState: State;
  action: string;
  timestamp: Timestamp | FieldValue;
  metadata?: Record<string, unknown>;
}
