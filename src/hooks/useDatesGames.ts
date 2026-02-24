import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { DateRow, GameRow } from "@/lib/types";

// ─── useDates ────────────────────────────────────────────────

export function useDates() {
  const [dates, setDates] = useState<DateRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDates = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const data = await apiFetch<DateRow[]>(`/api/dates${params}`);
      setDates(data);
    } catch (err) {
      console.error("Failed to fetch dates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDate = useCallback(async (id: string) => {
    const data = await apiFetch<DateRow & { games: GameRow[] }>(`/api/dates/${id}`);
    return data;
  }, []);

  const createDate = useCallback(
    async (values: {
      title: string;
      date: string;
      location?: string;
      description?: string;
      mood?: string;
      journal_entry?: string;
      photos?: string[];
    }) => {
      const data = await apiFetch<DateRow>("/api/dates", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setDates((prev) => [data, ...prev]);
      return data;
    },
    []
  );

  const updateDate = useCallback(
    async (id: string, values: Partial<Omit<DateRow, "id" | "created_by" | "created_at">>) => {
      const data = await apiFetch<DateRow>(`/api/dates/${id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });
      setDates((prev) => prev.map((d) => (d.id === id ? data : d)));
      return data;
    },
    []
  );

  const deleteDate = useCallback(async (id: string) => {
    await apiFetch(`/api/dates/${id}`, { method: "DELETE" });
    setDates((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return { dates, loading, fetchDates, fetchDate, createDate, updateDate, deleteDate };
}

// ─── useGames ────────────────────────────────────────────────

export interface GameStats {
  zulWins: number;
  wendyWins: number;
  draws: number;
  total: number;
  zulPct: number;
  wendyPct: number;
  streak: { player: string; count: number } | null;
  leader: "Zul" | "Wendy" | null;
}

export function useGames() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchGames = useCallback(async (category?: string) => {
    setLoading(true);
    try {
      const params = category && category !== "All" ? `?category=${encodeURIComponent(category)}` : "";
      const data = await apiFetch<GameRow[]>(`/api/games${params}`);
      setGames(data);
    } catch (err) {
      console.error("Failed to fetch games:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch<GameStats>("/api/games/stats");
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const createGame = useCallback(
    async (values: {
      game_name: string;
      game_category: string;
      winner: string;
      score_zul?: number | null;
      score_gf?: number | null;
      notes?: string;
      played_at?: string;
      date_id?: string;
    }) => {
      const data = await apiFetch<GameRow>("/api/games", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setGames((prev) => [data, ...prev]);
      return data;
    },
    []
  );

  const updateGame = useCallback(
    async (id: string, values: Partial<Omit<GameRow, "id">>) => {
      const data = await apiFetch<GameRow>(`/api/games/${id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });
      setGames((prev) => prev.map((g) => (g.id === id ? data : g)));
      return data;
    },
    []
  );

  const deleteGame = useCallback(async (id: string) => {
    await apiFetch(`/api/games/${id}`, { method: "DELETE" });
    setGames((prev) => prev.filter((g) => g.id !== id));
  }, []);

  return { games, stats, loading, fetchGames, fetchStats, createGame, updateGame, deleteGame };
}
