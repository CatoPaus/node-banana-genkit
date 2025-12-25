import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/genkit";
import { GenerateRequest, GenerateResponse, ModelType } from "@/types";
import { Part } from "genkit";

export const maxDuration = 300; // 5 minute timeout
export const dynamic = 'force-dynamic';

// Map model types to model IDs
// Using exact model strings as Genkit should support them
const MODEL_MAP: Record<ModelType, string> = {
  "nano-banana": "googleai/gemini-2.5-flash-image",
  "nano-banana-pro": "googleai/gemini-3-pro-image-preview",
};

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`\n[API:${requestId}] ========== NEW GENERATE REQUEST (GENKIT) ==========`);

  try {
    const body: GenerateRequest = await request.json();
    const { images, prompt, model = "nano-banana-pro", aspectRatio, resolution, useGoogleSearch } = body;

    if (!images || images.length === 0 || !prompt) {
      return NextResponse.json<GenerateResponse>(
        { success: false, error: "At least one image and prompt are required" },
        { status: 400 }
      );
    }

    console.log(`[API:${requestId}] Processing request for model: ${model}`);

    // Prepare inputs for Genkit
    const promptParts: Part[] = [
      { text: prompt }
    ];

    // Add images
    images.forEach((image) => {
      let mimeType = "image/png";
      let data = image;

      if (image.includes("base64,")) {
        const [header, base64Data] = image.split("base64,");
        const mimeMatch = header.match(/data:([^;]+)/);
        if (mimeMatch) mimeType = mimeMatch[1];
        data = base64Data;
      }

      // Genkit expects full data URL in 'url' field for media parts
      promptParts.push({
        media: {
          contentType: mimeType,
          url: `data:${mimeType};base64,${data}`
        }
      });
    });

    // Build configuration
    const config: any = {};
    if (aspectRatio) {
      config.imageConfig = { aspectRatio };
    }
    if (model === "nano-banana-pro" && resolution) {
      if (!config.imageConfig) config.imageConfig = {};
      config.imageConfig.imageSize = resolution;
    }

    // Required for Gemini models to output images
    if (model === "nano-banana" || model === "nano-banana-pro") {
      (config as any).responseModalities = ['IMAGE', 'TEXT'];
    }

    // Handle Google Search tool (passed via config for now as raw tool check might be needed)
    // Note: Genkit tool abstraction is preferred, but for built-in model tools, we pass them in config if supported by plugin
    // or as a known tool.
    // For now, we will omit explicit Google Search tool passing unless we define it as a Genkit tool. 
    // If 'useGoogleSearch' is critical, we might need to check if we can pass raw 'tools' in config.
    // Attempting to pass raw tools array in config for pass-through:
    if (model === "nano-banana-pro" && useGoogleSearch) {
      // This is an attempt to pass raw tools to the underlying provider
      (config as any).tools = [{ googleSearch: {} }];
    }

    console.log(`[API:${requestId}] Calling Genkit generate...`);

    const response = await ai.generate({
      model: MODEL_MAP[model],
      prompt: promptParts,
      config: config,
    });

    console.log(`[API:${requestId}] Genkit response received`);

    // Extract image from response
    // Genkit response.media() should return the first media part
    const media = response.media;

    if (media) {
      // Genkit usually returns media as { url, contentType } or similar.
      // If it's a data URL, we can return it directly.
      // If it's a generated image, it is often a data URL in the output part.

      console.log(`[API:${requestId}] Found media in response`);
      return NextResponse.json<GenerateResponse>({
        success: true,
        image: media.url // Assuming data URL is returned
      });
    }

    // Fallback: Check for text or error
    console.warn(`[API:${requestId}] No media found, checking text`);
    const text = response.text;
    if (text) {
      return NextResponse.json<GenerateResponse>({
        success: false,
        error: `Model returned text instead of image: ${text.substring(0, 200)}`
      }, { status: 500 });
    }

    return NextResponse.json<GenerateResponse>({
      success: false,
      error: "No image or text in response"
    }, { status: 500 });

  } catch (error: any) {
    console.error(`[API:${requestId}] Error:`, error);
    return NextResponse.json<GenerateResponse>({
      success: false,
      error: error.message || "Generation failed"
    }, { status: 500 });
  }
}
