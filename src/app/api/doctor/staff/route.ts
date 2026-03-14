export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/request-auth";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
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

        const staffMembers = await prisma.clinic_staff.findMany({
            where: { doctor_id: doctor.doctor_id },
            include: {
                users: true,
                clinics: true
            },
            orderBy: { created_at: "desc" }
        });

        const formattedStaff = staffMembers.map(staff => ({
            staff_id: staff.staff_id,
            user_id: staff.user_id,
            name: staff.users?.name,
            email: staff.users?.email,
            role: staff.staff_role,
            status: staff.status,
            valid_from: staff.valid_from,
            valid_to: staff.valid_to,
            created_at: staff.created_at,
            clinic_id: staff.clinic_id,
            clinic_name: staff.clinics?.clinic_name || null
        }));

        return NextResponse.json({ staff: formattedStaff });
    } catch (error) {
        console.error("Get staff error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
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

        const body = await req.json();
        const { username, email, password, role, status, is_limited, valid_from, valid_to, clinic_id } = body;

        // Basic validation
        if (!email || !role || !username) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check if user already exists
        const existingUser = await prisma.users.findUnique({ where: { email } });
        if (existingUser) {
            return NextResponse.json({ error: "Email already in use" }, { status: 400 });
        }

        const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

        // Create User and Clinic Staff in a transaction
        const newStaff = await prisma.$transaction(async (tx) => {
            const newUser = await tx.users.create({
                data: {
                    name: username,
                    email,
                    password: hashedPassword,
                    role: "CLINIC_STAFF"
                }
            });

            const fromDate = is_limited && valid_from ? new Date(valid_from) : null;
            const toDate = is_limited && valid_to ? new Date(valid_to) : null;

            const clinicStaff = await tx.clinic_staff.create({
                data: {
                    doctor_id: doctor.doctor_id,
                    user_id: newUser.user_id,
                    clinic_id: clinic_id ? parseInt(clinic_id) : null,
                    staff_role: role,
                    status: status || "ACTIVE",
                    valid_from: fromDate,
                    valid_to: toDate
                }
            });

            return { user: newUser, staff: clinicStaff };
        });

        return NextResponse.json({ success: true, staff: newStaff.staff }, { status: 201 });
    } catch (error) {
        console.error("Create staff error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
