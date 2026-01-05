# OBSIDIAN ANTIGRAVITY AUTH - PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-05 21:39:17  
**Not a git repository** (consider `git init`)  
**Type:** Obsidian Plugin + Local Proxy Server

## OVERVIEW

Bridge Obsidian Copilot với Google Antigravity API để dùng FREE Gemini 3 và Claude models qua Google account của bạn.

**Stack:** TypeScript + Node.js http server + esbuild + Obsidian Plugin API

## STRUCTURE

```
obsidian-antigravity-auth/
├── src/
│   ├── main.ts                    # Plugin entry, lifecycle management
│   ├── types/index.ts             # All type definitions, constants, configs
│   ├── account/                   # Account + resilience
│   │   ├── AccountManager.ts      # Multi-account, rotation, token refresh
│   │   └── ResilienceEngine.ts    # Retry logic, rate limit handling
│   ├── auth/OAuthManager.ts       # Google OAuth flow (PKCE)
│   ├── proxy/ProxyServer.ts       # Local HTTP server (OpenAI-compatible)
│   ├── transform/                 # Request/response conversion
│   │   ├── RequestTransformer.ts  # OpenAI format → Antigravity format
│   │   └── ResponseTransformer.ts # Antigravity → OpenAI (+ SSE streaming)
│   └── ui/SettingsTab.ts          # Obsidian settings UI
├── esbuild.config.mjs             # ESBuild bundler (dev watch + prod)
├── manifest.json                  # Obsidian plugin manifest
├── versions.json                  # Plugin version compatibility map
└── main.js                        # Bundled output (NOT committed, generated)
```

## WHERE TO LOOK

| Task                                          | Location                              |
|-----------------------------------------------|---------------------------------------|
| Add/modify models                             | `types/index.ts` → AVAILABLE_MODELS   |
| Change OAuth credentials                      | `types/index.ts` → DEFAULT_SETTINGS   |
| Fix account rotation logic                    | `account/AccountManager.ts`           |
| Fix rate limit handling                       | `account/ResilienceEngine.ts`         |
| Add retry strategies                          | `account/ResilienceEngine.ts`         |
| Fix OAuth flow issues                         | `auth/OAuthManager.ts`                |
| Modify proxy endpoints                        | `proxy/ProxyServer.ts`                |
| Fix OpenAI → Antigravity conversion           | `transform/RequestTransformer.ts`     |
| Fix streaming/response issues                 | `transform/ResponseTransformer.ts`    |
| Add settings fields                           | `ui/SettingsTab.ts`                   |
| Modify plugin lifecycle (load/unload)         | `main.ts`                             |
| Add/change API endpoints                      | `types/index.ts` → ANTIGRAVITY_CONFIG |
| Change thinking budgets (low/medium/high)     | `transform/RequestTransformer.ts`     |
| Fix SSE streaming format                      | `transform/ResponseTransformer.ts`    |

## CONVENTIONS

### Code Style
- **NO tests configured** — viết code cẩn thận, test manually trong Obsidian
- Strict TypeScript: `noImplicitAny`, `strictNullChecks` enabled
- Optional chaining (`?.`) và nullish coalescing (`??`) preferred
- Error handling: try-catch với Notice() để thông báo user

### Naming
- Manager suffix cho classes quản lý state (`AccountManager`, `OAuthManager`)
- Transformer suffix cho data conversion (`RequestTransformer`, `ResponseTransformer`)
- Engine suffix cho orchestration logic (`ResilienceEngine`)

### Token Refresh
- Auto-refresh 5 phút trước khi expire (`AccountManager.scheduleTokenRefresh`)
- NEVER block user flow — refresh trong background
- Mark account 'expired' nếu refresh fail

### Rate Limit Handling
- Sticky account selection — chỉ rotate khi 429
- Parse retry time từ error message: `"reset after 3s"` hoặc `"reset after 500ms"`
- Default 60s nếu không parse được
- Rotate qua tất cả accounts trước khi báo "all rate limited"

## ANTI-PATTERNS (THIS PROJECT)

### NEVER
- **NEVER** commit `main.js` — đây là generated file (gitignore'd)
- **NEVER** hardcode credentials — dùng settings system
- **NEVER** block plugin load nếu proxy fail — plugin vẫn phải load được
- **NEVER** throw uncaught errors trong proxy request handlers — luôn catch và send error response
- **NEVER** expose refresh tokens trong logs — security risk
- **NEVER** modify OAuth scopes without understanding Antigravity requirements

### ALWAYS
- **ALWAYS** validate account exists trước khi dùng (`getActiveAccount()` có thể null)
- **ALWAYS** cleanup timers/servers trong `onunload()` — prevent memory leaks
- **ALWAYS** handle both streaming và non-streaming responses
- **ALWAYS** preserve thinking output cho thinking models (flag `includeThoughts: true`)
- **ALWAYS** close HTTP server gracefully (`server.close()`)

### DEPRECATED
- OAuth without PKCE — project dùng PKCE (code_challenge)
- Blocking refresh — dùng scheduled background refresh thay vì refresh on-demand

## UNIQUE STYLES

### Model ID Mapping
- User-facing: `antigravity-gemini-3-pro-high`
- API actual: `gemini-3-pro-high`
- Thinking variants map to base: `claude-sonnet-4-5-thinking-{low|medium|high}` → `claude-sonnet-4-5-thinking`

### Thinking Budget
- Low: 8000 tokens
- Medium: 16000 tokens
- High: 32000 tokens
- **CRITICAL:** `maxOutputTokens` MUST be > `thinkingBudget`, auto-adjust nếu không đủ

### OpenAI Compatibility
- `/v1/models` endpoint → returns AVAILABLE_MODELS
- `/v1/chat/completions` endpoint → proxy to Antigravity
- SSE format: `data: {json}\n\n` và kết thúc bằng `data: [DONE]\n\n`
- Role mapping: `assistant` (OpenAI) ↔ `model` (Antigravity)

### Multi-Account Strategy
- **Sticky selection** — không round-robin, stick với 1 account cho đến khi rate limited
- **Auto-rotation on 429** — ResilienceEngine tự động rotate sang account khác
- **Status indicators:** Green (active), Orange (rate_limited), Red (expired/error)

## COMMANDS

```bash
# Development
bun run dev              # Watch mode với sourcemaps

# Production build
bun run build            # TypeScript check + esbuild bundle

# Version bump
bun run version          # Auto-update manifest.json + versions.json

# Install to vault (manual)
cp main.js manifest.json <vault>/.obsidian/plugins/obsidian-antigravity-auth/
```

## CRITICAL NOTES

### OAuth Credentials
- Default credentials hardcoded trong `types/index.ts`
- User có thể override trong settings nếu muốn dùng own credentials
- **Redirect URI:** `http://localhost:51121` (fixed port)
- Callback server timeout: 5 phút

### Proxy Server
- Binds to `127.0.0.1` only — local access only
- Default port: 8787
- Supports CORS (wildcard origin)
- **Port conflict:** Show error nếu port đã bị chiếm

### Project Discovery
- Mỗi Google account có 1 project ID (auto-discovered via `loadCodeAssist` endpoint)
- Project ID dùng trong mỗi request → `request.project` field
- Format: `projects/{project-id}/locations/{location}` → extract `{project-id}`

### Antigravity API Quirks
- User-Agent REQUIRED: `antigravity/1.11.5 windows/amd64`
- X-Goog-Api-Client REQUIRED: `google-cloud-sdk vscode_cloudshelleditor/0.1`
- System messages → `systemInstruction` field (separate từ `contents`)
- Streaming endpoint khác: `/v1internal:streamGenerateContent?alt=sse`

### Token Lifecycle
- Access token expires sau ~1h
- Refresh token never expires (unless revoked)
- Auto-refresh scheduled 5 phút trước expire
- **CRITICAL:** Stop timers trong `dispose()` để prevent memory leak

### NO CI/CD
- Không có GitHub Actions
- Không có automated tests
- Build manually trước khi release
- Version bumping: `npm run version` để update manifest

## GOTCHAS

1. **Obsidian Plugin API externals** — esbuild config excludes `obsidian`, `electron`, `@codemirror/*`, `@lezer/*` → NEVER bundle these
2. **Thinking models maxOutputTokens constraint** — API rejects nếu `maxOutputTokens <= thinkingBudget`, auto-fix bằng `thinkingBudget + 4000`
3. **SSE chunk filtering** — Filter out `thought` parts (chỉ giữ `text` parts), prevent exposing internal reasoning
4. **Rate limit expiry auto-clear** — `isRateLimited()` tự clear expired rate limits, không cần manual cleanup
5. **Account persistence** — Save accounts qua `saveCallback` sau mỗi change (add/remove/status update)
6. **First account auto-select** — `currentAccountEmail` auto-set to first account khi load
7. **Proxy auto-start** — Nếu `autoStartProxy: true` và có ≥1 account, proxy start on plugin load
8. **PKCE code_verifier storage** — Stored trong `OAuthManager` instance (cleared after token exchange), NEVER persisted

## COMMON TASKS

### Add New Model
1. Add to `AVAILABLE_MODELS` trong `types/index.ts`
2. Update `mapModelId()` trong `RequestTransformer.ts` nếu cần mapping
3. Update README model table

### Change Thinking Budget
Modify `getThinkingBudget()` trong `RequestTransformer.ts`:
```ts
if (modelId.includes('low')) return 8000;
if (modelId.includes('medium')) return 16000;
if (modelId.includes('high')) return 32000;
```

### Add New Settings Field
1. Add to `PluginSettings` interface trong `types/index.ts`
2. Add to `DEFAULT_SETTINGS` trong `types/index.ts`
3. Add UI control trong `SettingsTab.ts` → `createSettingsSection()`
4. Handle trong `updateSettings()` callback nếu cần side effects

### Debug Rate Limiting
- Check `AccountManager.markRateLimited()` calls
- Check `ResilienceEngine.parseRetryAfter()` regex
- Enable logging: settings → "Enable Logging" toggle
- Check console: `console.log()` statements trong proxy handlers

### Fix OAuth Issues
- Check redirect URI matches `http://localhost:51121/oauth-callback` exactly (CÓ PATH!)
- Check scopes trong `OAUTH_CONFIG.scopes` (types/index.ts)
- Check PKCE code_verifier/code_challenge generation
- Check state validation trong callback
- Test project discovery endpoint separately

### Source Recommended (inspired by)
- https://github.com/NoeFabris/opencode-antigravity-auth

---

## ⚠️ CRITICAL LESSONS LEARNED (Session 2026-01-06)

### 🔴 ELECTRON/OBSIDIAN ENVIRONMENT - CORS HELL

**NEVER use `fetch()` for external API calls in Obsidian plugins!**

```typescript
// ❌ WRONG - Browser CORS will BLOCK this even in plugin
const response = await fetch('https://external-api.com/endpoint', {...});

// ✅ CORRECT - Use Node.js https module (no CORS)
import * as https from 'https';
const apiReq = https.request(options, (apiRes) => {...});
```

**Why:** Obsidian runs in Electron renderer process. Even though Node.js APIs are available, `fetch()` goes through Chromium's network stack which enforces CORS. External APIs (Google, etc.) don't have `Access-Control-Allow-Origin` headers → blocked.

**Solution:** Use Node.js `http`/`https` modules which bypass browser security entirely.

### 🔴 OAUTH REDIRECT URI - PATH MATTERS!

```typescript
// ❌ WRONG - Missing path
redirect_uri: 'http://localhost:51121'

// ✅ CORRECT - Must include /oauth-callback
redirect_uri: 'http://localhost:51121/oauth-callback'
```

The redirect URI in authorization request MUST EXACTLY MATCH the one in token exchange. Google will reject with `redirect_uri_mismatch` if different.

### 🔴 OAUTH CREDENTIALS - USE THE RIGHT ONES

**Current working credentials (from NoeFabris repo):**
```typescript
oauthClientId: '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com'
oauthClientSecret: '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'
```

If OAuth fails with `deleted_client` error → credentials were revoked. Check NoeFabris repo for updated ones.

### 🔴 PROJECT DISCOVERY - MULTIPLE FORMATS

API returns project ID in different formats:
```typescript
// Format 1: Full path (older accounts)
"cloudAICompanionProject": "projects/xxx-yyy-zzz/locations/us"
// → Extract: "xxx-yyy-zzz"

// Format 2: Direct ID (newer accounts) 
"cloudaicompanionProject": "ethereal-manifest-spqvw"
// → Use directly: "ethereal-manifest-spqvw"
```

**Must handle BOTH formats!** Check for `projects/` prefix, if not present use value directly.

**Default fallback:** `rising-fact-p41fc` (when discovery fails)

### 🔴 PORT CONFLICTS - EADDRINUSE

OAuth callback server (port 51121) can get stuck if:
- Previous login attempt failed/timed out
- Plugin reloaded without proper cleanup

**Fix:**
```typescript
async startCallbackServer() {
  this.stopCallbackServer(); // ALWAYS stop first!
  
  this.server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      reject(new Error('Port already in use. Restart Obsidian.'));
    }
  });
}
```

### 🔴 OPENAI CONTENT FORMAT - NOT ALWAYS STRING

Copilot sends content in multiple formats:
```typescript
// Format 1: Simple string
{ role: 'user', content: 'Hello' }

// Format 2: Array of parts (common!)
{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }

// Format 3: Just array of objects
{ role: 'user', content: [{ text: 'Hello' }] }
```

**MUST use `extractTextContent()` to normalize before sending to Antigravity API!**

### 🔴 CORS HEADERS FOR INCOMING REQUESTS

Obsidian Copilot uses OpenAI SDK which sends custom headers like `x-stainless-os`.

```typescript
// ❌ WRONG - Too restrictive
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

// ✅ CORRECT - Allow all headers
res.setHeader('Access-Control-Allow-Headers', '*');
```

### 🔴 SETTINGS TAB REFRESH

After adding account or starting proxy, settings tab doesn't auto-refresh.

**Fix:** Add `refresh()` method and call it after state changes:
```typescript
// In SettingsTab.ts
refresh(): void {
  this.display();
}

// In main.ts after login success
this.settingsTab.refresh();
```

---

## DEBUGGING CHECKLIST

When something doesn't work, check in this order:

1. **Console logs** (Ctrl+Shift+I) - Look for `[Proxy]` messages
2. **Network tab** - Are requests reaching proxy?
3. **API response status** - 200? 400? 429?
4. **Error message content** - Google's error messages are descriptive

### Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `deleted_client` | OAuth credentials revoked | Update credentials from NoeFabris repo |
| `redirect_uri_mismatch` | URI doesn't match exactly | Add `/oauth-callback` path |
| `EADDRINUSE` | Port 51121 stuck | Restart Obsidian |
| `CORS policy` on external fetch | Using `fetch()` for API | Switch to `https.request()` |
| `Unknown name "text"` | Content format wrong | Use `extractTextContent()` |
| `Could not extract project ID` | Regex doesn't match | Handle direct ID format |

---

## FILE QUICK REFERENCE (Updated)

| Issue | File | Function/Line |
|-------|------|---------------|
| OAuth credentials | `types/index.ts` | `DEFAULT_SETTINGS` |
| Redirect URI path | `types/index.ts` | `OAUTH_CONFIG.redirectPath` |
| Project discovery | `auth/OAuthManager.ts` | `discoverProject()` |
| Default project ID | `types/index.ts` | `ANTIGRAVITY_CONFIG.defaultProjectId` |
| HTTPS requests (no CORS) | `proxy/ProxyServer.ts` | `makeAntigravityRequest()` |
| Content extraction | `transform/RequestTransformer.ts` | `extractTextContent()` |
| CORS headers | `proxy/ProxyServer.ts` | `handleRequest()` |
| Port conflict handling | `auth/OAuthManager.ts` | `startCallbackServer()` |

---

## 🔧 ANTIGRAVITY API REQUEST FORMAT

### Request Structure (CRITICAL)
```typescript
{
  project: "ethereal-manifest-spqvw",  // Project ID, NOT full path
  model: "gemini-3-flash",              // Model ID without "antigravity-" prefix
  request: {
    contents: [
      {
        role: "user",  // or "model" for assistant
        parts: [{ text: "Hello" }]  // MUST be array of {text: string}
      }
    ],
    systemInstruction: {  // Optional, separate from contents
      parts: [{ text: "You are a helpful assistant" }]
    },
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.7,
      topP: 0.95,
      thinkingConfig: {  // Only for thinking models
        thinkingBudget: 16000,
        includeThoughts: true
      }
    }
  },
  userAgent: "antigravity",
  requestId: "agent-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### Common Mistakes
| Mistake | Correct |
|---------|---------|
| `parts: [{ text: ["Hello"] }]` | `parts: [{ text: "Hello" }]` |
| `role: "assistant"` | `role: "model"` |
| `project: "projects/xxx/..."` | `project: "xxx"` (just the ID) |
| `model: "antigravity-gemini-3-flash"` | `model: "gemini-3-flash"` |

---

## 🔧 FETCH VS HTTPS MODULE

### When fetch() is OK:
- **Google OAuth token endpoint** (`oauth2.googleapis.com`) - has CORS headers
- **Google userinfo endpoint** (`googleapis.com/oauth2/v2/userinfo`) - has CORS headers

### When MUST use https module:
- **Antigravity API** (`daily-cloudcode-pa.sandbox.googleapis.com`) - NO CORS headers
- **Any Google Cloud internal API** - NO CORS headers

### Pattern:
```typescript
// OAuth (fetch OK - Google adds CORS headers for OAuth)
const response = await fetch(OAUTH_CONFIG.tokenUrl, {...});

// Antigravity API (MUST use https)
const apiReq = https.request(options, (apiRes) => {...});
```

---

## 🔧 STREAMING RESPONSE HANDLING

### SSE Format from Antigravity:
```
data: {"response":{"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}}

data: {"response":{"candidates":[{"content":{"parts":[{"text":" world"}]}}]}}

data: [DONE]
```

### SSE Format to OpenAI (Copilot expects):
```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"}}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":" world"}}]}

data: [DONE]
```

### Key Points:
1. **Buffer accumulation** - chunks may not be complete JSON lines
2. **Line splitting** - split by `\n`, keep incomplete line in buffer
3. **Filter `data:` prefix** - only process lines starting with `data:`
4. **Transform each chunk** - Antigravity format → OpenAI format

---

## 🔧 CONSOLE LOGGING CONVENTION

All proxy logs use `[Proxy]` prefix for easy filtering:

```typescript
console.log('[Proxy] POST /v1/chat/completions');
console.log('[Proxy] Making request with account:', account.email);
console.log('[Proxy] API response status:', apiRes.statusCode);
console.error('[Proxy] API error response:', statusCode, errorText);
```

**Debug Steps:**
1. Open DevTools: `Ctrl+Shift+I`
2. Filter console by `[Proxy]`
3. Trace request flow

---

## 🔧 ACCOUNT PERSISTENCE

Accounts are stored in Obsidian's plugin data:
```
<vault>/.obsidian/plugins/obsidian-antigravity-auth/data.json
```

Structure:
```json
{
  "settings": {
    "proxyPort": 8787,
    "defaultModel": "antigravity-gemini-3-pro-high",
    "autoStartProxy": true,
    ...
  },
  "accounts": [
    {
      "email": "user@gmail.com",
      "accessToken": "ya29.xxx...",
      "refreshToken": "1//xxx...",
      "expiresAt": 1704500000000,
      "projectId": "ethereal-manifest-spqvw",
      "status": "active",
      "lastUsed": 1704499000000
    }
  ]
}
```

**NEVER** commit or share this file - contains sensitive tokens!

---

## 🔧 COPILOT CONFIGURATION

In Obsidian Copilot settings:

| Setting | Value |
|---------|-------|
| API Base URL | `http://localhost:8787/v1` |
| API Key | `unused` (or any string) |
| Model | Select from dropdown (plugin populates via `/v1/models`) |
| CORS Mode | ✅ Enable (checkbox must be checked!) |

**If CORS checkbox is not checked, Copilot won't send requests correctly!**

---

## 📦 BUILD OUTPUT

After `bun run build` or `bun esbuild.config.mjs production`:

| File | Size | Description |
|------|------|-------------|
| `main.js` | ~47KB | Bundled plugin (minified) |
| `manifest.json` | ~500B | Plugin metadata |

Copy both to vault's plugin folder:
```bash
cp main.js manifest.json <vault>/.obsidian/plugins/obsidian-antigravity-auth/
```

---

## 🚨 IF PLUGIN BREAKS

### Quick Recovery Steps:
1. **Delete plugin data**: Remove `data.json` from plugin folder
2. **Rebuild**: `bun esbuild.config.mjs production`
3. **Restart Obsidian** completely (not just reload)
4. **Re-add account**: Click "Add Google Account" in settings

### If OAuth fails:
1. Check credentials in `types/index.ts` → `DEFAULT_SETTINGS`
2. Verify NoeFabris repo hasn't updated credentials
3. Clear port 51121 if stuck (restart Obsidian)

### If API calls fail:
1. Check `[Proxy]` logs in console
2. Verify account status (green = active)
3. Check API error message for hints
4. Try different endpoint (daily/prod/autopush)

---

## 📋 VERSION HISTORY

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| v1.0.0-working | 2026-01-06 | ✅ WORKING | First fully working version. All features functional. |

**Git Tag:** `v1.0.0-working` - Use this to revert if things break!

---

## 🚧 MISSING FEATURES (vs NoeFabris repo)

### Gemini CLI Dual Quota System - NOT IMPLEMENTED

**What it is:** NoeFabris repo has a "Dual Quota System" that doubles effective quota for Gemini models by using BOTH Antigravity quota AND Gemini CLI quota per account.

**Current behavior (this plugin):**
```
Account 1 (Antigravity) → 429 → Account 2 (Antigravity) → 429 → ERROR
```

**NoeFabris behavior:**
```
Account 1 (Antigravity) → 429 → Account 1 (Gemini CLI) → 429 → Account 2 (Antigravity) → 429 → Account 2 (Gemini CLI) → Success!
```

**Feature comparison:**

| Feature             | NoeFabris repo | This plugin  |
|---------------------|----------------|--------------|
| Account rotation    | ✅             | ✅           |
| Antigravity quota   | ✅             | ✅           |
| Gemini CLI quota    | ✅             | ❌ NOT IMPLEMENTED |
| Dual quota fallback | ✅             | ❌ NOT IMPLEMENTED |

**To implement this, you would need:**
1. Add Gemini CLI headers to `types/index.ts`:
   ```typescript
   export const GEMINI_CLI_HEADERS = {
     "User-Agent": "google-api-nodejs-client/9.15.1",
     "X-Goog-Api-Client": "gl-node/22.17.0",
     "Client-Metadata": "ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI",
   };
   ```
2. Modify `GoogleAccount` type to track separate rate limits:
   ```typescript
   rateLimits?: {
     antigravity?: { expiry: number };
     geminiCli?: { expiry: number };
   };
   ```
3. Modify `AccountManager` to track 2 quota types separately
4. Modify `ResilienceEngine` to try Gemini CLI quota before rotating account
5. Modify `ProxyServer` to use appropriate headers based on quota type

**Estimated effort:** 200-300 lines of code changes

**Reference:** See NoeFabris repo files:
- `src/plugin/accounts.ts` → `getAvailableHeaderStyle()`
- `src/plugin.ts` → quota fallback logic (L1135-L1156)
- `src/constants.ts` → `GEMINI_CLI_HEADERS`
