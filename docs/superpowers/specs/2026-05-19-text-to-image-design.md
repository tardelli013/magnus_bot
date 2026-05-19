# Text-to-Image Renderer — Design Spec

**Date:** 2026-05-19  
**Status:** Approved

## Problem

WhatsApp does not reliably preserve monospace formatting and line breaks across devices. The classification table rendered in a ` ``` ` code block breaks on mobile when the font or screen width differs from the sender's device.

## Goal

Render the entire formatted message as a PNG image before sending. The image is also saved locally to `generated-images/` so it can be retrieved manually without running the WhatsApp integration.

## Architecture

```
scrape → format() → renderToImage() → saveImage() → [dry-run exits here]
                                                   → sendToGroup(media)
```

No new CLI flags. The `--dry-run` flag continues to gate sending; the image is always saved locally regardless.

## New File: `image-renderer.js`

Single-responsibility module at the project root (alongside `formatter.js`).

### Public API

```js
async function renderToImage(text)          // → Buffer (PNG)
async function saveImage(buffer, dir)       // → string (absolute path of saved file)
```

### Rendering Logic

- Canvas width: **720px fixed**. Height: dynamic, calculated from total line count × line height + padding.
- Padding: **32px** on all sides.
- Line height: **24px** (~1.6 ratio at 15–16px font size).
- Each line is processed in order:

| Condition | Font | Color |
|---|---|---|
| Inside ` ``` ` block | `15px 'Courier New', monospace` | `#c9d1d9`, background fill `#161b22` |
| Line matches `*...*` (bold title) | `bold 18px sans-serif` | `#f0c040` |
| Line matches `_..._` (italic subtitle) | `italic 15px sans-serif` | `#8b949e` |
| Empty line | — | 8px extra vertical gap |
| Default text | `16px sans-serif` | `#e6edf3` |

- Background: `#0d1117`
- Markdown markers (`*`, `_`, ` ``` `) are stripped before rendering — not displayed literally.
- Emojis render natively via the system font stack (macOS: Apple Color Emoji).

### Saved File

Path: `generated-images/classificacao-YYYY-MM-DD.png`  
One file per day; overwritten on each run. Directory created automatically if absent.

## Changes to `whatsapp.js`

`sendToGroup` gains an optional `media` parameter:

```js
async function sendToGroup(client, groupId, message, media = null)
```

- If `media` is provided, sends `MessageMedia` instead of text.
- `message` is passed as `null` when sending an image.

## Changes to `enviar.js`

```js
const { renderToImage, saveImage } = require('./image-renderer');

const buffer = await renderToImage(message);
const imagePath = await saveImage(buffer, path.join(__dirname, 'generated-images'));
logger.info(`imagem salva em ${imagePath}`);

if (!FLAGS.dryRun) {
  const { MessageMedia } = require('whatsapp-web.js');
  const media = new MessageMedia('image/png', buffer.toString('base64'));
  await sendToGroup(client, groupId, null, media);
}
```

## `.gitignore`

Add `generated-images/` to prevent committing generated PNGs.

## Dependencies

Add `canvas` (npm package `canvas`) to `dependencies` in `package.json`.  
Version: latest stable (`^3.x`). Has native bindings — requires `node-gyp` build tools (present on macOS by default).

## Out of Scope

- Thumbnails or alternate image sizes
- Watermarks or branding
- Sending both text and image simultaneously
- Fallback to text if canvas fails
