import axios from "axios";
import { getConfig } from "../config";
import { LineSendMessagePayload, LineReplyPayload } from "../types/line";
import { Timeouts } from "../config/constants";
import { withRetry } from "../utils/retry";
import * as logger from "../utils/logger";

const LINE_API_BASE = "https://api.line.me/v2/bot";

function getAuthHeader() {
  const config = getConfig();
  return { Authorization: `Bearer ${config.line.channelAccessToken}` };
}

export async function pushMessage(
  userId: string,
  text: string
): Promise<void> {
  const payload: LineSendMessagePayload = {
    to: userId,
    messages: [{ type: "text", text }],
  };

  const response = await withRetry(
    () =>
      axios.post(`${LINE_API_BASE}/message/push`, payload, {
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        timeout: Timeouts.HTTP_REQUEST_TIMEOUT_MS,
      }),
    { label: "LINE pushMessage" }
  );

  logger.info("LINEメッセージ送信完了", { status: response.status });
}

export async function replyMessage(
  replyToken: string,
  text: string
): Promise<void> {
  const payload: LineReplyPayload = {
    replyToken,
    messages: [{ type: "text", text }],
  };

  await withRetry(
    () =>
      axios.post(`${LINE_API_BASE}/message/reply`, payload, {
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        timeout: Timeouts.HTTP_REQUEST_TIMEOUT_MS,
      }),
    { label: "LINE replyMessage" }
  );

  logger.info("LINEメッセージ返信完了");
}
