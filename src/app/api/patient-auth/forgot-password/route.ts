export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/jwt";

async function findPatientByPhone(phone: string) {
    return prisma.patients.findFirst({
        where: { phone },
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

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const phone = String(body?.phone || "").trim();
        const newPassword = String(body?.newPassword || "").trim();
        const confirmPassword = String(body?.confirmPassword || "").trim();

        if (!phone || !newPassword || !confirmPassword) {
            return NextResponse.json(
                { error: "Phone, new password, and confirm password are required" },
                { status: 400 }
            );
        }

        const patient = await findPatientByPhone(phone);
        if (!patient) {
            return NextResponse.json({ error: "Patient not found. Please create an account." }, { status: 404 });
        }

        if (!String(patient.password || "").trim()) {
            return NextResponse.json(
                { error: "This account does not have a password yet. Please use set password." },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: "Password must be at least 6 characters long" },
                { status: 400 }
            );
        }

        if (newPassword !== confirmPassword) {
            return NextResponse.json(
                { error: "Password and confirm password must match" },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.patients.update({
            where: { patient_id: patient.patient_id },
            data: { password: hashedPassword },
        });

        const token = generateToken({
            userId: patient.patient_id,
            patientId: patient.patient_id,
            role: "PATIENT",
        });

        const response = NextResponse.json(
            {
                message: "Password reset successful",
                role: "PATIENT",
                token,
                patient: {
                    patient_id: patient.patient_id,
                    full_name: patient.full_name,
                    phone: patient.phone,
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
        console.error("Patient forgot password error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
