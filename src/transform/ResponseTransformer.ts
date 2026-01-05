import { 
  OpenAIChatResponse, 
  OpenAIStreamChunk, 
  AntigravityResponse 
} from '../types';

export class ResponseTransformer {
  
  transformFromAntigravity(response: AntigravityResponse, model: string): OpenAIChatResponse {
    const candidate = response.response.candidates[0];
    const textParts = candidate?.content?.parts?.filter(p => p.text) || [];
    const text = textParts.map(p => p.text).join('');
    
    return {
      id: response.response.responseId || this.generateId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: text
        },
        finish_reason: this.mapFinishReason(candidate?.finishReason)
      }],
      usage: response.response.usageMetadata ? {
        prompt_tokens: response.response.usageMetadata.promptTokenCount,
        completion_tokens: response.response.usageMetadata.candidatesTokenCount,
        total_tokens: response.response.usageMetadata.totalTokenCount
      } : undefined
    };
  }

  transformStreamChunk(data: string, model: string, index: number): OpenAIStreamChunk | null {
    try {
      // Remove 'data: ' prefix if present
      const jsonStr = data.replace(/^data:\s*/, '').trim();
      if (!jsonStr || jsonStr === '[DONE]') return null;

      const response = JSON.parse(jsonStr);
      const candidate = response.response?.candidates?.[0];
      
      if (!candidate) return null;

      const textParts = candidate.content?.parts?.filter((p: any) => p.text && !p.thought) || [];
      const text = textParts.map((p: any) => p.text).join('');

      return {
        id: response.response?.responseId || this.generateId(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          delta: {
            ...(index === 0 ? { role: 'assistant' } : {}),
            ...(text ? { content: text } : {})
          },
          finish_reason: candidate.finishReason === 'STOP' ? 'stop' : null
        }]
      };
    } catch (e) {
      console.error('Failed to parse stream chunk:', e);
      return null;
    }
  }

  formatSSEChunk(chunk: OpenAIStreamChunk): string {
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }

  formatSSEDone(): string {
    return 'data: [DONE]\n\n';
  }

  private mapFinishReason(reason?: string): 'stop' | 'length' | null {
    switch (reason) {
      case 'STOP': return 'stop';
      case 'MAX_TOKENS': return 'length';
      default: return null;
    }
  }

  private generateId(): string {
    return `chatcmpl-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
  }
}
