import { AiJudgmentPatterns } from "../config/constants";

export type AiJudgmentPattern =
  (typeof AiJudgmentPatterns)[keyof typeof AiJudgmentPatterns];

export interface AiJudgmentResult {
  pattern: AiJudgmentPattern;
  constructionDate: string | null;
  constructionStartTime: string | null;
  confidence: number;
  reasoning: string;
}
