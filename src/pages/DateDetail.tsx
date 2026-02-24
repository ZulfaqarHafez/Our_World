import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar as CalendarIcon, Pencil, Trash2, Trophy, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useDates } from "@/hooks/useDatesGames";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { DateRow, GameRow } from "@/lib/types";

const DateDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchDate, deleteDate } = useDates();
  const [dateEntry, setDateEntry] = useState<(DateRow & { games: GameRow[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchDate(id)
      .then((data) => setDateEntry(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, fetchDate]);

  // Fetch signed URLs for photos
  useEffect(() => {
    if (!dateEntry || !dateEntry.photos || dateEntry.photos.length === 0) {
      setPhotoUrls([]);
      return;
    }
    (async () => {
      try {
        const data = await apiFetch<{ urls: { path: string; signedUrl: string }[] }>("/api/photos/sign", {
          method: "POST",
          body: JSON.stringify({ paths: dateEntry.photos }),
        });
        setPhotoUrls(data.urls.map((u) => u.signedUrl).filter(Boolean));
      } catch {
        setPhotoUrls([]);
      }
    })();
  }, [dateEntry]);

  const handleDelete = async () => {
    if (!id || !confirm("Delete this date entry?")) return;
    try {
      await deleteDate(id);
      navigate("/dates");
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !dateEntry) {
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

      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden h-56 sm:h-72 bg-gradient-to-br from-primary/20 to-accent/20">
        {photoUrls[0] ? (
          <img src={photoUrls[0]} alt={dateEntry.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-8xl opacity-20">{dateEntry.mood || "💕"}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent" />
        <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
          <div>
            <span className="text-3xl mr-2">{dateEntry.mood || "💕"}</span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-primary-foreground">{dateEntry.title}</h1>
            <div className="flex items-center gap-4 text-sm text-primary-foreground/80 mt-2">
              {dateEntry.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {dateEntry.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5" />
                {new Date(dateEntry.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9 bg-card/80 backdrop-blur-sm border-primary-foreground/20">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 bg-card/80 backdrop-blur-sm border-primary-foreground/20 text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Description */}
      {dateEntry.description && (
        <div className="glass-card p-5">
          <p className="text-foreground/90 leading-relaxed">{dateEntry.description}</p>
        </div>
      )}

      {/* Photos Gallery */}
      {photoUrls.length > 0 && (
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground mb-3">📸 Photos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photoUrls.map((url, i) => (
              <div key={i} className="rounded-xl overflow-hidden aspect-square shadow-sm hover:shadow-md transition-shadow">
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                  onClick={() => window.open(url, "_blank")}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Journal */}
      {dateEntry.journal_entry && (
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground mb-3">📖 Journal</h2>
          <div className="glass-card p-5 border-l-4 border-primary/40">
            <p className="text-foreground/85 leading-relaxed italic">{dateEntry.journal_entry}</p>
          </div>
        </div>
      )}

      {/* Linked games */}
      {dateEntry.games && dateEntry.games.length > 0 && (
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground mb-3">🎮 Games Played</h2>
          <div className="space-y-2">
            {dateEntry.games.map((game) => (
              <div key={game.id} className="glass-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                    game.winner === "Zul" ? "bg-accent/10" : game.winner === "Wendy" ? "bg-primary/10" : "bg-muted"
                  }`}>
                    <Trophy className={`h-4 w-4 ${
                      game.winner === "Zul" ? "text-accent" : game.winner === "Wendy" ? "text-primary" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div>
                    <span className="font-medium text-foreground">{game.game_name}</span>
                    <span className="text-sm text-muted-foreground ml-2">({game.game_category})</span>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${
                  game.winner === "Zul" ? "text-accent" : game.winner === "Wendy" ? "text-primary" : "text-muted-foreground"
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
