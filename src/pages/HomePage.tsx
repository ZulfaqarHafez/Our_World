import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Calendar, Gamepad2, BookOpen, Heart, ArrowRight, MapPin, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useDates, useGames } from "@/hooks/useDatesGames";
import coupleIllustration from "@/assets/couple-illustration.jpg";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const HomePage = () => {
  const { dates, loading: datesLoading, fetchDates } = useDates();
  const { stats, loading: gamesLoading, fetchStats } = useGames();

  useEffect(() => {
    fetchDates();
    fetchStats();
  }, [fetchDates, fetchStats]);

  const recentDates = dates.slice(0, 3);
  const zulWins = stats?.zulWins ?? 0;
  const wendyWins = stats?.wendyWins ?? 0;
  const total = stats?.total ?? 0;
  const zulPct = stats?.zulPct ?? 0;
  const wendyPct = stats?.wendyPct ?? 0;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      {/* Hero Banner */}
      <motion.div variants={item} className="relative rounded-2xl overflow-hidden">
        <div className="gradient-rose p-6 sm:p-8 flex items-center gap-6">
          <div className="flex-1 z-10">
            <h1 className="font-serif text-2xl sm:text-4xl font-bold text-primary-foreground mb-2">
              Welcome back 💕
            </h1>
            <p className="text-primary-foreground/80 text-sm sm:text-base max-w-md">
              Here's what's happening in our little world. {dates.length} dates logged, {total} games played, and counting…
            </p>
          </div>
          <img
            src={coupleIllustration}
            alt="Us"
            className="hidden sm:block h-32 w-32 rounded-xl object-cover shadow-lg border-2 border-primary-foreground/20"
          />
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "Dates", value: dates.length.toString(), icon: Calendar, color: "text-primary", bg: "bg-primary/10" },
          { label: "Games", value: total.toString(), icon: Gamepad2, color: "text-accent", bg: "bg-accent/10" },
          { label: "Memories", value: "∞", icon: Heart, color: "text-primary", bg: "bg-primary/10" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4 sm:p-5 text-center group hover:shadow-md transition-shadow">
            <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg ${stat.bg} mb-3`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div className="font-serif text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
          </div>
        ))}
      </motion.div>

      {/* Recent Dates - Photo cards */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-semibold text-foreground">Recent Adventures</h2>
          <Link to="/dates" className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {recentDates.length === 0 && !datesLoading ? (
            <div className="sm:col-span-3 text-center py-8 text-muted-foreground">
              <p className="text-sm">No dates logged yet. Start your first adventure!</p>
            </div>
          ) : recentDates.map((date) => (
            <Link
              key={date.id}
              to={`/dates/${date.id}`}
              className="group block rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
            >
              <div className="relative h-40 overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl opacity-30">{date.mood || "💕"}</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="font-serif text-base font-semibold text-primary-foreground truncate">{date.title}</h3>
                  {date.location && (
                    <p className="text-xs text-primary-foreground/80 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {date.location}
                    </p>
                  )}
                </div>
                <span className="absolute top-3 right-3 text-lg">{date.mood || "💕"}</span>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Score snapshot */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-semibold text-foreground">Scoreboard</h2>
          <Link to="/games" className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">
            Full board <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="glass-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              <div className="font-serif text-3xl font-bold text-accent">{zulWins}</div>
              <div className="text-sm text-muted-foreground mt-1">Zul</div>
            </div>
            <div className="text-center px-6">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">vs</div>
            </div>
            <div className="text-center flex-1">
              <div className="font-serif text-3xl font-bold text-primary">{wendyWins}</div>
              <div className="text-sm text-muted-foreground mt-1">Wendy</div>
            </div>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden flex">
            <div className="gradient-gold h-full rounded-l-full transition-all duration-700" style={{ width: `${zulPct}%` }} />
            <div className="gradient-rose h-full rounded-r-full transition-all duration-700" style={{ width: `${wendyPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{zulPct}%</span>
            <span>{wendyPct}%</span>
          </div>
        </div>
      </motion.div>

      {/* Quick actions */}
      <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Link to="/dates" className="glass-card p-5 text-center hover:shadow-md transition-all group">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 mb-3 group-hover:scale-110 transition-transform">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground block">New Date Entry</span>
          <span className="text-xs text-muted-foreground mt-1 block">Log a memory</span>
        </Link>
        <Link to="/games" className="glass-card p-5 text-center hover:shadow-md transition-all group">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-accent/10 mb-3 group-hover:scale-110 transition-transform">
            <Gamepad2 className="h-6 w-6 text-accent" />
          </div>
          <span className="text-sm font-medium text-foreground block">Log a Game</span>
          <span className="text-xs text-muted-foreground mt-1 block">Track the score</span>
        </Link>
        <Link to="/study" className="glass-card p-5 text-center hover:shadow-md transition-all group col-span-2 sm:col-span-1">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-muted mb-3 group-hover:scale-110 transition-transform">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium text-foreground block">Study Assistant</span>
          <span className="text-xs text-muted-foreground mt-1 block">AI-powered notes</span>
        </Link>
      </motion.div>
    </motion.div>
  );
};

export default HomePage;
