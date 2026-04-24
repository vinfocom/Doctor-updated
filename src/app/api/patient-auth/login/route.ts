export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/jwt";
import { validateLoginChallengeProof } from "@/lib/loginChallenge";

async function findPatientByIdentifier(identifier: string) {
    try {
        return await prisma.patients.findFirst({
            where: {
                OR: [{ phone: identifier }, { telegram_chat_id: identifier }],
            },
            select: {
                patient_id: true,
                full_name: true,
                phone: true,
                telegram_chat_id: true,
                password: true,
                doctor_id: true,
                booking_id: true,
                admin_id: true,
            },
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (!msg.includes("telegram_chat_id")) throw error;
        return prisma.patients.findFirst({
            where: { phone: identifier },
            select: {
                patient_id: true,
                full_name: true,
                phone: true,
                password: true,
                doctor_id: true,
                booking_id: true,
                admin_id: true,
            },
        });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const identifier = String(
            searchParams.get("identifier") ||
            searchParams.get("phone") ||
            searchParams.get("telegram_chat_id") ||
            ""
        ).trim();

        if (!identifier) {
            return NextResponse.json({ exists: false, hasPassword: false, patient: null });
        }

        const patient = await findPatientByIdentifier(identifier);
        if (!patient) {
            return NextResponse.json({ exists: false, hasPassword: false, patient: null });
        }

        return NextResponse.json({
            exists: true,
            hasPassword: Boolean(String(patient.password || "").trim()),
            patient: {
                patient_id: patient.patient_id,
                full_name: patient.full_name,
                phone: patient.phone,
                telegram_chat_id: patient.telegram_chat_id,
                doctor_id: patient.doctor_id,
                booking_id: patient.booking_id,
                admin_id: patient.admin_id,
            },
        });
    } catch (error) {
        console.error("Patient login lookup error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const identifier = String(body?.identifier || body?.phone || body?.telegram_chat_id || "").trim();
        const password = String(body?.password || "").trim();
        const setPassword = String(body?.setPassword || "").trim();
        const confirmPassword = String(body?.confirmPassword || "").trim();
        const challengeId = String(body?.challengeId || "").trim();
        const challengeVerificationToken = String(body?.challengeVerificationToken || "").trim();

        if (!identifier || !challengeId || !challengeVerificationToken) {
            return NextResponse.json(
                { error: "Identifier and verified calculation are required" },
                { status: 400 }
            );
        }

        const challengeResult = validateLoginChallengeProof(
            challengeId,
            challengeVerificationToken
        );
        if (!challengeResult.ok) {
            const message =
                challengeResult.reason === "expired"
                    ? "Calculation expired. Please generate a new one."
                    : "Please verify the calculation before logging in.";

            return NextResponse.json({ error: message }, { status: 400 });
        }

        const patient = await findPatientByIdentifier(identifier);

        if (!patient) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }

        const hasStoredPassword = Boolean(String(patient.password || "").trim());

        if (!hasStoredPassword) {
            if (!setPassword || !confirmPassword) {
                return NextResponse.json(
                    {
                        error: "Password setup required",
                        requiresPasswordSetup: true,
                    },
                    { status: 428 }
                );
            }

            if (setPassword.length < 6) {
                return NextResponse.json(
                    { error: "Password must be at least 6 characters long" },
                    { status: 400 }
                );
            }

            if (setPassword !== confirmPassword) {
                return NextResponse.json(
                    { error: "Password and confirm password must match" },
                    { status: 400 }
                );
            }

            const hashedPassword = await bcrypt.hash(setPassword, 12);
            await prisma.patients.update({
                where: { patient_id: patient.patient_id },
                data: { password: hashedPassword },
            });
        } else {
            if (!password) {
                return NextResponse.json({ error: "Password is required" }, { status: 400 });
            }

            const isPasswordValid = await bcrypt.compare(password, String(patient.password || ""));
            if (!isPasswordValid) {
                return NextResponse.json({ error: "Invalid phone number or password" }, { status: 401 });
            }
        }

        const token = generateToken({
            userId: patient.patient_id,
            patientId: patient.patient_id,
            role: "PATIENT",
        });

        const response = NextResponse.json(
            {
                message: "Patient login successful",
                role: "PATIENT",
                token,
                patient: {
                    patient_id: patient.patient_id,
                    full_name: patient.full_name,
                    phone: patient.phone,
                    telegram_chat_id: patient.telegram_chat_id,
                    doctor_id: patient.doctor_id,
                    booking_id: patient.booking_id,
                    admin_id: patient.admin_id,
                },
            },
            { status: 200 }
        );

        response.cookies.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
        });

        return response;
    } catch (error) {
        console.error("Patient login error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
