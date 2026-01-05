import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    try {
        const urlObj = new URL(targetUrl);

        // Security Check: Only allow requests to Google APIs
        // This prevents the proxy from being used as an open proxy
        if (!urlObj.hostname.endsWith('googleapis.com')) {
            return NextResponse.json({ error: 'Invalid domain' }, { status: 403 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Append API key securely on the server side
        urlObj.searchParams.append('key', apiKey);

        // Fetch the external resource
        const response = await fetch(urlObj.toString());

        if (!response.ok) {
            return NextResponse.json(
                { error: `Upstream error: ${response.status} ${response.statusText}` },
                { status: response.status }
            );
        }

        // Stream the response back
        // We pass through the Content-Type header so the browser knows it's a video/image
        const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
        const blob = await response.blob();

        return new NextResponse(blob, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600', // Cache for performance
            },
        });

    } catch (error: any) {
        console.error('Proxy error:', error);
        return NextResponse.json({ error: 'Failed to proxy request' }, { status: 500 });
    }
}
