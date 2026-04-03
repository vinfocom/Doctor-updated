"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Calculator, Eye, EyeOff, RefreshCw } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [form, setForm] = useState({ email: "", password: "" });
    const [challengeId, setChallengeId] = useState("");
    const [challengeQuestion, setChallengeQuestion] = useState("");
    const [challengeAnswer, setChallengeAnswer] = useState("");
    const [challengeVerificationToken, setChallengeVerificationToken] = useState("");
    const [challengeVerified, setChallengeVerified] = useState(false);
    const [challengeMessage, setChallengeMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [challengeLoading, setChallengeLoading] = useState(false);
    const [verifyingChallenge, setVerifyingChallenge] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const canSubmit = useMemo(
        () =>
            Boolean(
                form.email.trim() &&
                form.password &&
                challengeId &&
                challengeVerificationToken &&
                challengeAnswer.trim() &&
                challengeVerified
            ) && !loading,
        [challengeAnswer, challengeId, challengeVerificationToken, challengeVerified, form.email, form.password, loading]
    );

    const loadChallenge = async (clearAnswer = true) => {
        setChallengeLoading(true);
        setError("");
        setChallengeMessage("");
        setChallengeVerified(false);
        setChallengeVerificationToken("");

        try {
            const res = await fetch("/api/auth/login-challenge", { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Unable to load calculation");
                setChallengeId("");
                setChallengeQuestion("");
                return;
            }

            setChallengeId(data.challengeId || "");
            setChallengeQuestion(data.question || "");
            if (clearAnswer) {
                setChallengeAnswer("");
            }
        } catch {
            setError("Unable to load calculation");
            setChallengeId("");
            setChallengeQuestion("");
        } finally {
            setChallengeLoading(false);
        }
    };

    useEffect(() => {
        loadChallenge();
    }, []);

    useEffect(() => {
        if (challengeVerified) {
            setChallengeVerified(false);
            setChallengeMessage("");
            setChallengeVerificationToken("");
        }
    }, [challengeAnswer, challengeVerified]);

    const handleVerifyChallenge = async () => {
        if (!challengeId || !challengeAnswer.trim()) {
            setError("Enter the calculation answer before verifying.");
            return;
        }

        setVerifyingChallenge(true);
        setError("");
        setChallengeMessage("");
        setChallengeVerified(false);
        setChallengeVerificationToken("");

        try {
            const res = await fetch("/api/auth/login-challenge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    challengeId,
                    answer: challengeAnswer.trim(),
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                const message = data.error || "Wrong answer";
                await loadChallenge();
                setError(message);
                return;
            }

            setChallengeVerificationToken(data.verificationToken || "");
            setChallengeVerified(true);
            setChallengeMessage("Verified");
        } catch {
            setError("Unable to verify calculation right now.");
        } finally {
            setVerifyingChallenge(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setChallengeMessage("");

        if (!challengeVerified || !challengeId || !challengeVerificationToken) {
            setError("Please verify the calculation before signing in.");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    challengeId,
                    challengeVerificationToken,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error);
                if (res.status === 400) {
                    setChallengeVerified(false);
                    await loadChallenge();
                }
                return;
            }

            const role = data.user.role;
            if (role === "SUPER_ADMIN" || role === "ADMIN") router.push("/dashboard/admin");
            else if (role === "DOCTOR" || role === "CLINIC_STAFF") router.push("/dashboard/doctor");
            else router.push("/dashboard/admin");
        } catch {
            setError("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-gradient-to-br from-gray-50 to-indigo-50/30">
            <div className="page-glow" />

            {/* Background orbs */}
            <motion.div
                className="absolute top-20 left-20 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="absolute bottom-20 right-20 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl"
                animate={{ scale: [1.1, 1, 1.1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.div
                className="relative z-10 w-full max-w-md"
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
                <div className="glass-card p-10">
                    {/* Header */}
                    <motion.div
                        className="text-center mb-8"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/10 flex items-center justify-center text-2xl mx-auto mb-4">
                            🏥
                        </div>
                        <h1 className="text-3xl font-bold gradient-text">Welcome Back</h1>
                        <p className="text-gray-500 mt-2 text-sm">Sign in to your account</p>
                    </motion.div>

                    {/* Error */}
                    {error && (
                        <motion.div
                            className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                        >
                            {error}
                        </motion.div>
                    )}

                    {/* Form */}
                    <motion.form
                        onSubmit={handleSubmit}
                        className="space-y-5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Email</label>
                            <input
                                type="email"
                                className="input-field"
                                placeholder="you@example.com"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="input-field pr-10"
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <label className="block text-sm font-medium text-gray-700">Quick Verification</label>
                                <button
                                    type="button"
                                    onClick={() => loadChallenge()}
                                    disabled={challengeLoading || verifyingChallenge}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800 disabled:opacity-50"
                                >
                                    <RefreshCw size={14} />
                                    Regenerate
                                </button>
                            </div>
                            <div className="mb-3 flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm">
                                <Calculator size={16} className="text-indigo-600" />
                                {challengeLoading ? (
                                    <span>Loading calculation...</span>
                                ) : challengeQuestion ? (
                                    <>
                                        <span>{challengeQuestion.replace("?", "")}</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="w-20 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-center text-sm font-semibold text-gray-800 outline-none"
                                            placeholder="Ans"
                                            value={challengeAnswer}
                                            onChange={(e) => setChallengeAnswer(e.target.value)}
                                            disabled={challengeVerified}
                                        />
                                    </>
                                ) : (
                                    <span>Calculation unavailable</span>
                                )}
                                <button
                                    type="button"
                                    onClick={handleVerifyChallenge}
                                    disabled={challengeLoading || verifyingChallenge || challengeVerified || !challengeAnswer.trim() || !challengeId}
                                    className="ml-auto rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {verifyingChallenge ? "Verifying..." : "Verify"}
                                </button>
                            </div>
                            {challengeMessage ? (
                                <p className="mt-1.5 text-sm font-medium text-emerald-600">{challengeMessage}</p>
                            ) : null}
                        </div>

                        <motion.button
                            type="submit"
                            className="btn-primary w-full py-3.5 mt-2 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={!canSubmit}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                    </svg>
                                    Signing in...
                                </span>
                            ) : "Sign In"}
                        </motion.button>
                    </motion.form>
                </div>
            </motion.div>
        </div>
    );
}
