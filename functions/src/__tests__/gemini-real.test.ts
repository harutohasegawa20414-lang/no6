/**
 * AI 業者返信判定テスト（OpenAI GPT-4o-mini 実API）
 *
 * 本物のOpenAI APIを使って、No.6のGeminiプロンプトと同じロジックで
 * 業者の様々な返信パターンをAIが正しく判定できるかテストする。
 *
 * ※ テスト専用。本番はGemini APIを使用。
 */

import OpenAI from "openai";
import { AiJudgmentPatterns } from "../config/constants";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
if (!OPENAI_API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY が設定されていません。テストをスキップします。");
}

// テスト用の候補日
const CANDIDATE_DATE_1 = "2026-04-10";
const CANDIDATE_DATE_2 = "2026-04-12";
const CANDIDATE_DATE_3 = "2026-04-15";

// gemini.service.ts と同じプロンプトを使用
function buildPrompt(contractorReply: string): string {
  return `あなたは工事日程調整アシスタントです。
業者からの返信を分析し、以下の判定を行ってください。

候補日：
- 候補日1: ${CANDIDATE_DATE_1}
- 候補日2: ${CANDIDATE_DATE_2}
- 候補日3: ${CANDIDATE_DATE_3}

判定ルール：
- 「1」「1番」「候補1」「1でお願いします」「1番目」→ 候補日1を選択（パターンA）
- 「2」「2番」「候補2」「2でお願いします」「2番目」→ 候補日2を選択（パターンA）
- 「3」「3番」「候補3」「3でお願いします」「3番目」→ 候補日3を選択（パターンA）
- 候補日の日付そのもの（例: 4/10、4月10日）を指定 → その候補日を選択（パターンA）
- 候補日にない日付を提案 → パターンB（提案された日付をconstructionDateに設定すること）
- 日程に関する情報が一切ない → 判定不能

時間の解釈ルール：
- 「9:00」「9時」「朝9時」「午前9時」→ 09:00
- 「13時」「午後1時」「1時から」→ 13:00
- 「10時半」「10:30」→ 10:30
- 時間の記載がない場合 → null

判定パターン：
- パターンA: 業者が候補日のいずれかを選択した場合（番号指定を含む）
- パターンB: 業者が候補日以外の日程を提案した場合
- 判定不能: 返信内容から日程が読み取れない場合

業者からの返信:
${contractorReply}

必ず以下のJSON形式のみで回答してください：
{
  "pattern": "パターンA" | "パターンB" | "判定不能",
  "constructionDate": "YYYY-MM-DD形式の日付（判定不能の場合はnull）",
  "constructionStartTime": "HH:MM形式の時間（記載がない場合はnull）",
  "confidence": 0.0〜1.0の確信度,
  "reasoning": "判定理由"
}`;
}

interface JudgmentResult {
  pattern: string;
  constructionDate: string | null;
  constructionStartTime: string | null;
  confidence: number;
  reasoning: string;
}

async function callAI(reply: string): Promise<JudgmentResult> {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: buildPrompt(reply) }],
    temperature: 0,
  });

  const text = response.choices[0].message.content || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON found in response: ${text}`);
  }
  return JSON.parse(jsonMatch[0]) as JudgmentResult;
}

describe("AI 業者返信判定テスト（OpenAI GPT-4o-mini 実API）", () => {
  beforeAll(() => {
    console.log("\n🔑 OpenAI GPT-4o-mini を使用してプロンプトの判定精度をテストします");
    console.log("   ※ 本番はGemini APIを使用。プロンプトは同一です。\n");
  });

  // ===== パターンA: 候補日を選択 =====

  test("パターンA: 「1番、9:00開始で」", async () => {
    const reply = "1番、9:00開始でお願いします";
    const result = await callAI(reply);

    console.log(`  返信: "${reply}"`);
    console.log(`  判定: ${result.pattern} / 日付: ${result.constructionDate} / 時間: ${result.constructionStartTime} / 確信度: ${result.confidence}`);
    console.log(`  理由: ${result.reasoning}\n`);

    expect(result.pattern).toBe(AiJudgmentPatterns.PATTERN_A);
    expect(result.constructionDate).toBe("2026-04-10");
    expect(result.constructionStartTime).toBe("09:00");
  });

  test("パターンA: 「2番で13時にお願いします」", async () => {
    const reply = "2番で13時にお願いします";
    const result = await callAI(reply);

    console.log(`  返信: "${reply}"`);
    console.log(`  判定: ${result.pattern} / 日付: ${result.constructionDate} / 時間: ${result.constructionStartTime} / 確信度: ${result.confidence}`);
    console.log(`  理由: ${result.reasoning}\n`);

    expect(result.pattern).toBe(AiJudgmentPatterns.PATTERN_A);
    expect(result.constructionDate).toBe("2026-04-12");
    expect(result.constructionStartTime).toBe("13:00");
  });

  test("パターンA: 「候補3の15日で朝9時から」", async () => {
    const reply = "候補3の15日で朝9時からお願いします";
    const result = await callAI(reply);

    console.log(`  返信: "${reply}"`);
    console.log(`  判定: ${result.pattern} / 日付: ${result.constructionDate} / 時間: ${result.constructionStartTime} / 確信度: ${result.confidence}`);
    console.log(`  理由: ${result.reasoning}\n`);

    expect(result.pattern).toBe(AiJudgmentPatterns.PATTERN_A);
    expect(result.constructionDate).toBe("2026-04-15");
    expect(result.constructionStartTime).toBe("09:00");
  });

  test("パターンA: 「4/12でお願いします。10時半から」", async () => {
    const reply = "4/12でお願いします。10時半からで";
    const result = await callAI(reply);

    console.log(`  返信: "${reply}"`);
    console.log(`  判定: ${result.pattern} / 日付: ${result.constructionDate} / 時間: ${result.constructionStartTime} / 確信度: ${result.confidence}`);
    console.log(`  理由: ${result.reasoning}\n`);

    expect(result.pattern).toBe(AiJudgmentPatterns.PATTERN_A);
    expect(result.constructionDate).toBe("2026-04-12");
    expect(result.constructionStartTime).toBe("10:30");
  });

  test("パターンA: 時間指定なし「1でお願いします」", async () => {
    const reply = "1でお願いします";
    const result = await callAI(reply);

    console.log(`  返信: "${reply}"`);
    console.log(`  判定: ${result.pattern} / 日付: ${result.constructionDate} / 時間: ${result.constructionStartTime} / 確信度: ${result.confidence}`);
    console.log(`  理由: ${result.reasoning}\n`);

    expect(result.pattern).toBe(AiJudgmentPatterns.PATTERN_A);
    expect(result.constructionDate).toBe("2026-04-10");
  });

  // ===== パターンB: 候補日以外を提案 =====

  test("パターンB: 「どれも厳しいので4/20はどうですか」", async () => {
    const reply = "すみません、どの日も予定が入っていまして。4月20日はいかがでしょうか？";
    const result = await callAI(reply);

    console.log(`  返信: "${reply}"`);
    console.log(`  判定: ${result.pattern} / 日付: ${result.constructionDate} / 時間: ${result.constructionStartTime} / 確信度: ${result.confidence}`);
    console.log(`  理由: ${result.reasoning}\n`);

    expect(result.pattern).toBe(AiJudgmentPatterns.PATTERN_B);
    expect(result.constructionDate).toBe("2026-04-20");
  });

  test("パターンB: 「4/13の月曜日なら可能です」", async () => {
    const reply = "候補日はどれも難しいです。4/13の月曜日なら可能です。";
    const result = await callAI(reply);

    console.log(`  返信: "${reply}"`);
    console.log(`  判定: ${result.pattern} / 日付: ${result.constructionDate} / 時間: ${result.constructionStartTime} / 確信度: ${result.confidence}`);
    console.log(`  理由: ${result.reasoning}\n`);

    expect(result.pattern).toBe(AiJudgmentPatterns.PATTERN_B);
    expect(result.constructionDate).toBe("2026-04-13");
  });

  // ===== 判定不能 =====

  test("判定不能: 「確認して折り返します」", async () => {
    const reply = "確認して折り返します";
    const result = await callAI(reply);

    console.log(`  返信: "${reply}"`);
    console.log(`  判定: ${result.pattern} / 日付: ${result.constructionDate} / 時間: ${result.constructionStartTime} / 確信度: ${result.confidence}`);
    console.log(`  理由: ${result.reasoning}\n`);

    expect(result.pattern).toBe(AiJudgmentPatterns.UNCLEAR);
    expect(result.constructionDate).toBeNull();
  });

  test("判定不能: 「ちょっとわかりません」", async () => {
    const reply = "ちょっとわかりません。上に確認します。";
    const result = await callAI(reply);

    console.log(`  返信: "${reply}"`);
    console.log(`  判定: ${result.pattern} / 日付: ${result.constructionDate} / 時間: ${result.constructionStartTime} / 確信度: ${result.confidence}`);
    console.log(`  理由: ${result.reasoning}\n`);

    expect(result.pattern).toBe(AiJudgmentPatterns.UNCLEAR);
    expect(result.constructionDate).toBeNull();
  });

  test("判定不能: 「お疲れ様です」（無関係なメッセージ）", async () => {
    const reply = "お疲れ様です。今日もよろしくお願いします。";
    const result = await callAI(reply);

    console.log(`  返信: "${reply}"`);
    console.log(`  判定: ${result.pattern} / 日付: ${result.constructionDate} / 時間: ${result.constructionStartTime} / 確信度: ${result.confidence}`);
    console.log(`  理由: ${result.reasoning}\n`);

    expect(result.pattern).toBe(AiJudgmentPatterns.UNCLEAR);
  });
});
