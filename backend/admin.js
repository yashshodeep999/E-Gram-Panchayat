// server.js ✅ FINAL COMBINED (Forms + Receipt + Razorpay + Admin + Members + Uploads + Service Request + Feedback)

const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

/* =========================
   APP
========================= */
const app = express();

/* =========================
   CONFIG
========================= */
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/yashodeep";
const JWT_SECRET =
  process.env.JWT_SECRET || "EGP_SUPER_SECRET_CHANGE_THIS_123456789";

/* =========================
   MIDDLEWARE
========================= */

// ✅ CORS (Live Server + Backend Pages)
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "http://127.0.0.1:5501",
      "http://localhost:5501",
      "http://localhost:5000",
      "http://127.0.0.1:5000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ IMPORTANT: increase JSON limit for base64 stamp/photos
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   STATIC FOLDERS
========================= */

// ✅ Serve HTML/CSS/JS from /Public
app.use(express.static(path.join(__dirname, "Public")));

// ✅ Uploads Folder
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use("/uploads", express.static(uploadsDir));

/* =========================
   DB CONNECTION
========================= */
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected:", MONGO_URI))
  .catch((e) => console.log("❌ Mongo Error:", e.message));

/* =========================
   RAZORPAY CONFIG
========================= */
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.log("❌ Missing Razorpay keys in .env");
} else {
  console.log("✅ RAZORPAY_KEY_ID loaded");
  console.log("✅ RAZORPAY_KEY_SECRET loaded");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

/* =========================
   MODELS / SCHEMAS
========================= */

// ✅ (Keep your existing Submission model file)
const Submission = require("./models/Submission");

// ✅ Users
const UserSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "ADMIN" },
  },
  { timestamps: true }
);
const User = mongoose.model("User", UserSchema);

// ✅ Members
const MemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    position: { type: String, required: true },
    bio: { type: String, required: true },
    image: { type: String, default: null },
  },
  { timestamps: true }
);
const Member = mongoose.model("Member", MemberSchema);

// ✅ Service Requests
const ServiceRequestSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    address: String,
    service: String,
  },
  { timestamps: true }
);
const ServiceRequest = mongoose.model("ServiceRequest", ServiceRequestSchema);

// ✅ Feedback
const FeedbackSchema = new mongoose.Schema(
  {
    fname: String,
    fphone: String,
    fservice: String,
    rating: String,
    fmsg: String,
  },
  { timestamps: true }
);
const Feedback = mongoose.model("Feedback", FeedbackSchema);

// ✅ Contact
const ContactSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    message: String,
  },
  { timestamps: true }
);
const ContactMessage = mongoose.model("ContactMessage", ContactSchema);

/* =========================
   AUTH MIDDLEWARE
========================= */
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ msg: "Token missing" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ msg: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ msg: "Admin access only" });
  }
  next();
}

/* =========================
   MULTER (UPLOAD) SETUP
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only jpg, png, webp images allowed"));
    }
    cb(null, true);
  },
});

/* =========================
   TEST ROUTE
========================= */
app.get("/ping", (req, res) => res.send("pong ✅ backend running"));

/* =========================================================
   (A) FORMS -> MongoDB (Submission)
========================================================= */

// ✅ Save any form
app.post("/api/submit", async (req, res) => {
  try {
    const { formType, data } = req.body;

    if (!formType || !data) {
      return res.status(400).json({
        success: false,
        message: "formType and data are required",
      });
    }

    const saved = await Submission.create({ formType, data });
    return res.json({ success: true, id: saved._id });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Get submissions by type
app.get("/api/submissions/:formType", async (req, res) => {
  try {
    const list = await Submission.find({ formType: req.params.formType }).sort({
      createdAt: -1,
    });
    res.json({ success: true, list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Load latest register
app.get("/api/register/latest", async (req, res) => {
  try {
    const latest = await Submission.findOne({ formType: "register" }).sort({
      createdAt: -1,
    });
    return res.json({ ok: true, doc: latest });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ✅ Save receipt
app.post("/api/save-receipt", async (req, res) => {
  try {
    const saved = await Submission.create({
      formType: "receipt",
      data: req.body,
    });

    res.json({ ok: true, id: saved._id });
  } catch (err) {
    console.log("❌ Receipt save error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* =========================================================
   (B) RAZORPAY
========================================================= */

app.post("/api/create-order", async (req, res) => {
  try {
    const { amount, receipt } = req.body;

    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid amount" });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        ok: false,
        error: "Razorpay keys missing in .env",
      });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amt * 100),
      currency: "INR",
      receipt: receipt || `rcpt_${Date.now()}`,
    });

    return res.json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
    });
  } catch (err) {
    console.log("❌ CREATE ORDER ERROR:", err);

    return res.status(err.statusCode || 500).json({
      ok: false,
      error: "Order creation failed",
      statusCode: err.statusCode || 500,
      details: err.error?.description || err.message || "Unknown error",
    });
  }
});

app.post("/api/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ ok: false, error: "Signature mismatch" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.log("❌ VERIFY ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "Verification failed",
      details: err.message,
    });
  }
});

/* =========================================================
   (C) AUTH ROUTES
========================================================= */

// ✅ Register Admin (run once)
app.post("/api/register-admin", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ msg: "username and password required" });
    }

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ msg: "Admin already exists" });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashed, role: "ADMIN" });

    res.json({ msg: "Admin registered ✅" });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ✅ Login (Admin)
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ msg: "Invalid username" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ msg: "Invalid password" });

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================================
   (D) SERVICE + FEEDBACK + CONTACT
========================================================= */

// ✅ Service Request
app.post("/submit-form", async (req, res) => {
  try {
    await ServiceRequest.create(req.body);
    res.json({ ok: true, msg: "Service request submitted ✅" });
  } catch (err) {
    res.status(500).json({ ok: false, msg: "Error saving service request" });
  }
});

// ✅ Feedback
app.post("/feedback", async (req, res) => {
  try {
    await Feedback.create(req.body);
    res.json({ ok: true, msg: "Feedback submitted ✅" });
  } catch (err) {
    res.status(500).json({ ok: false, msg: "Error saving feedback" });
  }
});

// ✅ Contact
app.post("/contact", async (req, res) => {
  try {
    await ContactMessage.create(req.body);
    res.json({ ok: true, msg: "Message sent ✅" });
  } catch (err) {
    res.status(500).json({ ok: false, msg: "Error saving message" });
  }
});

/* =========================================================
   (E) MEMBERS CRUD (ADMIN)
========================================================= */

// ✅ Add Member (ADMIN)
app.post(
  "/members",
  auth,
  adminOnly,
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, position, bio } = req.body || {};

      if (!name || !position || !bio) {
        return res.status(400).json({ msg: "name, position, bio required" });
      }

      const newMember = await Member.create({
        name,
        position,
        bio,
        image: req.file ? req.file.filename : null,
      });

      res.json({ status: "Member added ✅", member: newMember });
    } catch (err) {
      res.status(500).json({ msg: "Error adding member", error: err.message });
    }
  }
);

// ✅ Get Members (PUBLIC)
app.get("/members", async (req, res) => {
  const members = await Member.find().sort({ createdAt: -1 });
  res.json(members);
});

// ✅ Update Member (ADMIN)
app.put(
  "/members/:id",
  auth,
  adminOnly,
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, position, bio } = req.body || {};
      if (!name || !position || !bio) {
        return res.status(400).json({ msg: "name, position, bio required" });
      }

      const member = await Member.findById(req.params.id);
      if (!member) return res.status(404).json({ msg: "Member not found" });

      // If new image uploaded, delete old one
      if (req.file) {
        if (member.image) {
          const oldPath = path.join(uploadsDir, member.image);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        member.image = req.file.filename;
      }

      member.name = name;
      member.position = position;
      member.bio = bio;

      await member.save();

      res.json({ status: "Member updated ✅", member });
    } catch (err) {
      res.status(500).json({ msg: "Error updating member", error: err.message });
    }
  }
);

// ✅ Delete Member (ADMIN)
app.delete("/members/:id", auth, adminOnly, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ msg: "Member not found" });

    if (member.image) {
      const imgPath = path.join(uploadsDir, member.image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await Member.findByIdAndDelete(req.params.id);
    res.json({ status: "Member deleted ✅" });
  } catch (err) {
    res.status(500).json({ msg: "Error deleting member", error: err.message });
  }
});

/* =========================
   GLOBAL ERROR (multer)
========================= */
app.use((err, req, res, next) => {
  if (err?.message?.includes("Only jpg")) {
    return res.status(400).json({ msg: err.message });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ msg: "File too large (max 2MB)" });
  }
  next(err);
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log("✅ Server running on http://localhost:" + PORT);
  console.log("✅ Ping: http://localhost:" + PORT + "/ping");
  console.log(
    "✅ Open Main Form: http://localhost:" +
      PORT +
      "/Forms/main-application.html"
  );
});
