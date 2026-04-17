function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectLang(text) {
  const t = String(text || "");
  // if contains Marathi unicode, treat as mr
  return /[\u0900-\u097F]/.test(t) ? "mr" : "en";
}

function scoreChunk(queryNorm, chunkNorm) {
  const qWords = queryNorm.split(" ").filter(Boolean);
  if (qWords.length === 0) return 0;

  let hit = 0;
  for (const w of qWords) {
    if (w.length <= 2) continue;
    if (chunkNorm.includes(w)) hit++;
  }
  return hit / Math.max(3, qWords.length);
}

function makeReplyText(text, lang) {
  if (!text) {
    return lang === "mr"
      ? "माफ करा, ही माहिती वेबसाईटवर स्पष्टपणे सापडली नाही. कृपया Services/Contact पेज पहा किंवा कार्यालयाशी संपर्क करा."
      : "Sorry, I couldn't find this clearly on the website. Please check the Services/Contact page or contact the office.";
  }
  // keep answer short & clean
  return text.length > 450 ? text.slice(0, 450).trim() + "..." : text.trim();
}

// EXACT answers first (leaders/services)
function exactAnswer(kb, qNorm, lang) {
  if (!kb) return null;

  // leaders
  if (qNorm.includes("sarpanch") || qNorm.includes("सरपंच")) {
    const name = kb.leaders?.sarpanch;
    if (name) return lang === "mr" ? `सरपंच: ${name}` : `Sarpanch: ${name}`;
  }
  if (qNorm.includes("gram sevak") || qNorm.includes("ग्राम सेवक")) {
    const name = kb.leaders?.gramSevak;
    if (name) return lang === "mr" ? `ग्रामसेवक: ${name}` : `Gram Sevak: ${name}`;
  }
  if (qNorm.includes("police patil") || qNorm.includes("पोलीस पाटील")) {
    const name = kb.leaders?.policePatil;
    if (name) return lang === "mr" ? `पोलीस पाटील: ${name}` : `Police Patil: ${name}`;
  }

  // simple service hints
  if (qNorm.includes("water tax") || qNorm.includes("पाणी कर") || qNorm.includes("water")) {
    return lang === "mr"
      ? "पाणी कर / Property Tax माहिती साधारणतः Services किंवा Forms मध्ये असते. कृपया Services पेज पहा."
      : "Water tax / Property tax info is usually under Services or Forms. Please open the Services page.";
  }

  if (qNorm.includes("birth") || qNorm.includes("जन्म")) {
    return lang === "mr"
      ? "जन्म प्रमाणपत्र: Services/Forms मध्ये ‘Birth Certificate’ फॉर्म उपलब्ध आहे."
      : "Birth Certificate: The ‘Birth Certificate’ form is available in Services/Forms.";
  }

  return null;
}

function answerFromIndex(site, message, lang) {
  const chunks = Array.isArray(site?.chunks) ? site.chunks : [];
  const kb = site?.kb || {};
  const finalLang = lang || detectLang(message);

  const qNorm = normalize(message);

  // 1) exact first
  const exact = exactAnswer(kb, qNorm, finalLang);
  if (exact) {
    return {
      success: true,
      reply: exact,
      mode: "exact",
    };
  }

  // 2) best chunk match
  if (!chunks.length) {
    return { success: true, reply: makeReplyText("", finalLang), mode: "no-index" };
  }

  let best = null;
  let bestScore = 0;

  for (const c of chunks) {
    const s = scoreChunk(qNorm, c.norm || "");
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }

  if (!best || bestScore < 0.18) {
    return { success: true, reply: makeReplyText("", finalLang), mode: "fallback" };
  }

  return {
    success: true,
    reply: `${makeReplyText(best.text, finalLang)}\n\n(Reference page: ${best.page})`,
    mode: "site",
    page: best.page,
    score: bestScore,
  };
}

module.exports = { answerFromIndex, detectLang };