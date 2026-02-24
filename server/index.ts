import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { studyRouter } from "./routes/study.js";
import { photosRouter } from "./routes/photos.js";
import { datesRouter } from "./routes/dates.js";
import { gamesRouter } from "./routes/games.js";

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// ─── Security headers ───────────────────────────────────────
app.use(helmet());

// ─── CORS — restrict to known origins ────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:8080")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ─── Global rate limit ──────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  })
);

// ─── Body parser with reasonable limit ──────────────────────
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/study", studyRouter);
app.use("/api/photos", photosRouter);
app.use("/api/dates", datesRouter);
app.use("/api/games", gamesRouter);

// ─── Export for Vercel serverless + local dev ────────────────
export default app;

// Only listen when running directly (local dev via tsx)
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`✅ API server running on http://localhost:${PORT}`);
  });
}
