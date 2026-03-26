import * as path from "path";
import { getStorage } from "firebase-admin/storage";
import { StorageConfig } from "../config/constants";
import * as logger from "../utils/logger";

// 許可するContent-Typeのホワイトリスト（SVG等は除外: XSS/XXEリスク）
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/**
 * ファイル名をサニタイズしてパストラバーサルを防止
 */
function sanitizeFileName(fileName: string): string {
  // パス成分を取り除き、ファイル名のみ取得
  const basename = path.basename(fileName);
  // 英数字・ハイフン・アンダースコア・ドットのみ許可
  return basename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Firebase StorageにファイルをアップロードしてURLを返す
 * LINE WORKSで画像送信するために一時的にホストする
 */
export async function uploadTempFile(
  fileName: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  // Content-Typeのホワイトリストチェック
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error(`Disallowed content type: ${contentType}`);
  }

  const safeName = sanitizeFileName(fileName);
  const bucket = getStorage().bucket();
  const filePath = `${StorageConfig.TEMP_PHOTO_FOLDER}/${Date.now()}_${safeName}`;
  const file = bucket.file(filePath);

  await file.save(data, {
    metadata: { contentType },
  });

  // 署名付きURLを発行（24時間有効）
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + StorageConfig.SIGNED_URL_EXPIRY_MS,
  });

  logger.info("Temp file uploaded to Storage", { filePath });
  return url;
}
