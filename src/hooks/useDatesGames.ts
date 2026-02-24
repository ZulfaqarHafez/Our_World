import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { DateRow, GameRow } from "@/lib/types";

// ─── Extended types from server ──────────────────────────

export interface DateWithCover extends DateRow {
  cover_url?: string | null;
}

export interface DateWithDetails extends DateRow {
  games: GameRow[];
  photo_urls: string[];
}

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

// ─── useDates (list — cached, cover URLs included) ───────

export function useDates(search?: string) {
  const queryClient = useQueryClient();

  const { data: dates = [], isLoading: loading } = useQuery({
    queryKey: ["dates", search || ""],
    queryFn: () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      return apiFetch<DateWithCover[]>(`/api/dates${params}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: {
      title: string;
      date: string;
      location?: string;
      description?: string;
      mood?: string;
      journal_entry?: string;
      photos?: string[];
    }) =>
      apiFetch<DateRow>("/api/dates", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dates"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Partial<Omit<DateRow, "id" | "created_by" | "created_at">>;
    }) =>
      apiFetch<DateRow>(`/api/dates/${id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["dates"] });
      queryClient.invalidateQueries({ queryKey: ["date", id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/dates/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["dates"] });
      queryClient.removeQueries({ queryKey: ["date", id] });
    },
  });

  return {
    dates,
    loading,
    createDate: createMutation.mutateAsync,
    updateDate: (
      id: string,
      values: Partial<Omit<DateRow, "id" | "created_by" | "created_at">>
    ) => updateMutation.mutateAsync({ id, values }),
    deleteDate: deleteMutation.mutateAsync,
  };
}

// ─── useDate (single — cached, photo_urls + games included) ─

export function useDate(id: string | undefined) {
  return useQuery({
    queryKey: ["date", id],
    queryFn: () => apiFetch<DateWithDetails>(`/api/dates/${id}`),
    enabled: !!id,
  });
}

// ─── useGames (list + stats — both cached) ───────────────

export function useGames(category?: string) {
  const queryClient = useQueryClient();

  const { data: games = [], isLoading: loading } = useQuery({
    queryKey: ["games", category || "All"],
    queryFn: () => {
      const params =
        category && category !== "All"
          ? `?category=${encodeURIComponent(category)}`
          : "";
      return apiFetch<GameRow[]>(`/api/games${params}`);
    },
  });

  const { data: stats = null } = useQuery({
    queryKey: ["gameStats"],
    queryFn: () => apiFetch<GameStats>("/api/games/stats"),
  });

  const createMutation = useMutation({
    mutationFn: (values: {
      game_name: string;
      game_category: string;
      winner: string;
      score_zul?: number | null;
      score_gf?: number | null;
      notes?: string;
      played_at?: string;
      date_id?: string;
    }) =>
      apiFetch<GameRow>("/api/games", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["gameStats"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Partial<Omit<GameRow, "id">>;
    }) =>
      apiFetch<GameRow>(`/api/games/${id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["gameStats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/games/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["gameStats"] });
    },
  });

  return {
    games,
    stats,
    loading,
    createGame: createMutation.mutateAsync,
    updateGame: (id: string, values: Partial<Omit<GameRow, "id">>) =>
      updateMutation.mutateAsync({ id, values }),
    deleteGame: deleteMutation.mutateAsync,
  };
}
