import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

/**
 * GET /api/images/[...path]
 * Serve images from R2 bucket
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { path } = await params;
    const imagePath = path.join("/");

    // Get R2 bucket from Cloudflare context
    const { env } = await getCloudflareContext();
    const bucket = env.PRODUCT_IMAGES as R2Bucket;

    if (!bucket) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    // Get the object from R2
    const object = await bucket.get(imagePath);

    if (!object) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // Get content type from metadata or guess from extension
    const contentType = object.httpMetadata?.contentType || "image/jpeg";

    // Return the image with appropriate headers
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(object.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Image serve error:", error);
    return NextResponse.json(
      { error: "Failed to serve image" },
      { status: 500 }
    );
  }
}
