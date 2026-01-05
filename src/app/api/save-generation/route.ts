import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

// POST: Save a generated image to the generations folder
export async function POST(request: NextRequest) {
  try {
    const { directoryPath, image, prompt, url } = await request.json();

    if (!directoryPath || (!image && !url)) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate directory exists
    try {
      const stats = await fs.stat(directoryPath);
      if (!stats.isDirectory()) {
        return NextResponse.json(
          { success: false, error: "Path is not a directory" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Directory does not exist" },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const promptSnippet = prompt
      ? prompt
        .slice(0, 30)
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .toLowerCase()
      : "generation";

    let filename = `${timestamp}_${promptSnippet}`;
    let buffer: Buffer;

    let finalUrl = url;
    // Heuristic: If 'image' is provided but looks like a URL, treat it as a URL
    if (image && (typeof image === 'string') && (image.startsWith('http') || image.startsWith('/'))) {
      finalUrl = image;
    }

    if (image && !finalUrl) {
      filename += ".png";
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      buffer = Buffer.from(base64Data, "base64");
    } else if (finalUrl) {
      // Resolve relative URLs to localhost
      let fetchUrl = finalUrl;
      if (fetchUrl.startsWith("/")) {
        const port = process.env.PORT || 3000;
        const host = process.env.HOSTNAME || 'localhost';
        fetchUrl = `http://${host}:${port}${fetchUrl}`;
      }

      // Determine extension from URL (e.g. proxy extension hack)
      if (fetchUrl.includes('.mp4')) {
        filename += ".mp4";
      } else {
        // Default fallbacks? Or check headers?
        // For now, if no extension, default to png unless we verify otherwise
        // But since we added &ext=.mp4 to video proxy, this should work.
        // If not, we might be saving an image from a URL.
        filename += ".png";
      }

      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`Failed to fetch content from ${fetchUrl}: ${res.statusText}`);

      // Enhance: Check Content-Type if extension was ambiguous
      const contentType = res.headers.get("Content-Type");
      if (contentType?.includes("video") && !filename.endsWith(".mp4")) {
        filename = filename.replace(/\.png$/, ".mp4");
      }

      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      throw new Error("No content to save");
    }

    const filePath = path.join(directoryPath, filename);

    // Write the file
    await fs.writeFile(filePath, buffer);
    console.log(`[Server] Saved generation to: ${filePath}`);

    return NextResponse.json({
      success: true,
      filePath,
      filename,
    });
  } catch (error) {
    console.error("Failed to save generation:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Save failed",
      },
      { status: 500 }
    );
  }
}
