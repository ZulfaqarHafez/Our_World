import { Router, Request, Response } from "express";
import multer from "multer";
// @ts-ignore - pdf-parse types mismatch in ESM
import pdf from "pdf-parse";
import {
  getSupabaseAdmin,
  getOpenAI,
  getUserFromRequest,
} from "../lib/clients.js";

export const studyRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Constants ───────────────────────────────────────────────

const CHUNK_SIZE = 500;       // ~500 tokens per chunk
const CHUNK_OVERLAP = 50;     // 50-token overlap
const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4o-mini";
const DAILY_QUERY_LIMIT = 50;
const DAILY_COST_LIMIT = 5.0; // USD
const INPUT_COST_PER_M = 0.15;
const OUTPUT_COST_PER_M = 0.6;

// ─── Helpers ─────────────────────────────────────────────────

function splitIntoChunks(text: string): string[] {
  // Split by sentences/paragraphs, then group into ~CHUNK_SIZE word chunks
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(" ");
    if (chunk.trim().length > 20) {
      chunks.push(chunk.trim());
    }
  }
  return chunks;
}

async function checkRateLimit(
  userId: string
): Promise<{ allowed: boolean; queryCount: number; costUsd: number; resetTime: string }> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("api_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("window_date", today)
    .single();

  const queryCount = data?.query_count || 0;
  const costUsd = parseFloat(data?.cost_usd || "0");

  // Calculate reset time (midnight SGT = UTC+8)
  const now = new Date();
  const resetTomorrow = new Date(now);
  resetTomorrow.setUTCDate(resetTomorrow.getUTCDate() + 1);
  resetTomorrow.setUTCHours(16, 0, 0, 0); // midnight SGT = 16:00 UTC
  if (now.getUTCHours() >= 16) {
    resetTomorrow.setUTCDate(resetTomorrow.getUTCDate());
  }

  // Check combined cost across all users today
  const { data: allUsage } = await supabase
    .from("api_usage")
    .select("cost_usd")
    .eq("window_date", today);
  const totalCost = (allUsage || []).reduce((sum, row) => sum + parseFloat(row.cost_usd || "0"), 0);

  const allowed = queryCount < DAILY_QUERY_LIMIT && totalCost < DAILY_COST_LIMIT;

  return {
    allowed,
    queryCount,
    costUsd: totalCost,
    resetTime: resetTomorrow.toISOString(),
  };
}

async function updateUsage(userId: string, inputTokens: number, outputTokens: number) {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const cost = (inputTokens * INPUT_COST_PER_M + outputTokens * OUTPUT_COST_PER_M) / 1_000_000;

  // Upsert: increment the existing row or create a new one
  const { data: existing } = await supabase
    .from("api_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("window_date", today)
    .single();

  if (existing) {
    await supabase
      .from("api_usage")
      .update({
        query_count: existing.query_count + 1,
        tokens_used: existing.tokens_used + inputTokens + outputTokens,
        cost_usd: parseFloat(existing.cost_usd) + cost,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("api_usage").insert({
      user_id: userId,
      query_count: 1,
      tokens_used: inputTokens + outputTokens,
      cost_usd: cost,
      window_date: today,
    });
  }
}

// ─── POST /api/study/ingest — Upload & embed a document ─────

studyRouter.post("/ingest", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const file = req.file;
    const moduleName = (req.body.module_name as string) || "General";

    if (!file) return res.status(400).json({ error: "No file uploaded" });

    // 1. Parse PDF text
    let text = "";
    if (file.mimetype === "application/pdf") {
      const pdfData = await pdf(file.buffer);
      text = pdfData.text;
    } else if (
      file.mimetype === "text/plain" ||
      file.mimetype === "text/markdown"
    ) {
      text = file.buffer.toString("utf-8");
    } else {
      return res.status(400).json({ error: "Unsupported file type. Upload PDF or TXT files." });
    }

    if (text.trim().length < 50) {
      return res.status(400).json({ error: "Document contains too little text to process." });
    }

    const supabase = getSupabaseAdmin();
    const openai = getOpenAI();

    // 2. Upload file to Supabase Storage
    const storagePath = `${user.id}/${Date.now()}_${file.originalname}`;
    const { error: uploadErr } = await supabase.storage
      .from("lecture-materials")
      .upload(storagePath, file.buffer, { contentType: file.mimetype });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return res.status(500).json({ error: "Failed to upload file to storage" });
    }

    // 3. Create document record
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        filename: file.originalname,
        file_path: storagePath,
        uploaded_by: user.id,
        module_name: moduleName,
        status: "processing",
      })
      .select()
      .single();

    if (docErr || !doc) {
      console.error("Document insert error:", docErr);
      return res.status(500).json({ error: "Failed to create document record" });
    }

    // Return immediately — process embeddings async
    res.json({
      message: "Document uploaded. Processing embeddings...",
      document: doc,
    });

    // 4. Split text into chunks
    const chunks = splitIntoChunks(text);

    // 5. Embed all chunks (batch)
    try {
      const batchSize = 20;
      const allChunkRows: { document_id: string; content: string; embedding: number[]; chunk_index: number }[] = [];

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const embeddingRes = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch,
        });

        for (let j = 0; j < batch.length; j++) {
          allChunkRows.push({
            document_id: doc.id,
            content: batch[j],
            embedding: embeddingRes.data[j].embedding as unknown as number[],
            chunk_index: i + j,
          });
        }
      }

      // 6. Insert chunks into database
      const { error: chunkErr } = await supabase
        .from("document_chunks")
        .insert(allChunkRows);

      if (chunkErr) {
        console.error("Chunk insert error:", chunkErr);
        await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
        return;
      }

      // 7. Mark document as ready
      await supabase
        .from("documents")
        .update({ status: "ready", chunk_count: allChunkRows.length })
        .eq("id", doc.id);

      console.log(`✅ Document "${file.originalname}" processed: ${allChunkRows.length} chunks embedded`);
    } catch (embErr) {
      console.error("Embedding error:", embErr);
      await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
    }
  } catch (err) {
    console.error("Ingest error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/study/chat — RAG query ───────────────────────

studyRouter.post("/chat", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { question, document_id } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Missing 'question' in request body" });
    }

    // Rate limit check
    const rateLimit = await checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: "Daily limit reached",
        message: `You've used ${rateLimit.queryCount}/${DAILY_QUERY_LIMIT} queries today. Total spend: $${rateLimit.costUsd.toFixed(4)}. Resets at ${rateLimit.resetTime}.`,
        usage: rateLimit,
      });
    }

    const supabase = getSupabaseAdmin();
    const openai = getOpenAI();

    // 1. Embed the question
    const embeddingRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: question,
    });
    const queryEmbedding = embeddingRes.data[0].embedding;

    // 2. Find matching chunks via cosine similarity
    const { data: matches, error: matchErr } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_count: 5,
      filter_document_id: document_id || null,
    });

    if (matchErr) {
      console.error("Match error:", matchErr);
      return res.status(500).json({ error: "Failed to search documents" });
    }

    if (!matches || matches.length === 0) {
      return res.json({
        answer: "I couldn't find any relevant information in your uploaded documents. Please make sure you've uploaded the relevant materials first.",
        sources: [],
        usage: rateLimit,
      });
    }

    // 3. Get document names for source attribution
    const docIds = [...new Set(matches.map((m: any) => m.document_id))];
    const { data: docs } = await supabase
      .from("documents")
      .select("id, filename")
      .in("id", docIds);
    const docNameMap = new Map((docs || []).map((d: any) => [d.id, d.filename]));

    // 4. Build context from matched chunks
    const context = matches
      .map((m: any, i: number) => `[Source ${i + 1}: ${docNameMap.get(m.document_id) || "Unknown"}, chunk ${m.chunk_index}]\n${m.content}`)
      .join("\n\n---\n\n");

    // 5. Chat completion
    const systemPrompt = `You are a helpful study assistant. Answer questions ONLY based on the provided context from the user's uploaded lecture materials. If the context doesn't contain enough information to answer, say so clearly. Always cite which source(s) you used.

Context from uploaded documents:
${context}`;

    const chatRes = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    });

    const answer = chatRes.choices[0]?.message?.content || "No response generated.";
    const inputTokens = chatRes.usage?.prompt_tokens || 0;
    const outputTokens = chatRes.usage?.completion_tokens || 0;

    // 6. Update usage tracking
    await updateUsage(user.id, inputTokens, outputTokens);

    // 7. Get updated usage for response
    const updatedLimit = await checkRateLimit(user.id);

    const sources = matches.map((m: any) => ({
      chunkIndex: m.chunk_index,
      content: m.content.slice(0, 200) + (m.content.length > 200 ? "..." : ""),
      documentName: docNameMap.get(m.document_id) || "Unknown",
      similarity: m.similarity,
    }));

    res.json({ answer, sources, usage: updatedLimit });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/study/usage — Get current usage ───────────────

studyRouter.get("/usage", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const rateLimit = await checkRateLimit(user.id);
    res.json(rateLimit);
  } catch (err) {
    console.error("Usage error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /api/study/documents/:id — Delete a document ────

studyRouter.delete("/documents/:id", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const docId = req.params.id;
    const supabase = getSupabaseAdmin();

    // Get document info
    const { data: doc } = await supabase
      .from("documents")
      .select("*")
      .eq("id", docId)
      .single();

    if (!doc) return res.status(404).json({ error: "Document not found" });

    // Delete from storage
    await supabase.storage.from("lecture-materials").remove([doc.file_path]);

    // Delete chunks (cascade will handle this due to FK)
    await supabase.from("document_chunks").delete().eq("document_id", docId);

    // Delete document record
    await supabase.from("documents").delete().eq("id", docId);

    res.json({ message: "Document deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/study/documents — List documents ──────────────

studyRouter.get("/documents", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const moduleName = req.query.module as string | undefined;
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("documents")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (moduleName) {
      query = query.eq("module_name", moduleName);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json(data || []);
  } catch (err) {
    console.error("List documents error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
