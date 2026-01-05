import * as http from 'http';
import * as crypto from 'crypto';
import { GoogleAccount, OAUTH_CONFIG, ANTIGRAVITY_CONFIG } from '../types';

export class OAuthManager {
  private server: http.Server | null = null;
  private codeVerifier: string = '';
  private state: string = '';
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    this.codeVerifier = this.base64URLEncode(crypto.randomBytes(32));
    const hash = crypto.createHash('sha256').update(this.codeVerifier).digest();
    const codeChallenge = this.base64URLEncode(hash);
    return { codeVerifier: this.codeVerifier, codeChallenge };
  }

  private base64URLEncode(buffer: Buffer): string {
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  getAuthUrl(): string {
    this.state = crypto.randomBytes(16).toString('hex');
    const { codeChallenge } = this.generatePKCE();
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: `http://localhost:${OAUTH_CONFIG.redirectPort}${OAUTH_CONFIG.redirectPath}`,
      response_type: 'code',
      scope: OAUTH_CONFIG.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: this.state
    });

    return `${OAUTH_CONFIG.authUrl}?${params.toString()}`;
  }

  async startCallbackServer(): Promise<{ code: string; state: string }> {
    // Stop any existing server first
    this.stopCallbackServer();
    
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url || '', `http://localhost:${OAUTH_CONFIG.redirectPort}`);
        
        // Only handle the oauth-callback path
        if (url.pathname !== OAUTH_CONFIG.redirectPath) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        // Send success page
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Authentication Complete</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>${error ? 'Authentication Failed' : 'Authentication Successful!'}</h1>
            <p>${error ? error : 'You can close this window and return to Obsidian.'}</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
          </html>
        `);

        this.stopCallbackServer();

        if (error) {
          reject(new Error(`OAuth error: ${error}`));
        } else if (code && state) {
          resolve({ code, state });
        } else {
          reject(new Error('Invalid OAuth callback'));
        }
      });

      // Handle server errors (like EADDRINUSE)
      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${OAUTH_CONFIG.redirectPort} is already in use. Please restart Obsidian or wait a moment and try again.`));
        } else {
          reject(new Error(`Server error: ${err.message}`));
        }
      });

      this.server.listen(OAUTH_CONFIG.redirectPort, '127.0.0.1', () => {
        console.log(`OAuth callback server listening on port ${OAUTH_CONFIG.redirectPort}`);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.server) {
          this.stopCallbackServer();
          reject(new Error('OAuth timeout'));
        }
      }, 5 * 60 * 1000);
    });
  }

  stopCallbackServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const response = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        code_verifier: this.codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: `http://localhost:${OAUTH_CONFIG.redirectPort}${OAUTH_CONFIG.redirectPath}`
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in
    };
  }

  async getUserInfo(accessToken: string): Promise<{ email: string }> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    const data = await response.json();
    return { email: data.email };
  }

  async discoverProject(accessToken: string): Promise<string> {
    // Try each endpoint in order (prod first, then daily, then autopush)
    for (const endpoint of ANTIGRAVITY_CONFIG.loadEndpoints) {
      try {
        console.log(`Trying project discovery on ${endpoint}...`);
        const response = await fetch(`${endpoint}${ANTIGRAVITY_CONFIG.paths.loadCodeAssist}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': ANTIGRAVITY_CONFIG.userAgent,
            'X-Goog-Api-Client': ANTIGRAVITY_CONFIG.apiClient
          },
          body: JSON.stringify({})
        });

        if (!response.ok) {
          console.log(`Endpoint ${endpoint} returned ${response.status}, trying next...`);
          continue;
        }

        const data = await response.json();
        console.log('Project discovery response:', JSON.stringify(data));
        
        // Extract project ID from response
        // Format can be either:
        // 1. "projects/{project-id}/locations/{location}" - extract from path
        // 2. "ethereal-manifest-spqvw" - direct project ID (no prefix)
        if (data.cloudAICompanionProject || data.cloudaicompanionProject) {
          const projectField = data.cloudAICompanionProject || data.cloudaicompanionProject;
          // Check if it has projects/ prefix
          const match = projectField.match(/projects\/([^\/]+)/);
          if (match) {
            console.log(`Discovered project ID (from path): ${match[1]}`);
            return match[1];
          }
          // Otherwise it's a direct project ID
          console.log(`Discovered project ID (direct): ${projectField}`);
          return projectField;
        }
        
        // Try managedProject field as fallback
        if (data.managedProject) {
          const match = data.managedProject.match(/projects\/([^\/]+)/);
          if (match) {
            console.log(`Discovered managed project ID: ${match[1]}`);
            return match[1];
          }
          // Direct project ID
          console.log(`Discovered managed project ID (direct): ${data.managedProject}`);
          return data.managedProject;
        }
      } catch (error) {
        console.log(`Endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    
    // Fallback to default project ID (for business/workspace accounts)
    console.log(`Project discovery failed on all endpoints, using default: ${ANTIGRAVITY_CONFIG.defaultProjectId}`);
    return ANTIGRAVITY_CONFIG.defaultProjectId;
  }

  async performFullLogin(): Promise<GoogleAccount> {
    // Start callback server
    const callbackPromise = this.startCallbackServer();
    
    // Open browser with auth URL
    const authUrl = this.getAuthUrl();
    require('electron').shell.openExternal(authUrl);

    // Wait for callback
    const { code, state } = await callbackPromise;

    // Validate state
    if (state !== this.state) {
      throw new Error('Invalid OAuth state');
    }

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code);

    // Get user info
    const userInfo = await this.getUserInfo(tokens.accessToken);

    // Discover project
    const projectId = await this.discoverProject(tokens.accessToken);

    return {
      email: userInfo.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + (tokens.expiresIn * 1000),
      projectId,
      status: 'active',
      lastUsed: Date.now()
    };
  }
}
