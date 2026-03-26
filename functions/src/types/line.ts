export interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

export interface LineEvent {
  type: string;
  message?: {
    type: string;
    id: string;
    text?: string;
  };
  timestamp: number;
  source: {
    type: string;
    userId: string;
  };
  replyToken: string;
  mode: string;
}

export interface LineSendMessagePayload {
  to: string;
  messages: LineMessage[];
}

export interface LineMessage {
  type: string;
  text: string;
}

export interface LineReplyPayload {
  replyToken: string;
  messages: LineMessage[];
}
