export interface LineWorksCallbackBody {
  type: string;
  source: {
    userId: string;
    channelId?: string;
  };
  content: {
    type: string;
    text?: string;
    postback?: string;
  };
  issuedTime: string;
}

export interface LineWorksTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface LineWorksSendMessagePayload {
  content: {
    type: string;
    text: string;
  };
}
