import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { sanitizeFilename, uploadBufferToS3 } from "@/lib/s3";

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        let token = cookieStore.get("token")?.value;

        if (!token) {
            const authHeader = req.headers.get("Authorization");
            if (authHeader && authHeader.startsWith("Bearer ")) {
                token = authHeader.split(" ")[1];
            }
        }

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const session = verifyToken(token);
        if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN" && session.role !== "DOCTOR")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Only images for barcodes.
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: "Invalid file type. Allowed: JPG, PNG, WEBP" },
                { status: 400 }
            );
        }

        // Max size: 5 MB
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: "File too large. Max size is 5 MB." }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const safeName = sanitizeFilename(file.name || "barcode");
        const key = `clinic_barcodes/${Date.now()}_${safeName}`;
        const result = await uploadBufferToS3({
            key,
            buffer,
            contentType: file.type || "application/octet-stream",
        });

        return NextResponse.json({ url: result.url });
    } catch (error) {
        console.error("Clinic barcode upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
