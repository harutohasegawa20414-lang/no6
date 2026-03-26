/**
 * No.6 統合テスト（疑似テスト）
 *
 * 外部APIをすべてモックし、Firestoreエミュレータ上で
 * フェーズA（Kintone Webhook → LINE WORKS送信 → 業者返信 → AI判定 → 工事日更新）
 * の一連の流れをシミュレーションする。
 */

import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ===== 外部サービスのモック =====

// LINE WORKS: sendMessage / sendImage を何もしない関数に差し替え
jest.mock("../services/lineworks.service", () => ({
  sendMessage: jest.fn().mockResolvedValue(undefined),
  sendImage: jest.fn().mockResolvedValue(undefined),
}));

// Kintone: getKintoneRecord / updateKintoneRecord / downloadFile / extractImageFileKeys
jest.mock("../services/kintone.service", () => ({
  getKintoneRecord: jest.fn().mockResolvedValue({ record: {} }),
  updateKintoneRecord: jest.fn().mockResolvedValue(undefined),
  downloadFile: jest.fn().mockResolvedValue({ data: Buffer.from(""), contentType: "image/jpeg" }),
  extractImageFileKeys: jest.fn().mockReturnValue([]),
}));

// Storage: uploadTempFile
jest.mock("../services/storage.service", () => ({
  uploadTempFile: jest.fn().mockResolvedValue("https://example.com/temp-image.jpg"),
}));

// Gemini: 業者が「1番、9:00開始」と返信した判定結果を返す
jest.mock("../services/gemini.service", () => ({
  judgeContractorReply: jest.fn().mockResolvedValue({
    pattern: "パターンA",
    constructionDate: "2026-04-10",
    constructionStartTime: "09:00",
    confidence: 0.95,
    reasoning: "業者が候補日1を選択し、9:00開始と回答",
  }),
}));

// config: getConfig のモック（シークレットなしで動くように）
jest.mock("../config", () => ({
  getConfig: () => ({
    kintone: { baseUrl: "https://test.cybozu.com", apiToken: "test-token", appId: "210" },
    lineWorks: { clientId: "test", clientSecret: "test", serviceAccount: "test", privateKey: "test", botId: "test" },
    line: { channelSecret: "test", channelAccessToken: "test" },
    gemini: { apiKey: "test" },
    googleCalendar: { calendarId: "test@gmail.com", serviceAccountEmail: "test@test.iam.gserviceaccount.com", privateKey: "test" },
  }),
  allSecrets: [],
  kintoneBaseUrl: { value: () => "https://test.cybozu.com" },
  kintoneApiToken: { value: () => "test-token" },
  kintoneAppId: { value: () => "210" },
}));

// idempotency: テスト中はスキップ
jest.mock("../middleware/idempotency", () => ({
  ensureIdempotent: jest.fn().mockResolvedValue(undefined),
}));

// ===== テスト本体 =====

import * as firestoreService from "../services/firestore.service";
import * as lineWorksService from "../services/lineworks.service";
import * as kintoneService from "../services/kintone.service";
import * as geminiService from "../services/gemini.service";
import { sendCandidateDates } from "../handlers/phaseA/sendCandidateDates";
import { processContractorReply } from "../handlers/phaseA/processContractorReply";
import { updateConstructionDate } from "../handlers/phaseA/updateConstructionDate";
import { States } from "../config/constants";

const TEST_RECORD_ID = "TEST-001";

describe("No.6 フェーズA 統合テスト", () => {
  beforeAll(() => {
    // Firestore エミュレータに接続
    process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
    if (getApps().length === 0) {
      initializeApp({ projectId: "no-6-92dfa" });
    }
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    const db = getFirestore();
    const recordRef = db.collection("records").doc(TEST_RECORD_ID);
    await recordRef.delete();

    // idempotencyKeys もクリーンアップ
    const idempotencySnapshot = await db.collection("idempotencyKeys").get();
    const batch = db.batch();
    idempotencySnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    // stateHistory もクリーンアップ
    const historySnapshot = await db
      .collection("stateHistory")
      .where("recordId", "==", TEST_RECORD_ID)
      .get();
    const batch2 = db.batch();
    historySnapshot.docs.forEach((doc) => batch2.delete(doc.ref));
    await batch2.commit();
  });

  test("STEP 1: Kintone Webhook → Firestoreにレコード作成", async () => {
    console.log("\n========================================");
    console.log("STEP 1: Kintone Webhook シミュレーション");
    console.log("========================================");
    console.log("入力データ:");
    console.log("  レコードID: TEST-001");
    console.log("  候補日1: 2026-04-10");
    console.log("  候補日2: 2026-04-12");
    console.log("  候補日3: 2026-04-15");
    console.log("  業者名: テスト工務店");
    console.log("  お客様名: 山田太郎");

    // Kintone Webhookが来た想定で、Firestoreにレコードを作成
    await firestoreService.createRecord(TEST_RECORD_ID, {
      state: States.CANDIDATE_DATES_SENT,
      candidateDate1: "2026-04-10",
      candidateDate2: "2026-04-12",
      candidateDate3: "2026-04-15",
      contractorName: "テスト工務店",
      contractorLineWorksId: "contractor-user-001",
      customerName: "山田太郎",
      customerLineUserId: "U1234567890abcdef",
      staffName: "佐藤",
      officeStaffName: "鈴木",
      kintoneAppId: "210",
    });

    const record = await firestoreService.getRecord(TEST_RECORD_ID);
    expect(record).not.toBeNull();
    expect(record!.state).toBe(States.CANDIDATE_DATES_SENT);
    expect(record!.candidateDate1).toBe("2026-04-10");
    expect(record!.contractorName).toBe("テスト工務店");

    console.log("✓ Firestoreにレコード作成完了");
    console.log(`  状態: ${record!.state}`);
  });

  test("STEP 2: LINE WORKSで業者に候補日送信", async () => {
    console.log("\n========================================");
    console.log("STEP 2: 業者へ候補日送信");
    console.log("========================================");

    await sendCandidateDates(TEST_RECORD_ID);

    // LINE WORKS sendMessage が呼ばれたか確認
    expect(lineWorksService.sendMessage).toHaveBeenCalledWith(
      "contractor-user-001",
      expect.stringContaining("山田太郎様の工事について")
    );

    // 状態遷移の確認
    const record = await firestoreService.getRecord(TEST_RECORD_ID);
    expect(record!.state).toBe(States.WAITING_CONTRACTOR_REPLY);

    console.log("✓ LINE WORKSメッセージ送信（モック）");
    console.log(`  送信先: contractor-user-001`);
    console.log(`  状態: ${record!.state}`);

    // 送信されたメッセージの内容を表示
    const mockCall = (lineWorksService.sendMessage as jest.Mock).mock.calls[0];
    console.log(`  メッセージ内容:\n    ${mockCall[1].replace(/\n/g, "\n    ")}`);
  });

  test("STEP 3: 業者返信 → AI判定", async () => {
    console.log("\n========================================");
    console.log("STEP 3: 業者返信 → AI判定");
    console.log("========================================");

    const replyText = "1番の4月10日、9時開始でお願いします";
    console.log(`  業者返信: "${replyText}"`);

    const judgment = await processContractorReply(TEST_RECORD_ID, replyText);

    // Gemini が呼ばれたか確認
    expect(geminiService.judgeContractorReply).toHaveBeenCalledWith(
      replyText,
      "2026-04-10",
      "2026-04-12",
      "2026-04-15"
    );

    // AI判定結果の確認
    expect(judgment.pattern).toBe("パターンA");
    expect(judgment.constructionDate).toBe("2026-04-10");
    expect(judgment.constructionStartTime).toBe("09:00");

    // 状態遷移の確認
    const record = await firestoreService.getRecord(TEST_RECORD_ID);
    expect(record!.state).toBe(States.AI_JUDGED);
    expect(record!.constructionDate).toBe("2026-04-10");
    expect(record!.constructionStartTime).toBe("09:00");

    console.log("✓ AI判定完了（モック）");
    console.log(`  判定: ${judgment.pattern}`);
    console.log(`  工事日: ${judgment.constructionDate}`);
    console.log(`  開始時間: ${judgment.constructionStartTime}`);
    console.log(`  確信度: ${judgment.confidence}`);
    console.log(`  状態: ${record!.state}`);
  });

  test("STEP 4: Kintone工事日更新 → 工事日確定", async () => {
    console.log("\n========================================");
    console.log("STEP 4: Kintone工事日更新 → 工事日確定");
    console.log("========================================");

    await updateConstructionDate(TEST_RECORD_ID);

    // Kintone更新が呼ばれたか確認
    expect(kintoneService.updateKintoneRecord).toHaveBeenCalledWith(
      "210",
      TEST_RECORD_ID,
      expect.objectContaining({
        "工事日コーティング": "2026-04-10",
        "工事開始時刻": "09:00",
      })
    );

    // 進捗ステータス更新も呼ばれたか確認
    expect(kintoneService.updateKintoneRecord).toHaveBeenCalledWith(
      "210",
      TEST_RECORD_ID,
      expect.objectContaining({
        "進捗": "工事日確定",
      })
    );

    // 状態遷移の確認
    const record = await firestoreService.getRecord(TEST_RECORD_ID);
    expect(record!.state).toBe(States.CONSTRUCTION_DATE_CONFIRMED);
    expect(record!.constructionDateUpdatedInKintone).toBe(true);

    console.log("✓ Kintone工事日更新（モック）");
    console.log("✓ Kintone進捗ステータス更新（モック）");
    console.log(`  状態: ${record!.state}`);
    console.log(`  Kintone更新済み: ${record!.constructionDateUpdatedInKintone}`);
  });

  test("全体の状態遷移を確認", async () => {
    console.log("\n========================================");
    console.log("状態遷移サマリー");
    console.log("========================================");

    const db = getFirestore();
    const historySnapshot = await db
      .collection("stateHistory")
      .where("recordId", "==", TEST_RECORD_ID)
      .orderBy("timestamp", "asc")
      .get();

    console.log("  状態遷移履歴:");
    historySnapshot.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`    ${i + 1}. ${data.fromState || "(初期)"} → ${data.toState}  [${data.action}]`);
    });

    expect(historySnapshot.size).toBeGreaterThanOrEqual(3);

    console.log("\n========================================");
    console.log("テスト完了！フェーズAの流れが正常に動作しました。");
    console.log("========================================");
  });
});
