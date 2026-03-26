import * as kintoneService from "../../services/kintone.service";
import * as firestoreService from "../../services/firestore.service";
import { States, KintoneFields, KintoneProgressStatus, AiJudgmentPatterns, Defaults } from "../../config/constants";
import * as logger from "../../utils/logger";

export async function updateConstructionDate(recordId: string): Promise<void> {
  const record = await firestoreService.getRecord(recordId);
  if (!record) {
    throw new Error(`Record ${recordId} not found`);
  }

  const { constructionDate, constructionStartTime, kintoneAppId, aiJudgment, proposalCategory } = record;

  if (!constructionDate || !kintoneAppId) {
    throw new Error(`Record ${recordId}: missing construction date or app ID`);
  }

  if (aiJudgment === AiJudgmentPatterns.UNCLEAR) {
    // 判定不能の場合はエラー状態にして手動対応を促す
    await firestoreService.addError(
      recordId,
      "updateConstructionDate",
      "AI判定が「判定不能」のため工事日を更新できません。手動で確認してください。"
    );
    logger.warn("AI判定が不明のため、Kintone更新をスキップ", { recordId });
    return;
  }

  // 提案カテゴリに応じて工事日の更新先フィールドを切り替え
  const isUFB = proposalCategory?.includes("UFB");
  const constructionDateField = isUFB
    ? KintoneFields.CONSTRUCTION_DATE_UFB
    : KintoneFields.CONSTRUCTION_DATE_COATING;

  logger.info("工事日フィールドを更新中", {
    recordId,
    proposalCategory,
    field: constructionDateField,
  });

  // Step 1: 工事日をKintoneに更新
  await kintoneService.updateKintoneRecord(kintoneAppId, recordId, {
    [constructionDateField]: constructionDate,
    [KintoneFields.CONSTRUCTION_START_TIME]: constructionStartTime || Defaults.CONSTRUCTION_START_TIME,
  });

  // Step 2: 工事日更新成功後に進捗を更新
  await kintoneService.updateKintoneRecord(kintoneAppId, recordId, {
    [KintoneFields.PROGRESS_STATUS]: KintoneProgressStatus.CONSTRUCTION_DATE_CONFIRMED,
  });

  // Step 3: Firestoreの状態を遷移
  await firestoreService.transitionState(
    recordId,
    States.CONSTRUCTION_DATE_CONFIRMED,
    "updateConstructionDate",
    {
      constructionDateUpdatedInKintone: true,
    }
  );

  logger.info("Kintoneの工事日を更新完了", {
    recordId,
    constructionDate,
  });
}
