import { useState } from "react";
import { Plus, Trophy, Crown, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { mockGames } from "@/data/mockData";
import { Button } from "@/components/ui/button";
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
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const filtered = activeCategory === "All" ? mockGames : mockGames.filter((g) => g.gameCategory === activeCategory);

  const zulWins = filtered.filter((g) => g.winner === "Zul").length;
  const gfWins = filtered.filter((g) => g.winner === "GF").length;
  const draws = filtered.filter((g) => g.winner === "Draw").length;
  const total = filtered.length;

  const zulPct = total > 0 ? Math.round((zulWins / total) * 100) : 0;
  const gfPct = total > 0 ? Math.round((gfWins / total) * 100) : 0;

  // Calculate streaks
  const recentGames = [...mockGames].sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
  let currentStreak = { player: recentGames[0]?.winner || "", count: 0 };
  for (const g of recentGames) {
    if (g.winner === currentStreak.player && g.winner !== "Draw") {
      currentStreak.count++;
    } else break;
  }

  const leader = zulWins > gfWins ? "Zul" : gfWins > zulWins ? "GF" : null;

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
          <Button className="gradient-rose text-primary-foreground gap-2 shadow-lg">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Log Game</span>
          </Button>
        </div>
      </div>

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
          {leader === "GF" && <Crown className="absolute top-2 right-2 h-5 w-5 text-primary/40" />}
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-3">
            <span className="text-lg font-bold text-primary">G</span>
          </div>
          <div className="text-sm text-muted-foreground mb-1">GF</div>
          <div className="font-serif text-4xl font-bold text-primary">{gfWins}</div>
          <div className="text-xs text-muted-foreground mt-1">{gfPct}% win rate</div>
        </motion.div>
      </div>

      {/* Win bar + stats strip */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span className="font-medium">Zul — {zulWins}W</span>
          <span>{draws} draws</span>
          <span className="font-medium">{gfWins}W — GF</span>
        </div>
        <div className="h-4 rounded-full bg-muted overflow-hidden flex">
          <div className="gradient-gold h-full rounded-l-full transition-all duration-700" style={{ width: `${zulPct}%` }} />
          <div className="gradient-rose h-full rounded-r-full transition-all duration-700" style={{ width: `${gfPct}%` }} />
        </div>
        {currentStreak.count >= 2 && (
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
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
        {filtered.map((game) => (
          <motion.div key={game.id} variants={item} className="glass-card p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                game.winner === "Zul" ? "bg-accent/10" : game.winner === "GF" ? "bg-primary/10" : "bg-muted"
              }`}>
                <Trophy className={`h-4 w-4 ${
                  game.winner === "Zul" ? "text-accent" : game.winner === "GF" ? "text-primary" : "text-muted-foreground"
                }`} />
              </div>
              <div>
                <span className="font-medium text-foreground text-sm">{game.gameName}</span>
                <div className="text-xs text-muted-foreground">
                  {game.gameCategory} · {new Date(game.playedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-sm font-semibold ${
                game.winner === "Zul" ? "text-accent" : game.winner === "GF" ? "text-primary" : "text-muted-foreground"
              }`}>
                {game.winner === "Draw" ? "Draw 🤝" : `${game.winner} 🏆`}
              </span>
              {game.scoreZul != null && game.scoreGf != null && (
                <div className="text-xs text-muted-foreground">{game.scoreZul} – {game.scoreGf}</div>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No games in this category yet!</p>
        </div>
      )}
    </div>
  );
};

export default GamesPage;
