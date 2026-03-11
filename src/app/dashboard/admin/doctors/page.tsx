"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { Shield, UserPlus, X, Pencil, Trash2, AlertTriangle } from "lucide-react";

interface Doctor {
    doctor_id: number;
    doctor_name: string;
    specialization: string | null;
    phone: string | null;
    whatsapp_number?: string | null;
    admin_id: number | null;
}

export default function AdminDoctorsPage() {
    const router = useRouter();
    const [user, setUser] = useState<{ name: string; role: string } | null>(null);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);

    // ── Create form
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: "", email: "", password: "", role: "DOCTOR", phone: "", whatsapp_number: "",
    });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // ── Edit modal
    const [editDoc, setEditDoc] = useState<Doctor | null>(null);
    const [editForm, setEditForm] = useState({
        doctor_name: "", phone: "", whatsapp_number: "", specialization: "",
    });
    const [editError, setEditError] = useState("");
    const [editSubmitting, setEditSubmitting] = useState(false);

    // ── Delete confirm
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");

    const fetchData = useCallback(async () => {
        try {
            const meRes = await fetch("/api/auth/me");
            if (!meRes.ok) { router.push("/login"); return; }
            const meData = await meRes.json();
            if (meData.user.role !== "SUPER_ADMIN" && meData.user.role !== "ADMIN") { router.push("/login"); return; }
            setUser(meData.user);
            const docRes = await fetch("/api/doctors");
            if (docRes.ok) { const data = await docRes.json(); setDoctors(data.doctors); }
        } catch { router.push("/login"); } finally { setLoading(false); }
    }, [router]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Delete
    const handleDelete = async (doctorId: number) => {
        const res = await fetch(`/api/doctors?id=${doctorId}`, { method: "DELETE" });
        if (res.ok) {
            setDoctors(doctors.filter((d) => d.doctor_id !== doctorId));
            setDeleteConfirmId(null);
        }
    };

    // ── Open edit modal
    const openEdit = (doc: Doctor) => {
        setEditDoc(doc);
        setEditForm({
            doctor_name: doc.doctor_name || "",
            phone: doc.phone || "",
            whatsapp_number: doc.whatsapp_number || "",
            specialization: doc.specialization || "",
        });
        setEditError("");
    };

    // ── Submit edit
    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editDoc) return;
        setEditSubmitting(true);
        setEditError("");
        try {
            const res = await fetch("/api/doctors", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ doctor_id: editDoc.doctor_id, ...editForm }),
            });
            const data = await res.json();
            if (res.ok) {
                setDoctors((prev) => prev.map((d) =>
                    d.doctor_id === editDoc.doctor_id
                        ? { ...d, ...editForm }
                        : d
                ));
                setEditDoc(null);
            } else {
                setEditError(data.error || "Update failed");
            }
        } catch {
            setEditError("An error occurred");
        } finally {
            setEditSubmitting(false);
        }
    };

    // ── Create
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true); setError(""); setSuccess("");
        try {
            const payload = {
                name: formData.name, email: formData.email,
                password: formData.password, role: formData.role,
                specific_details: formData.role === "DOCTOR"
                    ? { phone: formData.phone, whatsapp_number: formData.whatsapp_number }
                    : undefined,
            };
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok) {
                setSuccess("Doctor created successfully!");
                setFormData({ name: "", email: "", password: "", role: "DOCTOR", phone: "", whatsapp_number: "" });
                setShowForm(false);
                await fetchData();
            } else {
                setError(data.error || "Failed to create user");
            }
        } catch { setError("An error occurred"); } finally { setSubmitting(false); }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                    <svg className="animate-spin h-10 w-10 text-indigo-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <motion.div className="mb-8" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Manage Doctors</h1>
                        <p className="text-gray-500 mt-1 text-sm">View, edit and manage all registered doctors</p>
                    </div>
                    <PremiumButton onClick={() => { setShowForm(!showForm); setError(""); setSuccess(""); }} icon={UserPlus}>
                        Create New Doctor
                    </PremiumButton>
                </div>
            </motion.div>

            {success && (
                <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{success}</div>
            )}

            {/* Doctors Table */}
            <motion.div className="glass-card p-7" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                {doctors.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-4xl mb-3">👨‍⚕️</p>
                        <p className="text-gray-400">No doctors registered yet</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>WhatsApp</th>
                                    <th>Specialization</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {doctors.map((doc, i) => (
                                    <motion.tr
                                        key={doc.doctor_id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 + i * 0.05 }}
                                    >
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                                                    {doc.doctor_name?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <span className="text-gray-800 font-medium">Dr. {doc.doctor_name}</span>
                                            </div>
                                        </td>
                                        <td className="text-gray-500">{doc.phone || "—"}</td>
                                        <td className="text-gray-500">{doc.whatsapp_number || "—"}</td>
                                        <td>
                                            <span className="badge badge-confirmed">{doc.specialization || "—"}</span>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <motion.button
                                                    onClick={() => openEdit(doc)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors text-xs font-semibold"
                                                    title="Edit doctor"
                                                    whileHover={{ scale: 1.04 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    <Pencil size={13} />
                                                    Edit
                                                </motion.button>
                                                <motion.button
                                                    onClick={() => { setDeleteConfirmId(doc.doctor_id); setDeleteConfirmName(doc.doctor_name); }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors text-xs font-semibold"
                                                    title="Delete doctor"
                                                    whileHover={{ scale: 1.04 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    <Trash2 size={13} />
                                                    Delete
                                                </motion.button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>

            {/* ── Delete Confirmation Modal ── */}
            <AnimatePresence>
                {deleteConfirmId !== null && (
                    <>
                        <motion.div
                            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setDeleteConfirmId(null)}
                        />
                        <motion.div
                            className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        >
                            <motion.div
                                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 text-center relative"
                                initial={{ scale: 0.88, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 20 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle size={26} className="text-red-500" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Doctor?</h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    Are you sure you want to delete <span className="font-semibold text-gray-700">Dr. {deleteConfirmName}</span>? This action cannot be undone.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setDeleteConfirmId(null)}
                                        className="flex-1 btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleDelete(deleteConfirmId!)}
                                        className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 transition-colors"
                                    >
                                        Yes, Delete
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Edit Modal ── */}
            <AnimatePresence>
                {editDoc && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setEditDoc(null)}
                        />
                        {/* Modal */}
                        <motion.div
                            className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        >
                            <motion.div
                                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 relative"
                                initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={() => setEditDoc(null)}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X size={20} />
                                </button>

                                <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                                    <Pencil size={18} className="text-indigo-500" /> Edit Doctor
                                </h2>
                                <p className="text-sm text-gray-400 mb-6">Dr. {editDoc.doctor_name}</p>

                                <form onSubmit={handleEditSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-gray-700">Full Name</label>
                                            <input
                                                type="text"
                                                value={editForm.doctor_name}
                                                onChange={(e) => setEditForm({ ...editForm, doctor_name: e.target.value })}
                                                required
                                                className="input-field"
                                                placeholder="Doctor name"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-gray-700">Specialization</label>
                                            <input
                                                type="text"
                                                value={editForm.specialization}
                                                onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                                                className="input-field"
                                                placeholder="e.g. Cardiologist"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-gray-700">Phone Number</label>
                                            <input
                                                type="tel"
                                                value={editForm.phone}
                                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                                className="input-field"
                                                placeholder="+91 98765 43210"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-gray-700">WhatsApp Number</label>
                                            <input
                                                type="tel"
                                                value={editForm.whatsapp_number}
                                                onChange={(e) => setEditForm({ ...editForm, whatsapp_number: e.target.value })}
                                                className="input-field"
                                                placeholder="+91 98765 43210"
                                            />
                                        </div>
                                    </div>

                                    {editError && (
                                        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</p>
                                    )}

                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setEditDoc(null)}
                                            className="btn-secondary"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={editSubmitting}
                                            className="btn-primary"
                                        >
                                            {editSubmitting ? "Saving..." : "Save Changes"}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Create Doctor Modal ── */}
            <AnimatePresence>
                {showForm && (
                    <>
                        <motion.div
                            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => { setShowForm(false); setError(""); }}
                        />
                        <motion.div
                            className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        >
                            <motion.div
                                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 relative max-h-[90vh] overflow-y-auto"
                                initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={() => { setShowForm(false); setError(""); }}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X size={20} />
                                </button>

                                <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-indigo-500" />
                                    Create New Doctor
                                </h2>
                                <p className="text-sm text-gray-400 mb-6">Fill in the details to register a new doctor account.</p>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-gray-700">Full Name</label>
                                            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="input-field" placeholder="John Doe" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-gray-700">Role</label>
                                            <select name="role" value={formData.role} onChange={handleInputChange} className="input-field">
                                                <option value="DOCTOR">Doctor</option>
                                                <option value="ADMIN">Clinic Admin</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-gray-700">Email Address</label>
                                            <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className="input-field" placeholder="doctor@example.com" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-gray-700">Password</label>
                                            <input type="password" name="password" value={formData.password} onChange={handleInputChange} required className="input-field" placeholder="••••••••" />
                                        </div>
                                        {formData.role === "DOCTOR" && (
                                            <>
                                                <div className="space-y-1">
                                                    <label className="text-sm font-medium text-gray-700">Phone Number</label>
                                                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="input-field" placeholder="+91 98765 43210" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-sm font-medium text-gray-700">WhatsApp Number</label>
                                                    <input type="tel" name="whatsapp_number" value={formData.whatsapp_number} onChange={handleInputChange} className="input-field" placeholder="+91 98765 43210" />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

                                    <div className="flex justify-end gap-3 pt-2">
                                        <button type="button" onClick={() => { setShowForm(false); setError(""); }} className="btn-secondary">
                                            Cancel
                                        </button>
                                        <button type="submit" disabled={submitting} className="btn-primary">
                                            {submitting ? "Creating..." : "Create Account"}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
