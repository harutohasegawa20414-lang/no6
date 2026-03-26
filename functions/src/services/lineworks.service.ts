import axios from "axios";
import * as jwt from "jsonwebtoken";
import { getConfig } from "../config";
import { LineWorksConfig, Timeouts } from "../config/constants";
import { LineWorksTokenResponse } from "../types/lineworks";
import { withRetry } from "../utils/retry";
import * as logger from "../utils/logger";

// URLパスインジェクション防止: IDに許可される文字のみ通す
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_\-@.]+$/;

function validatePathParam(value: string, name: string): void {
  if (!value || !SAFE_ID_PATTERN.test(value)) {
    throw new Error(`Invalid ${name}: contains disallowed characters`);
  }
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + LineWorksConfig.TOKEN_REFRESH_BUFFER_MS) {
    return cachedToken.token;
  }

  const config = getConfig();

  // JWT アサーション作成
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: config.lineWorks.clientId,
      sub: config.lineWorks.serviceAccount,
      iat: now,
      exp: now + LineWorksConfig.JWT_EXPIRY_SECONDS,
    },
    config.lineWorks.privateKey,
    { algorithm: "RS256" }
  );

  const params = new URLSearchParams();
  params.append("assertion", assertion);
  params.append("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  params.append("client_id", config.lineWorks.clientId);
  params.append("client_secret", config.lineWorks.clientSecret);
  params.append("scope", "bot");

  try {
    const response = await axios.post<LineWorksTokenResponse>(
      LineWorksConfig.AUTH_URL,
      params,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: Timeouts.HTTP_REQUEST_TIMEOUT_MS,
      }
    );

    cachedToken = {
      token: response.data.access_token,
      expiresAt: Date.now() + response.data.expires_in * 1000,
    };

    return cachedToken.token;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response) {
      logger.error("LINE WORKSトークン取得エラー", { status: err.response.status });
    }
    throw err;
  }
}

export async function sendMessage(
  userId: string,
  text: string
): Promise<void> {
  const config = getConfig();
  const token = await getAccessToken();
  const botId = config.lineWorks.botId;

  validatePathParam(botId, "botId");
  validatePathParam(userId, "userId");

  await withRetry(
    () =>
      axios.post(
        `${LineWorksConfig.API_BASE_URL}/bots/${botId}/users/${userId}/messages`,
        {
          content: {
            type: "text",
            text,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: Timeouts.HTTP_REQUEST_TIMEOUT_MS,
        }
      ),
    { label: "LINE WORKS sendMessage" }
  );

  logger.info("LINE WORKS message sent", { userId });
}

/**
 * LINE WORKSで画像メッセージを送信する
 */
export async function sendImage(
  userId: string,
  imageUrl: string
): Promise<void> {
  const config = getConfig();
  const token = await getAccessToken();
  const botId = config.lineWorks.botId;

  validatePathParam(botId, "botId");
  validatePathParam(userId, "userId");

  // imageURL検証: HTTPSのみ許可 + SSRF対策
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "https:") {
      throw new Error("Only HTTPS URLs are allowed for images");
    }
    // SSRF対策: プライベート/ローカルIPアドレスをブロック
    const hostname = parsed.hostname;
    const blockedPatterns = [
      /^127\./,                                  // localhost IPv4
      /^10\./,                                   // RFC1918
      /^172\.(1[6-9]|2[0-9]|3[01])\./,         // RFC1918
      /^192\.168\./,                             // RFC1918
      /^0\./,                                    // current network
      /^169\.254\./,                             // link-local
      /^::1$/,                                   // localhost IPv6
      /^fc00:/i,                                 // unique local IPv6
      /^fe80:/i,                                 // link-local IPv6
    ];
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      blockedPatterns.some((p) => p.test(hostname))
    ) {
      throw new Error("Internal/private URLs are not allowed");
    }
    if (imageUrl.length > 2048) {
      throw new Error("URL too long");
    }
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Invalid imageUrl");
  }

  await withRetry(
    () =>
      axios.post(
        `${LineWorksConfig.API_BASE_URL}/bots/${botId}/users/${userId}/messages`,
        {
          content: {
            type: "image",
            previewImageUrl: imageUrl,
            originalContentUrl: imageUrl,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: Timeouts.HTTP_REQUEST_TIMEOUT_MS,
        }
      ),
    { label: "LINE WORKS sendImage" }
  );

  logger.info("LINE WORKS image sent", { userId });
}
