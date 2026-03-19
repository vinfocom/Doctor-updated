"use client";

import React, { useMemo, useState } from "react";

type ExportPreset = "ONE_DAY" | "ONE_WEEK" | "ONE_MONTH" | "CUSTOM";
type ExportFormat = "pdf" | "excel";

const toISTYMD = (date: Date) => {
    const shifted = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
    const day = String(shifted.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const addDays = (base: Date, days: number) => {
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    return next;
};

const buildFilename = (format: ExportFormat, from: string, to: string) => {
    const safeFrom = from.replaceAll("-", "");
    const safeTo = to.replaceAll("-", "");
    const ext = format === "pdf" ? "pdf" : "xlsx";
    return `appointments_${safeFrom}_${safeTo}.${ext}`;
};

const parseFilename = (contentDisposition: string | null) => {
    if (!contentDisposition) return "";
    const match = /filename="([^"]+)"/i.exec(contentDisposition);
    return match?.[1] || "";
};

interface AppointmentExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AppointmentExportModal({ isOpen, onClose }: AppointmentExportModalProps) {
    const [preset, setPreset] = useState<ExportPreset>("ONE_DAY");
    const [format, setFormat] = useState<ExportFormat>("pdf");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const dateRange = useMemo(() => {
        const today = new Date();
        if (preset === "ONE_DAY") {
            const day = toISTYMD(today);
            return { from: day, to: day };
        }
        if (preset === "ONE_WEEK") {
            const to = toISTYMD(today);
            const from = toISTYMD(addDays(today, -6));
            return { from, to };
        }
        if (preset === "ONE_MONTH") {
            const to = toISTYMD(today);
            const from = toISTYMD(addDays(today, -29));
            return { from, to };
        }
        return { from: customFrom, to: customTo || customFrom };
    }, [preset, customFrom, customTo]);

    if (!isOpen) return null;

    const handleDownload = async () => {
        setError("");
        if (preset === "CUSTOM" && !customFrom) {
            setError("Please select a From date.");
            return;
        }
        if (preset === "CUSTOM" && customTo && customTo < customFrom) {
            setError("To date cannot be earlier than From date.");
            return;
        }

        const { from, to } = dateRange;
        if (!from || !to) {
            setError("Please choose a valid date range.");
            return;
        }

        setSubmitting(true);
        try {
            const params = new URLSearchParams({
                dateFrom: from,
                dateTo: to,
                format,
            });
            const res = await fetch(`/api/appointments/export?${params.toString()}`);
            if (!res.ok) {
                setError("Failed to generate export. Please try again.");
                return;
            }

            const blob = await res.blob();
            const serverFilename = parseFilename(res.headers.get("Content-Disposition"));
            const filename = serverFilename || buildFilename(format, from, to);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            onClose();
        } catch {
            setError("Something went wrong while downloading.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
                <div className="border-b border-gray-100 p-6">
                    <h2 className="text-xl font-bold text-gray-800">Download Appointments</h2>
                    <p className="mt-2 text-sm text-gray-500">
                        Choose a time range and format to export patient appointment details.
                    </p>
                </div>

                <div className="space-y-5 p-6">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2">Timeframe</label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: "ONE_DAY", label: "1 Day" },
                                { value: "ONE_WEEK", label: "1 Week" },
                                { value: "ONE_MONTH", label: "1 Month" },
                                { value: "CUSTOM", label: "Custom Range" },
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setPreset(item.value as ExportPreset)}
                                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${preset === item.value
                                        ? "bg-indigo-600 text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                        }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        {preset === "CUSTOM" && (
                            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                                    <input
                                        type="date"
                                        value={customFrom}
                                        onChange={(e) => setCustomFrom(e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                                    <input
                                        type="date"
                                        value={customTo}
                                        min={customFrom || undefined}
                                        onChange={(e) => setCustomTo(e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2">Format</label>
                        <div className="flex gap-2">
                            {[
                                { value: "pdf", label: "PDF" },
                                { value: "excel", label: "Excel" },
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setFormat(item.value as ExportFormat)}
                                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${format === item.value
                                        ? "bg-indigo-600 text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                        }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={submitting}
                            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {submitting ? "Preparing..." : "Download"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
