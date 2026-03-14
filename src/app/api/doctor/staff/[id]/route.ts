export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/request-auth";

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSessionFromRequest(req);
        if (!session || session.role !== "DOCTOR") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const doctor = await prisma.doctors.findUnique({
            where: { user_id: session.userId },
            select: { doctor_id: true }
        });

        if (!doctor) {
            return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
        }

        const resolvedParams = await props.params;
        const staffId = parseInt(resolvedParams.id);
        const body = await req.json();
        const { username, role, status, is_limited, valid_from, valid_to, clinic_id } = body;

        const existingStaff = await prisma.clinic_staff.findUnique({
            where: { staff_id: staffId },
            include: { users: true }
        });

        if (!existingStaff || existingStaff.doctor_id !== doctor.doctor_id) {
            return NextResponse.json({ error: "Staff not found or forbidden" }, { status: 404 });
        }

        const fromDate = is_limited && valid_from ? new Date(valid_from) : null;
        const toDate = is_limited && valid_to ? new Date(valid_to) : null;

        await prisma.$transaction(async (tx) => {
            if (username && existingStaff.users.name !== username) {
                await tx.users.update({
                    where: { user_id: existingStaff.user_id },
                    data: { name: username }
                });
            }

            await tx.clinic_staff.update({
                where: { staff_id: staffId },
                data: {
                    staff_role: role || existingStaff.staff_role,
                    status: status || existingStaff.status,
                    valid_from: fromDate,
                    valid_to: toDate,
                    clinic_id: clinic_id ? parseInt(clinic_id) : null
                }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Update staff error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSessionFromRequest(req);
        if (!session || session.role !== "DOCTOR") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const doctor = await prisma.doctors.findUnique({
            where: { user_id: session.userId },
            select: { doctor_id: true }
        });

        if (!doctor) {
            return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
        }

        const resolvedParams = await props.params;
        const staffId = parseInt(resolvedParams.id);

        const existingStaff = await prisma.clinic_staff.findUnique({
            where: { staff_id: staffId }
        });

        if (!existingStaff || existingStaff.doctor_id !== doctor.doctor_id) {
            return NextResponse.json({ error: "Staff not found or forbidden" }, { status: 404 });
        }

        await prisma.$transaction(async (tx) => {
            await tx.clinic_staff.delete({
                where: { staff_id: staffId }
            });

            await tx.users.delete({
                where: { user_id: existingStaff.user_id }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete staff error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
