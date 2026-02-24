import { Router } from "express";
import { getUserFromRequest, getSupabaseForUser } from "../lib/clients.js";

export const gamesRouter = Router();

// ─── Auth middleware ─────────────────────────────────────────

async function requireAuth(req: any, res: any): Promise<{ id: string; email: string; token: string } | null> {
  const user = await getUserFromRequest(req.headers.authorization);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return user;
}

// ─── GET /api/games — list all games ─────────────────────────

gamesRouter.get("/", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const sb = getSupabaseForUser(user.token);

    let query = sb
      .from("games")
      .select("*")
      .order("played_at", { ascending: false });

    // Optional category filter
    const category = req.query.category as string;
    if (category && category !== "All") {
      query = query.eq("game_category", category);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err: any) {
    console.error("GET /games error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/games/stats — aggregate scoreboard stats ──────

gamesRouter.get("/stats", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const sb = getSupabaseForUser(user.token);

    // Fetch all games in one query — small table, efficient enough
    const { data: games, error } = await sb
      .from("games")
      .select("winner, played_at")
      .order("played_at", { ascending: false });

    if (error) throw error;

    const all = games || [];
    const zulWins = all.filter((g) => g.winner === "Zul").length;
    const wendyWins = all.filter((g) => g.winner === "Wendy").length;
    const draws = all.filter((g) => g.winner === "Draw").length;
    const total = all.length;

    // Calculate current streak
    let streak = { player: "", count: 0 };
    for (const g of all) {
      if (g.winner === "Draw") break;
      if (streak.count === 0) {
        streak = { player: g.winner, count: 1 };
      } else if (g.winner === streak.player) {
        streak.count++;
      } else {
        break;
      }
    }

    res.json({
      zulWins,
      wendyWins,
      draws,
      total,
      zulPct: total > 0 ? Math.round((zulWins / total) * 100) : 0,
      wendyPct: total > 0 ? Math.round((wendyWins / total) * 100) : 0,
      streak: streak.count >= 2 ? streak : null,
      leader: zulWins > wendyWins ? "Zul" : wendyWins > zulWins ? "Wendy" : null,
    });
  } catch (err: any) {
    console.error("GET /games/stats error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/games — log a game ───────────────────────────

gamesRouter.post("/", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { game_name, game_category, winner, score_zul, score_gf, notes, played_at, date_id } = req.body;

    if (!game_name || !game_category || !winner) {
      res.status(400).json({ error: "game_name, game_category, and winner are required" });
      return;
    }

    // Validate enums
    const validCategories = ["Card Game", "Board Game", "Mobile Game", "Video Game", "Sport", "Other"];
    if (!validCategories.includes(game_category)) {
      res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(", ")}` });
      return;
    }

    const validWinners = ["Zul", "Wendy", "Draw"];
    if (!validWinners.includes(winner)) {
      res.status(400).json({ error: "Winner must be Zul, Wendy, or Draw" });
      return;
    }

    if (game_name.length > 200) {
      res.status(400).json({ error: "Game name too long (max 200 chars)" });
      return;
    }

    const sb = getSupabaseForUser(user.token);

    const { data, error } = await sb
      .from("games")
      .insert({
        game_name: game_name.trim(),
        game_category,
        winner,
        score_zul: score_zul ?? null,
        score_gf: score_gf ?? null,
        notes: notes?.trim() || null,
        played_at: played_at || new Date().toISOString().split("T")[0],
        date_id: date_id || null,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err: any) {
    console.error("POST /games error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/games/:id — update a game ─────────────────────

gamesRouter.put("/:id", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const sb = getSupabaseForUser(user.token);
    const { game_name, game_category, winner, score_zul, score_gf, notes, played_at, date_id } = req.body;

    const updates: Record<string, any> = {};
    if (game_name !== undefined) updates.game_name = game_name.trim();
    if (game_category !== undefined) updates.game_category = game_category;
    if (winner !== undefined) updates.winner = winner;
    if (score_zul !== undefined) updates.score_zul = score_zul;
    if (score_gf !== undefined) updates.score_gf = score_gf;
    if (notes !== undefined) updates.notes = notes?.trim() || null;
    if (played_at !== undefined) updates.played_at = played_at;
    if (date_id !== undefined) updates.date_id = date_id;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const { data, error } = await sb
      .from("games")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    res.json(data);
  } catch (err: any) {
    console.error("PUT /games/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/games/:id — delete a game ──────────────────

gamesRouter.delete("/:id", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const sb = getSupabaseForUser(user.token);

    const { error } = await sb
      .from("games")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /games/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});
