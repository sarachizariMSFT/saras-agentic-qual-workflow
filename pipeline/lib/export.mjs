// export.mjs — deliverable export. Turns the report/story markdown into a .docx the researcher can
// hand off without any manual copy-paste. Zero dependencies: the 'builtin' engine hand-rolls the
// OOXML package (a store-only ZIP with CRC32 + WordprocessingML), so it runs on any machine with just
// Node. Set config.export.docxEngine to 'pandoc' to shell out to pandoc when it's installed (richer
// fidelity), with automatic fallback to builtin if pandoc isn't found.
//
// Supported markdown: ATX headings (#..######), paragraphs, bullet + numbered lists, blockquotes,
// GFM pipe tables, fenced code, and inline **bold** / *italic* / `code` / [text](url). Every link
// (including a participant quote's Marvin clip_url) is written as a real Word hyperlink.
//
// CLI:
//   node lib/export.mjs docx <in.md> <out.docx>     convert one file
//   node lib/export.mjs deliverables <runDir>       export config.export.deliverables found in runDir

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const EXPORT = CONFIG.export || {};

// ---------- XML helpers ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => esc(s).replace(/"/g, '&quot;');

// ---------- inline markdown -> runs ----------
// Returns an array of tokens: { text, bold, italic, code, href }. Flat (no nesting) on purpose —
// good enough for a report and keeps the parser robust.
export function parseInline(s) {
  const runs = [];
  let rest = String(s);
  const re = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(__[^_]+__)|(_[^_]+_)/;
  while (rest.length) {
    const m = re.exec(rest);
    if (!m) { runs.push({ text: rest }); break; }
    if (m.index > 0) runs.push({ text: rest.slice(0, m.index) });
    const tok = m[0];
    if (tok.startsWith('`')) {
      runs.push({ text: tok.slice(1, -1), code: true });
    } else if (tok.startsWith('[')) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      runs.push({ text: lm[1], href: lm[2] });
    } else if (tok.startsWith('**')) {
      runs.push({ text: tok.slice(2, -2), bold: true });
    } else if (tok.startsWith('__')) {
      runs.push({ text: tok.slice(2, -2), bold: true });
    } else {
      runs.push({ text: tok.slice(1, -1), italic: true });
    }
    rest = rest.slice(m.index + tok.length);
  }
  return runs.filter(r => r.text !== '');
}

// ---------- block markdown -> a document model ----------
// blocks: { type:'heading', level, runs } | { type:'para'|'quote', runs }
//       | { type:'list', ordered, items:[runs...] } | { type:'code', lines:[...] }
//       | { type:'table', header:[runs...], rows:[[runs...]...] }
export function parseBlocks(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  const isBlank = l => /^\s*$/.test(l);
  while (i < lines.length) {
    let line = lines[i];

    if (isBlank(line)) { i++; continue; }

    // fenced code
    if (/^\s*```/.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++; // closing fence
      blocks.push({ type: 'code', lines: code });
      continue;
    }

    // heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { blocks.push({ type: 'heading', level: h[1].length, runs: parseInline(h[2].trim()) }); i++; continue; }

    // horizontal rule -> skip
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { i++; continue; }

    // table (a header row followed by a |---| separator)
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const splitRow = r => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => parseInline(c.trim()));
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && !isBlank(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    // blockquote (fold consecutive > lines)
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      blocks.push({ type: 'quote', runs: parseInline(buf.join(' ')) });
      continue;
    }

    // list (bullet or ordered) — fold consecutive item lines
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, '')));
        i++;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    // paragraph — fold consecutive plain lines
    const buf = [];
    while (i < lines.length && !isBlank(lines[i]) &&
      !/^(#{1,6})\s|^\s*```|^\s*>|^\s*([-*+]|\d+\.)\s/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]))) {
      buf.push(lines[i]); i++;
    }
    blocks.push({ type: 'para', runs: parseInline(buf.join(' ')) });
  }
  return blocks;
}

// ---------- document model -> WordprocessingML ----------
function runXml(r, hyperlinks) {
  const rpr = [];
  if (r.bold) rpr.push('<w:b/>');
  if (r.italic) rpr.push('<w:i/>');
  if (r.code) rpr.push('<w:rStyle w:val="Code"/><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
  const rprXml = rpr.length ? `<w:rPr>${rpr.join('')}</w:rPr>` : '';
  const t = `<w:t xml:space="preserve">${esc(r.text)}</w:t>`;
  if (r.href) {
    const rId = `rIdL${hyperlinks.length + 1}`;
    hyperlinks.push({ rId, target: r.href });
    const linkRpr = `<w:rPr>${rpr.join('')}<w:rStyle w:val="Hyperlink"/><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>`;
    return `<w:hyperlink r:id="${rId}"><w:r>${linkRpr}${t}</w:r></w:hyperlink>`;
  }
  return `<w:r>${rprXml}${t}</w:r>`;
}

function paraXml(runs, style, hyperlinks) {
  const ppr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  const body = (runs && runs.length ? runs : [{ text: '' }]).map(r => runXml(r, hyperlinks)).join('');
  return `<w:p>${ppr}${body}</w:p>`;
}

function tableXml(block, hyperlinks) {
  const border = '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>`).join('') +
    '</w:tblBorders>';
  const cell = (runs, header) => {
    const cellRuns = header ? runs.map(r => ({ ...r, bold: true })) : runs;
    return `<w:tc><w:tcPr/>${paraXml(cellRuns, null, hyperlinks)}</w:tc>`;
  };
  const row = (cells, header) => `<w:tr>${cells.map(c => cell(c, header)).join('')}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${border}</w:tblPr>` +
    row(block.header, true) + block.rows.map(r => row(r, false)).join('') + '</w:tbl>';
}

export function blocksToDocumentXml(blocks) {
  const hyperlinks = [];
  const body = [];
  for (const b of blocks) {
    if (b.type === 'heading') body.push(paraXml(b.runs, b.level === 1 ? 'Title' : `Heading${Math.min(b.level, 6)}`, hyperlinks));
    else if (b.type === 'para') body.push(paraXml(b.runs, null, hyperlinks));
    else if (b.type === 'quote') body.push(paraXml(b.runs, 'Quote', hyperlinks));
    else if (b.type === 'list') b.items.forEach((it, idx) =>
      body.push(paraXml([{ text: b.ordered ? `${idx + 1}. ` : '\u2022 ' }, ...it], 'ListParagraph', hyperlinks)));
    else if (b.type === 'code') b.lines.forEach(l => body.push(paraXml([{ text: l, code: true }], null, hyperlinks)));
    else if (b.type === 'table') body.push(tableXml(b, hyperlinks));
  }
  const doc =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<w:body>${body.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>` +
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>';
  return { doc, hyperlinks };
}

// ---------- OOXML package parts ----------
const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

function stylesXml() {
  const heading = (id, name, sz, color) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>` +
    `<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr>` +
    `<w:rPr><w:b/><w:sz w:val="${sz}"/>${color ? `<w:color w:val="${color}"/>` : ''}</w:rPr></w:style>`;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>' +
    '<w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr>' +
    '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>' +
    '<w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="52"/></w:rPr></w:style>' +
    heading('Heading1', 'heading 1', 40) + heading('Heading2', 'heading 2', 32) +
    heading('Heading3', 'heading 3', 28) + heading('Heading4', 'heading 4', 26) +
    heading('Heading5', 'heading 5', 24) + heading('Heading6', 'heading 6', 22) +
    '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/>' +
    '<w:pPr><w:ind w:left="720"/><w:spacing w:after="160"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/>' +
    '<w:pPr><w:ind w:left="720"/><w:spacing w:after="80"/></w:pPr></w:style>' +
    '<w:style w:type="character" w:styleId="Code"><w:name w:val="Code"/>' +
    '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr></w:style>' +
    '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/>' +
    '<w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>' +
    '</w:styles>';
}

function documentRels(hyperlinks) {
  const rels = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'];
  for (const h of hyperlinks) {
    rels.push(`<Relationship Id="${h.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escAttr(h.target)}" TargetMode="External"/>`);
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    rels.join('') + '</Relationships>';
}

// ---------- store-only ZIP (with CRC32) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function dosDateTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time & 0xFFFF, date: date & 0xFFFF };
}
export function zipStore(entries) {
  const now = dosDateTime(new Date());
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(now.time, 10);
    local.writeUInt16LE(now.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(now.time, 12);
    cd.writeUInt16LE(now.date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, nameBuf]));
    offset += local.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuf, end]);
}

// Read one stored entry back out of a package we wrote (used by the self-test to verify content).
export function extractEntry(buf, name) {
  let i = 0;
  while (i + 4 <= buf.length && buf.readUInt32LE(i) === 0x04034b50) {
    const method = buf.readUInt16LE(i + 8);
    const compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const nm = buf.toString('utf8', i + 30, i + 30 + nameLen);
    const dataStart = i + 30 + nameLen + extraLen;
    const data = buf.slice(dataStart, dataStart + compSize);
    if (nm === name) return method === 0 ? data.toString('utf8') : null;
    i = dataStart + compSize;
  }
  return null;
}

// ---------- public API ----------
export function mdToDocxBuffer(md) {
  const blocks = parseBlocks(md);
  const { doc, hyperlinks } = blocksToDocumentXml(blocks);
  return zipStore([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'word/document.xml', data: doc },
    { name: 'word/styles.xml', data: stylesXml() },
    { name: 'word/_rels/document.xml.rels', data: documentRels(hyperlinks) },
  ]);
}

// Try pandoc; return true on success, false if it isn't installed or fails (caller falls back).
function tryPandoc(inPath, outPath) {
  try {
    execFileSync('pandoc', [inPath, '-o', outPath], { stdio: 'ignore' });
    return fs.existsSync(outPath);
  } catch {
    return false;
  }
}

export function writeDocx(inPath, outPath, { engine } = {}) {
  const useEngine = engine || EXPORT.docxEngine || 'builtin';
  if (useEngine === 'pandoc' && tryPandoc(inPath, outPath)) return { engine: 'pandoc', out: outPath };
  const md = fs.readFileSync(inPath, 'utf8');
  fs.writeFileSync(outPath, mdToDocxBuffer(md));
  return { engine: 'builtin', out: outPath };
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'docx') {
    const [inPath, outPath] = rest;
    if (!inPath || !outPath) { console.error('Usage: node lib/export.mjs docx <in.md> <out.docx>'); process.exit(2); }
    const r = writeDocx(path.resolve(inPath), path.resolve(outPath));
    console.log(`Wrote ${outPath} (${r.engine} engine, ${fs.statSync(outPath).size} bytes)`);
  } else if (cmd === 'deliverables') {
    const runDir = rest[0] && path.resolve(rest[0]);
    if (!runDir) { console.error('Usage: node lib/export.mjs deliverables <runDir>'); process.exit(2); }
    const wanted = EXPORT.deliverables || [];
    let n = 0;
    for (const name of wanted) {
      const outPath = path.join(runDir, name);
      const inPath = outPath.replace(/\.docx$/, '.md');
      if (!fs.existsSync(inPath)) { console.error(`  skip  ${name} (no ${path.basename(inPath)})`); continue; }
      const r = writeDocx(inPath, outPath);
      console.log(`  ok    ${name} (${r.engine})`); n++;
    }
    console.log(`\nExported ${n} deliverable(s) from ${runDir}`);
    if (!n) process.exit(1);
  } else {
    console.error('Usage: node lib/export.mjs docx <in.md> <out.docx> | deliverables <runDir>'); process.exit(2);
  }
}
