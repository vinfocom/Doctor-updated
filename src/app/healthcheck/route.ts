export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export async function GET() {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor(process.uptime());

    try {
        await prisma.$queryRaw`SELECT 1`;

        return NextResponse.json({
            status: "ok",
            timestamp,
            uptime,
        });
    } catch (error) {
        console.error("Healthcheck failed:", error);

        return NextResponse.json(
            {
                status: "error",
                timestamp,
                uptime,
            },
            { status: 503 }
        );
    }
}
