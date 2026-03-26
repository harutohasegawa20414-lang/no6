import axios from "axios";
import { getConfig } from "../config";
import { KintoneUpdatePayload, KintoneGetResponse, KintoneRecord, KintoneFileEntry } from "../types/kintone";
import { Timeouts } from "../config/constants";
import { withRetry } from "../utils/retry";
import * as logger from "../utils/logger";

function getClient() {
  const config = getConfig();
  return axios.create({
    baseURL: config.kintone.baseUrl,
    timeout: Timeouts.HTTP_REQUEST_TIMEOUT_MS,
    headers: {
      "X-Cybozu-API-Token": config.kintone.apiToken,
      "Content-Type": "application/json",
    },
  });
}

export async function getKintoneRecord(
  appId: string,
  recordId: string
): Promise<KintoneRecord> {
  const client = getClient();

  const response = await withRetry(
    () =>
      client.get<KintoneGetResponse>("/k/v1/record.json", {
        params: { app: appId, id: recordId },
      }),
    { label: "Kintone getRecord" }
  );

  return response.data.record;
}

export async function updateKintoneRecord(
  appId: string,
  recordId: string,
  fields: Record<string, string>
): Promise<void> {
  const client = getClient();

  const record: Record<string, { value: string }> = {};
  for (const [key, value] of Object.entries(fields)) {
    record[key] = { value };
  }

  const payload: KintoneUpdatePayload = {
    app: appId,
    id: recordId,
    record,
  };

  await withRetry(
    () => client.put("/k/v1/record.json", payload),
    { label: "Kintone updateRecord" }
  );

  logger.info("Kintone record updated", { appId, recordId, fields: Object.keys(fields) });
}

/**
 * Kintoneのファイルフィールドから画像ファイルのfileKeyを抽出する
 */
export function extractImageFileKeys(
  record: KintoneRecord,
  fieldCodes: string[]
): KintoneFileEntry[] {
  const files: KintoneFileEntry[] = [];
  for (const code of fieldCodes) {
    const field = record[code];
    if (!field || !Array.isArray(field.value)) continue;
    for (const entry of field.value as KintoneFileEntry[]) {
      if (entry.contentType?.startsWith("image/")) {
        files.push(entry);
      }
    }
  }
  return files;
}

// セキュリティ: fileKeyフォーマット検証
const SAFE_FILEKEY_PATTERN = /^[a-zA-Z0-9_\-]+$/;

/**
 * KintoneからファイルをダウンロードしてBufferで返す
 */
export async function downloadFile(fileKey: string): Promise<{ data: Buffer; contentType: string }> {
  if (!fileKey || !SAFE_FILEKEY_PATTERN.test(fileKey) || fileKey.length > 200) {
    throw new Error(`Invalid fileKey format: ${fileKey.slice(0, 20)}`);
  }
  const config = getConfig();

  const response = await withRetry(
    () =>
      axios.get(`${config.kintone.baseUrl}/k/v1/file.json`, {
        params: { fileKey },
        headers: {
          "X-Cybozu-API-Token": config.kintone.apiToken,
        },
        responseType: "arraybuffer",
        timeout: Timeouts.FILE_DOWNLOAD_TIMEOUT_MS,
      }),
    { label: "Kintone downloadFile" }
  );

  logger.info("Kintone file downloaded", { fileKey });
  return {
    data: Buffer.from(response.data),
    contentType: response.headers["content-type"] || "application/octet-stream",
  };
}
