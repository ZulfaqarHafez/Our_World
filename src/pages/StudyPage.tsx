import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  BookOpen,
  Upload,
  MessageSquare,
  Mic,
  MicOff,
  Plus,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  FileText,
  Trash2,
  Loader2,
  Send,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Sparkles,
  Lightbulb,
  ListChecks,
  HelpCircle,
  Copy,
  Check,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDocuments, useChat, useVoiceInput } from "@/hooks/useStudy";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { DocumentRow, ChatMessage } from "@/lib/types";

// ─── Subject helpers ─────────────────────────────────────────

interface Subject {
  name: string;
  color: string;
  documentCount: number;
}

function deriveSubjects(documents: DocumentRow[]): Subject[] {
  const map = new Map<string, number>();
  for (const doc of documents) {
    map.set(doc.module_name, (map.get(doc.module_name) || 0) + 1);
  }
  const colors = [
    "bg-primary/15 text-primary",
    "bg-accent/15 text-accent-foreground",
    "bg-muted text-muted-foreground",
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
    "bg-purple-100 text-purple-700",
  ];
  return Array.from(map.entries()).map(([name, count], i) => ({
    name,
    color: colors[i % colors.length],
    documentCount: count,
  }));
}

// ─── Animations ──────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

// ─── Starter prompts ────────────────────────────────────────

interface StarterPrompt {
  icon: React.ReactNode;
  label: string;
  question: string;
}

function getStarterPrompts(subjectName: string, docNames: string[]): StarterPrompt[] {
  const docContext = docNames.length > 0
    ? ` from ${docNames.length === 1 ? `"${docNames[0]}"` : "my uploaded materials"}`
    : "";
  return [
    {
      icon: <Sparkles className="h-4 w-4" />,
      label: "Summarize key concepts",
      question: `Summarize the key concepts and main ideas${docContext}.`,
    },
    {
      icon: <ListChecks className="h-4 w-4" />,
      label: "Create a study outline",
      question: `Create a structured study outline covering the main topics${docContext}.`,
    },
    {
      icon: <Lightbulb className="h-4 w-4" />,
      label: "Explain important terms",
      question: `What are the most important terms and definitions I should know${docContext}?`,
    },
    {
      icon: <HelpCircle className="h-4 w-4" />,
      label: "Practice questions",
      question: `Generate 5 practice questions with answers to test my understanding of the material${docContext}.`,
    },
  ];
}

// ─── Component ───────────────────────────────────────────────

const StudyPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [view, setView] = useState<"subjects" | "chat">("subjects");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [scopeToDoc, setScopeToDoc] = useState<string | undefined>(undefined);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Hooks — always fetch ALL documents so the subject list stays complete.
  // We filter to the active subject in derived state below.
  const {
    documents,
    loading: docsLoading,
    uploading,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
  } = useDocuments(undefined);

  const {
    messages,
    isLoading: chatLoading,
    usage,
    conversationLoaded,
    sendMessage,
    clearMessages,
    fetchUsage,
    loadConversation,
  } = useChat(activeSubject || undefined);

  const { isListening, transcript, isSupported: voiceSupported, startListening, stopListening, resetTranscript } =
    useVoiceInput();

  // Fetch documents on mount / subject change
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Load existing conversation when entering chat view
  useEffect(() => {
    if (view === "chat" && activeSubject) {
      loadConversation();
    }
  }, [view, activeSubject, loadConversation]);

  // Fetch usage on mount
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Voice transcript → input
  useEffect(() => {
    if (transcript) setChatInput(transcript);
  }, [transcript]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Search: find matching message indices
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return messages
      .map((msg, i) => (msg.content.toLowerCase().includes(q) ? i : -1))
      .filter((i) => i !== -1);
  }, [messages, searchQuery]);

  // Scroll to active match
  useEffect(() => {
    if (searchMatches.length > 0 && activeMatchIndex < searchMatches.length) {
      const msgIdx = searchMatches[activeMatchIndex];
      const el = messageRefs.current.get(msgIdx);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeMatchIndex, searchMatches]);

  // Reset match index when query changes
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchQuery]);

  const navigateMatch = useCallback(
    (direction: "prev" | "next") => {
      if (searchMatches.length === 0) return;
      setActiveMatchIndex((prev) =>
        direction === "next"
          ? (prev + 1) % searchMatches.length
          : (prev - 1 + searchMatches.length) % searchMatches.length
      );
    },
    [searchMatches.length]
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setActiveMatchIndex(0);
  }, []);

  // Derived
  const subjects = deriveSubjects(documents);
  const subjectDocs = activeSubject
    ? documents.filter((d) => d.module_name === activeSubject)
    : documents;
  const readyDocs = subjectDocs.filter((d) => d.status === "ready");

  // Handlers
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md"];
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSubject) return;

    // Validate file extension
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast({ title: "Invalid file type", description: "Only PDF, TXT, and MD files are supported.", variant: "destructive" });
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: `Max file size is 10 MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`, variant: "destructive" });
      e.target.value = "";
      return;
    }
    try {
      await uploadDocument(file, activeSubject);
      toast({ title: "Upload started", description: `"${file.name}" is being processed. Status updates automatically.` });
    } catch (err: any) {
      console.error("Upload failed:", err);
      toast({ title: "Upload failed", description: err.message || "Something went wrong.", variant: "destructive" });
    }
    e.target.value = "";
  };

  const handleSend = async () => {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    if (q.length > 2000) {
      toast({ title: "Question too long", description: "Max 2000 characters.", variant: "destructive" });
      return;
    }
    setChatInput("");
    resetTranscript();
    await sendMessage(q, scopeToDoc);
  };

  const handleNewSubject = () => {
    const name = newSubjectName.trim();
    if (!name) return;
    setNewSubjectName("");
    setShowNewSubject(false);
    setActiveSubject(name);
    setView("chat");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden h-40 sm:h-48 gradient-rose">
        <div className="absolute inset-0 flex items-center px-6 sm:px-8">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-primary-foreground">
              Study Assistant
            </h1>
            <p className="text-primary-foreground/80 text-sm mt-1">
              AI-powered study buddy — upload notes and ask questions based on your materials
            </p>
          </div>
        </div>
      </div>

      {view === "subjects" ? (
        /* ═══════ Subject Selection View ═══════ */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-foreground">Your Subjects</h2>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowNewSubject(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New Subject
            </Button>
          </div>

          {/* New subject input */}
          <AnimatePresence>
            {showNewSubject && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-2"
              >
                <Input
                  placeholder="e.g. Computer Science"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleNewSubject()}
                  autoFocus
                />
                <Button onClick={handleNewSubject} className="gradient-rose text-primary-foreground">
                  Create
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowNewSubject(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {docsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {subjects.map((subject) => (
                <motion.button
                  key={subject.name}
                  variants={item}
                  onClick={() => {
                    setScopeToDoc(undefined);
                    setActiveSubject(subject.name);
                    setView("chat");
                  }}
                  className="glass-card p-6 text-left hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`inline-flex items-center justify-center h-10 w-10 rounded-lg ${subject.color}`}
                    >
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-foreground mb-1">
                    {subject.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {subject.documentCount} {subject.documentCount === 1 ? "document" : "documents"}
                  </p>
                </motion.button>
              ))}

              {/* Add subject card */}
              <motion.button
                variants={item}
                onClick={() => setShowNewSubject(true)}
                className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary/70 transition-all min-h-[140px]"
              >
                <Plus className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-sm font-medium">Add Subject</span>
              </motion.button>
            </motion.div>
          )}

          {/* Info */}
          <div className="glass-card p-5 flex items-start gap-4">
            <BookOpen className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="font-serif text-sm font-semibold text-foreground mb-1">How it works</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Create a subject, upload your lecture PDFs, and the AI will answer questions based
                only on your uploaded materials. Each subject keeps its documents separate so answers
                stay relevant.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ═══════ Chat View ═══════ */
        <div className="space-y-4">
          {/* Header bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setView("subjects");
                setActiveSubject(null);
                setScopeToDoc(undefined);
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              ← Back to subjects
            </button>

            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`text-xs gap-1 ${searchOpen ? 'text-primary' : 'text-muted-foreground'}`}
                    onClick={() => searchOpen ? closeSearch() : setSearchOpen(true)}
                  >
                    <Search className="h-3 w-3" />
                    Search
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-destructive gap-1"
                    onClick={() => {
                      if (confirm("Clear this conversation?")) clearMessages();
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear chat
                  </Button>
                </>
              )}
              {/* Usage meter */}
              {usage && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {usage.queryCount} / 50 queries
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 h-[calc(100vh-18rem)]">
            {/* ── Sidebar: Documents ── */}
            <div className="glass-card p-5 space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-lg font-semibold text-foreground">
                    {activeSubject}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Documents</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">PDF, TXT, MD — max 10 MB</p>

              {/* Scope filter */}
              <div className="space-y-1">
                <button
                  onClick={() => setScopeToDoc(undefined)}
                  className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                    !scopeToDoc ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  All documents
                </button>
              </div>

              {/* Document list */}
              {subjectDocs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No documents yet</p>
                  <p className="text-xs mt-1">Upload PDFs or text files to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {subjectDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                        scopeToDoc === doc.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => setScopeToDoc(scopeToDoc === doc.id ? undefined : doc.id)}
                    >
                      <div className="mt-0.5">
                        {doc.status === "processing" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-accent" />
                        ) : doc.status === "ready" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{doc.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.status === "processing"
                            ? "Processing..."
                            : doc.status === "ready"
                            ? `${doc.chunk_count} chunks`
                            : "Error"}
                          {" · "}
                          {new Date(doc.uploaded_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                        {doc.summary && scopeToDoc === doc.id && (
                          <p className="text-xs text-muted-foreground/80 mt-1.5 leading-relaxed line-clamp-3">
                            {doc.summary}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${doc.filename}"?`)) {
                            try {
                              await deleteDocument(doc.id);
                              if (scopeToDoc === doc.id) setScopeToDoc(undefined);
                              toast({ title: "Document deleted", description: `"${doc.filename}" has been removed.` });
                              fetchDocuments(); // refresh the list
                            } catch (err: any) {
                              toast({ title: "Delete failed", description: err.message || "Something went wrong.", variant: "destructive" });
                            }
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Chat area ── */}
            <div className="md:col-span-2 glass-card p-5 flex flex-col">
              {/* Search bar */}
              <AnimatePresence>
                {searchOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-3"
                  >
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border">
                      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search in conversation..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") navigateMatch(e.shiftKey ? "prev" : "next");
                          if (e.key === "Escape") closeSearch();
                        }}
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                      {searchQuery && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {searchMatches.length > 0
                            ? `${activeMatchIndex + 1} / ${searchMatches.length}`
                            : "No matches"}
                        </span>
                      )}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => navigateMatch("prev")}
                          disabled={searchMatches.length === 0}
                          className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => navigateMatch("next")}
                          disabled={searchMatches.length === 0}
                          className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={closeSearch}
                        className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {!conversationLoaded ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center">
                    <div className="text-center text-muted-foreground mb-6">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <h3 className="font-serif text-lg font-semibold text-foreground/70 mb-1">
                        Start a conversation
                      </h3>
                      <p className="text-sm max-w-sm">
                        {readyDocs.length > 0
                          ? `Ask questions about your ${activeSubject} materials. The AI answers based only on your uploaded content.`
                          : `Upload your ${activeSubject} materials first, then ask questions.`}
                      </p>
                    </div>

                    {/* Starter prompts */}
                    {readyDocs.length > 0 && (
                      <motion.div
                        variants={container}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg px-4"
                      >
                        {getStarterPrompts(
                          activeSubject || "",
                          readyDocs.map((d) => d.filename)
                        ).map((prompt, i) => (
                          <motion.button
                            key={i}
                            variants={item}
                            onClick={() => {
                              setChatInput(prompt.question);
                              // Auto-send after a brief delay so user sees what's sent
                              setTimeout(() => {
                                sendMessage(prompt.question, scopeToDoc);
                                setChatInput("");
                              }, 100);
                            }}
                            disabled={chatLoading}
                            className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-all text-left group"
                          >
                            <div className="mt-0.5 text-primary/60 group-hover:text-primary transition-colors">
                              {prompt.icon}
                            </div>
                            <span className="text-sm text-foreground/70 group-hover:text-foreground transition-colors">
                              {prompt.label}
                            </span>
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                ) : (
                  messages.map((msg, i) => (
                    <div
                      key={i}
                      ref={(el) => { if (el) messageRefs.current.set(i, el); }}
                      className={`transition-opacity duration-200 ${
                        searchQuery && !searchMatches.includes(i) ? "opacity-30" : ""
                      } ${
                        searchQuery && searchMatches[activeMatchIndex] === i
                          ? "ring-2 ring-primary/40 rounded-2xl"
                          : ""
                      }`}
                    >
                      <ChatBubble
                        message={msg}
                        searchQuery={searchQuery}
                      />
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Rate limit warning */}
              {usage && !usage.allowed && (
                <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3 mt-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    Daily limit reached ({usage.queryCount}/50 queries). Resets at midnight SGT.
                  </span>
                </div>
              )}

              {/* Chat input */}
              <div className="flex gap-2 mt-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder={
                      readyDocs.length > 0
                        ? `Ask about ${activeSubject}...`
                        : "Upload documents first..."
                    }
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    disabled={readyDocs.length === 0 || (usage !== null && !usage.allowed)}
                    className="w-full h-11 pl-4 pr-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  />
                  {voiceSupported && (
                    <button
                      onClick={isListening ? stopListening : startListening}
                      disabled={readyDocs.length === 0}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                        isListening
                          ? "text-destructive animate-pulse"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                <Button
                  className="gradient-rose text-primary-foreground"
                  disabled={
                    !chatInput.trim() ||
                    chatLoading ||
                    readyDocs.length === 0 ||
                    (usage !== null && !usage.allowed)
                  }
                  onClick={handleSend}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {isListening && (
                <p className="text-xs text-accent text-center mt-2 animate-pulse">
                  🎙️ Listening... speak your question
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ─── Highlight helper ────────────────────────────────────────

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-300/60 dark:bg-yellow-500/30 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ─── Chat Bubble Component ───────────────────────────────────

function ChatBubble({ message, searchQuery = "" }: { message: ChatMessage; searchQuery?: string }) {
  const isUser = message.role === "user";
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = message.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "gradient-rose text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        }`}
      >
        {/* Copy button (assistant messages only) */}
        {!isUser && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
            title="Copy as markdown"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}

        {/* Low-confidence warning */}
        {message.low_confidence && (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Low confidence — the retrieved context may not fully cover this topic.</span>
          </div>
        )}

        {isUser ? (
          <div className="whitespace-pre-wrap">
            <HighlightedText text={message.content} query={searchQuery} />
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_strong]:font-bold [&_table]:my-2 [&_table]:text-xs [&_th]:px-2 [&_th]:py-1 [&_th]:border [&_th]:border-foreground/20 [&_th]:bg-foreground/5 [&_th]:font-semibold [&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-foreground/10 [&_code]:text-xs [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-foreground/10 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:border-l-2 [&_blockquote]:border-foreground/20 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-2 [&_hr]:my-3 [&_hr]:border-foreground/10">
            {searchQuery ? (
              <HighlightedText text={message.content} query={searchQuery} />
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}

        {/* Source citations with expandable details */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-foreground/10">
            <button
              onClick={() => setSourcesExpanded(!sourcesExpanded)}
              className="flex items-center gap-1.5 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity w-full text-left"
            >
              {sourcesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span>{message.sources.length} source{message.sources.length > 1 ? "s" : ""} referenced</span>
            </button>

            {/* Always show source names */}
            <div className="mt-1.5 space-y-1">
              {message.sources.map((s, i) => (
                <div key={i} className="text-xs">
                  <div className="flex items-center gap-2 opacity-70">
                    <span>📄 {s.documentName}</span>
                    <span className="text-[10px] opacity-50">chunk {s.chunkIndex}</span>
                    {s.similarity !== undefined && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        s.similarity >= 0.7 ? "bg-green-500/15 text-green-600 dark:text-green-400" :
                        s.similarity >= 0.5 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                        "bg-red-500/15 text-red-500"
                      }`}>
                        {Math.round(s.similarity * 100)}% match
                      </span>
                    )}
                  </div>
                  {/* Expandable content preview */}
                  {sourcesExpanded && s.content && (
                    <div className="mt-1 ml-5 p-2 rounded bg-foreground/5 text-[11px] leading-relaxed opacity-60 whitespace-pre-wrap">
                      {s.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default StudyPage;
