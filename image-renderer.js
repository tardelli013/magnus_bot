const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const { buildReportParts } = require('./formatter');

const WIDTH = 720;
const PADDING = 32;
const LINE_H = 26;
const EMPTY_H = 10;
const ROW_H = 30;
const GRID_PAD_X = 12;
const PART_GAP = 14;

const COLORS = {
  bg: '#0d1117',
  codeBg: '#161b22',
  bold: '#f0c040',
  italic: '#8b949e',
  text: '#e6edf3',
  code: '#c9d1d9',
  gridHeaderBg: '#21262d',
  zebraBg: '#161b22',
  highlightBg: '#1f6feb',
  highlightText: '#ffffff',
  gridBorder: '#30363d',
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

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = String(text);
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function gridColumnWidths(ctx, model, area) {
  const natural = model.columns.map((c, ci) => {
    ctx.font = 'bold 14px sans-serif';
    let w = ctx.measureText(c.label).width;
    ctx.font = '14px sans-serif';
    for (const r of model.rows) w = Math.max(w, ctx.measureText(r.values[ci]).width);
    return Math.ceil(w) + GRID_PAD_X * 2;
  });
  const clubIdx = 1; // coluna "Clube" é flexível: ocupa o espaço restante
  const fixed = natural.reduce((s, w, i) => s + (i === clubIdx ? 0 : w), 0);
  natural[clubIdx] = Math.max(80, area - fixed);
  return natural;
}

function drawGridCells(ctx, columns, values, xs, widths) {
  for (let i = 0; i < columns.length; i++) {
    const maxW = widths[i] - GRID_PAD_X * 2;
    const text = fitText(ctx, values[i], maxW);
    const tx = columns[i].align === 'right'
      ? xs[i] + widths[i] - GRID_PAD_X - ctx.measureText(text).width
      : xs[i] + GRID_PAD_X;
    ctx.fillText(text, tx, ROW_H / 2);
  }
}

function drawGrid(ctx, model, y) {
  const area = WIDTH - PADDING * 2;

  if (model.title) {
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = COLORS.bold;
    ctx.fillText(model.title.replace(/\*/g, ''), PADDING, y + 18, area);
    y += LINE_H;
  }

  const widths = gridColumnWidths(ctx, model, area);
  const xs = [];
  let x = PADDING;
  for (const w of widths) { xs.push(x); x += w; }
  const tableW = x - PADDING;

  ctx.textBaseline = 'middle';

  // cabeçalho
  ctx.fillStyle = COLORS.gridHeaderBg;
  ctx.fillRect(PADDING, y, tableW, ROW_H);
  ctx.save();
  ctx.translate(0, y);
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = COLORS.bold;
  drawGridCells(ctx, model.columns, model.columns.map((c) => c.label), xs, widths);
  ctx.restore();
  y += ROW_H;

  // linhas
  model.rows.forEach((r, ri) => {
    ctx.fillStyle = r.highlight ? COLORS.highlightBg : (ri % 2 === 0 ? COLORS.bg : COLORS.zebraBg);
    ctx.fillRect(PADDING, y, tableW, ROW_H);
    ctx.save();
    ctx.translate(0, y);
    ctx.font = r.highlight ? 'bold 14px sans-serif' : '14px sans-serif';
    ctx.fillStyle = r.highlight ? COLORS.highlightText : COLORS.text;
    drawGridCells(ctx, model.columns, r.values, xs, widths);
    ctx.restore();
    y += ROW_H;
  });

  // moldura sutil
  ctx.strokeStyle = COLORS.gridBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(PADDING + 0.5, y - ROW_H * (model.rows.length + 1) + 0.5, tableW - 1, ROW_H * (model.rows.length + 1) - 1);

  ctx.textBaseline = 'alphabetic';
  return y;
}

function drawTextPart(ctx, text, y) {
  ctx.textBaseline = 'alphabetic';
  for (const line of text.split('\n')) {
    const d = parseLine(line, false);
    if (d.type === 'empty') { y += EMPTY_H; continue; }
    if (d.type === 'bold') {
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
  return y;
}

function reportHeight(parts) {
  let h = PADDING;
  for (const p of parts) {
    if (p.type === 'grid') {
      if (p.model.title) h += LINE_H;
      h += ROW_H * (p.model.rows.length + 1);
    } else {
      for (const line of p.text.split('\n')) h += line === '' ? EMPTY_H : LINE_H;
    }
    h += PART_GAP;
  }
  return h + PADDING;
}

async function renderReport(payload, opts = {}) {
  const parts = buildReportParts(payload, opts);
  const totalHeight = reportHeight(parts);

  const canvas = createCanvas(WIDTH, totalHeight);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, totalHeight);

  let y = PADDING;
  for (const p of parts) {
    y = p.type === 'grid' ? drawGrid(ctx, p.model, y) : drawTextPart(ctx, p.text, y);
    y += PART_GAP;
  }

  return canvas.toBuffer('image/png', { compressionLevel: 0 });
}

function timestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  // hora local (respeita TZ do ambiente, ex.: TZ=America/Sao_Paulo no CI)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

async function saveImage(buffer, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const filename = `classificacao-${timestamp()}.png`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

module.exports = { parseLine, renderToImage, renderReport, drawGrid, saveImage };
