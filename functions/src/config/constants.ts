// ===== 状態名 =====
export const States = {
  CONSTRUCTION_DATE_SCHEDULING: "工事日日程調整",
  CANDIDATE_DATES_SENT: "候補日確認送信済み",
  WAITING_CONTRACTOR_REPLY: "業者返信待ち",
  AI_JUDGED: "AI判定済み",
  CONSTRUCTION_DATE_CONFIRMED: "工事日確定",
  CUSTOMER_CONFIRMATION_SENT: "お客様確認送信済み",
  CUSTOMER_CONFIRMED: "お客様確定",
  CONSTRUCTION_DATE_RESCHEDULING: "工事日程再調整",
  ERROR: "エラー",
} as const;

export type State = (typeof States)[keyof typeof States];

// ===== Kintone フィールドコード =====
export const KintoneFields = {
  RECORD_ID: "レコード番号",
  CANDIDATE_DATE_1: "候補日1",
  CANDIDATE_DATE_2: "候補日2",
  CANDIDATE_DATE_3: "候補日3",
  CONTRACTOR_NAME: "業者名",
  CONSTRUCTION_DATE_COATING: "工事日コーティング",
  CONSTRUCTION_DATE_UFB: "工事日UFB浄水器関連",
  CONSTRUCTION_START_TIME: "工事開始時刻",
  PROPOSAL_CATEGORY: "提案カテゴリ",
  PROGRESS_STATUS: "進捗",
  CUSTOMER_NAME: "お客様名",
  CUSTOMER_LINE_USER_ID: "LINE_userid",
  STAFF_NAME: "アポ担当",
  OFFICE_STAFF_NAME: "BY担当者",
  CONTRACTOR_LINE_WORKS_ID: "業者LINEWORKSユーザーI",
  APP_ID: "アプリID",
} as const;

// ===== Kintone 写真フィールドコード =====
// 業者に送信する写真が格納されたファイルフィールド
export const KintonePhotoFields = [
  "写真1",
  "写真2",
  "写真3",
] as const;

// ===== Kintone 進捗ステータス =====
export const KintoneProgressStatus = {
  CONSTRUCTION_DATE_SCHEDULING: "工事日日程調整",
  CONSTRUCTION_DATE_CONFIRMED: "工事日確定",
  ORDER_REQUESTED: "発注依頼済み",
  CONSTRUCTION_DATE_RESCHEDULING: "工事日程再調整",
} as const;

// ===== Firestore コレクション名 =====
export const Collections = {
  RECORDS: "records",
  IDEMPOTENCY_KEYS: "idempotencyKeys",
  STATE_HISTORY: "stateHistory",
} as const;

// ===== メッセージテンプレート =====
export const MessageTemplates = {
  CANDIDATE_DATES_TO_CONTRACTOR: (
    customerName: string,
    date1: string,
    date2: string,
    date3: string
  ) =>
    `${customerName}様の工事について、以下の候補日でご都合をお聞かせください。\n\n候補日1: ${date1}\n候補日2: ${date2}\n候補日3: ${date3}\n\nご都合の良い日時をご返信ください。`,

  CUSTOMER_NOTIFICATION_PATTERN_A: (
    customerName: string,
    constructionDate: string,
    startTime: string
  ) =>
    `${customerName}様\n\n工事日が確定いたしました。\n\n工事日: ${constructionDate}\n開始時間: ${startTime}\n\nよろしくお願いいたします。`,

  CUSTOMER_NOTIFICATION_PATTERN_B: (
    customerName: string,
    constructionDate: string,
    startTime: string
  ) =>
    `${customerName}様\n\n工事日程についてご連絡いたします。\n\n工事日: ${constructionDate}\n開始時間: ${startTime}\n\n上記日程でよろしいでしょうか？\n\n1. はい（この日程でお願いします）\n2. いいえ（日程を再調整してください）\n\n番号でご返信ください。`,

  ORDER_REQUEST: (
    contractorName: string,
    customerName: string,
    constructionDate: string,
    startTime: string
  ) =>
    `${contractorName}様\n\n以下の工事の発注をお願いいたします。\n\nお客様名: ${customerName}\n工事日: ${constructionDate}\n開始時間: ${startTime}\n\nよろしくお願いいたします。`,
} as const;

// ===== AI判定 パターン =====
export const AiJudgmentPatterns = {
  PATTERN_A: "パターンA", // 候補日のいずれかに一致
  PATTERN_B: "パターンB", // 候補日外の日程
  UNCLEAR: "判定不能",
} as const;

// ===== タイムアウト・リトライ設定 =====
export const Timeouts = {
  CONTRACTOR_REPLY_HOURS: 48,
  API_RETRY_MAX: 3,
  API_RETRY_DELAY_MS: 1000,
  IDEMPOTENCY_KEY_TTL_HOURS: 24,
  HTTP_REQUEST_TIMEOUT_MS: 30000, // 30秒
  FILE_DOWNLOAD_TIMEOUT_MS: 60000, // 60秒（ファイルDL用）
} as const;

// ===== デフォルト値 =====
export const Defaults = {
  CONSTRUCTION_START_TIME: "09:00",
  CALENDAR_EVENT_DURATION_HOURS: 2,
  TIMEZONE: "Asia/Tokyo",
} as const;

// ===== Cloud Functions設定 =====
export const FunctionConfig = {
  REGION: "asia-northeast1",
  MAX_INSTANCES_DEFAULT: 10,
  MAX_INSTANCES_ADMIN: 5,
} as const;

// ===== LINE WORKS設定 =====
export const LineWorksConfig = {
  AUTH_URL: "https://auth.worksmobile.com/oauth2/v2.0/token",
  API_BASE_URL: "https://www.worksapis.com/v1.0",
  JWT_EXPIRY_SECONDS: 3600,
  TOKEN_REFRESH_BUFFER_MS: 60000,
} as const;

// ===== AI設定 =====
export const AiConfig = {
  GEMINI_MODEL: "gemini-2.0-flash",
  VERTEX_LOCATION: "asia-northeast1",
  MAX_REPLY_LENGTH: 1000,
} as const;

// ===== Storage設定 =====
export const StorageConfig = {
  TEMP_PHOTO_FOLDER: "temp-photos",
  SIGNED_URL_EXPIRY_MS: 1 * 60 * 60 * 1000, // 1時間
  MAX_PHOTO_COUNT: 10,
  MAX_PHOTO_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
} as const;
