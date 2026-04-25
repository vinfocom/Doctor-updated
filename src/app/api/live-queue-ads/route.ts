import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isMissingLiveQueueAdsTableError } from "@/lib/liveQueueAdsDb";

function parseClinicId(value: string | null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(req: NextRequest) {
    try {
        const clinicId = parseClinicId(req.nextUrl.searchParams.get("clinicId"));

        if (!clinicId) {
            return NextResponse.json({ error: "Valid clinicId is required." }, { status: 400 });
        }

        const ads = await prisma.live_queue_side_ads.findMany({
            where: {
                clinic_id: clinicId,
            },
            orderBy: [
                { position: "asc" },
                { sort_order: "asc" },
                { created_at: "asc" },
            ],
        });

        return NextResponse.json({ ads });
    } catch (error) {
        if (isMissingLiveQueueAdsTableError(error)) {
            return NextResponse.json(
                {
                    error: "Live queue ads table is missing. Run the Prisma migration to enable ad management.",
                },
                { status: 503 }
            );
        }

        console.error("Live queue ads GET error:", error);
        return NextResponse.json({ error: "Failed to load queue ads." }, { status: 500 });
    }
}
