export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET: List doctors
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const adminId = searchParams.get("adminId");

        const where: Record<string, unknown> = {};
        if (adminId) where.admin_id = Number(adminId);

        const doctors = await prisma.doctors.findMany({
            where,
            include: {
                admin: {
                    select: {
                        admin_id: true,
                        user: {
                            select: { user_id: true, name: true, email: true },
                        },
                    },
                },
                schedules: true,
            },
        });
        const serializedDoctors = doctors.map(doc => ({
            ...doc,
            chat_id: doc.chat_id ? String(doc.chat_id) : null
        }));

        return NextResponse.json({ doctors: serializedDoctors });
    } catch (error: any) {
        console.error("Get doctors error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error?.message || String(error) },
            { status: 500 }
        );
    }
}

// DELETE: Admin can delete a doctor
export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const doctorId = searchParams.get("id");

        if (!doctorId) {
            return NextResponse.json({ error: "Doctor ID required" }, { status: 400 });
        }

        const doctor = await prisma.doctors.findUnique({
            where: { doctor_id: parseInt(doctorId) },
            select: { doctor_id: true, user_id: true },
        });

        if (!doctor) {
            return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
        }

        // Delete in FK-safe order: tokens → doctor → user (so email is reusable)
        await prisma.$transaction(async (tx) => {
            // 1. Delete user_tokens for this user (FK on users)
            if (doctor.user_id) {
                await tx.user_tokens.deleteMany({ where: { user_id: doctor.user_id } });
            }
            // 2. Delete the doctor record
            await tx.doctors.delete({ where: { doctor_id: doctor.doctor_id } });
            // 3. Delete the linked user so email can be reused
            if (doctor.user_id) {
                await tx.users.delete({ where: { user_id: doctor.user_id } });
            }
        });

        return NextResponse.json({ message: "Doctor deleted successfully" });
    } catch (error) {
        console.error("Delete doctor error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH: Update doctor details
export async function PATCH(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { doctor_id, doctor_name, phone, whatsapp_number, specialization } = body;

        if (!doctor_id) {
            return NextResponse.json({ error: "doctor_id required" }, { status: 400 });
        }

        const updated = await prisma.doctors.update({
            where: { doctor_id: Number(doctor_id) },
            data: {
                ...(doctor_name !== undefined && { doctor_name }),
                ...(phone !== undefined && { phone }),
                ...(whatsapp_number !== undefined && { whatsapp_number }),
                ...(specialization !== undefined && { specialization }),
            },
        });

        return NextResponse.json({
            message: "Doctor updated successfully",
            doctor: { ...updated, chat_id: updated.chat_id ? String(updated.chat_id) : null },
        });
    } catch (error) {
        console.error("Update doctor error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
