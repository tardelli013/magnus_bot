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

module.exports = { parseLine };
