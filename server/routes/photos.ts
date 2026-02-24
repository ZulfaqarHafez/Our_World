import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import { getSupabaseAdmin, getUserFromRequest } from "../lib/clients.js";

export const photosRouter = Router();

const MAX_PATHS = 50;
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB per image
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: MAX_IMAGES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported image type: ${file.mimetype}`));
    }
  },
});

// ─── POST /api/photos/upload — Upload up to 5 images ────────

photosRouter.post("/upload", (req: Request, res: Response, next) => {
  upload.array("images", MAX_IMAGES)(req, res, (err: any) => {
    if (err) {
      console.error("Multer error:", err.message);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File too large (max 5 MB each)" });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ error: "Too many files (max 5)" });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No images provided" });
    }

    console.log(`Uploading ${files.length} image(s) for user ${user.id}`);

    const supabase = getSupabaseAdmin();
    const paths: string[] = [];

    for (const file of files) {
      const ext = file.originalname.split(".").pop()?.toLowerCase() || "jpg";
      const safeName = `${crypto.randomUUID()}.${ext}`;
      const storagePath = `${user.id}/${safeName}`;

      console.log(`Uploading ${file.originalname} (${file.size} bytes) → ${storagePath}`);

      const { data, error } = await supabase.storage
        .from("couple-photos")
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        console.error(`Upload error for ${file.originalname}:`, JSON.stringify(error));
        return res.status(500).json({ error: `Failed to upload ${file.originalname}: ${error.message}` });
      }

      console.log(`Uploaded successfully:`, data);
      paths.push(storagePath);
    }

    res.json({ paths });
  } catch (err: any) {
    console.error("Photos upload error:", err?.message, err?.stack);
    if (err.message?.includes("Unsupported image type")) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─── POST /api/photos/sign — Generate signed URLs ───────────
// Accepts: { paths: string[] }
// Returns: { urls: [{ path, signedUrl }] }

photosRouter.post("/sign", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { paths } = req.body;
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: "Provide an array of storage paths" });
    }

    if (paths.length > MAX_PATHS) {
      return res.status(400).json({ error: `Maximum ${MAX_PATHS} paths per request` });
    }

    // Validate all paths belong to the requesting user and have no traversal
    for (const p of paths) {
      if (typeof p !== "string") {
        return res.status(400).json({ error: "All paths must be strings" });
      }
      if (p.includes("..") || p.startsWith("/")) {
        return res.status(400).json({ error: "Invalid path detected" });
      }
      if (!p.startsWith(`${user.id}/`)) {
        return res.status(403).json({ error: "You can only access your own photos" });
      }
    }

    const supabase = getSupabaseAdmin();
    const urls: { path: string; signedUrl: string }[] = [];

    // Batch sign all URLs at once instead of one-by-one
    const { data, error } = await supabase.storage
      .from("couple-photos")
      .createSignedUrls(paths, 3600); // 1-hour expiry

    if (error || !data) {
      console.error("Batch signed URL error:", error);
      // Fallback: return empty URLs
      for (const p of paths) urls.push({ path: p, signedUrl: "" });
    } else {
      for (let i = 0; i < paths.length; i++) {
        urls.push({
          path: paths[i],
          signedUrl: data[i]?.signedUrl || "",
        });
      }
    }

    res.json({ urls });
  } catch (err) {
    console.error("Photos sign error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
