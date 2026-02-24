import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { studyRouter } from "./routes/study.js";
import { photosRouter } from "./routes/photos.js";

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/study", studyRouter);
app.use("/api/photos", photosRouter);

app.listen(PORT, () => {
  console.log(`✅ API server running on http://localhost:${PORT}`);
});
