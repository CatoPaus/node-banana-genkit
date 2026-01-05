import { NextResponse } from "next/server";
import { ai } from "@/lib/genkit";

// Types for request body
interface GenerateRequest {
  model: string;
  prompt: string;
  images?: string[];
  // Allow any other config keys
  [key: string]: any;
}

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).substring(7);
  // console.log(`[API:${requestId}] ========== NEW GENERATE REQUEST (GENKIT) ==========`);

  try {
    const body: GenerateRequest = await req.json();
    const { model: modelId, prompt, images, ...rest } = body;

    // Validate inputs
    // Prompt is required UNLESS mode is 'upscale'
    const isUpscale = rest.mode === 'upscale';
    if (!prompt && !isUpscale) {
      // console.log(`[API:${requestId}] Validation failed: No prompt provided`);
      return NextResponse.json({ success: false, error: "Prompt is required" }, { status: 400 });
    }

    if (!modelId) {
      // console.log(`[API:${requestId}] Validation failed: No model provided`);
      return NextResponse.json({ success: false, error: "Model is required" }, { status: 400 });
    }

    // console.log(`[API:${requestId}] Processing request for model: ${modelId}`);

    // Construct prompt parts
    const promptParts: any[] = [{ text: prompt }];
    if (images && images.length > 0) {
      images.forEach(img => {
        promptParts.push({ media: { url: img } });
      });
    }

    // Config for the model (includes dynamic options like aspectRatio, personGeneration)
    // We pass 'rest' which contains all dynamic keys from the frontend
    const config = {
      ...rest
    };

    // console.log(`[API:${requestId}] Calling Genkit generate with model: ${modelId}`);
    // console.log(`[API:${requestId}] Config payload:`, JSON.stringify(config));

    try {
      const response = await ai.generate({
        model: modelId,
        prompt: promptParts,
        config: config,
      });

      // Check for long-running operation (Veo)
      // The Genkit response might contain the operation ID in the 'result' or custom fields if it's not finished
      // However, for Veo, Genkit currently returns an object with `id` field if it's an operation
      const rawResponse = response as any;
      const opId = rawResponse.id || (rawResponse.operation && rawResponse.operation.id);

      if (opId && opId.includes('operations/')) {
        return NextResponse.json({
          success: true,
          operationId: opId,
          message: "Operation started"
        });
      }

      const text = response.text;
      const media = response.media; // Returns a single media object or null

      // Check if media exists (it's not an array in Genkit's simplified response view)
      if (media) {
        // console.log(`[API:${requestId}] Generated media found`);
        const imageUrl = media.url;
        return NextResponse.json({
          success: true,
          output: imageUrl, // For image models
          result: text
        });
      }



      // console.log(`[API:${requestId}] Generated text length: ${text?.length}`);
      return NextResponse.json({ success: true, output: text, result: text });

    } catch (genError: any) {
      console.error(`[API:${requestId}] Error from ai.generate:`, genError);
      return NextResponse.json({
        success: false,
        error: genError.message || "Model generation failed",
        details: genError.toString()
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error(`[API:${requestId}] Unhandled error:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
