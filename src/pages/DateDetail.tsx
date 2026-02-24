import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar as CalendarIcon, Pencil, Trash2, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { mockDates, mockGames } from "@/data/mockData";
import { Button } from "@/components/ui/button";

const DateDetail = () => {
  const { id } = useParams();
  const date = mockDates.find((d) => d.id === id);
  const linkedGames = mockGames.filter((g) => g.dateId === id);

  if (!date) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-lg">Date not found</p>
        <Link to="/dates" className="text-primary text-sm mt-2 inline-block hover:underline">
          ← Back to dates
        </Link>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl mx-auto">
      {/* Back */}
      <Link to="/dates" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to dates
      </Link>

      {/* Cover Image */}
      {date.coverImage && (
        <div className="relative rounded-2xl overflow-hidden h-56 sm:h-72">
          <img src={date.coverImage} alt={date.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
            <div>
              <span className="text-3xl mr-2">{date.mood}</span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-primary-foreground">{date.title}</h1>
              <div className="flex items-center gap-4 text-sm text-primary-foreground/80 mt-2">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {date.location}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {new Date(date.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9 bg-card/80 backdrop-blur-sm border-primary-foreground/20">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9 bg-card/80 backdrop-blur-sm border-primary-foreground/20 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* No cover fallback header */}
      {!date.coverImage && (
        <div>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-3xl mr-2">{date.mood}</span>
              <h1 className="inline font-serif text-3xl font-bold text-foreground">{date.title}</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9"><Pencil className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-9 w-9 text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{date.location}</span>
            <span className="flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" />{new Date(date.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
        </div>
      )}

      {/* Description */}
      <div className="glass-card p-5">
        <p className="text-foreground/90 leading-relaxed">{date.description}</p>
      </div>

      {/* Journal */}
      {date.journalEntry && (
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground mb-3">📖 Journal</h2>
          <div className="glass-card p-5 border-l-4 border-primary/40">
            <p className="text-foreground/85 leading-relaxed italic">{date.journalEntry}</p>
          </div>
        </div>
      )}

      {/* Linked games */}
      {linkedGames.length > 0 && (
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground mb-3">🎮 Games Played</h2>
          <div className="space-y-2">
            {linkedGames.map((game) => (
              <div key={game.id} className="glass-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                    game.winner === "Zul" ? "bg-accent/10" : game.winner === "GF" ? "bg-primary/10" : "bg-muted"
                  }`}>
                    <Trophy className={`h-4 w-4 ${
                      game.winner === "Zul" ? "text-accent" : game.winner === "GF" ? "text-primary" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div>
                    <span className="font-medium text-foreground">{game.gameName}</span>
                    <span className="text-sm text-muted-foreground ml-2">({game.gameCategory})</span>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${
                  game.winner === "Zul" ? "text-accent" : game.winner === "GF" ? "text-primary" : "text-muted-foreground"
                }`}>
                  {game.winner === "Draw" ? "Draw 🤝" : `${game.winner} wins 🏆`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default DateDetail;
