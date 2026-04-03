export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createLoginChallenge, verifyLoginChallenge } from "@/lib/loginChallenge";

export async function GET() {
    return NextResponse.json(createLoginChallenge());
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const challengeId = String(body?.challengeId || "").trim();
        const answer = String(body?.answer || "").trim();

        if (!challengeId || !answer) {
            return NextResponse.json(
                { error: "Challenge id and answer are required" },
                { status: 400 }
            );
        }

        const result = verifyLoginChallenge(challengeId, answer);
        if (!result.ok) {
            const message =
                result.reason === "expired"
                    ? "Calculation expired. Please generate a new one."
                    : result.reason === "incorrect"
                        ? "Wrong answer"
                        : "Calculation not found. Please generate a new one.";

            return NextResponse.json({ error: message }, { status: 400 });
        }

        return NextResponse.json({
            message: "Calculation verified",
            challengeId,
            expiresAt: result.expiresAt,
            verificationToken: result.verificationToken,
        });
    } catch (error) {
        console.error("Login challenge verification error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
