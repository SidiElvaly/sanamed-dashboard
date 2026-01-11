"use client";

import React, { useEffect, useState, useRef, use as usePromise } from "react";
import Topbar from "@/components/Topbar";
import { DocumentsPanel, type PatientDoc } from "@/components/PatientPanels";
import Link from "next/link";
import {
    AlertCircle,
    UploadCloud,
    ChevronLeft
} from "lucide-react";
import { toast } from "sonner";
import { handleClientError } from "@/lib/client-error";
import { callExtractFileAPI } from "@/components/PatientPanels";
import { decodeId } from "@/lib/obfuscation";

/* ----------------- Types ----------------- */
type Patient = {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    idnum?: string;
    dob?: string | null;
    status?: string;
};

/* ---------------------------- Main Page ---------------------------- */
export default function PatientDocumentsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: rawId } = usePromise(params);
    const id = React.useMemo(() => decodeId(rawId) || "", [rawId]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const [patient, setPatient] = useState<Patient | null>(null);
    const [docs, setDocs] = useState<PatientDoc[]>([]);

    const [uploading, setUploading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !patient) return;

        setUploadError(null);
        setUploading(true);
        setExtracting(false);

        // Process files sequentially
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let uploadedDocId: string | null = null;

            try {
                // 1. Upload
                setExtracting(false);
                // Using "Uploading..." state conceptually here

                const formData = new FormData();
                formData.append("file", file);
                formData.append("title", file.name);

                const res = await fetch(`/api/patients/${patient.id}/documents`, {
                    method: "POST",
                    body: formData,
                });

                const saved = await res.json();
                if (!res.ok) throw new Error(saved?.error || `Upload failed for ${file.name}`);

                if (saved?.document?.id) {
                    uploadedDocId = saved.document.id;
                } else {
                    throw new Error("Invalid server response: missing document ID");
                }

                // 2. Extract & Index (Blocking UI update until success)
                setExtracting(true);
                // Pass the mongoDocumentId (uploadedDocId) to ensure it's indexed correctly
                // even if this call is technically redundant with the backend's auto-indexing.
                if (uploadedDocId) {
                    await callExtractFileAPI(file, patient.id, uploadedDocId);
                }

                // 3. Update UI only on success
                if (saved?.document) {
                    setDocs((prev) => [saved.document as PatientDoc, ...prev]);
                    toast.success(`Indexed: ${file.name}`);
                }

            } catch (err) {
                console.error(err);
                const msg = err instanceof Error ? err.message : "Details unavailable";

                // Rollback: Delete the uploaded document if indexing failed
                if (uploadedDocId) {
                    try {
                        await fetch(`/api/patients/${patient.id}/documents/${uploadedDocId}`, {
                            method: "DELETE"
                        });
                        console.log(`Rolled back upload for ${uploadedDocId}`);
                    } catch (cleanupErr) {
                        console.error("Failed to rollback document:", cleanupErr);
                    }
                }

                handleClientError(err, "Indexing failed", `Could not index ${file.name}: ${msg}`);
                // Continue to next file
            }
        }

        setUploading(false);
        setExtracting(false);
        e.target.value = "";
    };

    useEffect(() => {
        setMounted(true);
        async function loadData() {
            try {
                setLoading(true);
                const pRes = await fetch(`/api/patients/${id}`, { cache: "no-store" });
                if (!pRes.ok) throw new Error("Failed to load patient");

                const pData = await pRes.json();
                setPatient(pData.patient);
                setDocs(pData.documents || []);
            } catch (e) {
                setError("Failed to load patient data.");
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [id]);

    if (!mounted || loading) {
        return (
            <main className="w-full bg-slate-50/30 min-h-screen">
                <Topbar title="Documents" />
                <div className="p-8">
                    <div className="h-4 w-40 rounded bg-slate-200 animate-pulse mb-6" />
                    <div className="h-64 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 animate-pulse" />
                </div>
            </main>
        );
    }

    if (error || !patient) {
        return (
            <main className="w-full bg-slate-50/30 min-h-screen">
                <Topbar title="Documents" />
                <div className="flex flex-col items-center justify-center p-20 text-center">
                    <AlertCircle className="h-12 w-12 text-rose-500 mb-4" />
                    <h2 className="text-lg font-bold text-slate-900">{error || "Patient not found"}</h2>
                    <Link href="/dashboard/patients" className="mt-4 text-sm font-semibold text-emerald-600 hover:underline">
                        Back to patient list
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="w-full bg-slate-50/30 min-h-screen">
            <Topbar title="Documents" />

            <section className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-6 pb-10 pt-6">
                {/* Navigation & Header */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link
                            href={`/dashboard/patients/${patient.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-emerald-600 mb-2 transition-colors"
                        >
                            <ChevronLeft className="h-3 w-3" /> Back to Profile
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-900">Patient Documents</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {(uploading || extracting) && (
                            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full animate-pulse border border-emerald-100">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                {uploading ? "Uploading..." : "Indexing content..."}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleImportClick}
                            disabled={uploading || extracting}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-slate-800 hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-60"
                        >
                            <UploadCloud className="h-4 w-4" />
                            Import Document
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf"
                            multiple
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>
                </div>

                {uploadError && (
                    <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-medium">
                        Error: {uploadError}
                    </div>
                )}

                <div className="card bg-white p-6 shadow-sm border border-slate-100 rounded-2xl">
                    <DocumentsPanel docs={docs} setDocs={setDocs} patientId={patient.id} />
                </div>
            </section>
        </main>
    );
}
