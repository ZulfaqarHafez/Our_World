import { Router, Request, Response } from "express";
import { getSupabaseAdmin, getUserFromRequest } from "../lib/clients.js";

export const photosRouter = Router();

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

    const supabase = getSupabaseAdmin();
    const urls: { path: string; signedUrl: string }[] = [];

    for (const p of paths) {
      const { data, error } = await supabase.storage
        .from("couple-photos")
        .createSignedUrl(p, 300); // 5-minute expiry

      if (error || !data) {
        console.error(`Signed URL error for ${p}:`, error);
        urls.push({ path: p, signedUrl: "" });
      } else {
        urls.push({ path: p, signedUrl: data.signedUrl });
      }
    }

    res.json({ urls });
  } catch (err) {
    console.error("Photos sign error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
