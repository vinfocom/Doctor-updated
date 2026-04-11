export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/jwt";
import { validateLoginChallengeProof } from "@/lib/loginChallenge";

const DEFAULT_ADMIN_ID = 1;

function normalizeDigits(value: string) {
    return value.replace(/\D/g, "");
}

function phonesMatch(left: string | null | undefined, right: string | null | undefined) {
    const normalizedLeft = normalizeDigits(String(left || ""));
    const normalizedRight = normalizeDigits(String(right || ""));
    if (!normalizedLeft || !normalizedRight) return false;
    if (normalizedLeft === normalizedRight) return true;
    if (normalizedLeft.length >= 10 && normalizedRight.length >= 10) {
        return normalizedLeft.slice(-10) === normalizedRight.slice(-10);
    }
    return false;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const full_name = String(body?.full_name || "").trim();
        const phone = String(body?.phone || "").trim();
        const gender = String(body?.gender || "").trim();
        const challengeId = String(body?.challengeId || "").trim();
        const challengeVerificationToken = String(body?.challengeVerificationToken || "").trim();
        const rawAge = body?.age;

        if (!full_name) {
            return NextResponse.json({ error: "Full name is required" }, { status: 400 });
        }

        if (!phone) {
            return NextResponse.json(
                { error: "Phone number is required" },
                { status: 400 }
            );
        }

        if (!challengeId || !challengeVerificationToken) {
            return NextResponse.json(
                { error: "Verified calculation is required" },
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
                    : "Please verify the calculation before signing up.";

            return NextResponse.json({ error: message }, { status: 400 });
        }

        let age: number | null = null;
        if (rawAge !== undefined && rawAge !== null && String(rawAge).trim() !== "") {
            const parsedAge = parseInt(String(rawAge), 10);
            if (Number.isNaN(parsedAge) || parsedAge <= 0 || parsedAge >= 150) {
                return NextResponse.json({ error: "Please enter a valid age" }, { status: 400 });
            }
            age = parsedAge;
        }

        const existingPatients = await prisma.patients.findMany({
            where: {
                admin_id: DEFAULT_ADMIN_ID,
                profile_type: "SELF",
                phone,
            },
            select: {
                patient_id: true,
                full_name: true,
                phone: true,
                doctor_id: true,
                admin_id: true,
            },
            orderBy: { patient_id: "asc" },
        });

        const existingPatient =
            existingPatients.find((patient) => phonesMatch(patient.phone, phone)) ||
            null;

        const patient = existingPatient
            ? await prisma.patients.update({
                where: { patient_id: existingPatient.patient_id },
                data: {
                    full_name,
                    phone,
                    ...(gender ? { gender } : {}),
                    ...(age !== null ? { age } : {}),
                    admin_id: DEFAULT_ADMIN_ID,
                    profile_type: "SELF",
                },
                select: {
                    patient_id: true,
                    full_name: true,
                    phone: true,
                    doctor_id: true,
                    admin_id: true,
                },
            })
            : await prisma.patients.create({
                data: {
                    full_name,
                    phone,
                    gender: gender || null,
                    age,
                    admin_id: DEFAULT_ADMIN_ID,
                    doctor_id: null,
                    profile_type: "SELF",
                },
                select: {
                    patient_id: true,
                    full_name: true,
                    phone: true,
                    doctor_id: true,
                    admin_id: true,
                },
            });

        const token = generateToken({
            userId: patient.patient_id,
            patientId: patient.patient_id,
            role: "PATIENT",
        });

        const response = NextResponse.json(
            {
                message: existingPatient
                    ? "Patient signup completed successfully"
                    : "Patient account created successfully",
                role: "PATIENT",
                token,
                patient,
            },
            { status: existingPatient ? 200 : 201 }
        );

        response.cookies.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
        });

        return response;
    } catch (error: unknown) {
        console.error("Patient signup error:", error);
        if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "P2002"
        ) {
            return NextResponse.json(
                { error: "Phone number is already linked to another patient" },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}