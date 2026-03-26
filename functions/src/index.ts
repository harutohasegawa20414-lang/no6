import { initializeApp, getApps } from "firebase-admin/app";

// Firebase Admin初期化
if (getApps().length === 0) initializeApp();

// ===== Cloud Functions エクスポート =====

// HTTP Functions
export { onKintoneWebhook } from "./functions/onKintoneWebhook";
export { onLineWorksCallback } from "./functions/onLineWorksCallback";
export { onLineWebhook } from "./functions/onLineWebhook";
export { onManualRetry } from "./functions/onManualRetry";

// Firestore Triggers
export { onStateChange } from "./functions/onStateChange";
