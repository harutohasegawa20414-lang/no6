import * as lineWorksService from "../../services/lineworks.service";
import * as firestoreService from "../../services/firestore.service";
import * as kintoneService from "../../services/kintone.service";
import * as storageService from "../../services/storage.service";
import { States, KintonePhotoFields, StorageConfig } from "../../config/constants";
import { MessageTemplates } from "../../config/constants";
import { formatDateTimeForDisplay } from "../../utils/dateUtils";
import * as logger from "../../utils/logger";
import { FieldValue } from "firebase-admin/firestore";

export async function sendCandidateDates(recordId: string): Promise<void> {
  const record = await firestoreService.getRecord(recordId);
  if (!record) {
    throw new Error(`Record ${recordId} not found`);
  }

  const {
    contractorLineWorksId,
    customerName,
    candidateDate1,
    candidateDate2,
    candidateDate3,
    candidateDate1Time,
    candidateDate2Time,
    candidateDate3Time,
  } = record;

  if (!contractorLineWorksId || !customerName || !candidateDate1 || !candidateDate2 || !candidateDate3) {
    throw new Error(`Record ${recordId}: missing required fields for sending candidate dates`);
  }

  // 表示用にフォーマット（例: "4月14日 9:00"）
  const display1 = formatDateTimeForDisplay(candidateDate1, candidateDate1Time);
  const display2 = formatDateTimeForDisplay(candidateDate2, candidateDate2Time);
  const display3 = formatDateTimeForDisplay(candidateDate3, candidateDate3Time);

  // 業者にLINE WORKSで候補日を送信
  const message = MessageTemplates.CANDIDATE_DATES_TO_CONTRACTOR(
    customerName,
    display1,
    display2,
    display3
  );

  await lineWorksService.sendMessage(contractorLineWorksId, message);

  // Kintoneから写真を取得して業者に送信
  if (record.kintoneAppId) {
    try {
      const kintoneRecord = await kintoneService.getKintoneRecord(record.kintoneAppId, recordId);
      const imageFiles = kintoneService.extractImageFileKeys(kintoneRecord, [...KintonePhotoFields]);
      const limitedFiles = imageFiles.slice(0, StorageConfig.MAX_PHOTO_COUNT);

      if (imageFiles.length > StorageConfig.MAX_PHOTO_COUNT) {
        logger.warn("写真数が上限を超えたため一部スキップ", {
          recordId,
          total: imageFiles.length,
          limit: StorageConfig.MAX_PHOTO_COUNT,
        });
      }

      for (const file of limitedFiles) {
        const { data, contentType } = await kintoneService.downloadFile(file.fileKey);
        if (data.length > StorageConfig.MAX_PHOTO_SIZE_BYTES) {
          logger.warn("ファイルサイズ超過のためスキップ", { recordId, fileName: file.name, size: data.length });
          continue;
        }
        const imageUrl = await storageService.uploadTempFile(file.name, data, contentType);
        await lineWorksService.sendImage(contractorLineWorksId, imageUrl);
      }

      if (imageFiles.length > 0) {
        logger.info("業者へ写真を送信完了", { recordId, count: imageFiles.length });
      }
    } catch (err) {
      // 写真送信失敗は致命的エラーとしない（候補日メッセージは送信済み）
      logger.error("業者への写真送信に失敗", err);
    }
  }

  // 状態遷移: 候補日確認送信済み → 業者返信待ち
  await firestoreService.transitionState(
    recordId,
    States.WAITING_CONTRACTOR_REPLY,
    "sendCandidateDates",
    {
      candidateDatesSentAt: FieldValue.serverTimestamp(),
    }
  );

  logger.info("業者へ候補日を送信完了", {
    recordId,
    contractorLineWorksId,
  });
}
