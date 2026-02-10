import { task } from "@trigger.dev/sdk/v3";
import crypto from "crypto";

// ============================================================
// Transloadit Helper Functions
// ============================================================

function getExpiryDate(): string {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    return date.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

function generateSignature(params: Record<string, unknown>, secret: string): string {
    const toSign = JSON.stringify(params);
    return `sha384:${crypto.createHmac('sha384', secret).update(toSign).digest('hex')}`;
}

interface TransloaditResult {
    ok: string;
    assembly_id: string;
    assembly_ssl_url: string;
    results: Record<string, Array<{ ssl_url: string; url: string; name: string }>>;
    error?: string;
    message?: string;
}

async function runTransloaditAssembly(
    steps: Record<string, unknown>
): Promise<TransloaditResult> {
    const authKey = process.env.NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY;
    const authSecret = process.env.TRANSLOADIT_AUTH_SECRET;

    if (!authKey || !authSecret) {
        throw new Error("Transloadit credentials not configured (NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY, TRANSLOADIT_AUTH_SECRET)");
    }

    const params = {
        auth: { key: authKey, expires: getExpiryDate() },
        steps,
    };

    const signature = generateSignature(params, authSecret);

    const formData = new FormData();
    formData.append('params', JSON.stringify(params));
    formData.append('signature', signature);

    const response = await fetch('https://api2.transloadit.com/assemblies', {
        method: 'POST',
        body: formData,
    });

    const assembly = await response.json();
    if (assembly.error) {
        throw new Error(`Transloadit assembly error: ${assembly.error} - ${assembly.message}`);
    }

    // Poll for completion (max 120 seconds)
    let result = assembly;
    const startTime = Date.now();
    while (result.ok !== 'ASSEMBLY_COMPLETED' && Date.now() - startTime < 120000) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const pollResponse = await fetch(result.assembly_ssl_url);
        result = await pollResponse.json();
        if (result.error) {
            throw new Error(`Transloadit processing error: ${result.error} - ${result.message}`);
        }
    }

    if (result.ok !== 'ASSEMBLY_COMPLETED') {
        throw new Error('Transloadit assembly timed out');
    }

    return result;
}

// ============================================================
// LLM Execution Task - Uses Groq or Google Gemini API
// ============================================================
export const llmTask = task({
    id: "llm-execution",
    retry: { maxAttempts: 2 },
    run: async (payload: {
        prompt: string;
        model?: string;
        images?: string[];
    }) => {
        const modelId = payload.model || "groq:meta-llama/llama-4-scout-17b-16e-instruct";

        // Route to Groq or Gemini
        if (modelId.startsWith("groq:")) {
            const Groq = (await import("groq-sdk")).default;
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) throw new Error("GROQ_API_KEY not set");

            const groq = new Groq({ apiKey });
            const completion = await groq.chat.completions.create({
                model: modelId.replace("groq:", ""),
                messages: [{ role: "user", content: payload.prompt }],
                temperature: 0.7,
                max_tokens: 4096,
            });

            return { text: completion.choices[0]?.message?.content || "" };
        } else {
            const { GoogleGenerativeAI } = await import("@google/generative-ai");
            const apiKey = process.env.GOOGLE_AI_API_KEY;
            if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not set");

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: modelId });

            const parts: any[] = [{ text: payload.prompt }];
            if (payload.images?.length) {
                for (const img of payload.images) {
                    const base64Match = img.match(/^data:(.+);base64,(.+)$/);
                    if (base64Match) {
                        parts.push({
                            inlineData: { mimeType: base64Match[1], data: base64Match[2] },
                        });
                    }
                }
            }

            const result = await model.generateContent(parts);
            return { text: result.response.text() };
        }
    },
});

// ============================================================
// Crop Image Task - Uses Transloadit /image/resize robot
// ============================================================
export const cropImageTask = task({
    id: "crop-image",
    retry: { maxAttempts: 2 },
    run: async (payload: {
        imageUrl: string;
        x: number;
        y: number;
        width: number;
        height: number;
    }) => {
        console.log(`[Crop Image] Processing: ${payload.imageUrl.substring(0, 60)}...`);
        console.log(`[Crop Image] Crop params: x=${payload.x}, y=${payload.y}, w=${payload.width}, h=${payload.height}`);

        // If the image is a base64 data URL, we can't use Transloadit's HTTP import
        // Instead, we'll upload it directly
        let steps: Record<string, unknown>;

        if (payload.imageUrl.startsWith('data:')) {
            // For base64 images, upload directly
            steps = {
                ':original': {
                    robot: '/upload/handle',
                },
                cropped: {
                    robot: '/image/resize',
                    use: ':original',
                    crop: {
                        x1: payload.x,
                        y1: payload.y,
                        x2: payload.x + payload.width,
                        y2: payload.y + payload.height,
                    },
                    resize_strategy: 'crop',
                    result: true,
                },
            };

            // For base64, we need to convert to a file and upload
            const authKey = process.env.NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY;
            const authSecret = process.env.TRANSLOADIT_AUTH_SECRET;
            if (!authKey || !authSecret) {
                throw new Error("Transloadit credentials not configured");
            }

            const params = {
                auth: { key: authKey, expires: getExpiryDate() },
                steps,
            };
            const signature = generateSignature(params, authSecret);

            // Convert base64 to Blob
            const base64Data = payload.imageUrl.split(',')[1];
            const mimeType = payload.imageUrl.match(/^data:(.+);base64/)?.[1] || 'image/png';
            const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const blob = new Blob([byteArray], { type: mimeType });

            const formData = new FormData();
            formData.append('params', JSON.stringify(params));
            formData.append('signature', signature);
            formData.append('file', blob, 'image.png');

            const response = await fetch('https://api2.transloadit.com/assemblies', {
                method: 'POST',
                body: formData,
            });
            const assembly = await response.json();
            if (assembly.error) {
                throw new Error(`Transloadit error: ${assembly.error} - ${assembly.message}`);
            }

            // Poll for completion
            let result = assembly;
            const startTime = Date.now();
            while (result.ok !== 'ASSEMBLY_COMPLETED' && Date.now() - startTime < 120000) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const pollResponse = await fetch(result.assembly_ssl_url);
                result = await pollResponse.json();
                if (result.error) throw new Error(`Transloadit error: ${result.error}`);
            }

            const resultUrl = result.results.cropped?.[0]?.ssl_url || result.results[':original']?.[0]?.ssl_url;
            if (!resultUrl) throw new Error('No result from Transloadit crop');

            console.log(`[Crop Image] Success: ${resultUrl.substring(0, 60)}...`);
            return { imageUrl: resultUrl };

        } else {
            // For HTTP URLs, use HTTP import
            steps = {
                imported: {
                    robot: '/http/import',
                    url: payload.imageUrl,
                },
                cropped: {
                    robot: '/image/resize',
                    use: 'imported',
                    crop: {
                        x1: payload.x,
                        y1: payload.y,
                        x2: payload.x + payload.width,
                        y2: payload.y + payload.height,
                    },
                    resize_strategy: 'crop',
                    result: true,
                },
            };

            const result = await runTransloaditAssembly(steps);
            const resultUrl = result.results.cropped?.[0]?.ssl_url;
            if (!resultUrl) throw new Error('No result from Transloadit crop');

            console.log(`[Crop Image] Success: ${resultUrl.substring(0, 60)}...`);
            return { imageUrl: resultUrl };
        }
    },
});

// ============================================================
// Extract Frame Task - Uses Transloadit /video/thumbs robot
// ============================================================
export const extractFrameTask = task({
    id: "extract-frame",
    retry: { maxAttempts: 2 },
    run: async (payload: {
        videoUrl: string;
        timestamp?: number;
        format?: string;
    }) => {
        console.log(`[Extract Frame] Processing: ${payload.videoUrl.substring(0, 60)}...`);
        console.log(`[Extract Frame] Timestamp: ${payload.timestamp || 0}s, Format: ${payload.format || 'png'}`);

        const timestamp = payload.timestamp || 0;

        const steps: Record<string, unknown> = {
            imported: {
                robot: '/http/import',
                url: payload.videoUrl,
            },
            thumbnail: {
                robot: '/video/thumbs',
                use: 'imported',
                offsets: [timestamp],
                width: 1920,
                height: 1080,
                resize_strategy: 'fit',
                format: payload.format || 'png',
                result: true,
            },
        };

        const result = await runTransloaditAssembly(steps);
        const frameUrl = result.results.thumbnail?.[0]?.ssl_url;

        if (!frameUrl) {
            throw new Error('No frame extracted from video');
        }

        console.log(`[Extract Frame] Success: ${frameUrl.substring(0, 60)}...`);
        return { frameUrl };
    },
});
