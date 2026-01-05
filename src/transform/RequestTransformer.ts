import { 
  OpenAIChatRequest, 
  OpenAIMessage, 
  AntigravityRequest, 
  AntigravityContent,
  ANTIGRAVITY_CONFIG 
} from '../types';
import * as crypto from 'crypto';

export class RequestTransformer {
  
  transformToAntigravity(openAIRequest: OpenAIChatRequest, projectId: string): AntigravityRequest {
    const modelId = this.mapModelId(openAIRequest.model);
    const { contents, systemInstruction } = this.transformMessages(openAIRequest.messages);
    
    const request: AntigravityRequest = {
      project: projectId,
      model: modelId,
      request: {
        contents,
        generationConfig: {
          maxOutputTokens: openAIRequest.max_tokens || 8192,
          temperature: openAIRequest.temperature ?? 0.7,
          topP: openAIRequest.top_p ?? 0.95
        }
      },
      userAgent: 'antigravity',
      requestId: this.generateRequestId()
    };

    if (systemInstruction) {
      request.request.systemInstruction = systemInstruction;
    }

    // Add thinking config for thinking models
    if (modelId.includes('thinking')) {
      const thinkingBudget = this.getThinkingBudget(modelId);
      request.request.generationConfig!.thinkingConfig = {
        thinkingBudget,
        includeThoughts: true
      };
      // maxOutputTokens must be greater than thinkingBudget
      if (request.request.generationConfig!.maxOutputTokens! <= thinkingBudget) {
        request.request.generationConfig!.maxOutputTokens = thinkingBudget + 4000;
      }
    }

    return request;
  }

  private mapModelId(openAIModel: string): string {
    // Remove 'antigravity-' prefix if present
    const modelId = openAIModel.replace('antigravity-', '');
    
    const modelMap: Record<string, string> = {
      'gemini-3-pro-high': 'gemini-3-pro-high',
      'gemini-3-pro-low': 'gemini-3-pro-low',
      'gemini-3-flash': 'gemini-3-flash',
      'claude-sonnet-4-5': 'claude-sonnet-4-5',
      'claude-sonnet-4-5-thinking-low': 'claude-sonnet-4-5-thinking',
      'claude-sonnet-4-5-thinking-medium': 'claude-sonnet-4-5-thinking',
      'claude-sonnet-4-5-thinking-high': 'claude-sonnet-4-5-thinking',
      'claude-opus-4-5-thinking-low': 'claude-opus-4-5-thinking',
      'claude-opus-4-5-thinking-medium': 'claude-opus-4-5-thinking',
      'claude-opus-4-5-thinking-high': 'claude-opus-4-5-thinking'
    };

    return modelMap[modelId] || modelId;
  }

  private getThinkingBudget(modelId: string): number {
    if (modelId.includes('low')) return 8000;
    if (modelId.includes('medium')) return 16000;
    if (modelId.includes('high')) return 32000;
    return 16000;
  }

  private transformMessages(messages: OpenAIMessage[]): {
    contents: AntigravityContent[];
    systemInstruction?: { parts: { text: string }[] };
  } {
    const contents: AntigravityContent[] = [];
    let systemInstruction: { parts: { text: string }[] } | undefined;

    for (const msg of messages) {
      // Handle content that might be string or array (OpenAI format)
      const textContent = this.extractTextContent(msg.content);
      
      if (msg.role === 'system') {
        systemInstruction = {
          parts: [{ text: textContent }]
        };
      } else {
        // Map 'assistant' to 'model' for Antigravity API
        const role = msg.role === 'assistant' ? 'model' : 'user';
        contents.push({
          role,
          parts: [{ text: textContent }]
        });
      }
    }

    return { contents, systemInstruction };
  }

  private extractTextContent(content: string | any[] | any): string {
    // If content is a string, return it directly
    if (typeof content === 'string') {
      return content;
    }
    
    // If content is an array (OpenAI's content array format)
    if (Array.isArray(content)) {
      const textParts: string[] = [];
      for (const part of content) {
        if (typeof part === 'string') {
          textParts.push(part);
        } else if (part && typeof part === 'object') {
          // Handle { type: 'text', text: '...' } format
          if (part.type === 'text' && part.text) {
            textParts.push(part.text);
          }
          // Handle { text: '...' } format
          else if (part.text) {
            textParts.push(part.text);
          }
        }
      }
      return textParts.join('\n');
    }
    
    // If content is an object with text property
    if (content && typeof content === 'object' && content.text) {
      return content.text;
    }
    
    // Fallback: stringify
    return String(content || '');
  }

  private generateRequestId(): string {
    // Generate UUID v4 style ID
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `agent-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  getHeaders(accessToken: string, isStreaming: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': ANTIGRAVITY_CONFIG.userAgent,
      'X-Goog-Api-Client': ANTIGRAVITY_CONFIG.apiClient,
      'Client-Metadata': JSON.stringify({
        ideType: 'IDE_UNSPECIFIED',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI'
      })
    };

    if (isStreaming) {
      headers['Accept'] = 'text/event-stream';
    }

    return headers;
  }
}
