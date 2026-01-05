import * as http from 'http';
import * as https from 'https';
import { IncomingMessage, ServerResponse } from 'http';
import { AccountManager } from '../account/AccountManager';
import { ResilienceEngine, RequestResult } from '../account/ResilienceEngine';
import { RequestTransformer } from '../transform/RequestTransformer';
import { ResponseTransformer } from '../transform/ResponseTransformer';
import { 
  OpenAIChatRequest, 
  ANTIGRAVITY_CONFIG, 
  AVAILABLE_MODELS,
  GoogleAccount 
} from '../types';

export class ProxyServer {
  private server: http.Server | null = null;
  private requestTransformer: RequestTransformer;
  private responseTransformer: ResponseTransformer;
  private resilienceEngine: ResilienceEngine;

  constructor(
    private accountManager: AccountManager,
    private port: number = 8787
  ) {
    this.requestTransformer = new RequestTransformer();
    this.responseTransformer = new ResponseTransformer();
    this.resilienceEngine = new ResilienceEngine(accountManager);
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch(err => {
          console.error('Request handler error:', err);
          this.sendError(res, 500, 'Internal server error');
        });
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.port} is already in use`));
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        console.log(`Proxy server listening on http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    console.log(`[Proxy] ${req.method} ${req.url}`);
    
    // CORS headers - allow all headers from OpenAI SDK and other clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      console.log('[Proxy] Handling OPTIONS preflight');
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${this.port}`);
    const path = url.pathname;

    if (path === '/v1/models' && req.method === 'GET') {
      console.log('[Proxy] Handling /v1/models');
      await this.handleModels(res);
    } else if (path === '/v1/chat/completions' && req.method === 'POST') {
      console.log('[Proxy] Handling /v1/chat/completions');
      await this.handleChatCompletions(req, res);
    } else {
      console.log(`[Proxy] 404 Not found: ${path}`);
      this.sendError(res, 404, 'Not found');
    }
  }

  private async handleModels(res: ServerResponse): Promise<void> {
    const models = AVAILABLE_MODELS.map(m => ({
      id: m.id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'google',
      permission: [],
      root: m.id,
      parent: null
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ object: 'list', data: models }));
  }

  private async handleChatCompletions(req: IncomingMessage, res: ServerResponse): Promise<void> {
    console.log('[Proxy] Reading request body...');
    const body = await this.readBody(req);
    console.log('[Proxy] Request body length:', body.length);
    
    let request: OpenAIChatRequest;
    
    try {
      request = JSON.parse(body);
      console.log('[Proxy] Parsed request, model:', request.model, 'streaming:', request.stream);
    } catch (e) {
      console.error('[Proxy] Invalid JSON body');
      this.sendError(res, 400, 'Invalid JSON body');
      return;
    }

    const isStreaming = request.stream === true;

    console.log('[Proxy] Executing with retry...');
    const result = await this.resilienceEngine.executeWithRetry<any>(
      async (account: GoogleAccount) => {
        console.log('[Proxy] Making request with account:', account.email);
        return this.makeAntigravityRequest(account, request, isStreaming, res);
      }
    );

    console.log('[Proxy] Result:', result.success, result.statusCode);
    if (!result.success && !isStreaming) {
      this.sendError(res, result.statusCode || 500, result.error?.message || 'Request failed');
    }
  }

  private async makeAntigravityRequest(
    account: GoogleAccount,
    request: OpenAIChatRequest,
    isStreaming: boolean,
    res: ServerResponse
  ): Promise<RequestResult<any>> {
    const antigravityRequest = this.requestTransformer.transformToAntigravity(request, account.projectId);
    const headers = this.requestTransformer.getHeaders(account.accessToken, isStreaming);
    const endpoint = ANTIGRAVITY_CONFIG.endpoints.daily;
    const apiPath = isStreaming ? ANTIGRAVITY_CONFIG.paths.stream : ANTIGRAVITY_CONFIG.paths.generate;

    return new Promise((resolve) => {
      const url = new URL(`${endpoint}${apiPath}`);
      const body = JSON.stringify(antigravityRequest);

      console.log('[Proxy] Making HTTPS request to:', url.hostname, url.pathname);

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const apiReq = https.request(options, (apiRes) => {
        console.log('[Proxy] API response status:', apiRes.statusCode);
        
        if (apiRes.statusCode === 429) {
          let errorText = '';
          apiRes.on('data', (chunk) => errorText += chunk);
          apiRes.on('end', () => {
            resolve({
              success: false,
              statusCode: 429,
              retryAfter: this.resilienceEngine.parseRetryAfter(errorText),
              error: new Error('Rate limited')
            });
          });
          return;
        }

        if (apiRes.statusCode && apiRes.statusCode >= 400) {
          let errorText = '';
          apiRes.on('data', (chunk) => errorText += chunk);
          apiRes.on('end', () => {
            console.error('[Proxy] API error response:', apiRes.statusCode, errorText.substring(0, 500));
            resolve({
              success: false,
              statusCode: apiRes.statusCode || 500,
              error: new Error(errorText)
            });
          });
          return;
        }

        if (isStreaming) {
          this.handleNodeStreamingResponse(apiRes, request.model, res);
          resolve({ success: true, data: null });
        } else {
          let responseData = '';
          apiRes.on('data', (chunk) => responseData += chunk);
          apiRes.on('end', () => {
            try {
              const data = JSON.parse(responseData);
              const transformed = this.responseTransformer.transformFromAntigravity(data, request.model);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(transformed));
              resolve({ success: true, data: null });
            } catch (e) {
              resolve({
                success: false,
                statusCode: 500,
                error: new Error('Failed to parse response')
              });
            }
          });
        }
      });

      apiReq.on('error', (error) => {
        console.error('[Proxy] HTTPS request error:', error);
        resolve({
          success: false,
          statusCode: 500,
          error: error as Error
        });
      });

      apiReq.write(body);
      apiReq.end();
    });
  }

  private handleNodeStreamingResponse(
    apiRes: http.IncomingMessage,
    model: string,
    res: ServerResponse
  ): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    let buffer = '';
    let chunkIndex = 0;

    apiRes.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const transformedChunk = this.responseTransformer.transformStreamChunk(trimmed, model, chunkIndex);
        if (transformedChunk) {
          res.write(this.responseTransformer.formatSSEChunk(transformedChunk));
          chunkIndex++;
        }
      }
    });

    apiRes.on('end', () => {
      res.write(this.responseTransformer.formatSSEDone());
      res.end();
    });

    apiRes.on('error', (err) => {
      console.error('Streaming error:', err);
      res.end();
    });
  }

  private async readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  private sendError(res: ServerResponse, statusCode: number, message: string): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        message,
        type: 'api_error',
        code: statusCode
      }
    }));
  }
}
