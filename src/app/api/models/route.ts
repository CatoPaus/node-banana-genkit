import { NextResponse } from "next/server";
import { ai } from "@/lib/genkit";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Access the registry directly if available
        // @ts-ignore
        const registry = ai.registry;

        if (!registry) {
            return NextResponse.json({ success: false, error: "Genkit registry not accessible" }, { status: 500 });
        }

        // List all actions
        const rawActions = await registry.listActions();

        // Genkit registry.listActions() might return an object map or Map or array
        let actionsList: any[] = [];
        if (Array.isArray(rawActions)) {
            actionsList = rawActions;
        } else if (rawActions instanceof Map) {
            actionsList = Array.from(rawActions.values());
        } else {
            actionsList = Object.values(rawActions);
        }

        // console.log(`[API:Models] Found ${actionsList.length} actions.`);

        // Filter for models
        const models = actionsList
            .filter((action: any) => {
                const metadata = action.__action || action;
                const type = metadata.actionType || (metadata.key && metadata.key.startsWith('model/') ? 'model' : null);
                // Allow both standard models and background models (often used for long-running tasks like Video)
                return type === 'model' || type === 'background-model';
                // return type === 'background-model'; // VEO models are background models!

            })
            .map((action: any) => {
                const metadata = action.__action || action;
                const rawName = metadata.name || metadata.key || "";
                const id = rawName;
                const label = rawName.split('/').pop() || rawName;
                const provider = rawName.split('/')[0];

                // FIX: GoogleAI plugin might auto-discover Imagen models (e.g. via Gemini API) 
                // but these often lack full features (like Seed) or map to the wrong endpoint.
                // We typically want to use the VertexAI implementation for Imagen.
                // So, if we see an 'imagen' model coming from 'googleai' provider, skip it.
                if (provider === 'googleai' && rawName.includes('imagen')) {
                    return null;
                }

                // FIX: "gemini-3-pro-image-preview" seems to only be available via GoogleAI (API Key) currently.
                // The VertexAI endpoint returns 404. So we filter out the Vertex version to force usage of the GoogleAI one.
                if (provider === 'vertexai' && rawName.includes('gemini-3')) {
                    return null;
                }

                // Extract capabilities from metadata.metadata.model (Genkit/GoogleAI standard)
                const modelInfo = (metadata.metadata && metadata.metadata.model) || {};
                const customOptions = modelInfo.customOptions || {};
                const supportsFlags = modelInfo.supports || {};

                // Parse custom options definitions into a frontend-friendly format
                const options: any[] = [];
                if (customOptions.properties) {
                    Object.entries(customOptions.properties).forEach(([key, schema]: [string, any]) => {
                        // Skip sensitive or internal fields could be added here
                        // For now, apiKey is the only one we definitely want to skip if present
                        if (key === 'apiKey') return;

                        const option: any = {
                            key,
                            label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), // CamelCase to Title Case
                            description: schema.description,
                            type: schema.type,
                        };

                        if (schema.enum) {
                            option.type = 'enum';
                            option.values = schema.enum;
                        } else if (schema.type === 'boolean') {
                            option.type = 'boolean';
                        } else if (schema.type === 'number' || schema.type === 'integer') {
                            option.type = 'number';
                            if (schema.minimum !== undefined) option.min = schema.minimum;
                            if (schema.maximum !== undefined) option.max = schema.maximum;
                        }

                        options.push(option);
                    });
                }


                // Heuristics (fallback if metadata is missing/incomplete for other providers)
                const description = (metadata.description || "").toLowerCase();
                const isGemini = id.includes('gemini') || id.includes('nano-banana');
                const isGeminiImage = isGemini && (id.includes('image') || description.includes('image'));
                const isImagen = id.includes('imagen');
                const isDallE = id.includes('dall-e');
                const isUpscaler = id.includes('upscale');

                if (isImagen) {
                    if (isUpscaler) {
                        // Inject upscaleFactor for upscaler models (natively it's nested in upscaleConfig)
                        if (!options.find(o => o.key === 'upscaleFactor')) {
                            options.push({
                                key: 'upscaleFactor',
                                label: 'Upscale Factor',
                                type: 'enum',
                                values: ['x2', 'x4']
                            });
                        }
                    }
                }

                // Inject Aspect Ratio if missing for ANY identified image generator (excluding Upscalers)
                const isImageGenerator = isImagen || isGeminiImage || isDallE;
                if (isImageGenerator && !isUpscaler && !options.find(o => o.key === 'aspectRatio')) {
                    options.push({
                        key: 'aspectRatio',
                        label: 'Aspect Ratio',
                        type: 'enum',
                        values: ["1:1", "9:16", "16:9", "3:4", "4:3"],
                        description: "The aspect ratio of the generated image."
                    });
                }

                const capabilities = {
                    // Use flag if present, otherwise fallback to heuristics. 
                    supportsImageInput: (isImagen && isUpscaler) || (!isImagen && (supportsFlags.media !== undefined ? supportsFlags.media : isGemini)),
                    supportsVideo: id.includes('veo'), // Heuristic for Video/VEO models
                    supportsAudio: id.includes('speech') || id.includes('tts'),

                    // Legacy flags mapping (optional, but good for backward compat if needed)
                    supportsAspectRatio: !!options.find(o => o.key === 'aspectRatio'),
                    supportsResolution: !!options.find(o => o.key === 'resolution'),

                    supportsCodeExecution: supportsFlags.codeExecution || false,
                    supportsTools: supportsFlags.tools || false,
                    supportsMultimodal: supportsFlags.multimodal || supportsFlags.media || false,
                    supportsGoogleSearch: supportsFlags.googleSearchRetrieval || (isGemini && !isGeminiImage),

                    // The dynamic options
                    options,

                    // Raw metadata for info display
                    raw: supportsFlags
                };

                return {
                    id,
                    label,
                    provider,
                    description: metadata.description || "",
                    capabilities
                };
            })
            .filter((m: any) => m !== null); // Remove filtered models

        return NextResponse.json({ success: true, models });
    } catch (error) {
        console.error("Error fetching models:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch models" }, { status: 500 });
    }
}

