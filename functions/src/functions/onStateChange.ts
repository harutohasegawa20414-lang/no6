import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { States, AiJudgmentPatterns, FunctionConfig } from "../config/constants";
import { RecordDocument } from "../types/firestore";
import { sendOrderRequest } from "../handlers/phaseB/sendOrderRequest";
import { sendCustomerMessage } from "../handlers/phaseB/sendCustomerMessage";
import { createCalendarEvent } from "../handlers/phaseB/createCalendarEvent";
import * as firestoreService from "../services/firestore.service";
import * as logger from "../utils/logger";

if (getApps().length === 0) initializeApp();

export const onStateChange = onDocumentUpdated(
  {
    document: "records/{recordId}",
    region: FunctionConfig.REGION,
  },
  async (event) => {
    const recordId = event.params.recordId;
    const beforeData = event.data?.before.data() as RecordDocument | undefined;
    const afterData = event.data?.after.data() as RecordDocument | undefined;

    if (!beforeData || !afterData) return;

    // 状態が変わっていない場合はスキップ
    if (beforeData.state === afterData.state) return;

    const newState = afterData.state;
    logger.info("ステート変更検知", {
      recordId,
      from: beforeData.state,
      to: newState,
    });

    try {
      switch (newState) {
        case States.CONSTRUCTION_DATE_CONFIRMED:
          // Phase BはHTTPトリガー（onLineWorksCallback）から直接実行される
          // Firestoreトリガーからは実行しない（エミュレーターの外部ネットワーク制限のため）
          logger.info("Phase BはHTTPトリガーから実行されます", { recordId });
          break;

        case States.CONSTRUCTION_DATE_RESCHEDULING:
          logger.info("再調整のためワークフローをリセット", { recordId });
          break;

        case States.CUSTOMER_CONFIRMED:
          logger.info("ワークフロー完了", { recordId });
          break;

        default:
          // その他の状態遷移は各ハンドラが直接処理済み
          break;
      }
    } catch (err) {
      logger.error("ステート変更ハンドラーエラー", err, { recordId, newState });
      await firestoreService.addError(
        recordId,
        `onStateChange:${newState}`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }
);

export async function executePhaseB(
  recordId: string,
  record: RecordDocument
): Promise<void> {
  logger.info("Phase Bタスクを実行中", { recordId });

  // 3タスクを並列実行（Promise.allSettled）
  const results = await Promise.allSettled([
    sendOrderRequest(recordId),
    sendCustomerMessage(recordId),
    createCalendarEvent(recordId),
  ]);

  // 結果の記録
  const taskNames = ["sendOrderRequest", "sendCustomerMessage", "createCalendarEvent"];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      logger.error(`Phase Bタスク失敗: ${taskNames[i]}`, result.reason, { recordId });
      await firestoreService.addError(
        recordId,
        taskNames[i],
        result.reason instanceof Error ? result.reason.message : String(result.reason)
      );
    }
  }

  // sendCustomerMessage の結果からパターンを判定
  const customerMessageResult = results[1];
  if (customerMessageResult.status === "fulfilled") {
    const messageType = customerMessageResult.value;

    if (messageType === "パターンA") {
      // パターンA: お客様確認不要 → 自動完了
      await firestoreService.transitionState(
        recordId,
        States.CUSTOMER_CONFIRMED,
        "executePhaseB:patternA"
      );
    } else {
      // パターンB: お客様確認待ち
      await firestoreService.transitionState(
        recordId,
        States.CUSTOMER_CONFIRMATION_SENT,
        "executePhaseB:patternB"
      );
    }
  }
}
