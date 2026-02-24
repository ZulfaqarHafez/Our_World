import { useState, useEffect } from "react";
import { Plus, Trophy, Crown, Flame, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGames } from "@/hooks/useDatesGames";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import gamesHero from "@/assets/games-hero.jpg";

const categories = ["All", "Card Game", "Board Game", "Mobile Game", "Video Game", "Sport", "Other"] as const;

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const GamesPage = () => {
  const { games, stats, loading, fetchGames, fetchStats, createGame } = useGames();
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    game_name: "",
    game_category: "Board Game" as string,
    winner: "Zul" as string,
    score_zul: "",
    score_gf: "",
    notes: "",
    played_at: new Date().toISOString().split("T")[0],
  });

  // Fetch on mount and when category changes
  useEffect(() => {
    fetchGames(activeCategory);
  }, [fetchGames, activeCategory]);

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const filtered = games;

  // Use stats from server
  const zulWins = stats?.zulWins ?? 0;
  const wendyWins = stats?.wendyWins ?? 0;
  const draws = stats?.draws ?? 0;
  const total = stats?.total ?? 0;
  const zulPct = stats?.zulPct ?? 0;
  const wendyPct = stats?.wendyPct ?? 0;
  const currentStreak = stats?.streak;
  const leader = stats?.leader ?? null;

  const handleCreate = async () => {
    if (!form.game_name.trim()) return;
    setSaving(true);
    try {
      await createGame({
        game_name: form.game_name,
        game_category: form.game_category,
        winner: form.winner,
        score_zul: form.score_zul ? parseInt(form.score_zul) : null,
        score_gf: form.score_gf ? parseInt(form.score_gf) : null,
        notes: form.notes || undefined,
        played_at: form.played_at,
      });
      setShowAdd(false);
      setForm({ game_name: "", game_category: "Board Game", winner: "Zul", score_zul: "", score_gf: "", notes: "", played_at: new Date().toISOString().split("T")[0] });
      fetchStats(); // Refresh stats after adding
    } catch (err: any) {
      console.error("Create failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden h-40 sm:h-48">
        <img src={gamesHero} alt="Games" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/60 to-foreground/20" />
        <div className="absolute inset-0 flex items-center justify-between px-6 sm:px-8">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-primary-foreground">Scoreboard</h1>
            <p className="text-primary-foreground/80 text-sm mt-1">Who's really winning? Let's see 👀</p>
          </div>
          <Button className="gradient-rose text-primary-foreground gap-2 shadow-lg" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Log Game</span>
          </Button>
        </div>
      </div>

      {/* Add game form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-5 space-y-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-serif text-lg font-semibold text-foreground">Log a Game</h2>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                placeholder="Game name *"
                value={form.game_name}
                onChange={(e) => setForm((f) => ({ ...f, game_name: e.target.value }))}
              />
              <Select value={form.game_category} onValueChange={(v) => setForm((f) => ({ ...f, game_category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {["Card Game", "Board Game", "Mobile Game", "Video Game", "Sport", "Other"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.winner} onValueChange={(v) => setForm((f) => ({ ...f, winner: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Winner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Zul">Zul</SelectItem>
                  <SelectItem value="Wendy">Wendy</SelectItem>
                  <SelectItem value="Draw">Draw</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={form.played_at}
                onChange={(e) => setForm((f) => ({ ...f, played_at: e.target.value }))}
              />
              <Input
                placeholder="Zul's score (optional)"
                type="number"
                value={form.score_zul}
                onChange={(e) => setForm((f) => ({ ...f, score_zul: e.target.value }))}
              />
              <Input
                placeholder="Wendy's score (optional)"
                type="number"
                value={form.score_gf}
                onChange={(e) => setForm((f) => ({ ...f, score_gf: e.target.value }))}
              />
            </div>
            <Input
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <Button
              className="gradient-rose text-primary-foreground w-full"
              disabled={!form.game_name.trim() || saving}
              onClick={handleCreate}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Game
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score cards - more visual */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-card p-5 sm:p-6 text-center relative overflow-hidden"
        >
          {leader === "Zul" && <Crown className="absolute top-2 right-2 h-5 w-5 text-accent/40" />}
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-accent/10 mb-3">
            <span className="text-lg font-bold text-accent">Z</span>
          </div>
          <div className="text-sm text-muted-foreground mb-1">Zul</div>
          <div className="font-serif text-4xl font-bold text-accent">{zulWins}</div>
          <div className="text-xs text-muted-foreground mt-1">{zulPct}% win rate</div>
        </motion.div>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5 sm:p-6 text-center relative overflow-hidden"
        >
          {leader === "Wendy" && <Crown className="absolute top-2 right-2 h-5 w-5 text-primary/40" />}
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-3">
            <span className="text-lg font-bold text-primary">W</span>
          </div>
          <div className="text-sm text-muted-foreground mb-1">Wendy</div>
          <div className="font-serif text-4xl font-bold text-primary">{wendyWins}</div>
          <div className="text-xs text-muted-foreground mt-1">{wendyPct}% win rate</div>
        </motion.div>
      </div>

      {/* Win bar + stats strip */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span className="font-medium">Zul — {zulWins}W</span>
          <span>{draws} draws</span>
          <span className="font-medium">{wendyWins}W — Wendy</span>
        </div>
        <div className="h-4 rounded-full bg-muted overflow-hidden flex">
          <div className="gradient-gold h-full rounded-l-full transition-all duration-700" style={{ width: `${zulPct}%` }} />
          <div className="gradient-rose h-full rounded-r-full transition-all duration-700" style={{ width: `${wendyPct}%` }} />
        </div>
        {currentStreak && currentStreak.count >= 2 && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-accent" />
            <span>{currentStreak.player} is on a {currentStreak.count}-game win streak!</span>
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeCategory === cat
                ? "gradient-rose text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Game history */}
      {loading && games.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
        {filtered.map((game) => (
          <motion.div key={game.id} variants={item} className="glass-card p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                game.winner === "Zul" ? "bg-accent/10" : game.winner === "Wendy" ? "bg-primary/10" : "bg-muted"
              }`}>
                <Trophy className={`h-4 w-4 ${
                  game.winner === "Zul" ? "text-accent" : game.winner === "Wendy" ? "text-primary" : "text-muted-foreground"
                }`} />
              </div>
              <div>
                <span className="font-medium text-foreground text-sm">{game.game_name}</span>
                <div className="text-xs text-muted-foreground">
                  {game.game_category} · {new Date(game.played_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-sm font-semibold ${
                game.winner === "Zul" ? "text-accent" : game.winner === "Wendy" ? "text-primary" : "text-muted-foreground"
              }`}>
                {game.winner === "Draw" ? "Draw 🤝" : `${game.winner} 🏆`}
              </span>
              {game.score_zul != null && game.score_gf != null && (
                <div className="text-xs text-muted-foreground">{game.score_zul} – {game.score_gf}</div>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
      )}

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No games in this category yet!</p>
        </div>
      )}
    </div>
  );
};

export default GamesPage;
