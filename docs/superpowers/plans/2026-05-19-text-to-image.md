# Text-to-Image Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the formatted WhatsApp message as a PNG image using node-canvas, save it locally to `generated-images/`, and send it via `MessageMedia` instead of plain text.

**Architecture:** A new `image-renderer.js` module parses markdown-annotated text into render descriptors and draws them onto a fixed-width canvas. `enviar.js` calls this after `format()` and passes the PNG buffer to an updated `sendToGroup` in `whatsapp.js` as a `MessageMedia` object. The image is always saved locally first — `--dry-run` stops before sending.

**Tech Stack:** Node.js, `canvas` npm package (v3.x, node-canvas), `whatsapp-web.js` `MessageMedia`, Node built-in `node:test`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `image-renderer.js` | Parse text → render descriptors → PNG Buffer; save to disk |
| Create | `tests/image-renderer.test.js` | Unit + integration tests for image-renderer |
| Create | `tests/whatsapp.test.js` | Unit tests for updated `sendToGroup` |
| Modify | `whatsapp.js` | Add optional `media` parameter to `sendToGroup` |
| Modify | `enviar.js` | Integrate render + save + send image pipeline |
| Modify | `package.json` | Add `canvas` dependency |
| Modify | `.gitignore` | Add `generated-images/` |

---

### Task 1: Install canvas and update .gitignore

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install canvas**

```bash
npm install canvas
```

Expected: `added 1 package` (or similar). If build fails, install Xcode Command Line Tools first: `xcode-select --install`, then retry.

- [ ] **Step 2: Add generated-images/ to .gitignore**

Add this line to `.gitignore`:

```
generated-images/
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: install canvas, ignore generated-images/"
```

---

### Task 2: Create image-renderer.js — parseLine

**Files:**
- Create: `tests/image-renderer.test.js`
- Create: `image-renderer.js`

- [ ] **Step 1: Create test file with failing tests for parseLine**

Create `tests/image-renderer.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseLine, renderToImage, saveImage } = require('../image-renderer');

// parseLine tests
test('parseLine: codeToggle for ``` regardless of inCodeBlock state', () => {
  assert.deepEqual(parseLine('```', false), { type: 'codeToggle' });
  assert.deepEqual(parseLine('```', true), { type: 'codeToggle' });
});

test('parseLine: code line when inCodeBlock=true', () => {
  assert.deepEqual(parseLine('Pos  Clube  Pts', true), { type: 'code', text: 'Pos  Clube  Pts' });
});

test('parseLine: empty line', () => {
  assert.deepEqual(parseLine('', false), { type: 'empty' });
});

test('parseLine: bold — line containing *...*', () => {
  const d = parseLine('🏆 *CLASSIFICAÇÃO — Sub-7 Divisão A1*', false);
  assert.equal(d.type, 'bold');
  assert.equal(d.text, '🏆 CLASSIFICAÇÃO — Sub-7 Divisão A1');
});

test('parseLine: bold — emoji + *text* pattern', () => {
  const d = parseLine('⚽ *ARTILHEIROS — MAGNUS*', false);
  assert.equal(d.type, 'bold');
  assert.equal(d.text, '⚽ ARTILHEIROS — MAGNUS');
});

test('parseLine: italic — _text_ wrapping whole line', () => {
  const d = parseLine('_Atualizado: 19/05/2026 10:00_', false);
  assert.equal(d.type, 'italic');
  assert.equal(d.text, 'Atualizado: 19/05/2026 10:00');
});

test('parseLine: plain text', () => {
  const d = parseLine('1. KEVIN MATTOS PANTOJO — 4 gols', false);
  assert.equal(d.type, 'text');
  assert.equal(d.text, '1. KEVIN MATTOS PANTOJO — 4 gols');
});

test('parseLine: bullet warning line is plain text', () => {
  const d = parseLine('• algum aviso aqui', false);
  assert.equal(d.type, 'text');
  assert.equal(d.text, '• algum aviso aqui');
});

// renderToImage tests (will fail until Task 3)
test('renderToImage: returns a Buffer starting with PNG magic bytes', async () => {
  const buf = await renderToImage('*Título*\n_subtítulo_\n\n1. texto simples');
  assert.ok(Buffer.isBuffer(buf), 'deve retornar um Buffer');
  assert.equal(buf[0], 0x89, 'magic byte 0');
  assert.equal(buf[1], 0x50, 'magic byte 1 (P)');
  assert.equal(buf[2], 0x4e, 'magic byte 2 (N)');
  assert.equal(buf[3], 0x47, 'magic byte 3 (G)');
});

test('renderToImage: buffer has meaningful size (>5KB)', async () => {
  const buf = await renderToImage('*Título*\n_sub_\n\ntexto');
  assert.ok(buf.length > 5000, `buffer muito pequeno: ${buf.length} bytes`);
});

test('renderToImage: handles full message format without throwing', async () => {
  const msg = [
    '🏆 *CLASSIFICAÇÃO — Sub-7 Divisão A1*',
    '_Atualizado: 19/05/2026 11:38_',
    '',
    '```',
    'Pos  Clube                   Pts  J  V  E  D',
    '20º   ASSOC PORTUGUESA          3  7  1  0  6',
    '```',
    '',
    '⚽ *ARTILHEIROS — MAGNUS*',
    '1. KEVIN MATTOS — 4 gols',
    '',
    '🔥 *TOP 5 ARTILHEIROS GERAIS*',
    '1. JOGADOR (CLUBE) — 17 gols',
  ].join('\n');
  const buf = await renderToImage(msg);
  assert.ok(buf.length > 5000);
});

// saveImage tests (will fail until Task 4)
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-test-'));

test('saveImage: creates directory if it does not exist', async () => {
  const newDir = path.join(tmpDir, 'subdir-' + Date.now());
  const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  await saveImage(fakePng, newDir);
  assert.ok(fs.existsSync(newDir), 'diretório deve ser criado');
});

test('saveImage: saves file with name matching classificacao-YYYY-MM-DD.png', async () => {
  const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const saved = await saveImage(fakePng, tmpDir);
  assert.match(path.basename(saved), /^classificacao-\d{4}-\d{2}-\d{2}\.png$/);
});

test('saveImage: returns absolute path of saved file', async () => {
  const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const saved = await saveImage(fakePng, tmpDir);
  assert.ok(path.isAbsolute(saved), 'caminho deve ser absoluto');
  assert.ok(fs.existsSync(saved), 'arquivo deve existir no caminho retornado');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/image-renderer.test.js
```

Expected: `Error: Cannot find module '../image-renderer'`

- [ ] **Step 3: Create image-renderer.js with parseLine**

Create `image-renderer.js`:

```js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const WIDTH = 720;
const PADDING = 32;
const LINE_H = 26;
const EMPTY_H = 10;

const COLORS = {
  bg: '#0d1117',
  codeBg: '#161b22',
  bold: '#f0c040',
  italic: '#8b949e',
  text: '#e6edf3',
  code: '#c9d1d9',
};

function parseLine(line, inCodeBlock) {
  if (line === '```') return { type: 'codeToggle' };
  if (inCodeBlock) return { type: 'code', text: line };
  if (line === '') return { type: 'empty' };
  if (/\*[^*]+\*/.test(line)) return { type: 'bold', text: line.replace(/\*/g, '') };
  if (/^_.*_$/.test(line)) return { type: 'italic', text: line.replace(/^_|_$/g, '') };
  return { type: 'text', text: line };
}

module.exports = { parseLine };
```

- [ ] **Step 4: Run tests to verify parseLine tests pass**

```bash
node --test tests/image-renderer.test.js
```

Expected: 8 parseLine tests pass; renderToImage and saveImage tests fail with `TypeError: renderToImage is not a function`.

- [ ] **Step 5: Commit**

```bash
git add image-renderer.js tests/image-renderer.test.js
git commit -m "feat(image-renderer): add parseLine with markdown detection"
```

---

### Task 3: Add renderToImage

**Files:**
- Modify: `image-renderer.js`

- [ ] **Step 1: Run tests to confirm renderToImage tests still fail**

```bash
node --test tests/image-renderer.test.js 2>&1 | grep -E '(pass|fail|renderToImage)'
```

Expected: `renderToImage` tests show `fail`.

- [ ] **Step 2: Implement renderToImage — add after parseLine, before module.exports**

Replace `module.exports = { parseLine };` with the full implementation:

```js
async function renderToImage(text) {
  const lines = text.split('\n');

  const descriptors = [];
  let inCode = false;
  for (const line of lines) {
    const d = parseLine(line, inCode);
    if (d.type === 'codeToggle') {
      inCode = !inCode;
    } else {
      descriptors.push(d);
    }
  }

  let totalHeight = PADDING;
  for (const d of descriptors) {
    totalHeight += d.type === 'empty' ? EMPTY_H : LINE_H;
  }
  totalHeight += PADDING;

  const canvas = createCanvas(WIDTH, totalHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, totalHeight);

  let y = PADDING;
  for (const d of descriptors) {
    if (d.type === 'empty') {
      y += EMPTY_H;
      continue;
    }

    if (d.type === 'code') {
      ctx.fillStyle = COLORS.codeBg;
      ctx.fillRect(0, y, WIDTH, LINE_H);
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillStyle = COLORS.code;
    } else if (d.type === 'bold') {
      ctx.font = 'bold 17px sans-serif';
      ctx.fillStyle = COLORS.bold;
    } else if (d.type === 'italic') {
      ctx.font = 'italic 14px sans-serif';
      ctx.fillStyle = COLORS.italic;
    } else {
      ctx.font = '15px sans-serif';
      ctx.fillStyle = COLORS.text;
    }

    ctx.fillText(d.text, PADDING, y + 18);
    y += LINE_H;
  }

  return canvas.toBuffer('image/png');
}

module.exports = { parseLine, renderToImage };
```

- [ ] **Step 3: Run tests to verify renderToImage tests pass**

```bash
node --test tests/image-renderer.test.js 2>&1 | grep -E '(pass|fail)'
```

Expected: all parseLine tests + all renderToImage tests pass; saveImage tests fail with `TypeError: saveImage is not a function`.

- [ ] **Step 4: Commit**

```bash
git add image-renderer.js
git commit -m "feat(image-renderer): implement renderToImage with node-canvas"
```

---

### Task 4: Add saveImage

**Files:**
- Modify: `image-renderer.js`

- [ ] **Step 1: Run tests to confirm saveImage tests still fail**

```bash
node --test tests/image-renderer.test.js 2>&1 | grep -E 'saveImage'
```

Expected: saveImage tests show `fail`.

- [ ] **Step 2: Implement saveImage — add after renderToImage, before module.exports**

Replace `module.exports = { parseLine, renderToImage };` with:

```js
async function saveImage(buffer, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `classificacao-${date}.png`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

module.exports = { parseLine, renderToImage, saveImage };
```

- [ ] **Step 3: Run all image-renderer tests**

```bash
node --test tests/image-renderer.test.js
```

Expected: all 14 tests pass.

- [ ] **Step 4: Commit**

```bash
git add image-renderer.js
git commit -m "feat(image-renderer): add saveImage, complete public API"
```

---

### Task 5: Update whatsapp.js to support media

**Files:**
- Modify: `whatsapp.js`
- Create: `tests/whatsapp.test.js`

- [ ] **Step 1: Create failing tests for the updated sendToGroup**

Create `tests/whatsapp.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { sendToGroup } = require('../whatsapp');

function makeClient(chatOverrides = {}) {
  const chat = {
    isGroup: true,
    name: 'Grupo Teste',
    lastSent: null,
    sendMessage: async (payload) => { chat.lastSent = payload; },
    ...chatOverrides,
  };
  return {
    getChatById: async () => chat,
    getChats: async () => [],
    _chat: chat,
  };
}

test('sendToGroup: throws if groupId is missing', async () => {
  const client = makeClient();
  await assert.rejects(() => sendToGroup(client, null, 'msg'), /groupId obrigatório/);
});

test('sendToGroup: throws if message empty and no media', async () => {
  const client = makeClient();
  await assert.rejects(() => sendToGroup(client, 'g@g.us', ''), /mensagem vazia/);
});

test('sendToGroup: throws if message is null and no media', async () => {
  const client = makeClient();
  await assert.rejects(() => sendToGroup(client, 'g@g.us', null), /mensagem vazia/);
});

test('sendToGroup: sends text message when no media provided', async () => {
  const client = makeClient();
  await sendToGroup(client, 'g@g.us', 'olá grupo');
  assert.equal(client._chat.lastSent, 'olá grupo');
});

test('sendToGroup: sends media object when media is provided', async () => {
  const client = makeClient();
  const fakeMedia = { mimetype: 'image/png', data: 'base64abc' };
  await sendToGroup(client, 'g@g.us', null, fakeMedia);
  assert.equal(client._chat.lastSent, fakeMedia);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/whatsapp.test.js
```

Expected: `sendToGroup: sends media object when media is provided` fails; `throws if message is null and no media` may throw a different error (`Cannot read properties of null`).

- [ ] **Step 3: Update sendToGroup in whatsapp.js**

Find and replace the entire `sendToGroup` function:

```js
async function sendToGroup(client, groupId, message, media = null) {
  if (!groupId) throw new Error('sendToGroup: groupId obrigatório');
  if (!media && (!message || !message.trim())) throw new Error('sendToGroup: mensagem vazia');

  let chat;
  try {
    chat = await client.getChatById(groupId);
  } catch (err) {
    const groups = await listGroups(client);
    const list = groups.map((g) => `  ${g.id} — ${g.name}`).join('\n') || '  (nenhum grupo encontrado)';
    throw new Error(`grupo "${groupId}" não encontrado. Grupos disponíveis:\n${list}`);
  }

  if (!chat.isGroup) {
    throw new Error(`o ID "${groupId}" não corresponde a um grupo (é uma DM/contato)`);
  }

  logger.info(`→ enviando para grupo "${chat.name}" (${groupId})`);
  await chat.sendMessage(media || message);
  logger.info('mensagem enviada ✓');
}
```

- [ ] **Step 4: Run all tests**

```bash
node --test tests/whatsapp.test.js tests/image-renderer.test.js tests/parser.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add whatsapp.js tests/whatsapp.test.js
git commit -m "feat(whatsapp): support optional media in sendToGroup"
```

---

### Task 6: Integrate in enviar.js and verify

**Files:**
- Modify: `enviar.js`

- [ ] **Step 1: Add path and image-renderer requires at the top of enviar.js**

After `const { format } = require('./formatter');`, add:

```js
const path = require('path');
const { renderToImage, saveImage } = require('./image-renderer');
```

- [ ] **Step 2: Replace the send block in main()**

Find and replace this block in `main()`:

```js
const message = format(payload, { targetTeam, displayName, stale });

if (FLAGS.dryRun) {
  console.log('\n=== DRY RUN — mensagem que SERIA enviada ===\n');
  console.log(message);
  console.log('\n=== fim ===');
  return;
}

const groupId = requireEnv('WHATSAPP_GROUP_ID');
const { start, sendToGroup, shutdown } = require('./whatsapp');
const client = await start();
try {
  await sendToGroup(client, groupId, message);
} finally {
  await shutdown(client);
}
```

With:

```js
const message = format(payload, { targetTeam, displayName, stale });
const buffer = await renderToImage(message);
const imagePath = await saveImage(buffer, path.join(__dirname, 'generated-images'));
logger.info(`imagem salva: ${imagePath}`);

if (FLAGS.dryRun) {
  console.log('\n=== DRY RUN — mensagem que SERIA enviada (como imagem) ===\n');
  console.log(message);
  console.log(`\n=== imagem salva em ${imagePath} ===`);
  return;
}

const groupId = requireEnv('WHATSAPP_GROUP_ID');
const { MessageMedia } = require('whatsapp-web.js');
const { start, sendToGroup, shutdown } = require('./whatsapp');
const media = new MessageMedia('image/png', buffer.toString('base64'));
const client = await start();
try {
  await sendToGroup(client, groupId, null, media);
} finally {
  await shutdown(client);
}
```

- [ ] **Step 3: Verify with dry-run**

```bash
TARGET_TEAM="Magnus" npm run cache
```

Expected output includes:

```
=== DRY RUN — mensagem que SERIA enviada (como imagem) ===

🏆 *CLASSIFICAÇÃO — Sub-7 Divisão A1*
...

=== imagem salva em /.../magnus_bot/generated-images/classificacao-2026-05-19.png ===
```

- [ ] **Step 4: Verify the image was created and open it**

```bash
ls -lh generated-images/
open generated-images/classificacao-2026-05-19.png
```

Expected: file exists, size > 10KB. Image shows dark background, yellow title, gray date, monospace table, white scorer lines.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add enviar.js
git commit -m "feat: render and send message as PNG image via node-canvas"
```
