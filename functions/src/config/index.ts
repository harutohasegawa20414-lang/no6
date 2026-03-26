import { defineSecret } from "firebase-functions/params";

// ===== Firebase Functions Secrets =====
export const kintoneBaseUrl = defineSecret("KINTONE_BASE_URL");
export const kintoneApiToken = defineSecret("KINTONE_API_TOKEN");
export const kintoneAppId = defineSecret("KINTONE_APP_ID");

export const lineWorksClientId = defineSecret("LINEWORKS_CLIENT_ID");
export const lineWorksClientSecret = defineSecret("LINEWORKS_CLIENT_SECRET");
export const lineWorksServiceAccount = defineSecret("LINEWORKS_SERVICE_ACCOUNT");
export const lineWorksPrivateKey = defineSecret("LINEWORKS_PRIVATE_KEY");
export const lineWorksBotId = defineSecret("LINEWORKS_BOT_ID");

export const lineChannelSecret = defineSecret("LINE_CHANNEL_SECRET");
export const lineChannelAccessToken = defineSecret("LINE_CHANNEL_ACCESS_TOKEN");

export const geminiApiKey = defineSecret("GEMINI_API_KEY");
export const vertexProjectId = defineSecret("VERTEX_PROJECT_ID");
export const vertexServiceAccountEmail = defineSecret("VERTEX_SERVICE_ACCOUNT_EMAIL");
export const vertexPrivateKey = defineSecret("VERTEX_PRIVATE_KEY");

export const googleCalendarId = defineSecret("GOOGLE_CALENDAR_ID");
export const googleServiceAccountEmail = defineSecret("GOOGLE_SERVICE_ACCOUNT_EMAIL");
export const googlePrivateKey = defineSecret("GOOGLE_PRIVATE_KEY");

export const useAiJudgment = defineSecret("USE_AI_JUDGMENT");

export const kintoneWebhookToken = defineSecret("KINTONE_WEBHOOK_TOKEN");
export const adminApiToken = defineSecret("ADMIN_API_TOKEN");
export const lineWorksBotSecret = defineSecret("LINEWORKS_BOT_SECRET");

// ===== 全シークレット一覧（runWithで使用） =====
export const allSecrets = [
  kintoneBaseUrl,
  kintoneApiToken,
  kintoneAppId,
  lineWorksClientId,
  lineWorksClientSecret,
  lineWorksServiceAccount,
  lineWorksPrivateKey,
  lineWorksBotId,
  lineChannelSecret,
  lineChannelAccessToken,
  geminiApiKey,
  vertexProjectId,
  vertexServiceAccountEmail,
  vertexPrivateKey,
  googleCalendarId,
  googleServiceAccountEmail,
  googlePrivateKey,
  useAiJudgment,
  kintoneWebhookToken,
  adminApiToken,
  lineWorksBotSecret,
];

export function getConfig() {
  return {
    kintone: {
      baseUrl: kintoneBaseUrl.value(),
      apiToken: kintoneApiToken.value(),
      appId: kintoneAppId.value(),
    },
    lineWorks: {
      clientId: lineWorksClientId.value(),
      clientSecret: lineWorksClientSecret.value(),
      serviceAccount: lineWorksServiceAccount.value(),
      privateKey: lineWorksPrivateKey.value().replace(/\\n/g, "\n"),
      botId: lineWorksBotId.value(),
    },
    line: {
      channelSecret: lineChannelSecret.value(),
      channelAccessToken: lineChannelAccessToken.value(),
    },
    gemini: {
      apiKey: geminiApiKey.value(),
    },
    vertex: {
      projectId: vertexProjectId.value(),
      serviceAccountEmail: vertexServiceAccountEmail.value(),
      privateKey: vertexPrivateKey.value().replace(/\\n/g, "\n"),
    },
    googleCalendar: {
      calendarId: googleCalendarId.value(),
      serviceAccountEmail: googleServiceAccountEmail.value(),
      privateKey: googlePrivateKey.value().replace(/\\n/g, "\n"),
    },
    useAiJudgment: useAiJudgment.value() === "true",
  };
}
