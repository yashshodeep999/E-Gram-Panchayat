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
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   FRONTEND SERVE
========================= */
const publicPath = path.join(__dirname, "..", "Public", "nimgoan");

if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  console.log("✅ Serving Frontend from:", publicPath);
}

/* =========================
   HOMEPAGE
========================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "Home.html"));
});

/* =========================
   UPLOADS
========================= */
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.use("/uploads", express.static(uploadsDir));

/* =========================
   DB CONNECTION
========================= */
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
   SCHEMAS
========================= */
const User = mongoose.model("User", new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, default: "ADMIN" }
}));

const Member = mongoose.model("Member", new mongoose.Schema({
  name: String,
  position: String,
  bio: String,
  image: String
}));

/* =========================
   MEMBERS API (IMPORTANT)
========================= */
app.get("/members", async (req, res) => {
  try {
    const data = await Member.find().sort({ createdAt: -1 });
    res.json(data);
  } catch {
    res.status(500).json({ msg: "Error loading members" });
  }
});

/* =========================
   AUTH
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
   FINAL FALLBACK (VERY IMPORTANT)
========================= */
app.use((req, res) => {
  const filePath = path.join(publicPath, req.path);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(publicPath, "Home.html"));
  }
});

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log(`✅ Server running on PORT ${PORT}`);
});