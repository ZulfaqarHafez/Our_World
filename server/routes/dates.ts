import { Router } from "express";
import { getUserFromRequest, getSupabaseForUser, getSupabaseAdmin } from "../lib/clients.js";

export const datesRouter = Router();

// ─── Auth middleware ─────────────────────────────────────────

async function requireAuth(req: any, res: any): Promise<{ id: string; email: string; token: string } | null> {
  const user = await getUserFromRequest(req.headers.authorization);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return user;
}

// ─── GET /api/dates — list all dates ─────────────────────────

datesRouter.get("/", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const sb = getSupabaseForUser(user.token);

    let query = sb
      .from("dates")
      .select("*")
      .order("date", { ascending: false });

    // Optional search filter
    const search = (req.query.search as string)?.trim();
    if (search) {
      query = query.or(`title.ilike.%${search}%,location.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Batch-sign cover photos (first photo of each date) in one call
    const coverPaths = (data || [])
      .filter((d: any) => d.photos?.length > 0)
      .map((d: any) => d.photos[0]);

    let coverMap: Record<string, string> = {};
    if (coverPaths.length > 0) {
      const admin = getSupabaseAdmin();
      const { data: signed } = await admin.storage
        .from("couple-photos")
        .createSignedUrls(coverPaths, 3600);
      if (signed) {
        signed.forEach((s: any, i: number) => {
          if (s.signedUrl) coverMap[coverPaths[i]] = s.signedUrl;
        });
      }
    }

    // Attach cover_url to each date
    const enriched = (data || []).map((d: any) => ({
      ...d,
      cover_url: d.photos?.[0] ? (coverMap[d.photos[0]] || null) : null,
    }));

    res.json(enriched);
  } catch (err: any) {
    console.error("GET /dates error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/dates/:id — single date with linked games ─────

datesRouter.get("/:id", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const sb = getSupabaseForUser(user.token);

    // Fetch date
    const { data: dateRow, error: dateErr } = await sb
      .from("dates")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (dateErr || !dateRow) {
      res.status(404).json({ error: "Date not found" });
      return;
    }

    // Fetch linked games and sign photo URLs in parallel
    const gamesPromise = sb
      .from("games")
      .select("*")
      .eq("date_id", req.params.id)
      .order("played_at", { ascending: false });

    let photoUrls: string[] = [];
    const photoPaths: string[] = dateRow.photos || [];
    let signPromise: Promise<void> = Promise.resolve();

    if (photoPaths.length > 0) {
      const admin = getSupabaseAdmin();
      signPromise = admin.storage
        .from("couple-photos")
        .createSignedUrls(photoPaths, 3600)
        .then(({ data: signed }) => {
          if (signed) {
            photoUrls = signed.map((s: any) => s.signedUrl).filter(Boolean);
          }
        });
    }

    const [{ data: games, error: gamesErr }] = await Promise.all([gamesPromise, signPromise]);

    if (gamesErr) throw gamesErr;

    res.json({ ...dateRow, games: games || [], photo_urls: photoUrls });
  } catch (err: any) {
    console.error("GET /dates/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/dates — create a date ────────────────────────

datesRouter.post("/", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { title, date, location, description, mood, journal_entry, photos } = req.body;

    if (!title || !date) {
      res.status(400).json({ error: "Title and date are required" });
      return;
    }

    // Input validation
    if (title.length > 200) {
      res.status(400).json({ error: "Title too long (max 200 chars)" });
      return;
    }
    if (description && description.length > 5000) {
      res.status(400).json({ error: "Description too long (max 5000 chars)" });
      return;
    }
    if (journal_entry && journal_entry.length > 10000) {
      res.status(400).json({ error: "Journal entry too long (max 10000 chars)" });
      return;
    }

    const sb = getSupabaseAdmin();

    const { data, error } = await sb
      .from("dates")
      .insert({
        title: title.trim(),
        date,
        location: (location || "").trim(),
        description: (description || "").trim(),
        mood: mood || null,
        journal_entry: journal_entry || null,
        photos: photos || [],
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err: any) {
    console.error("POST /dates error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/dates/:id — update a date ─────────────────────

datesRouter.put("/:id", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const sb = getSupabaseAdmin();

    const { title, date, location, description, mood, journal_entry, photos } = req.body;

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title.trim();
    if (date !== undefined) updates.date = date;
    if (location !== undefined) updates.location = location.trim();
    if (description !== undefined) updates.description = description.trim();
    if (mood !== undefined) updates.mood = mood;
    if (journal_entry !== undefined) updates.journal_entry = journal_entry;
    if (photos !== undefined) updates.photos = photos;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const { data, error } = await sb
      .from("dates")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: "Date not found" });
      return;
    }

    res.json(data);
  } catch (err: any) {
    console.error("PUT /dates/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/dates/:id — delete a date ──────────────────

datesRouter.delete("/:id", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const sb = getSupabaseAdmin();

    const { error } = await sb
      .from("dates")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /dates/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});
