
import { ai } from '../lib/genkit';

async function main() {
    try {
        // @ts-ignore
        const registry = ai.registry;
        const actions = await registry.listActions();

        let actionsList = [];
        if (Array.isArray(actions)) {
            actionsList = actions;
        } else if (actions instanceof Map) {
            actionsList = Array.from(actions.values());
        } else {
            actionsList = Object.values(actions);
        }

        const models = actionsList
            .filter((a: any) => {
                const metadata = a.__action || a;
                const key = metadata.name || metadata.key || '';
                return key.includes('gemini-3-pro-image-preview');
            })
            .map((a: any) => {
                const metadata = a.__action || a;
                return {
                    key: metadata.name || metadata.key,
                    provider: metadata.key ? metadata.key.split('/')[0] : 'unknown',
                    metadata: metadata.metadata
                };
            });

        console.log(JSON.stringify(models, null, 2));

    } catch (error) {
        console.error(error);
    }
}

main();
