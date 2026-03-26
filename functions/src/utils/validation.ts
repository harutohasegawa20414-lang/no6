import { KintoneRecord, KintoneWebhookBody, getStringValue } from "../types/kintone";
import { LineWebhookBody } from "../types/line";
import { LineWorksCallbackBody } from "../types/lineworks";
import { KintoneFields, AiConfig } from "../config/constants";
import { ValidationError } from "./errors";

// ===== Webhookペイロード検証 =====

const MAX_TEXT_LENGTH = AiConfig.MAX_REPLY_LENGTH;

// セキュリティ: 入力フォーマットの厳密検証パターン
const RECORD_ID_PATTERN = /^\d{1,20}$/;  // Kintone recordIdは数値のみ
const USER_ID_PATTERN = /^[a-zA-Z0-9_\-@.]+$/;  // LINE/LINE WORKS userId
const APP_ID_PATTERN = /^\d{1,10}$/;  // Kintone appIdは数値のみ

export function validateKintoneWebhookBody(body: unknown): KintoneWebhookBody {
  if (!body || typeof body !== "object") {
    throw new ValidationError("リクエストボディが不正です");
  }

  const b = body as Record<string, unknown>;
  if (typeof b.type !== "string" || !b.record || typeof b.record !== "object") {
    throw new ValidationError("Kintone Webhookボディの形式が不正です");
  }

  if (!b.app || typeof b.app !== "object") {
    throw new ValidationError("Kintone Webhookのappフィールドが不正です");
  }

  const app = b.app as Record<string, unknown>;
  if (typeof app.id !== "string" || !app.id || !APP_ID_PATTERN.test(app.id)) {
    throw new ValidationError("Kintone WebhookのappIDが不正です");
  }

  return body as KintoneWebhookBody;
}

export function validateLineWebhookBody(body: unknown): LineWebhookBody {
  if (!body || typeof body !== "object") {
    throw new ValidationError("リクエストボディが不正です");
  }

  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.events)) {
    throw new ValidationError("LINE Webhookのeventsが不正です");
  }

  // 各イベントの基本検証
  for (const event of b.events) {
    if (typeof event !== "object" || !event) continue;
    const e = event as Record<string, unknown>;
    if (e.type === "message" && e.message) {
      const msg = e.message as Record<string, unknown>;
      if (msg.type === "text" && typeof msg.text === "string" && msg.text.length > MAX_TEXT_LENGTH) {
        throw new ValidationError(`メッセージが長すぎます（最大${MAX_TEXT_LENGTH}文字）`);
      }
    }
    if (e.source && typeof e.source === "object") {
      const src = e.source as Record<string, unknown>;
      if (src.userId && typeof src.userId === "string") {
        if (src.userId.length > 100 || !USER_ID_PATTERN.test(src.userId)) {
          throw new ValidationError("LINE userIdが不正です");
        }
      }
    }
  }

  return body as LineWebhookBody;
}

export function validateLineWorksCallbackBody(body: unknown): LineWorksCallbackBody {
  if (!body || typeof body !== "object") {
    throw new ValidationError("リクエストボディが不正です");
  }

  const b = body as Record<string, unknown>;
  if (typeof b.type !== "string") {
    throw new ValidationError("LINE WORKSコールバックのtypeが不正です");
  }

  if (!b.source || typeof b.source !== "object") {
    throw new ValidationError("LINE WORKSコールバックのsourceが不正です");
  }

  const source = b.source as Record<string, unknown>;
  if (typeof source.userId !== "string" || !source.userId || source.userId.length > 100 || !USER_ID_PATTERN.test(source.userId)) {
    throw new ValidationError("LINE WORKSのuserIdが不正です");
  }

  // テキストメッセージの長さ制限
  if (b.content && typeof b.content === "object") {
    const content = b.content as Record<string, unknown>;
    if (content.type === "text" && typeof content.text === "string" && content.text.length > MAX_TEXT_LENGTH) {
      throw new ValidationError(`メッセージが長すぎます（最大${MAX_TEXT_LENGTH}文字）`);
    }
  }

  if (typeof b.issuedTime !== "string" || !b.issuedTime) {
    throw new ValidationError("LINE WORKSのissuedTimeが不正です");
  }

  return body as LineWorksCallbackBody;
}

export function validateManualRetryBody(body: unknown): { recordId: string; action: string } {
  if (!body || typeof body !== "object") {
    throw new ValidationError("リクエストボディが不正です");
  }

  const b = body as Record<string, unknown>;
  if (typeof b.recordId !== "string" || !b.recordId || !RECORD_ID_PATTERN.test(b.recordId)) {
    throw new ValidationError("recordIdが不正です");
  }

  const ALLOWED_ACTIONS = [
    "sendCandidateDates",
    "updateConstructionDate",
    "sendOrderRequest",
    "sendCustomerMessage",
    "createCalendarEvent",
  ];
  if (typeof b.action !== "string" || !ALLOWED_ACTIONS.includes(b.action)) {
    throw new ValidationError("actionが不正です");
  }

  return { recordId: b.recordId, action: b.action };
}

export function validateCandidateDates(record: KintoneRecord): {
  candidateDate1: string;
  candidateDate2: string;
  candidateDate3: string;
  contractorName: string;
} {
  const candidateDate1 = getStringValue(record, KintoneFields.CANDIDATE_DATE_1);
  const candidateDate2 = getStringValue(record, KintoneFields.CANDIDATE_DATE_2);
  const candidateDate3 = getStringValue(record, KintoneFields.CANDIDATE_DATE_3);
  const contractorName = getStringValue(record, KintoneFields.CONTRACTOR_NAME);

  if (!candidateDate1 || !candidateDate2 || !candidateDate3) {
    throw new ValidationError("候補日1〜3がすべて入力されている必要があります");
  }

  if (!contractorName) {
    throw new ValidationError("業者名が入力されている必要があります");
  }

  return {
    candidateDate1,
    candidateDate2,
    candidateDate3,
    contractorName,
  };
}

export function validateRecordId(recordId: unknown): string {
  if (!recordId || typeof recordId !== "string") {
    throw new ValidationError("レコードIDが不正です");
  }
  return recordId;
}

export function extractCustomerChoice(text: string): "OK" | "NG" | null {
  const trimmed = text.trim();

  // 番号による選択
  if (trimmed === "1" || trimmed.startsWith("1.") || trimmed.startsWith("1 ")) return "OK";
  if (trimmed === "2" || trimmed.startsWith("2.") || trimmed.startsWith("2 ")) return "NG";

  // テキストによる選択
  const okPatterns = ["はい", "ok", "お願い", "大丈夫", "了解"];
  const ngPatterns = ["いいえ", "no", "再調整", "ダメ", "変更"];

  const lower = trimmed.toLowerCase();
  if (okPatterns.some((p) => lower.includes(p))) return "OK";
  if (ngPatterns.some((p) => lower.includes(p))) return "NG";

  return null;
}
