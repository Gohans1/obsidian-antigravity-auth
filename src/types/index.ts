// Core types for Obsidian Antigravity Auth Plugin

export interface GoogleAccount {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  projectId: string;
  status: AccountStatus;
  lastUsed: number;
  rateLimitExpiry?: number;
}

export type AccountStatus = 'active' | 'rate_limited' | 'expired' | 'error';

export interface PluginSettings {
  proxyPort: number;
  defaultModel: string;
  autoStartProxy: boolean;
  enableLogging: boolean;
  maxRetries: number;
  oauthClientId: string;
  oauthClientSecret: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  proxyPort: 8787,
  defaultModel: 'antigravity-gemini-3-pro-high',
  autoStartProxy: true,
  enableLogging: false,
  maxRetries: 3,
  oauthClientId: '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
  oauthClientSecret: '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'
};

// OAuth constants from Antigravity
export const OAUTH_CONFIG = {
  redirectPort: 51121,
  redirectPath: '/oauth-callback',
  scopes: [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/cclog',
    'https://www.googleapis.com/auth/experimentsandconfigs'
  ],
  authUrl: 'https://accounts.google.com/o/oauth2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token'
};

// Antigravity API endpoints
export const ANTIGRAVITY_CONFIG = {
  endpoints: {
    daily: 'https://daily-cloudcode-pa.sandbox.googleapis.com',
    autopush: 'https://autopush-cloudcode-pa.sandbox.googleapis.com',
    prod: 'https://cloudcode-pa.googleapis.com'
  },
  // Endpoint order for project discovery (prod first, then fallbacks)
  loadEndpoints: [
    'https://cloudcode-pa.googleapis.com',
    'https://daily-cloudcode-pa.sandbox.googleapis.com',
    'https://autopush-cloudcode-pa.sandbox.googleapis.com'
  ],
  paths: {
    generate: '/v1internal:generateContent',
    stream: '/v1internal:streamGenerateContent?alt=sse',
    loadCodeAssist: '/v1internal:loadCodeAssist'
  },
  userAgent: 'antigravity/1.11.5 windows/amd64',
  apiClient: 'google-cloud-sdk vscode_cloudshelleditor/0.1',
  // Default project ID when discovery fails (e.g., business/workspace accounts)
  defaultProjectId: 'rising-fact-p41fc'
};

// Available models
export const AVAILABLE_MODELS = [
  { id: 'antigravity-gemini-3-pro-high', name: 'Gemini 3 Pro High', family: 'gemini' },
  { id: 'antigravity-gemini-3-pro-low', name: 'Gemini 3 Pro Low', family: 'gemini' },
  { id: 'antigravity-gemini-3-flash', name: 'Gemini 3 Flash', family: 'gemini' },
  { id: 'antigravity-claude-sonnet-4-5', name: 'Claude Sonnet 4.5', family: 'claude' },
  { id: 'antigravity-claude-sonnet-4-5-thinking-low', name: 'Claude Sonnet 4.5 Think Low', family: 'claude' },
  { id: 'antigravity-claude-sonnet-4-5-thinking-medium', name: 'Claude Sonnet 4.5 Think Medium', family: 'claude' },
  { id: 'antigravity-claude-sonnet-4-5-thinking-high', name: 'Claude Sonnet 4.5 Think High', family: 'claude' },
  { id: 'antigravity-claude-opus-4-5-thinking-low', name: 'Claude Opus 4.5 Think Low', family: 'claude' },
  { id: 'antigravity-claude-opus-4-5-thinking-medium', name: 'Claude Opus 4.5 Think Medium', family: 'claude' },
  { id: 'antigravity-claude-opus-4-5-thinking-high', name: 'Claude Opus 4.5 Think High', family: 'claude' }
];

// OpenAI API Types
export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAIContentPart[] | any;
}

export interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface OpenAIChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
  };
  finish_reason: 'stop' | 'length' | null;
}

export interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: 'stop' | 'length' | null;
  }[];
}

// Antigravity API Types
export interface AntigravityRequest {
  project: string;
  model: string;
  request: {
    contents: AntigravityContent[];
    systemInstruction?: {
      parts: { text: string }[];
    };
    generationConfig?: {
      maxOutputTokens?: number;
      temperature?: number;
      topP?: number;
      thinkingConfig?: {
        thinkingBudget?: number;
        includeThoughts?: boolean;
      };
    };
  };
  userAgent: string;
  requestId: string;
}

export interface AntigravityContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface AntigravityResponse {
  response: {
    candidates: {
      content: {
        role: 'model';
        parts: { text: string }[];
      };
      finishReason: string;
    }[];
    usageMetadata?: {
      promptTokenCount: number;
      candidatesTokenCount: number;
      totalTokenCount: number;
    };
    modelVersion: string;
    responseId: string;
  };
  traceId: string;
}
