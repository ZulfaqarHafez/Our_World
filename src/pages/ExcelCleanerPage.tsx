import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  Download,
  Sparkles,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────

interface CleaningOptions {
  removeDuplicates: boolean;
  removeEmptyRows: boolean;
  removeIncomplete: boolean;
  filterInvalidColU: boolean;
  trimColumnsBeforeR: boolean;
  trimWhitespace: boolean;
  removeExtraSpaces: boolean;
  normalizeCase: boolean;
}

interface CleaningStats {
  removedDupes: number;
  removedEmpty: number;
  removedIncomplete: number;
  removedInvalidU: number;
  trimmed: number;
  finalRows: number;
  originalRows: number;
}

type CellValue = string | number | boolean | null | undefined;

const MAX_PREVIEW = 50;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/** Convert Excel column letter (e.g. "A", "BQ") to 0-based index */
function colToIndex(col: string): number {
  let idx = 0;
  for (const ch of col.toUpperCase()) {
    idx = idx * 26 + (ch.charCodeAt(0) - 64);
  }
  return idx - 1;
}

// Columns that are allowed to be empty in a "complete" response
const EXEMPT_COLS = [
  "J","K","L","M","U","V","X","Y",
  "AA","AB","AC","AD","AE","AF","AG","AH","AI","AK","BB",
];
const EXEMPT_INDICES = new Set(EXEMPT_COLS.map(colToIndex));
const LAST_REQUIRED_COL = colToIndex("BQ"); // 0-based index of column BQ
const COL_R_INDEX = colToIndex("R"); // 0-based index of column R
const COL_U_INDEX = colToIndex("U"); // 0-based index of column U

// ─── Page ──────────────────────────────────────────────────

const ExcelCleanerPage = () => {
  const [data, setData] = useState<CellValue[][] | null>(null);
  const [headers, setHeaders] = useState<CellValue[]>([]);
  const [fileName, setFileName] = useState("");
  const [cleanedData, setCleanedData] = useState<CellValue[][] | null>(null);
  const [stats, setStats] = useState<CleaningStats | null>(null);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [workbookRef, setWorkbookRef] = useState<XLSX.WorkBook | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [opts, setOpts] = useState<CleaningOptions>({
    removeDuplicates: true,
    removeEmptyRows: true,
    removeIncomplete: false,
    filterInvalidColU: false,
    trimColumnsBeforeR: false,
    trimWhitespace: true,
    removeExtraSpaces: false,
    normalizeCase: false,
  });

  const loadSheet = useCallback((wb: XLSX.WorkBook, idx: number) => {
    setSelectedSheet(idx);
    const ws = wb.Sheets[wb.SheetNames[idx]];
    const json: CellValue[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
    });
    if (json.length > 0) {
      setHeaders(json[0]);
      setData(json.slice(1));
    } else {
      setHeaders([]);
      setData([]);
    }
    setCleanedData(null);
    setStats(null);
  }, []);

  const parseFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      setParsing(true);
      setCleanedData(null);
      setStats(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        setWorkbookRef(wb);
        setSheetNames(wb.SheetNames);
        loadSheet(wb, 0);
        setParsing(false);
      };
      reader.readAsArrayBuffer(file);
    },
    [loadSheet]
  );

  const handleFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["xlsx", "xls", "csv", "tsv"].includes(ext)) return;
    if (file.size > MAX_FILE_SIZE) return;
    parseFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const reset = () => {
    setData(null);
    setHeaders([]);
    setFileName("");
    setCleanedData(null);
    setStats(null);
    setWorkbookRef(null);
    setSheetNames([]);
    setSelectedSheet(0);
  };

  const clean = () => {
    if (!data) return;
    let rows = data.map((r) => [...r]);
    let newHeaders = [...headers];
    let removedDupes = 0;
    let removedEmpty = 0;
    let removedIncomplete = 0;
    let removedInvalidU = 0;
    let trimmed = 0;

    if (opts.trimWhitespace) {
      rows = rows.map((r) =>
        r.map((c) => {
          if (typeof c === "string") {
            const t = c.trim();
            if (t !== c) trimmed++;
            return t;
          }
          return c;
        })
      );
    }

    if (opts.removeExtraSpaces) {
      rows = rows.map((r) =>
        r.map((c) => {
          if (typeof c === "string") {
            const t = c.replace(/\s+/g, " ");
            if (t !== c) trimmed++;
            return t;
          }
          return c;
        })
      );
    }

    if (opts.normalizeCase) {
      rows = rows.map((r) =>
        r.map((c) => {
          if (typeof c === "string" && c.length > 0) {
            return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
          }
          return c;
        })
      );
    }

    if (opts.removeEmptyRows) {
      const before = rows.length;
      rows = rows.filter((r) =>
        r.some((c) => c !== "" && c !== null && c !== undefined)
      );
      removedEmpty = before - rows.length;
    }

    if (opts.removeIncomplete) {
      const before = rows.length;
      const endCol = Math.min(LAST_REQUIRED_COL, headers.length - 1);
      rows = rows.filter((r) => {
        for (let ci = 0; ci <= endCol; ci++) {
          if (EXEMPT_INDICES.has(ci)) continue;
          const val = r[ci];
          if (val === "" || val === null || val === undefined) return false;
        }
        return true;
      });
      removedIncomplete = before - rows.length;
    }

    if (opts.filterInvalidColU) {
      const before = rows.length;
      rows = rows.filter((r) => {
        const val = String(r[COL_U_INDEX] ?? "").trim();
        if (!val) return true; // empty is allowed
        const digitsOnly = val.replace(/\D/g, "");
        // Remove if contains any letter or has fewer than 7 digits
        if (/[a-zA-Z]/.test(val) || digitsOnly.length < 7) return false;
        return true;
      });
      removedInvalidU = before - rows.length;
    }

    if (opts.removeDuplicates) {
      // Deduplicate by column "q17" — find its index from headers
      const q17Index = headers.findIndex(
        (h) => String(h).trim().toLowerCase() === "q17"
      );
      const seen = new Set<string>();
      const unique: CellValue[][] = [];
      for (const r of rows) {
        const key =
          q17Index >= 0
            ? String(r[q17Index] ?? "")
            : JSON.stringify(r); // fallback if q17 column not found
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(r);
        } else {
          removedDupes++;
        }
      }
      rows = unique;
    }

    if (opts.trimColumnsBeforeR) {
      // Drop columns A–Q from both headers and rows
      newHeaders = newHeaders.slice(COL_R_INDEX);
      rows = rows.map((r) => r.slice(COL_R_INDEX));
    }

    setCleanedData(rows);
    if (opts.trimColumnsBeforeR) {
      setHeaders(newHeaders);
    }
    setStats({
      removedDupes,
      removedEmpty,
      removedIncomplete,
      removedInvalidU,
      trimmed,
      finalRows: rows.length,
      originalRows: data.length,
    });
  };

  const download = () => {
    if (!cleanedData) return;
    const wsData = [headers, ...cleanedData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      sheetNames[selectedSheet] || "Cleaned"
    );
    const name = fileName.replace(/\.[^.]+$/, "") + "_cleaned.xlsx";
    XLSX.writeFile(wb, name);
  };

  const displayData = cleanedData || data;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden h-32 sm:h-40 md:h-48 bg-gradient-to-br from-emerald-600 to-teal-700">
        <div className="absolute inset-0 flex items-center px-6 sm:px-8">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white">
              Excel Cleaner
            </h1>
            <p className="text-white/80 text-sm mt-1">
              Upload, preview, clean, and download — no data leaves your browser
            </p>
          </div>
        </div>
      </div>

      {/* Upload zone — shown when no file is loaded */}
      {!data && !parsing && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`glass-card rounded-2xl p-16 text-center cursor-pointer transition-all border-2 border-dashed ${
            dragOver
              ? "border-emerald-500 bg-emerald-500/5"
              : "border-border hover:border-emerald-500/50"
          }`}
        >
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-emerald-500 opacity-70" />
          <p className="text-lg font-semibold">Drop your Excel or CSV file here</p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to browse — supports .xlsx, .xls, .csv
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.tsv"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* Parsing spinner */}
      {parsing && (
        <div className="glass-card rounded-2xl flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <span className="ml-3 text-muted-foreground font-medium">Parsing file…</span>
        </div>
      )}

      {/* Main content — shown when file is loaded */}
      {!parsing && data && (
        <div className="space-y-5">
          {/* File info bar */}
          <div className="glass-card rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {data.length} rows &middot; {headers.length} columns
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sheetNames.length > 1 && (
                <div className="flex gap-1.5 mr-2">
                  {sheetNames.map((s, i) => (
                    <Button
                      key={i}
                      variant={i === selectedSheet ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => workbookRef && loadSheet(workbookRef, i)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>

          {/* Cleaning options */}
          <div className="glass-card rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              Cleaning Options
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {([
                ["removeDuplicates", "Remove duplicate rows (by q17)"],
                ["removeEmptyRows", "Remove empty rows"],
                ["removeIncomplete", "Remove incomplete responses (A–BQ)"],
                ["filterInvalidColU", "Remove invalid col U (letters / <7 digits)"],
                ["trimColumnsBeforeR", "Remove columns before R"],
                ["trimWhitespace", "Trim whitespace"],
                ["removeExtraSpaces", "Remove extra spaces"],
                ["normalizeCase", "Normalize capitalization"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <Switch
                    checked={opts[key]}
                    onCheckedChange={(v) => setOpts((p) => ({ ...p, [key]: v }))}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={clean} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                Clean Data
              </Button>
              {cleanedData && (
                <Button onClick={download} variant="outline" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Download Cleaned File
                </Button>
              )}
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
              {([
                ["Original Rows", stats.originalRows, "text-muted-foreground"],
                ["Dupes Removed", stats.removedDupes, "text-amber-500"],
                ["Empty Removed", stats.removedEmpty, "text-red-400"],
                ["Incomplete", stats.removedIncomplete, "text-orange-400"],
                ["Invalid U", stats.removedInvalidU, "text-rose-500"],
                ["Cells Trimmed", stats.trimmed, "text-violet-400"],
                ["Final Rows", stats.finalRows, "text-emerald-500"],
              ] as const).map(([label, value, color]) => (
                <div key={label} className="glass-card rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {label}
                  </p>
                  <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Data preview table */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {cleanedData ? "Cleaned Preview" : "Data Preview"}
                </span>
                {cleanedData && (
                  <Badge
                    variant="default"
                    className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15"
                  >
                    CLEANED
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Showing {Math.min(displayData?.length || 0, MAX_PREVIEW)} of{" "}
                {displayData?.length || 0} rows
              </span>
            </div>
            <div className="overflow-x-auto max-h-[28rem]">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-background z-10">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b font-semibold">
                      #
                    </th>
                    {headers.map((h, i) => (
                      <th
                        key={i}
                        className="px-3 py-2 text-left text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold border-b whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis"
                      >
                        {h ? String(h) : `Col ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayData?.slice(0, MAX_PREVIEW).map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? "" : "bg-muted/30"}>
                      <td className="px-3 py-1.5 text-muted-foreground text-[11px] border-b border-border/20">
                        {ri + 1}
                      </td>
                      {headers.map((_, ci) => (
                        <td
                          key={ci}
                          className={`px-3 py-1.5 border-b border-border/20 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis ${
                            row[ci] === "" || row[ci] == null
                              ? "text-muted-foreground italic"
                              : ""
                          }`}
                        >
                          {row[ci] === "" || row[ci] == null ? "—" : String(row[ci])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ExcelCleanerPage;
