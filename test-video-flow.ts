
import fs from 'fs';
import path from 'path';

// Manual .env parser
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                process.env[match[1]] = match[2].replace(/^"(.*)"$/, '$1');
            }
        });
    } catch (e) {
        console.warn('Could not load .env.local');
    }
}

loadEnv();

const BASE_URL = 'http://localhost:3000';

async function testVideoFlow() {
    console.log('🚀 Starting Video Flow Test...');

    // 1. Generate Request
    console.log('Testing /api/generate with Veo...');
    const genResponse = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'googleai/veo-2.0-generate-001', // Use specific Veo model
            prompt: 'A cyberpunk hamster generating a video test',
            aspectRatio: '16:9'
        })
    });

    if (!genResponse.ok) {
        console.error('❌ Generate failed:', await genResponse.text());
        return;
    }

    const genResult: any = await genResponse.json();
    console.log('Generate Response:', genResult);

    if (!genResult.operationId) {
        console.error('❌ Expected operationId in response but got:', genResult);
        // If it finished immediately (unlikely for Veo), check output
        if (genResult.output || genResult.image) {
            console.log('⚠️ Warning: Video generated immediately?');
        }
        return;
    }

    const opId = genResult.operationId;
    console.log(`✅ Operation started: ${opId}`);

    // 2. Poll Operation
    console.log('Polling operation status...');
    let done = false;
    let attempts = 0;

    while (!done && attempts < 60) {
        await new Promise(r => setTimeout(r, 5000));
        process.stdout.write('.');

        const opResponse = await fetch(`${BASE_URL}/api/operations?id=${encodeURIComponent(opId)}`);
        if (!opResponse.ok) {
            console.error('\n❌ Poll failed:', await opResponse.text());
            return;
        }

        const opResult: any = await opResponse.json();
        if (opResult.done) {
            console.log('\n✅ Operation Complete!');
            done = true;

            if (opResult.error) {
                console.log('❌ Operation Error:', opResult.error);
            } else {
                let url: string | undefined;
                const medias = opResult.medias;
                const media = opResult.media;

                if (medias && medias.length > 0) {
                    console.log(`✅ Received ${medias.length} video(s):`);
                    medias.forEach((m: any, i: number) => {
                        console.log(`   [${i + 1}] ${m.url}`);
                    });
                    // Use first one for save test
                    url = medias[0].url;
                } else if (media && media.url) {
                    console.log('🎥 Video URL:', media.url);
                    url = media.url;
                }

                if (url) {
                    // 3. Test Save Generation logic manually (simulate what store does)
                    console.log('Testing /api/save-generation with url...');

                    // Define a generations path (simulate store default)
                    // Use a relative path for testing, or read from env if we had it
                    const testSavePath = path.resolve(process.cwd(), 'generations');
                    // Ensure dir exists
                    if (!fs.existsSync(testSavePath)) {
                        fs.mkdirSync(testSavePath, { recursive: true });
                    }

                    const saveRes = await fetch(`${BASE_URL}/api/save-generation`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            directoryPath: testSavePath,
                            url: url, // Passing as URL
                            prompt: 'Test video save flow'
                        })
                    });

                    if (saveRes.ok) {
                        const saveData = await saveRes.json();
                        console.log('✅ Save API Success:', saveData);
                        console.log(`✅ File saved to: ${saveData.filePath}`);
                    } else {
                        console.error('❌ Save API Failed:', await saveRes.text());
                    }
                } else {
                    console.error('❌ No media URL in completed operation');
                }
            }
        }
        attempts++;
    }

    if (!done) {
        console.error('\n❌ Timed out polling');
    }
}

testVideoFlow().catch(console.error);
