# markitup-mcp-server

MCP (Model Context Protocol) server for [MarkItUp](https://markitup.app) — AI-powered image annotation and marketing-visual generation. Lets Claude Code, Claude Desktop, Cursor, ChatGPT-with-MCP, and other MCP-compatible clients call MarkItUp directly.

> **Status:** v0.1.0 — pre-release. Five tools available: `markitup_credit_balance`, `markitup_generate`, `markitup_regen`, `markitup_extend`, `markitup_remove_background`.

## Prerequisites

1. A MarkItUp account — sign up at https://markitup.app.
2. A MarkItUp API key — generate one at https://markitup.app/dashboard/api-keys (coming soon — see Status).
3. Node.js 18 or newer (only if installing locally; `npx` doesn't require a local Node.js if your MCP client bundles one).

## Configure in Claude Code

Add to your MCP config (`~/.claude/mcp.json` or project-scoped `.mcp.json`):

```jsonc
{
  "mcpServers": {
    "markitup": {
      "command": "npx",
      "args": ["-y", "markitup-mcp-server"],
      "env": {
        "MARKITUP_API_KEY": "mk_live_..."
      }
    }
  }
}
```

## Configure in Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```jsonc
{
  "mcpServers": {
    "markitup": {
      "command": "npx",
      "args": ["-y", "markitup-mcp-server"],
      "env": {
        "MARKITUP_API_KEY": "mk_live_..."
      }
    }
  }
}
```

## Configure in Cursor

Cursor uses the same JSON shape. Settings → MCP → Add Server:

```jsonc
{
  "mcpServers": {
    "markitup": {
      "command": "npx",
      "args": ["-y", "markitup-mcp-server"],
      "env": { "MARKITUP_API_KEY": "mk_live_..." }
    }
  }
}
```

## Tools

### `markitup_credit_balance`

Returns the current credit balance and subscription status.

No arguments. Use it to verify your API key works and to check credits before calling generation tools.

### `markitup_generate`

Generates 3 polished marketing-visual variations from a screenshot. Costs 1 credit.

| Argument | Type | Required | Description |
|---|---|---|---|
| `description` | string | yes | What the image shows and what to highlight |
| `template_id` | string | yes | One of `glassmorphic`, `clean_minimal`, `bold_marketing`, `dark_professional`, `documentation` (and more) |
| `image_url` | string | one-of | Public HTTPS URL of the source image |
| `image_base64` | string | one-of | Base64-encoded image bytes (no `data:` prefix) |
| `image_mime_type` | string | no | MIME type when supplying `image_base64`. Default: `image/png` |
| `aspect_ratio` | string | no | One of `1:1`, `3:2`, `2:3`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9` |
| `image_size` | string | no | `1K`, `2K`, or `4K` |

Returns: the marketing copy (headline, sub-headline) plus 3 generated image variations as base64 image content blocks. The full structured response is also available under `structuredContent`.

**Example prompt (in Claude Code):**

> Use markitup_generate with the screenshot at https://example.com/dashboard.png — highlight the export button and pitch it for a marketing landing page using the bold_marketing template.

### `markitup_regen`

Regenerate one variation from a previous `markitup_generate` call. Costs 1 credit by default (`charge_credit: false` to skip).

The LLM must pass back the `text_analysis` object from the previous generate's `structuredContent.text` so the regenerated visual stays on-brand with the same headline / sub-headline. `variation_index` selects which slot (0–2).

### `markitup_extend`

AI outpaint — extend an image to a larger canvas / different aspect ratio. Costs 1 credit.

| Argument | Type | Required | Description |
|---|---|---|---|
| `image_url` / `image_base64` | string | one-of | Source image |
| `aspect_ratio` | string | yes | Target ratio (`16:9`, `9:16`, etc.) |
| `target_width` / `target_height` | number | yes | Output pixel dimensions |
| `image_size` | string | no | `1K`, `2K`, or `4K` |

### `markitup_remove_background`

Remove the background from an image via Photoroom's HD model. Returns a transparent PNG. Costs 1 credit (free for active Pro/Power subscribers).

| Argument | Type | Required | Description |
|---|---|---|---|
| `image_url` / `image_base64` | string | one-of | Source image |

## Environment variables

| Var | Required | Description |
|---|---|---|
| `MARKITUP_API_KEY` | yes | API key from your MarkItUp dashboard |
| `MARKITUP_API_BASE` | no | Override the API base URL. Default: `https://markitup.app/api/v1`. Useful for testing against staging. |

## Local development

```bash
git clone https://github.com/markitup/mcp-server.git
cd mcp-server
npm install
npm run build

# Point your MCP client config at the local build:
{
  "command": "node",
  "args": ["/absolute/path/to/mcp-server/dist/index.js"],
  "env": { "MARKITUP_API_KEY": "mk_test_..." }
}
```

## Security

- Never commit `MARKITUP_API_KEY` to source control.
- If you accidentally expose a key, revoke it immediately at https://markitup.app/dashboard/api-keys and create a new one.
- Keys are SHA-256 hashed on the server; the raw key is shown only once at creation.

## Errors

The server surfaces clean human-readable errors for the common cases:

- `Invalid or missing MARKITUP_API_KEY` — set or rotate the key.
- `Out of MarkItUp credits` — top up at https://markitup.app/credits.
- `Rate limit exceeded` — wait briefly and retry.

## License

MIT
