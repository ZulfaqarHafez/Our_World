import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Plus, MapPin, Search, Loader2, X, Calendar as CalendarIcon, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDates } from "@/hooks/useDatesGames";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAccessToken } from "@/lib/api";
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
  const { dates, loading, createDate } = useDates();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    title: "",
    date: new Date().toISOString().split("T")[0],
    location: "",
    description: "",
    mood: "",
    journal_entry: "",
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate previews when files change
  useEffect(() => {
    const urls = imageFiles.map((f) => URL.createObjectURL(f));
    setImagePreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [imageFiles]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    setImageFiles((prev) => [...prev, ...toAdd]);
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Upload images and return storage paths
  const uploadImages = async (): Promise<string[]> => {
    if (imageFiles.length === 0) return [];
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");
    const fd = new FormData();
    imageFiles.forEach((f) => fd.append("images", f));
    const res = await fetch("/api/photos/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Upload failed");
    }
    const data = await res.json();
    return data.paths as string[];
  };

  const filtered = dates.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.location.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    setFormError("");
    try {
      // Upload images first
      const photoPaths = await uploadImages();

      await createDate({
        title: form.title,
        date: form.date,
        location: form.location,
        description: form.description,
        mood: form.mood || undefined,
        journal_entry: form.journal_entry || undefined,
        photos: photoPaths.length > 0 ? photoPaths : undefined,
      });
      setShowAdd(false);
      setForm({ title: "", date: new Date().toISOString().split("T")[0], location: "", description: "", mood: "", journal_entry: "" });
      setImageFiles([]);
    } catch (err: any) {
      console.error("Create failed:", err);
      setFormError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

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
          <Button className="gradient-rose text-primary-foreground gap-2 shadow-lg" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Date</span>
          </Button>
        </div>
      </div>

      {/* Add new date form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-5 space-y-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-serif text-lg font-semibold text-foreground">Log a New Date</h2>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                placeholder="Title *"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
              <Input
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
              <Input
                placeholder="Mood emoji (e.g. 🥰)"
                value={form.mood}
                onChange={(e) => setForm((f) => ({ ...f, mood: e.target.value }))}
                maxLength={4}
              />
            </div>
            <Textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
            />
            <Textarea
              placeholder="Journal entry (optional)"
              value={form.journal_entry}
              onChange={(e) => setForm((f) => ({ ...f, journal_entry: e.target.value }))}
              rows={3}
            />

            {/* Image upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Photos ({imageFiles.length}/5)</span>
                {imageFiles.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4" />
                    Add Photos
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>
              {imagePreviews.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border">
                      <img src={src} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF, HEIC — max 5 MB each</p>
            </div>

            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{formError}</p>
            )}

            <Button
              className="gradient-rose text-primary-foreground w-full"
              disabled={!form.title.trim() || saving}
              onClick={handleCreate}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Date
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Cards */}
      {loading && dates.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2">
        {filtered.map((date) => (
          <motion.div key={date.id} variants={item}>
            <Link
              to={`/dates/${date.id}`}
              className="block rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group bg-card"
            >
              {/* Visual header with photo or mood */}
              <div className="relative h-32 overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
                {date.cover_url ? (
                  <img
                    src={date.cover_url}
                    alt={date.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-5xl opacity-40">{date.mood || "💕"}</span>
                  </div>
                )}
                <span className="absolute top-3 right-3 text-xl bg-card/80 backdrop-blur-sm rounded-full h-9 w-9 flex items-center justify-center">
                  {date.mood || "💕"}
                </span>
                <div className="absolute bottom-3 left-3">
                  <span className="text-xs bg-primary-foreground/90 text-foreground px-2 py-1 rounded-full font-medium">
                    {new Date(date.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
              {/* Text */}
              <div className="p-4">
                <h3 className="font-serif text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {date.title}
                </h3>
                {date.location && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    {date.location}
                  </div>
                )}
                {date.description && (
                  <p className="text-sm text-foreground/70 mt-2 line-clamp-2">{date.description}</p>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-16 text-muted-foreground">
          {dates.length === 0 ? (
            <>
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg">No dates logged yet</p>
              <p className="text-sm mt-1">Tap "New Date" to capture your first adventure!</p>
            </>
          ) : (
            <>
              <p className="text-lg">No dates found 😢</p>
              <p className="text-sm mt-1">Try a different search!</p>
            </>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default DatesPage;
