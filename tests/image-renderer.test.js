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
