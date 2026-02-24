import { useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import type { ChatMessage, DocumentRow } from "@/lib/types";

const CHAT_HISTORY_TURNS = 5;

// ─── useDocuments ────────────────────────────────────────────

export function useDocuments(moduleName?: string) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = moduleName ? `?module=${encodeURIComponent(moduleName)}` : "";
      const data = await apiFetch<DocumentRow[]>(`/api/study/documents${params}`);
      setDocuments(data);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleName]);

  const uploadDocument = useCallback(
    async (file: File, moduleNameOverride?: string) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("module_name", moduleNameOverride || moduleName || "General");

      const result = await apiFetch<{ message: string; document: DocumentRow }>(
        "/api/study/ingest",
        { method: "POST", body: formData }
      );

      // Add the new document optimistically (status: processing)
      setDocuments((prev) => [result.document, ...prev]);

      return result;
    },
    [moduleName]
  );

  const deleteDocument = useCallback(async (docId: string) => {
    await apiFetch(`/api/study/documents/${docId}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  const refreshDocument = useCallback(
    async (docId: string) => {
      // Re-fetch to get updated status
      await fetchDocuments();
    },
    [fetchDocuments]
  );

  return { documents, loading, fetchDocuments, uploadDocument, deleteDocument, refreshDocument };
}

// ─── useChat ─────────────────────────────────────────────────

export function useChat(moduleName?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const [usage, setUsage] = useState<{
    queryCount: number;
    allowed: boolean;
    resetTime: string;
  } | null>(null);

  // Save conversation to server (debounced via caller)
  const saveConversation = useCallback(
    async (msgs: ChatMessage[]) => {
      if (!moduleName || msgs.length === 0) return;
      try {
        await apiFetch("/api/study/conversations", {
          method: "PUT",
          body: JSON.stringify({ module_name: moduleName, messages: msgs }),
        });
      } catch (err) {
        console.error("Failed to save conversation:", err);
      }
    },
    [moduleName]
  );

  // Load existing conversation on mount / module change
  const loadConversation = useCallback(async () => {
    if (!moduleName) return;
    setConversationLoaded(false);
    try {
      const data = await apiFetch<{
        id: string;
        title: string;
        messages: ChatMessage[];
        updated_at: string;
      } | null>(`/api/study/conversations?module=${encodeURIComponent(moduleName)}`);
      if (data?.messages && data.messages.length > 0) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    } finally {
      setConversationLoaded(true);
    }
  }, [moduleName]);

  const sendMessage = useCallback(
    async (question: string, documentId?: string) => {
      // Add user message
      const userMsg: ChatMessage = { role: "user", content: question };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setIsLoading(true);

      try {
        // Build chat history from recent messages for conversation memory
        const recentHistory = updatedMessages
          .slice(-CHAT_HISTORY_TURNS * 2)
          .map((m) => ({ role: m.role, content: m.content }));

        const result = await apiFetch<{
          answer: string;
          sources: { chunkIndex: number; content: string; documentName: string; similarity: number; combinedScore?: number }[];
          usage: { queryCount: number; allowed: boolean; resetTime: string };
          low_confidence?: boolean;
        }>("/api/study/chat", {
          method: "POST",
          body: JSON.stringify({
            question,
            document_id: documentId,
            module_name: moduleName,
            chat_history: recentHistory,
          }),
        });

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: result.answer,
          sources: result.sources,
          low_confidence: result.low_confidence,
        };

        setMessages((prev) => {
          const updated = [...prev, assistantMsg];
          // Auto-save after each exchange
          saveConversation(updated);
          return updated;
        });
        setUsage(result.usage);
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          role: "assistant",
          content: `Error: ${err.message || "Something went wrong"}`,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [saveConversation]
  );

  const clearMessages = useCallback(async () => {
    setMessages([]);
    if (moduleName) {
      try {
        await apiFetch(`/api/study/conversations?module=${encodeURIComponent(moduleName)}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Failed to clear conversation:", err);
      }
    }
  }, [moduleName]);

  const fetchUsage = useCallback(async () => {
    try {
      const data = await apiFetch<{
        queryCount: number;
        allowed: boolean;
        resetTime: string;
      }>("/api/study/usage");
      setUsage(data);
    } catch (err) {
      console.error("Failed to fetch usage:", err);
    }
  }, []);

  return { messages, isLoading, usage, conversationLoaded, sendMessage, clearMessages, fetchUsage, loadConversation };
}

// ─── useVoiceInput ───────────────────────────────────────────

export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = useCallback(() => {
    if (!isSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join("");
      setTranscript(text);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => setTranscript(""), []);

  return { isListening, transcript, isSupported, startListening, stopListening, resetTranscript };
}
