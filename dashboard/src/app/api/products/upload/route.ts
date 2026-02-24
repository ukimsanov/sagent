import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDB } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

/**
 * POST /api/products/upload
 * Upload an image to R2 and return the URL
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    // Get the form data with the image file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 11);
    const filename = `${businessId}/${timestamp}-${random}.${ext}`;

    // Get R2 bucket from Cloudflare context
    const { env } = await getCloudflareContext();
    const bucket = env.PRODUCT_IMAGES as R2Bucket;

    if (!bucket) {
      console.error("R2 bucket not available");
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await bucket.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Construct the public URL
    // Note: This assumes the R2 bucket is configured with a custom domain or public access
    // For now, we'll store the key and the dashboard will need to serve it via a route
    const url = `/api/images/${filename}`;

    return NextResponse.json({ url, filename });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
