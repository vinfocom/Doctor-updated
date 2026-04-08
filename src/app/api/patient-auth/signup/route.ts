export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/jwt";
import { validateLoginChallengeProof } from "@/lib/loginChallenge";

function normalizePhone(value: string | null | undefined) {
    return String(value || "").replace(/\D/g, "");
}

function phonesMatch(left: string | null | undefined, right: string | null | undefined) {
    const normalizedLeft = normalizePhone(left);
    const normalizedRight = normalizePhone(right);
    if (!normalizedLeft || !normalizedRight) return false;
    if (normalizedLeft === normalizedRight) return true;
    if (normalizedLeft.length >= 10 && normalizedRight.length >= 10) {
        return normalizedLeft.slice(-10) === normalizedRight.slice(-10);
    }
    return false;
}

async function resolveSignupAdminId(body: {
    admin_id?: unknown;
    doctor_id?: unknown;
    clinic_id?: unknown;
}) {
    const explicitAdminId = Number(body.admin_id);
    if (Number.isFinite(explicitAdminId) && explicitAdminId > 0) {
        const admin = await prisma.admins.findUnique({
            where: { admin_id: explicitAdminId },
            select: { admin_id: true },
        });
        return admin?.admin_id ?? null;
    }

    const explicitDoctorId = Number(body.doctor_id);
    if (Number.isFinite(explicitDoctorId) && explicitDoctorId > 0) {
        const doctor = await prisma.doctors.findUnique({
            where: { doctor_id: explicitDoctorId },
            select: { admin_id: true },
        });
        return doctor?.admin_id ?? null;
    }

    const explicitClinicId = Number(body.clinic_id);
    if (Number.isFinite(explicitClinicId) && explicitClinicId > 0) {
        const clinic = await prisma.clinics.findUnique({
            where: { clinic_id: explicitClinicId },
            select: { admin_id: true },
        });
        return clinic?.admin_id ?? null;
    }

    const envAdminId = Number(process.env.DEFAULT_PATIENT_SIGNUP_ADMIN_ID);
    if (Number.isFinite(envAdminId) && envAdminId > 0) {
        const admin = await prisma.admins.findUnique({
            where: { admin_id: envAdminId },
            select: { admin_id: true },
        });
        return admin?.admin_id ?? null;
    }

    const admins = await prisma.admins.findMany({
        select: { admin_id: true },
        orderBy: { admin_id: "asc" },
        take: 2,
    });

    if (admins.length === 1) {
        return admins[0].admin_id;
    }

    return null;
}

async function findExistingSelfPatientByPhone(input: {
    phone: string;
    admin_id: number;
}) {
    const existingPatients = await prisma.patients.findMany({
        where: {
            admin_id: input.admin_id,
            profile_type: "SELF",
        },
        select: {
            patient_id: true,
            full_name: true,
            phone: true,
            doctor_id: true,
            booking_id: true,
            admin_id: true,
        },
        orderBy: { patient_id: "desc" },
    });

    return existingPatients.find((patient) => phonesMatch(patient.phone, input.phone)) || null;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const phone = String(searchParams.get("phone") || "").trim();
        const admin_id = await resolveSignupAdminId({
            admin_id: searchParams.get("admin_id") || undefined,
            doctor_id: searchParams.get("doctor_id") || undefined,
            clinic_id: searchParams.get("clinic_id") || undefined,
        });

        if (!phone || !admin_id) {
            return NextResponse.json({ exists: false, patient: null });
        }

        const existingPatient = await findExistingSelfPatientByPhone({ phone, admin_id });
        return NextResponse.json({
            exists: Boolean(existingPatient),
            patient: existingPatient,
        });
    } catch (error) {
        console.error("Patient signup lookup error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const full_name = String(body?.full_name || "").trim();
        const phone = String(body?.phone || "").trim();
        const gender = body?.gender == null ? null : String(body.gender).trim() || null;
        const ageValue = body?.age;
        const challengeId = String(body?.challengeId || "").trim();
        const challengeVerificationToken = String(body?.challengeVerificationToken || "").trim();

        if (!full_name || !phone || !challengeId || !challengeVerificationToken) {
            return NextResponse.json(
                { error: "Full name, phone, and verified calculation are required" },
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

        const admin_id = await resolveSignupAdminId(body || {});
        if (!admin_id) {
            return NextResponse.json(
                {
                    error: "Unable to determine clinic context for signup. Configure DEFAULT_PATIENT_SIGNUP_ADMIN_ID or pass admin_id, doctor_id, or clinic_id.",
                },
                { status: 400 }
            );
        }

        const existingPatient = await findExistingSelfPatientByPhone({ phone, admin_id });
        if (existingPatient) {
            return NextResponse.json(
                {
                    error: "This phone number is already linked to a patient account.",
                    patient: existingPatient,
                },
                { status: 409 }
            );
        }

        let parsedAge: number | null = null;
        if (ageValue !== undefined && ageValue !== null && String(ageValue).trim() !== "") {
            const ageNum = parseInt(String(ageValue), 10);
            if (!Number.isNaN(ageNum) && ageNum > 0 && ageNum < 150) {
                parsedAge = ageNum;
            }
        }

        const patient = await prisma.patients.create({
            data: {
                full_name,
                phone,
                age: parsedAge,
                gender,
                admin_id,
                doctor_id: null,
                booking_id: null,
                profile_type: "SELF",
            },
            select: {
                patient_id: true,
                full_name: true,
                phone: true,
                age: true,
                gender: true,
                admin_id: true,
                doctor_id: true,
                booking_id: true,
                profile_type: true,
            },
        });

        const token = generateToken({
            userId: patient.patient_id,
            patientId: patient.patient_id,
            role: "PATIENT",
        });

        const response = NextResponse.json(
            {
                message: "Patient signup successful",
                role: "PATIENT",
                token,
                patient,
            },
            { status: 201 }
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
        console.error("Patient signup error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
