import { genkit } from 'genkit';
import { googleAI, vertexAI } from '@genkit-ai/google-genai';
import { openAI } from '@genkit-ai/compat-oai/openai';

export const ai = genkit({
    plugins: [
        googleAI({
            apiKey: process.env.GEMINI_API_KEY,
        }),
        vertexAI({ projectId: 'gen-lang-client-0467064701', location: 'us-central1', apiKey: process.env.GEMINI_API_KEY }),
        openAI({
            apiKey: process.env.OPENAI_API_KEY,
        }),
    ],
});
