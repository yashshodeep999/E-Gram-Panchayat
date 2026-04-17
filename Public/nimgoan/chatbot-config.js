(function () {
  // Works for BOTH:
  // 1) Live Server (5500/5501): use http://localhost:5000/api/chat
  // 2) Node/Deploy same domain: use /api/chat

  const isLiveServer = location.port === "5500" || location.port === "5501";

  window.GP_CHATBOT = {
    apiUrl: isLiveServer ? "http://localhost:5000/api/chat" : "/api/chat",
    title: "GP Chatbot",
    welcomeEn:
      "Hello! Ask me about services, certificates, schemes, contacts, and office info.",
    welcomeMr:
      "नमस्कार! सेवा, प्रमाणपत्रे, योजना, संपर्क, कार्यालय माहिती याबद्दल विचारा.",
  };

  console.log("✅ Chatbot API URL:", window.GP_CHATBOT.apiUrl);
})();