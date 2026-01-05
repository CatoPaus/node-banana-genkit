import { NextResponse } from "next/server";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const operationId = searchParams.get("id");

    if (!operationId) {
        return NextResponse.json({ success: false, error: "Missing operation ID" }, { status: 400 });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        // Vertex operations start with "projects/"
        const isVertex = operationId.startsWith("projects/");

        // This client will be initialized based on the operation origin (Gemini or Vertex)
        let client: GoogleGenAI;

        if (isVertex) {
            // For Vertex, we extract project and location from the ID
            // ID format: projects/{project}/locations/{location}/...
            const parts = operationId.split('/');
            const project = parts[1];
            const location = parts[3];

            if (!project || !location) {
                throw new Error("Invalid Vertex Operation ID format");
            }

            // Initialization for Vertex AI
            // We DO NOT pass apiKey here because it is mutually exclusive with project/location in the SDK
            // This relies on Application Default Credentials (ADC) or similar environment auth.
            // This is the correct way to handle Vertex AI via the SDK in most server environments.
            client = new GoogleGenAI({
                vertexai: true,
                project: project,
                location: location
            });
        } else {
            // For Gemini (Google AI Studio)
            if (!apiKey) throw new Error("GEMINI_API_KEY not set for Gemini operation");
            client = new GoogleGenAI({ apiKey: apiKey });
        }

        // Fetch operation status
        // We use GenerateVideosOperation as a typed container for the request.
        // This is necessary because the SDK requires a concrete Operation object structure.
        // Even if the operation is not a video generation, extracting basic done/error status *should* work 
        // if the generic structure matches, but ideally strictly matching types is better.
        // For Veo (likely use case), this is correct.
        const operationParams = new GenerateVideosOperation();
        operationParams.name = operationId;

        // @ts-ignore - Types mismatch in SDK usage vs definition often requires casting or ignores
        const op = await client.operations.get({ operation: operationParams });

        if (!op.done) {
            return NextResponse.json({ success: true, done: false });
        }

        if (op.error) {
            return NextResponse.json({ success: true, done: true, error: op.error });
        }

        // Extract video from response
        // SDK maps response using its own internal mappers (e.g. videoFromVertex)
        const response = op.response;
        // @ts-ignore - access generatedVideos loosely
        const samples = response?.generatedVideos;

        if (samples && samples.length > 0) {
            const medias = samples.map((sample: any) => {
                let videoUrl = sample.video?.uri;
                const videoBytes = sample.video?.videoBytes;

                if (videoUrl) {
                    // SECURITY FIX: Do not send API Key to client.
                    // Route through secure proxy if needed for bypassing CORS or Auth barriers on GCS content.
                    if (!videoUrl.startsWith('/api/proxy-media') && videoUrl.startsWith('http')) {
                        videoUrl = `/api/proxy-media?url=${encodeURIComponent(videoUrl)}&ext=.mp4`;
                    }
                } else if (videoBytes) {
                    // Create Data URL if we have bytes but no URL
                    // Identify mime type if available, default to mp4
                    const mime = sample.video?.mimeType || 'video/mp4';
                    videoUrl = `data:${mime};base64,${videoBytes}`;
                }

                return { url: videoUrl };
            }).filter((m: any) => m.url);

            return NextResponse.json({
                success: true,
                done: true,
                medias: medias,
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
