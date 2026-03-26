export interface KintoneWebhookBody {
  type: string;
  app: {
    id: string;
    name: string;
  };
  record: KintoneRecord;
  recordTitle?: string;
}

export interface KintoneRecord {
  [fieldCode: string]: KintoneFieldValue;
}

export interface KintoneFieldValue {
  type: string;
  value: string | KintoneFileEntry[] | KintoneUserEntry[] | null;
}

export interface KintoneUserEntry {
  code: string;
  name: string;
}

export interface KintoneFileEntry {
  contentType: string;
  fileKey: string;
  name: string;
  size: string;
}

export interface KintoneUpdatePayload {
  app: string;
  id: string;
  record: {
    [fieldCode: string]: {
      value: string;
    };
  };
}

export interface KintoneGetResponse {
  record: KintoneRecord;
}

/**
 * Kintoneフィールドからstringのvalueだけを安全に取り出す
 */
export function getStringValue(record: KintoneRecord, fieldCode: string): string | undefined {
  const val = record[fieldCode]?.value;
  return typeof val === "string" ? val : undefined;
}

/**
 * Kintoneのユーザー選択フィールドから表示名を取り出す
 * USER_SELECT / CREATOR / MODIFIER 等に対応
 */
export function getUserDisplayName(record: KintoneRecord, fieldCode: string): string | undefined {
  const val = record[fieldCode]?.value;
  if (typeof val === "string") return val;
  if (Array.isArray(val) && val.length > 0) {
    const first = val[0] as KintoneUserEntry;
    if (first.name) return first.name;
  }
  return undefined;
}
