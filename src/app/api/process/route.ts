import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const TRANSLOADIT_AUTH_KEY = process.env.NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY!;
const TRANSLOADIT_AUTH_SECRET = process.env.TRANSLOADIT_AUTH_SECRET!;

interface TransloaditParams {
    auth: {
        key: string;
        expires: string;
    };
    steps: Record<string, unknown>;
}

interface TransloaditResult {
    ok: string;
    assembly_id: string;
    assembly_ssl_url: string;
    results: Record<string, Array<{
        ssl_url: string;
        url: string;
        name: string;
    }>>;
    error?: string;
    message?: string;
}

function generateSignature(params: TransloaditParams): string {
    const toSign = JSON.stringify(params);
    const signature = crypto
        .createHmac('sha384', TRANSLOADIT_AUTH_SECRET)
        .update(toSign)
        .digest('hex');
    return `sha384:${signature}`;
}

function getExpiryDate(): string {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    return date.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

async function pollForCompletion(assemblyUrl: string, maxWait = 120000): Promise<TransloaditResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
        const response = await fetch(assemblyUrl);
        const result = await response.json();

        if (result.ok === 'ASSEMBLY_COMPLETED') {
            return result;
        }

        if (result.error) {
            throw new Error(`Transloadit error: ${result.error} - ${result.message}`);
        }

        // Wait 1 second before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Assembly timeout');
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, fileUrl, ...options } = body;

        if (!fileUrl) {
            return NextResponse.json(
                { error: 'fileUrl is required' },
                { status: 400 }
            );
        }

        let steps: Record<string, unknown>;

        if (type === 'crop') {
            // Crop image using /image/resize robot
            const { x, y, width, height } = options;

            steps = {
                imported: {
                    robot: '/http/import',
                    url: fileUrl,
                },
                cropped: {
                    robot: '/image/resize',
                    use: 'imported',
                    crop: {
                        x1: x || 0,
                        y1: y || 0,
                        x2: (x || 0) + (width || 100),
                        y2: (y || 0) + (height || 100),
                    },
                    resize_strategy: 'crop',
                    result: true,
                },
            };
        } else if (type === 'frame') {
            // Extract frame using /video/thumbs robot
            const { timestamp = 0, timestampPercent } = options;

            // Build thumbnail step config
            const thumbnailStep: Record<string, unknown> = {
                robot: '/video/thumbs',
                use: 'imported',
                ffmpeg_stack: 'v6.0.0',
                format: 'png',
                result: true,
            };

            // Determine the target frame index when using count-based approach
            let targetFrameIndex = 0;

            if (typeof timestampPercent === 'number' && timestampPercent >= 0) {
                // Percentage-based extraction — generate evenly-spaced frames and pick the closest one
                // count=21 gives frames at 0%, 5%, 10%, ..., 100%
                const count = 21;
                thumbnailStep.count = count;
                targetFrameIndex = Math.min(Math.round(timestampPercent / 5), count - 1);
                console.log(`[Process/Frame] Percentage mode: ${timestampPercent}% → count=${count}, targetIndex=${targetFrameIndex}`);
            } else if (timestamp > 0) {
                thumbnailStep.offsets = [timestamp];
            } else {
                thumbnailStep.count = 1;
            }

            steps = {
                imported: {
                    robot: '/http/import',
                    url: fileUrl,
                },
                thumbnail: thumbnailStep,
            };

            // Store targetFrameIndex for result extraction below
            (steps as any)._targetFrameIndex = targetFrameIndex;
            (steps as any)._isPercentageMode = typeof timestampPercent === 'number';
        } else {
            return NextResponse.json(
                { error: 'Invalid type. Use "crop" or "frame"' },
                { status: 400 }
            );
        }

        // Extract internal metadata before sending to Transloadit
        const targetFrameIndex = (steps as any)._targetFrameIndex ?? 0;
        const isPercentageMode = (steps as any)._isPercentageMode ?? false;
        delete (steps as any)._targetFrameIndex;
        delete (steps as any)._isPercentageMode;

        const params: TransloaditParams = {
            auth: {
                key: TRANSLOADIT_AUTH_KEY,
                expires: getExpiryDate(),
            },
            steps,
        };

        const signature = generateSignature(params);

        // Create assembly (no file upload, using HTTP import)
        const formData = new FormData();
        formData.append('params', JSON.stringify(params));
        formData.append('signature', signature);

        const response = await fetch('https://api2.transloadit.com/assemblies', {
            method: 'POST',
            body: formData,
        });

        const assembly = await response.json();

        if (assembly.error) {
            return NextResponse.json(
                { error: assembly.message || 'Assembly creation failed' },
                { status: 500 }
            );
        }

        // Poll for completion
        const result = await pollForCompletion(assembly.assembly_ssl_url);

        // Get the result URL
        let resultUrl: string | null = null;

        if (type === 'crop' && result.results.cropped) {
            resultUrl = result.results.cropped[0]?.ssl_url;
        } else if (type === 'frame' && result.results.thumbnail) {
            const thumbnails = result.results.thumbnail;
            if (isPercentageMode && thumbnails.length > 1) {
                // Pick the frame at the target percentage index
                const idx = Math.min(targetFrameIndex, thumbnails.length - 1);
                resultUrl = thumbnails[idx]?.ssl_url;
                console.log(`[Process/Frame] Percentage: picked frame ${idx}/${thumbnails.length} → ${resultUrl?.substring(0, 60)}`);
            } else {
                resultUrl = thumbnails[0]?.ssl_url;
            }
        }

        if (!resultUrl) {
            return NextResponse.json(
                { error: 'No result from processing' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            resultUrl,
            assemblyId: result.assembly_id,
        });

    } catch (error) {
        console.error('Process error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Processing failed' },
            { status: 500 }
        );
    }
}
