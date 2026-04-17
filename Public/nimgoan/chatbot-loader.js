(function () {
  // ✅ Load CSS
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "chatbot.css";
  document.head.appendChild(css);

  const CFG = window.GP_CHATBOT || {
    apiUrl: "/api/chat",
    title: "GP Chatbot",
    welcomeEn: "Hello! How can I help you?",
    welcomeMr: "नमस्कार! मी कशी मदत करू?",
  };

  // ✅ Get language from dropdown OR auto
  function getLangFromSelector() {
    const sel = document.getElementById("languageSelector");
    return sel ? sel.value : null;
  }

  function detectLangText(text) {
    // simple Marathi detection (Devanagari)
    return /[\u0900-\u097F]/.test(text) ? "mr" : "en";
  }

  function getLang(message = "") {
    return getLangFromSelector() || detectLangText(message) || "en";
  }

  // ✅ Floating Button
  const btn = document.createElement("button");
  btn.className = "gp-chat-btn";
  btn.title = "Chat";
  btn.innerHTML = "💬";
  document.body.appendChild(btn);

  // ✅ Chatbox
  const box = document.createElement("div");
  box.className = "gp-chatbox";
  box.style.display = "none";

  box.innerHTML = `
    <div class="gp-chat-head">
      <div class="gp-head-left">
        <div class="gp-title">${CFG.title}</div>
        <div class="gp-small" id="gpLangLabel"></div>
      </div>

      <div class="gp-head-actions">
        <button class="gp-icon-btn" id="gpSpeakToggle" title="Speak answers">🔊</button>
        <div class="gp-close" title="Close">✕</div>
      </div>
    </div>

    <div class="gp-chat-body" id="gpChatBody"></div>

    <div class="gp-chat-foot">
      <button id="gpMicBtn" class="gp-mic" title="Speak">🎤</button>
      <input id="gpChatInput" placeholder="Type your question..." />
      <button id="gpChatSend">Send</button>
    </div>
  `;
  document.body.appendChild(box);

  const closeBtn = box.querySelector(".gp-close");
  const body = box.querySelector("#gpChatBody");
  const input = box.querySelector("#gpChatInput");
  const sendBtn = box.querySelector("#gpChatSend");
  const langLabel = box.querySelector("#gpLangLabel");
  const micBtn = box.querySelector("#gpMicBtn");
  const speakToggle = box.querySelector("#gpSpeakToggle");

  let SPEAK_ENABLED = false;

  function setPlaceholders(message = "") {
    const lang = getLang(message);
    langLabel.textContent = lang === "mr" ? "मराठी" : "English";
    input.placeholder = lang === "mr" ? "प्रश्न लिहा..." : "Type your question...";
    sendBtn.textContent = lang === "mr" ? "पाठवा" : "Send";
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // ✅ Speak answer (optional)
  function speakText(text, lang) {
    if (!SPEAK_ENABLED) return;
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "mr" ? "mr-IN" : "en-IN";
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }

  // ✅ Better bubbles (supports line breaks)
  function addMsg(type, text) {
    const row = document.createElement("div");
    row.className = `gp-msg ${type}`;
    row.innerHTML = `<div class="gp-bubble">${escapeHtml(text)}</div>`;
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  async function send() {
    const msg = input.value.trim();
    if (!msg) return;

    const lang = getLang(msg);
    setPlaceholders(msg);

    addMsg("user", msg);
    input.value = "";

    const typingRow = document.createElement("div");
    typingRow.className = "gp-msg bot";
    typingRow.innerHTML = `<div class="gp-bubble gp-typing">Typing…</div>`;
    body.appendChild(typingRow);
    body.scrollTop = body.scrollHeight;

    try {
      const res = await fetch(CFG.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, lang }),
      });

      const data = await res.json().catch(() => ({}));
      typingRow.remove();

      if (!res.ok) {
        addMsg("bot", data.reply || data.message || "Error. Please try again.");
        return;
      }

      const reply = data.reply || "No reply";
      addMsg("bot", reply);

      // ✅ speak answer if enabled
      speakText(reply, lang);
    } catch (e) {
      typingRow.remove();
      console.error("Chatbot fetch error:", e);
      addMsg("bot", "Server not reachable. Open Console (F12) → Network.");
    }
  }

  function openChat() {
    box.style.display = "block";
    setPlaceholders();

    if (body.childElementCount === 0) {
      const lang = getLang();
      addMsg("bot", lang === "mr" ? CFG.welcomeMr : CFG.welcomeEn);
    }
  }

  function toggleChat() {
    if (box.style.display === "block") box.style.display = "none";
    else openChat();
  }

  btn.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", () => (box.style.display = "none"));
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => e.key === "Enter" && send());

  // ✅ Speak toggle
  speakToggle.addEventListener("click", () => {
    SPEAK_ENABLED = !SPEAK_ENABLED;
    speakToggle.classList.toggle("active", SPEAK_ENABLED);
    speakToggle.title = SPEAK_ENABLED ? "Speak: ON" : "Speak: OFF";
  });

  // ✅ MIC Feature (works only in browser, not node terminal)
  if ("webkitSpeechRecognition" in window) {
    const rec = new webkitSpeechRecognition();
    rec.interimResults = false;

    micBtn.addEventListener("click", () => {
      const lang = getLang();
      rec.lang = lang === "mr" ? "mr-IN" : "en-IN";
      rec.start();
    });

    rec.onresult = (e) => {
      const spoken = e.results[0][0].transcript;
      input.value = spoken;
      send();
    };

    rec.onerror = () => {
      addMsg("bot", "Mic error. Allow microphone permission in browser.");
    };
  } else {
    micBtn.style.display = "none";
  }

  // if language dropdown changes, update placeholders
  const sel = document.getElementById("languageSelector");
  if (sel) sel.addEventListener("change", () => setPlaceholders());
})();