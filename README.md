# Obsidian Antigravity Auth Plugin

Bridge **Obsidian Copilot** with Google's **Antigravity API** for FREE access to Gemini 3 and Claude models using your Google account.

## Features

- **Google OAuth Sign-in** with automatic token refresh
- **Multi-Account Support** - Add multiple Google accounts for higher quotas
- **Auto-Rotation** - Automatically rotates accounts when rate-limited
- **OpenAI-Compatible Proxy** - Local server compatible with Obsidian Copilot
- **SSE Streaming** - Real-time streaming responses
- **Extended Thinking** - Support for Claude thinking models

## Available Models

| Model | Description |
|-------|-------------|
| `antigravity-gemini-3-pro-high` | Gemini 3 Pro with high thinking |
| `antigravity-gemini-3-pro-low` | Gemini 3 Pro with low thinking |
| `antigravity-gemini-3-flash` | Gemini 3 Flash (fast) |
| `antigravity-claude-sonnet-4-5` | Claude Sonnet 4.5 |
| `antigravity-claude-sonnet-4-5-thinking-*` | Claude Sonnet with thinking (low/medium/high) |
| `antigravity-claude-opus-4-5-thinking-*` | Claude Opus with thinking (low/medium/high) |

## Installation

### Manual Installation

1. Download the latest release (`main.js`, `manifest.json`)
2. Create folder: `<vault>/.obsidian/plugins/obsidian-antigravity-auth/`
3. Copy files to the folder
4. Enable the plugin in Obsidian Settings → Community Plugins

### From Source

```bash
git clone <this-repo>
cd obsidian-antigravity-auth
bun install
bunx esbuild src/main.ts --bundle --outfile=main.js --format=cjs --platform=node --target=es2018 --external:obsidian --external:electron

# Copy to your vault
cp main.js manifest.json <vault>/.obsidian/plugins/obsidian-antigravity-auth/
```

## Setup

### 1. Add Google Account

1. Go to Plugin Settings → Antigravity Auth
2. Click "**+ Add Google Account**"
3. Login with your Google account in the browser
4. Account will be added automatically

### 2. Configure Obsidian Copilot

1. Go to Copilot Settings → Model section
2. Set **API Base URL**: `http://localhost:8787/v1`
3. Set **API Key**: `unused` (any value works)
4. Select a model from the dropdown

### 3. Start Using

The proxy starts automatically. You can now use Copilot with FREE Gemini/Claude access!

## Commands

| Command | Description |
|---------|-------------|
| `Antigravity: Start Proxy` | Start the local proxy server |
| `Antigravity: Stop Proxy` | Stop the proxy server |
| `Antigravity: Add Account` | Add a new Google account |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **OAuth Client ID** | (pre-configured) | Optional: Use your own Google OAuth credentials |
| **OAuth Client Secret** | (pre-configured) | Optional: Use your own Google OAuth credentials |
| **Proxy Port** | 8787 | Port for the local proxy server |
| **Default Model** | gemini-3-pro-high | Model when none specified |
| **Auto-start Proxy** | Enabled | Start proxy on Obsidian load |
| **Enable Logging** | Disabled | Log requests for debugging |
| **Max Retries** | 3 | Retry attempts on rate limit |

> **Note**: OAuth credentials are pre-configured and work out of the box. You only need to provide your own if the defaults stop working.

## Multi-Account

Add multiple Google accounts for higher quotas:

- **Sticky Selection** - Stays on one account until rate-limited
- **Auto-Rotation** - Switches to next account on 429 error
- **Status Indicators** - Green (active), Orange (rate-limited), Red (error)

## Architecture

```
Obsidian Copilot → Proxy Server (localhost:8787)
                        ↓
                  Request Transformer (OpenAI → Antigravity)
                        ↓
                  Account Manager (select/rotate)
                        ↓
                  Resilience Engine (retry on 429)
                        ↓
                  Google Antigravity API
                        ↓
                  Response Transformer (Antigravity → OpenAI)
                        ↓
                  Streaming response to Copilot
```

## Troubleshooting

### "No accounts available"
Add a Google account in plugin settings.

### "Port already in use"
Change the port in settings or stop other services using port 8787.

### "Rate limited on all accounts"
Wait for rate limits to expire or add more accounts.

### "Token expired"
Plugin auto-refreshes tokens. If persistent, remove and re-add the account.

### Using Your Own OAuth Credentials (Optional)

If the default credentials stop working, you can create your own:

1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable required APIs (Cloud Resource Manager, Service Usage)
4. Create OAuth consent screen (External)
5. Add required scopes
6. Create OAuth credentials (Desktop app)
7. Copy Client ID and Secret to plugin settings

## Credits

Based on [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) by [@NoeFabris](https://github.com/NoeFabris).

## License

MIT
