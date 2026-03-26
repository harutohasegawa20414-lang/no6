import * as geminiService from "../../services/gemini.service";
import * as firestoreService from "../../services/firestore.service";
import { States, Defaults } from "../../config/constants";
import { AiJudgmentResult } from "../../types/ai";
import * as logger from "../../utils/logger";

export async function processContractorReply(
  recordId: string,
  replyText: string
): Promise<AiJudgmentResult> {
  const record = await firestoreService.getRecord(recordId);
  if (!record) {
    throw new Error(`Record ${recordId} not found`);
  }

  const {
    candidateDate1, candidateDate2, candidateDate3,
    candidateDate1Time, candidateDate2Time, candidateDate3Time,
  } = record;

  if (!candidateDate1 || !candidateDate2 || !candidateDate3) {
    throw new Error(`Record ${recordId}: candidate dates not set`);
  }

  // Gemini APIで業者返信を判定
  const judgment = await geminiService.judgeContractorReply(
    replyText,
    candidateDate1,
    candidateDate2,
    candidateDate3
  );

  // 業者が時間を指定しなかった場合、選択された候補日の元の時刻をフォールバックとして使う
  let startTime = judgment.constructionStartTime;
  if (!startTime && judgment.constructionDate) {
    const candidateTimes: Record<string, string | null> = {
      [candidateDate1]: candidateDate1Time || null,
      [candidateDate2]: candidateDate2Time || null,
      [candidateDate3]: candidateDate3Time || null,
    };
    startTime = candidateTimes[judgment.constructionDate] || Defaults.CONSTRUCTION_START_TIME;
  }

  // 判定結果とともに状態遷移: 業者返信待ち → AI判定済み
  await firestoreService.transitionState(
    recordId,
    States.AI_JUDGED,
    "processContractorReply",
    {
      contractorRawReply: replyText,
      aiJudgment: judgment.pattern,
      constructionDate: judgment.constructionDate,
      constructionStartTime: startTime || Defaults.CONSTRUCTION_START_TIME,
    }
  );

  logger.info("業者返信処理完了", {
    recordId,
    pattern: judgment.pattern,
    constructionDate: judgment.constructionDate,
  });

  return judgment;
}
