import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const operationId = searchParams.get("id");

    if (!operationId) {
        return NextResponse.json({ success: false, error: "Missing operation ID" }, { status: 400 });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");

        // The operationId from Genkit is the resource name, e.g. "models/.../operations/..."
        // We can fetch it directly from the Generative Language API
        const url = `https://generativelanguage.googleapis.com/v1beta/${operationId}?key=${apiKey}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to check operation: ${response.status} ${response.statusText}`);
        }

        const op = await response.json();

        if (!op.done) {
            return NextResponse.json({ success: true, done: false });
        }

        if (op.error) {
            return NextResponse.json({ success: true, done: true, error: op.error });
        }

        // Extract video URL from Veo response
        // Structure: op.response.generateVideoResponse.generatedSamples[].video.uri
        const samples = op.response?.generateVideoResponse?.generatedSamples;
        if (samples && samples.length > 0) {
            const medias = samples.map((sample: any) => {
                let videoUrl = sample.video?.uri;
                if (videoUrl) {
                    // SECURITY FIX: Do not send API Key to client.
                    // Instead, route through our secure proxy.
                    // Check if it's already proxied to avoid double-wrapping (defensive)
                    if (!videoUrl.startsWith('/api/proxy-media')) {
                        videoUrl = `/api/proxy-media?url=${encodeURIComponent(videoUrl)}&ext=.mp4`;
                    }
                }
                return { url: videoUrl };
            }).filter((m: any) => m.url);

            return NextResponse.json({
                success: true,
                done: true,
                medias: medias, // Array of { url: string }
                // Include first one as 'media' for backward compat
                media: medias.length > 0 ? medias[0] : undefined
            });
        }

        return NextResponse.json({
            success: true,
            done: true,
            error: { message: "Operation completed but no video found" }
        });

    } catch (error: any) {
        console.error("Operation check failed:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
