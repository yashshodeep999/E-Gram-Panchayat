const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of list) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) results = results.concat(walk(p));
    else results.push(p);
  }
  return results;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text, chunkSize = 900, overlap = 120) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks;
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// very small “knowledge base” extractor (leaders/services)
function extractKB(allTextByFile) {
  const kb = {
    leaders: {
      sarpanch: null,
      gramSevak: null,
      policePatil: null,
    },
    services: [],
  };

  // Try to find leader names from any page text
  const full = Object.entries(allTextByFile)
    .map(([file, text]) => `FILE:${file}\n${text}`)
    .join("\n\n");

  // Sarpanch patterns
  const sarpanchMatch =
    full.match(/sarpanch\s*[:\-]?\s*(mr\.)?\s*([A-Za-z.\s]{3,60})/i) ||
    full.match(/सरपंच\s*[:\-]?\s*([^\n]{3,60})/);

  if (sarpanchMatch) kb.leaders.sarpanch = sarpanchMatch[2] || sarpanchMatch[1] || sarpanchMatch[0];

  const gramSevakMatch =
    full.match(/gram\s*sevak\s*[:\-]?\s*(mr\.)?\s*([A-Za-z.\s]{3,60})/i) ||
    full.match(/ग्राम\s*सेवक\s*[:\-]?\s*([^\n]{3,60})/);

  if (gramSevakMatch) kb.leaders.gramSevak = gramSevakMatch[2] || gramSevakMatch[1] || gramSevakMatch[0];

  const policePatilMatch =
    full.match(/police\s*patil\s*[:\-]?\s*(mr\.)?\s*([A-Za-z.\s]{3,60})/i) ||
    full.match(/पोलीस\s*पाटील\s*[:\-]?\s*([^\n]{3,60})/);

  if (policePatilMatch) kb.leaders.policePatil = policePatilMatch[2] || policePatilMatch[1] || policePatilMatch[0];

  // Services: find lines containing common service terms from pages
  const serviceKeywords = [
    "birth certificate",
    "death certificate",
    "marriage",
    "no dues",
    "property tax",
    "water tax",
    "bpl",
    "ration",
    "certificate",
    "सेवा",
    "प्रमाणपत्र",
    "जन्म",
    "मृत्यू",
    "विवाह",
    "कर",
  ];

  const servicesSet = new Set();
  for (const [file, text] of Object.entries(allTextByFile)) {
    const n = normalize(text);
    for (const k of serviceKeywords) {
      if (n.includes(normalize(k))) servicesSet.add(k);
    }
  }
  kb.services = Array.from(servicesSet);

  return kb;
}

function buildSiteIndex(publicDir) {
  const files = walk(publicDir).filter((f) => f.toLowerCase().endsWith(".html"));

  const allTextByFile = {};
  const chunks = [];

  for (const f of files) {
    const rel = path.relative(publicDir, f).replaceAll("\\", "/");
    const html = fs.readFileSync(f, "utf8");
    const text = stripHtml(html);

    allTextByFile[rel] = text;

    const parts = chunkText(text);
    for (const p of parts) {
      chunks.push({
        page: rel,
        text: p,
        norm: normalize(p),
      });
    }
  }

  const kb = extractKB(allTextByFile);

  return { chunks, kb };
}

module.exports = { buildSiteIndex };