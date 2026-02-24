import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, MapPin, Search } from "lucide-react";
import { motion } from "framer-motion";
import { mockDates } from "@/data/mockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import datesHero from "@/assets/dates-hero.jpg";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const DatesPage = () => {
  const [search, setSearch] = useState("");

  const filtered = mockDates.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden h-40 sm:h-48">
        <img src={datesHero} alt="Dates" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/50 to-foreground/20" />
        <div className="absolute inset-0 flex items-center justify-between px-6 sm:px-8">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-primary-foreground">Date Log</h1>
            <p className="text-primary-foreground/80 text-sm mt-1">All our adventures, captured forever</p>
          </div>
          <Button className="gradient-rose text-primary-foreground gap-2 shadow-lg">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Date</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-muted/50"
        />
      </div>

      {/* Cards with images */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2">
        {filtered.map((date) => (
          <motion.div key={date.id} variants={item}>
            <Link
              to={`/dates/${date.id}`}
              className="block rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group bg-card"
            >
              {/* Cover image */}
              {date.coverImage && (
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={date.coverImage}
                    alt={date.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent" />
                  <span className="absolute top-3 right-3 text-xl bg-card/80 backdrop-blur-sm rounded-full h-9 w-9 flex items-center justify-center">
                    {date.mood}
                  </span>
                  <div className="absolute bottom-3 left-3">
                    <span className="text-xs bg-primary-foreground/90 text-foreground px-2 py-1 rounded-full font-medium">
                      {new Date(date.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
              )}
              {/* Text */}
              <div className="p-4">
                <h3 className="font-serif text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {date.title}
                </h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3" />
                  {date.location}
                </div>
                <p className="text-sm text-foreground/70 mt-2 line-clamp-2">{date.description}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">No dates found 😢</p>
          <p className="text-sm mt-1">Try a different search or add a new date!</p>
        </div>
      )}
    </div>
  );
};

export default DatesPage;
