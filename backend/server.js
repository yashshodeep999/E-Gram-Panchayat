const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();

/* =========================
   CONFIG
========================= */
const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI;
const SECRET = process.env.JWT_SECRET || "CHANGE_THIS_SECRET";

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   FRONTEND
========================= */
const publicPath = path.join(__dirname, "..", "Public", "nimgoan");

if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  console.log("✅ Serving Frontend from:", publicPath);
} else {
  console.log("⚠️ Frontend folder not found:", publicPath);
}

/* =========================
   UPLOADS
========================= */
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.use("/uploads", express.static(uploadsDir));

/* =========================
   DB CONNECTION
========================= */
if (!MONGO_URI) {
  console.error("❌ MONGO_URI missing");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

/* =========================
   TEST ROUTE
========================= */
app.get("/ping", (req, res) => {
  res.send("pong ✅ backend running");
});

/* =========================
   SCHEMA
========================= */
const Member = mongoose.model(
  "Member",
  new mongoose.Schema(
    {
      name: String,
      position: String,
      bio: String,
      image: String,
    },
    { timestamps: true }
  )
);

/* =========================
   MEMBERS API
========================= */
app.get("/members", async (req, res) => {
  try {
    const data = await Member.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    console.error("❌ Members fetch error:", err);
    res.status(500).json({ msg: "Failed to fetch members" });
  }
});

/* =========================
   AUTH (optional)
========================= */
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ msg: "Token missing" });
  }

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ msg: "Invalid token" });
  }
}

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({ msg: "Server error" });
});

/* =========================
   FRONTEND ROUTES (LAST)
========================= */

// Homepage
app.get("/", (req, res) => {
  const homeFile = path.join(publicPath, "Home.html");

  if (fs.existsSync(homeFile)) {
    res.sendFile(homeFile);
  } else {
    res.send("✅ Backend running, frontend missing");
  }
});

// Catch-all (SPA support)
app.use((req, res) => {
  const homeFile = path.join(publicPath, "Home.html");

  if (fs.existsSync(homeFile)) {
    res.sendFile(homeFile);
  } else {
    res.status(404).send("Page not found");
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on PORT ${PORT}`);
});