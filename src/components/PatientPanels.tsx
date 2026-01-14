"use client";

import React, { useRef, useState } from "react";

import {
    FileText,
    Star,
    StarOff,
    UploadCloud,
    Search,
    Trash2,
    Pencil,
    Plus,
} from "lucide-react";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import { toast } from "sonner";
import { handleClientError } from "@/lib/client-error";

/* ----------------- Types ----------------- */
export type AdmissionStatus = "LOW" | "MEDIUM" | "HIGH";

export type Admission = {
    id: string;
    patientId: string;
    visitDate: string; // ISO string
    reason: string;
    currentDiagnosis: string;
    medicalHistory?: string | null;
    status: AdmissionStatus;
    createdAt: string;
    createdByEmail?: string | null;
};

export type PatientDoc = {
    id: string;
    patientId: string;
    title: string;
    date: string | Date;
    isFavorite: boolean;
    fileName?: string;
};

export type SearchHit = {
    id: string;
    score: number;
    text: string;
};

/* ----------------- Helpers ----------------- */
function formatISODate(s?: string | null) {
    if (!s) return "-";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString();
}

function formatDocDate(d: PatientDoc["date"]) {
    const dt = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString();
}

function scoreToPercent(score: number) {
    const s = Math.max(0, Math.min(1, score));
    return Math.round(s * 100);
}

function extractMetaFromText(text: string) {
    const firstMention =
        text.match(/Premi[eè]re mention:\s*([0-9-]+)/i)?.[1] ?? null;
    const lastConsult =
        text.match(/Dernière consultation:\s*([0-9-]+)/i)?.[1] ?? null;
    const diagnosisDate =
        text.match(/date diagnostic:\s*([0-9-]+)/i)?.[1] ?? null;
    const status = text.match(/Statut:\s*([^.;\n]+)/i)?.[1]?.trim() ?? null;

    const title = text.split(":")[0]?.slice(0, 60)?.trim() || "Result";
    return { title, firstMention, lastConsult, diagnosisDate, status };
}

/* ----------------- Proxy APIs ----------------- */
export async function callExtractFileAPI(file: File, patientId: string, mongoDocumentId?: string) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("patientId", patientId);
    if (mongoDocumentId) {
        fd.append("mongoDocumentId", mongoDocumentId);
    }

    const res = await fetch("/api/extract-file", {
        method: "POST",
        body: fd,
        cache: "no-store",
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Request failed with status ${res.status}`);
    }

    const json = await res.json();
    if (json.error) {
        throw new Error(typeof json.error === "string" ? json.error : JSON.stringify(json.error));
    }

    return json;
}

async function callSemanticSearchAPI(query: string, patientId: string): Promise<SearchHit[]> {
    const res = await fetch("/api/semantic-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, patientId }),
        cache: "no-store",
    });

    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return (json.results ?? []) as SearchHit[];
}

/* ----------------- Components ----------------- */

function ScoreBadge({ score }: { score: number }) {
    const pct = scoreToPercent(score);
    const level =
        pct >= 80 ? "Excellent" : pct >= 65 ? "Good" : pct >= 50 ? "Medium" : "Low";

    return (
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {level} • {pct}%
        </span>
    );
}

function ResultCard({ hit, isBest }: { hit: SearchHit; isBest?: boolean }) {
    const pct = scoreToPercent(hit.score);
    const meta = extractMetaFromText(hit.text);

    return (
        <article
            className={[
                "rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md",
                isBest
                    ? "border-2 border-emerald-400 ring-2 ring-emerald-100"
                    : "border border-slate-100",
            ].join(" ")}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        {isBest && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                                Best match
                            </span>
                        )}
                        <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                            {meta.title}
                        </p>
                        <span className="text-[11px] text-slate-400">Hit: {hit.id}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        {meta.status && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                Status: {meta.status}
                            </span>
                        )}
                        {meta.firstMention && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                First: {meta.firstMention}
                            </span>
                        )}
                        {(meta.lastConsult || meta.diagnosisDate) && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                {meta.lastConsult
                                    ? `Last consult: ${meta.lastConsult}`
                                    : `Diagnosis: ${meta.diagnosisDate}`}
                            </span>
                        )}
                    </div>
                </div>

                <div className="shrink-0">
                    <ScoreBadge score={hit.score} />
                </div>
            </div>

            <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                        className={
                            isBest
                                ? "h-full rounded-full bg-emerald-600"
                                : "h-full rounded-full bg-emerald-500"
                        }
                        style={{ width: `${pct}%` }}
                        aria-label={`score ${pct}%`}
                    />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                    <span>{isBest ? "Top relevance" : "Relevance"}</span>
                    <span>{hit.score.toFixed(3)}</span>
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-50">
                <span className="block mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Extracted Passage
                </span>
                <p className="whitespace-pre-wrap text-sm text-slate-600 leading-relaxed">
                    {hit.text}
                </p>
            </div>
        </article>
    );
}

export function AdmissionsPanel({
    admissions,
    patientId,
}: {
    admissions: Admission[];
    patientId: string;
}) {
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    async function handleConfirmDelete() {
        if (!deleteId) return;
        setIsDeleting(true);

        try {
            const res = await fetch(
                `/api/patients/${patientId}/admissions/${deleteId}`,
                { method: "DELETE" }
            );

            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || "Delete failed");

            toast.success("Admission deleted successfully");
            window.location.reload();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
            setIsDeleting(false);
        }
    }

    return (
        <section className="mt-8">
            {/* Button removed - hoisted to parent page */}
            <div className="mb-5 flex items-center justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-6 w-1 rounded-full bg-emerald-500" />
                        <h2 className="text-lg font-bold text-slate-900">Admissions</h2>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {admissions.slice(0, 6).map((a) => (
                    <article
                        key={a.id}
                        className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-emerald-200/60"
                    >
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <span className="inline-flex items-center rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 border border-slate-100 group-hover:bg-white group-hover:border-emerald-100 group-hover:text-emerald-700 transition-colors">
                                {formatISODate(a.visitDate)}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide
                                ${a.status === 'HIGH' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                                    a.status === 'MEDIUM' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                        'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                {a.status}
                            </span>
                        </div>

                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-bold text-slate-900 leading-tight">
                                {a.currentDiagnosis}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                {a.reason}
                            </p>
                        </div>

                        {a.medicalHistory && (
                            <div className="mt-3 rounded-lg bg-slate-50/50 p-2 text-[11px] text-slate-600">
                                <span className="font-semibold text-slate-700">Hx:</span> {a.medicalHistory}
                            </div>
                        )}

                        <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                {a.createdByEmail}
                            </span>

                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <a
                                    href={`/dashboard/patients/${patientId}/admissions/${a.id}/edit`}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </a>

                                <button
                                    type="button"
                                    onClick={() => setDeleteId(a.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    </article>
                ))}

                {admissions.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-4 ring-slate-50">
                            <FileText className="h-6 w-6 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-medium">No admissions recorded</p>
                    </div>
                )}
            </div>

            <DeleteConfirmationModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Admission"
                message="Are you sure you want to delete this admission record? This action cannot be undone."
                isDeleting={isDeleting}
            />
        </section>
    );
}

export function DocumentsPanel({
    docs,
    setDocs,
    patientId,
}: {
    docs: PatientDoc[];
    setDocs: React.Dispatch<React.SetStateAction<PatientDoc[]>>;
    patientId: string;
}) {
    const [query, setQuery] = useState("");
    const [tab, setTab] = useState<"all" | "favorite" | "recent">("recent");

    const [semanticQ, setSemanticQ] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
    const [searchError, setSearchError] = useState<string | null>(null);

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    async function runSemanticSearch() {
        const q = semanticQ.trim();
        if (!q) {
            setSearchHits([]);
            return;
        }
        setSearchError(null);
        setSearching(true);
        try {
            const hits = await callSemanticSearchAPI(q, patientId);
            setSearchHits(hits);
        } catch (err) {
            handleClientError(err, "Semantic search failed", "The search service is currently unavailable.");
            setSearchError("Unable to perform search."); // Keep local state simple
            setSearchHits([]);
        } finally {
            setSearching(false);
        }
    }

    async function handleConfirmDelete() {
        if (!deleteId) return;
        setIsDeleting(true);


        try {
            const res = await fetch(
                `/api/patients/${patientId}/documents/${deleteId}`,
                { method: "DELETE" }
            );

            if (!res.ok) throw new Error(await res.text());
            setDocs((prev) => prev.filter((d) => d.id !== deleteId));
            setDeleteId(null);
            toast.success("Document deleted successfully");
        } catch (e) {
            handleClientError(e, "Delete failed", "Could not delete the document.");
        } finally {
            setIsDeleting(false);
        }
    }

    const filtered = docs
        .filter((d) =>
            d.title.toLowerCase().includes(query.trim().toLowerCase())
        )
        .filter((d, idx) => {
            if (tab === "favorite") return d.isFavorite;
            if (tab === "recent") return idx < 4;
            return true;
        });

    return (
        <section className="mt-12">
            <div className="mb-6 flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-1 rounded-full bg-indigo-500" />
                        <h2 className="text-lg font-bold text-slate-900">Documents</h2>
                    </div>
                </div>
            </div>

            {/* Semantic Search HERO */}
            <div className="mb-8 rounded-3xl bg-gradient-to-b from-indigo-50/50 to-white/50 p-1 ring-1 ring-indigo-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Search className="h-32 w-32 text-indigo-500 transform rotate-12" />
                </div>

                <div className="relative rounded-[20px] bg-white p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                    <Search className="h-3.5 w-3.5" />
                                </span>
                                Semantic Analysis
                            </h3>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <div className="relative flex-1">
                            <input
                                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 pl-11 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                                placeholder="Search documents..."
                                value={semanticQ}
                                onChange={(e) => setSemanticQ(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        runSemanticSearch();
                                    }
                                }}
                            />
                            <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                        </div>
                        <button
                            type="button"
                            onClick={runSemanticSearch}
                            disabled={searching}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 hover:shadow-emerald-200/50 transition-all disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                            {searching ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Search className="h-4 w-4" />
                                    Search
                                </>
                            )}
                        </button>
                    </div>

                    {searchError && (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {searchError}
                        </div>
                    )}

                    {searchHits.length > 0 && (
                        <div className="mt-6 space-y-3">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                Analysis Findings ({searchHits.length})
                            </div>
                            <div className="grid gap-3">
                                {searchHits.slice(0, 10).map((h, idx) => (
                                    <ResultCard key={h.id} hit={h} isBest={idx === 0} />
                                ))}
                            </div>
                        </div>
                    )}


                </div>
            </div>

            {/* Filter Bar */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
                <nav className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl">
                    {(["recent", "favorite", "all"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t
                                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                                }`}
                        >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </nav>

                <div className="relative w-full sm:w-64">
                    <input
                        className="w-full rounded-xl border-none bg-slate-100/50 px-4 py-2 pl-9 text-xs font-medium text-slate-700 outline-none focus:bg-slate-100 focus:ring-0 placeholder:text-slate-400"
                        placeholder="Filter by filename..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
            </div>

            {/* Document Grid */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {filtered.map((doc) => (
                    <article
                        key={doc.id}
                        className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-indigo-100"
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-sm font-semibold text-slate-900 leading-tight mb-1 line-clamp-2" title={doc.title}>
                                    {doc.title}
                                </h4>
                                <p className="text-[10px] text-slate-400">
                                    {formatDocDate(doc.date)}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setDeleteId(doc.id)}
                                disabled={isDeleting}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                title="Delete"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => alert("TODO: toggle favorite")}
                                    className="p-1.5 rounded-lg text-slate-300 hover:text-amber-400 transition-colors"
                                >
                                    {doc.isFavorite ? (
                                        <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                                    ) : (
                                        <Star className="h-4 w-4" />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        window.open(
                                            `/api/patients/${patientId}/documents/${doc.id}`,
                                            "_blank"
                                        )
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-slate-50 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    View PDF
                                </button>
                            </div>
                        </div>
                    </article>
                ))}

                {filtered.length === 0 && (
                    <div className="col-span-full py-12 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
                            <Search className="h-6 w-6 text-slate-300" />
                        </div>
                        <p className="text-sm text-slate-500">No documents found.</p>
                    </div>
                )}
            </div>

            <DeleteConfirmationModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Document"
                message="Are you sure you want to delete this document? This action cannot be undone."
                isDeleting={isDeleting}
            />
        </section>
    );
}
