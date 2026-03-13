import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/request-auth";

export async function GET(req: Request) {
    try {
        const session = await getSessionFromRequest(req);
        if (!session || (session.role !== "DOCTOR" && session.role !== "ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const phone = String(searchParams.get("phone") || "").trim();
        if (!phone) {
            return NextResponse.json({ patients: [] });
        }

        let adminId: number | undefined;
        let doctorId: number | undefined;

        if (session.role === "DOCTOR") {
            const doctor = await prisma.doctors.findUnique({
                where: { user_id: session.userId },
                select: { doctor_id: true, admin_id: true },
            });

            if (!doctor) {
                return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
            }

            doctorId = doctor.doctor_id;
            adminId = doctor.admin_id;
        } else {
            const admin = await prisma.admins.findUnique({
                where: { user_id: session.userId },
                select: { admin_id: true },
            });

            if (!admin) {
                return NextResponse.json({ error: "Admin profile not found" }, { status: 404 });
            }

            adminId = admin.admin_id;
        }

        const patients = await prisma.patients.findMany({
            where: {
                phone,
                admin_id: adminId,
                ...(doctorId ? { doctor_id: doctorId } : {}),
            },
            select: {
                patient_id: true,
                full_name: true,
            },
            orderBy: {
                patient_id: "desc",
            },
        });

        const uniquePatients = patients.filter((patient, index, items) => {
            const currentName = (patient.full_name || "").trim().toLowerCase();
            return items.findIndex((item) => (item.full_name || "").trim().toLowerCase() === currentName) === index;
        });

        return NextResponse.json({ patients: uniquePatients });
    } catch (error) {
        console.error("Patient lookup error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
