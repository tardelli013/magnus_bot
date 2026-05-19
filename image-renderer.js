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
  if (/^_.+_$/.test(line)) return { type: 'italic', text: line.replace(/^_|_$/g, '') };
  return { type: 'text', text: line };
}

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

    ctx.fillText(d.text, PADDING, y + 18, WIDTH - PADDING * 2);
    y += LINE_H;
  }

  return canvas.toBuffer('image/png', { compressionLevel: 0 });
}

async function saveImage(buffer, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `classificacao-${date}.png`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

module.exports = { parseLine, renderToImage, saveImage };
