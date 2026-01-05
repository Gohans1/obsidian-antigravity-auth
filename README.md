# Obsidian Antigravity Auth

Use **Gemini 3** and **Claude** models for FREE in [Obsidian Copilot](https://github.com/logancyang/obsidian-copilot) via your Google account.

---

## Quick Start

### Step 1: Install Plugin

Download `main.js` and `manifest.json` → Copy to `<vault>/.obsidian/plugins/obsidian-antigravity-auth/` → Enable in Settings.

### Step 2: Add Google Account

![Step 2: Add Google Account](docs/step2-add-account.png)

### Step 3: Configure Copilot

In [Obsidian Copilot](https://github.com/logancyang/obsidian-copilot) settings:

| Setting | Value |
|---------|-------|
| **Provider** | `OpenAI Format` |
| **Model Name** | See [Available Models](#available-models) |
| **Base URL** | `http://localhost:8787/v1` |
| **API Key** | `unused` |

![Step 3: Configure Copilot](docs/step3-copilot-config.png)

### Step 4: Done!

Start chatting. The proxy runs automatically.

![Step 4: Working Demo](docs/step4-demo.gif)

---

## Available Models

| Model ID | Type |
|----------|------|
| `antigravity-gemini-3-pro-high` | Gemini 3 Pro (high thinking) |
| `antigravity-gemini-3-pro-low` | Gemini 3 Pro (low thinking) |
| `antigravity-gemini-3-flash` | Gemini 3 Flash (fast) |
| `antigravity-claude-sonnet-4-5` | Claude Sonnet 4.5 |
| `antigravity-claude-sonnet-4-5-thinking-low` | Claude Sonnet 4.5 + Thinking |
| `antigravity-claude-sonnet-4-5-thinking-medium` | Claude Sonnet 4.5 + Thinking |
| `antigravity-claude-sonnet-4-5-thinking-high` | Claude Sonnet 4.5 + Thinking |
| `antigravity-claude-opus-4-5-thinking-low` | Claude Opus 4.5 + Thinking |
| `antigravity-claude-opus-4-5-thinking-medium` | Claude Opus 4.5 + Thinking |
| `antigravity-claude-opus-4-5-thinking-high` | Claude Opus 4.5 + Thinking |

> Need more models? Check [Antigravity Quota docs](https://github.com/NoeFabris/opencode-antigravity-auth?tab=readme-ov-file#antigravity-quota).

---

## Multi-Account (More Quota)

Add multiple Google accounts → Plugin auto-switches when rate-limited.

![Multi-Account Setup](docs/multi-account.png)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No accounts | Add Google account in plugin settings |
| Port in use | Change port in settings (default: 8787) |
| Rate limited | Wait or add more accounts |
| Token expired | Remove and re-add account |

---

## Credits

Based on [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) by [@NoeFabris](https://github.com/NoeFabris).

## License

MIT
