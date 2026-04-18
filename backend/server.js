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
const PORT = process.env.PORT || 10000; // ✅ Render uses 10000
const MONGO_URI = process.env.MONGO_URI;
const SECRET = process.env.JWT_SECRET || "CHANGE_THIS_SECRET";

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   FRONTEND SERVE (FIXED)
========================= */
const publicPath = path.join(__dirname, "..", "Public", "nimgoan");

// Serve static files (images, css, js)
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  console.log("✅ Serving Frontend from:", publicPath);
} else {
  console.log("❌ Frontend folder not found:", publicPath);
}

/* ✅ Homepage */
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "Home.html"));
});

/* ✅ IMPORTANT: Fix page navigation (VERY IMPORTANT) */
app.get("/*", (req, res) => {
  const filePath = path.join(publicPath, req.path);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(publicPath, "Home.html"));
  }
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
   CHATBOT
========================= */
const { buildSiteIndex } = require("./chatbot/siteIndex");
const { answerFromIndex, detectLang } = require("./chatbot/engineSmart");

let SITE = { chunks: [], kb: {} };
let isIndexed = false;

function rebuildIndex() {
  try {
    const smallPath = publicPath;
    SITE = buildSiteIndex(smallPath);
    console.log("✅ Chatbot index built:", SITE.chunks.length);
  } catch (e) {
    console.log("❌ Chatbot index error:", e.message);
  }
}

app.post("/api/chat", (req, res) => {
  try {
    const { message, lang } = req.body || {};

    if (!message) {
      return res.status(400).json({
        success: false,
        reply: "Message required",
      });
    }

    if (!isIndexed) {
      rebuildIndex();
      isIndexed = true;
    }

    const finalLang = lang || detectLang(message);
    const ans = answerFromIndex(SITE, message, finalLang);

    res.json(ans);
  } catch (e) {
    res.status(500).json({
      success: false,
      reply: "Chatbot error",
    });
  }
});

/* =========================
   SCHEMAS
========================= */
const User = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      username: { type: String, unique: true, required: true },
      password: { type: String, required: true },
      role: { type: String, default: "ADMIN" },
    },
    { timestamps: true }
  )
);

const ServiceRequest = mongoose.model(
  "ServiceRequest",
  new mongoose.Schema(
    {
      name: String,
      email: String,
      phone: String,
      address: String,
      service: String,
    },
    { timestamps: true }
  )
);

const ContactMessage = mongoose.model(
  "ContactMessage",
  new mongoose.Schema(
    {
      name: String,
      email: String,
      message: String,
    },
    { timestamps: true }
  )
);

const Member = mongoose.model(
  "Member",
  new mongoose.Schema(
    {
      name: { type: String, required: true },
      position: { type: String, required: true },
      bio: { type: String, required: true },
      image: String,
    },
    { timestamps: true }
  )
);

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

function adminOnly(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ msg: "Admin only" });
  }
  next();
}

/* =========================
   MULTER
========================= */
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
});

/* =========================
   ROUTES
========================= */
app.post("/api/register-admin", async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ msg: "Required fields missing" });
  }

  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ msg: "Admin exists" });

  const hash = await bcrypt.hash(password, 10);
  await User.create({ username, password: hash });

  res.json({ msg: "Admin registered" });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};

  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ msg: "Invalid username" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ msg: "Invalid password" });

  const token = jwt.sign(
    { id: user._id, role: user.role },
    SECRET,
    { expiresIn: "2h" }
  );

  res.json({ token });
});

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ msg: "File too large" });
  }

  console.error(err);
  res.status(500).json({ msg: "Server error" });
});

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log(`✅ Server running on PORT ${PORT}`);
});