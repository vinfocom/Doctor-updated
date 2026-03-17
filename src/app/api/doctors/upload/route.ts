import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { sanitizeFilename, uploadBufferToS3 } from "@/lib/s3";

export async function POST(req: NextRequest) {
    // Auth check – must be a DOCTOR
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

    const user = verifyToken(token);
    if (!user || user.role !== "DOCTOR") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const type = (formData.get("type") as string) || "document"; // profile_pic | barcode | document

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Allowed types
        const allowedTypes = [
            "application/pdf",
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
        ];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: "Invalid file type. Allowed: PDF, JPG, PNG, WEBP" },
                { status: 400 }
            );
        }

        // Max 10 MB
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: "File too large. Max size is 10 MB." }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // S3 folder based on type
        const folderMap: Record<string, string> = {
            profile_pic: "doctor_profile_pics",
            barcode: "doctor_barcodes",
            document: "doctor_documents",
        };
        const folder = folderMap[type] || "doctor_documents";

        const safeName = sanitizeFilename(file.name || "document");
        const key = `${folder}/${Date.now()}_${safeName}`;
        const result = await uploadBufferToS3({
            key,
            buffer,
            contentType: file.type || "application/octet-stream",
        });

        return NextResponse.json({ url: result.url });
    } catch (error) {
        console.error("Doctor upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
