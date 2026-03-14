export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.users.findUnique({
            where: { user_id: session.userId },
            select: {
                user_id: true,
                email: true,
                name: true,
                role: true,
                created_at: true,
                admin: {
                    select: {
                        admin_id: true,
                    },
                },
                clinic_staff: {
                    select: {
                        staff_role: true,
                        clinic_id: true,
                        doctor_id: true,
                        status: true,
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // For CLINIC_STAFF, include staff-specific role in the response
        const responseUser = {
            ...user,
            staff_role: user.clinic_staff?.staff_role || null,
            staff_clinic_id: user.clinic_staff?.clinic_id || null,
            staff_doctor_id: user.clinic_staff?.doctor_id || null,
        };

        return NextResponse.json({ user: responseUser });
    } catch (error) {
        console.error("Get me error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

