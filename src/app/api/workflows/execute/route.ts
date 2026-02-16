import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { topologicalSort, getConnectedInputs } from '@/lib/workflow-engine/validation';
import { Node, Edge } from '@xyflow/react';
import { tasks, runs } from '@trigger.dev/sdk/v3';

const executeWorkflowSchema = z.object({
    workflowId: z.string(),
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
    scope: z.enum(['FULL', 'PARTIAL', 'SINGLE']),
    nodeIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const body = await request.json();
        const validation = executeWorkflowSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            );
        }

        const { workflowId, nodes, edges, scope, nodeIds } = validation.data;

        // Determine which nodes to execute
        let nodesToExecute: Node[] = nodes;
        if (scope !== 'FULL' && nodeIds && nodeIds.length > 0) {
            // For SINGLE scope, include all upstream dependencies
            // so processing nodes (crop, extract frame) execute before the target node
            const allNodeIds = new Set<string>(nodeIds);

            if (scope === 'SINGLE') {
                // BFS backwards through edges to find all upstream dependencies
                const queue = [...nodeIds];
                while (queue.length > 0) {
                    const currentId = queue.shift()!;
                    edges.forEach((edge: Edge) => {
                        if (edge.target === currentId && !allNodeIds.has(edge.source)) {
                            allNodeIds.add(edge.source);
                            queue.push(edge.source);
                        }
                    });
                }
            }

            nodesToExecute = nodes.filter((n: Node) => allNodeIds.has(n.id));
        }

        // Create workflow run record
        const run = await prisma.workflowRun.create({
            data: {
                workflowId: workflowId !== 'temp' ? workflowId : undefined as unknown as string,
                userId: user.id,
                scope,
                status: 'RUNNING',
            },
        });

        const startTime = Date.now();
        const results: Array<{
            nodeId: string;
            status: 'SUCCESS' | 'FAILED';
            output?: unknown;
            error?: string;
            duration: number;
        }> = [];

        // Get execution layers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const executionLayers = topologicalSort(nodesToExecute as any, edges);

        // Store outputs for reference
        const nodeOutputs = new Map<string, unknown>();

        // Initialize outputs from existing node data
        nodes.forEach((node: Node) => {
            if (node.data?.output !== undefined) {
                nodeOutputs.set(node.id, node.data.output);
            }
        });

        // Execute layer by layer
        for (const layer of executionLayers) {
            const layerPromises = layer.map(async (nodeId) => {
                const node = nodes.find((n: Node) => n.id === nodeId);
                if (!node) return;

                const nodeStartTime = Date.now();

                // Create node result record
                const nodeResult = await prisma.nodeResult.create({
                    data: {
                        runId: run.id,
                        nodeId: node.id,
                        nodeType: node.type || 'unknown',
                        status: 'RUNNING',
                        startedAt: new Date(),
                    },
                });

                try {
                    // Gather inputs from connected nodes
                    const inputs = getConnectedInputs(node.id, nodes, edges);

                    // Override with actual outputs from executed nodes
                    edges.forEach((edge: Edge) => {
                        if (edge.target === node.id && edge.targetHandle) {
                            const output = nodeOutputs.get(edge.source);
                            if (output !== undefined) {
                                if (edge.targetHandle === 'images') {
                                    const currentImages = (inputs['images'] as string[]) || [];
                                    if (typeof output === 'string') {
                                        currentImages.push(output);
                                    }
                                    inputs['images'] = currentImages;
                                } else {
                                    inputs[edge.targetHandle] = output;
                                }
                            }
                        }
                    });

                    console.log(`[Execute] Node ${node.id} (${node.type}) inputs:`, JSON.stringify(inputs, null, 2));

                    // Execute based on node type
                    let output: unknown;

                    switch (node.type) {
                        case 'text':
                            output = node.data?.text || '';
                            break;

                        case 'uploadImage':
                            output = node.data?.imageUrl || '';
                            if (!output) throw new Error('No image uploaded');
                            if (typeof output === 'string' && output.startsWith('blob:')) {
                                throw new Error('Image upload incomplete: The image was not uploaded to the server. Please re-upload the image before running the workflow.');
                            }
                            break;

                        case 'uploadVideo':
                            output = node.data?.output || node.data?.videoUrl || '';
                            if (!output) throw new Error('No video uploaded');
                            if (typeof output === 'string' && output.startsWith('blob:')) {
                                throw new Error('Video upload incomplete: The video was not uploaded to the server. Please re-upload the video before running the workflow.');
                            }
                            break;

                        case 'llm':
                            // Check if we should skip Trigger.dev
                            if (process.env.SKIP_TRIGGER_DEV === 'true') {
                                output = await executeLLM(node, inputs);
                            } else {
                                output = await executeLLMViaTrigger(node, inputs, run.id);
                            }
                            break;

                        case 'cropImage':
                            if (process.env.SKIP_TRIGGER_DEV === 'true') {
                                output = await executeCropImage(node, inputs);
                            } else {
                                output = await executeCropImageViaTrigger(node, inputs, run.id);
                            }
                            break;

                        case 'extractFrame':
                            if (process.env.SKIP_TRIGGER_DEV === 'true') {
                                output = await executeExtractFrame(node, inputs);
                            } else {
                                output = await executeExtractFrameViaTrigger(node, inputs, run.id);
                            }
                            break;

                        default:
                            output = node.data?.output;
                    }

                    // Store output
                    nodeOutputs.set(node.id, output);

                    const duration = Date.now() - nodeStartTime;

                    // Update node result
                    await prisma.nodeResult.update({
                        where: { id: nodeResult.id },
                        data: {
                            status: 'SUCCESS',
                            input: inputs as object,
                            output: (typeof output === 'object' ? output : { value: output }) as object,
                            completedAt: new Date(),
                            duration,
                        },
                    });

                    results.push({
                        nodeId: node.id,
                        status: 'SUCCESS',
                        output,
                        duration,
                    });
                } catch (error) {
                    const duration = Date.now() - nodeStartTime;
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                    await prisma.nodeResult.update({
                        where: { id: nodeResult.id },
                        data: {
                            status: 'FAILED',
                            error: errorMessage,
                            completedAt: new Date(),
                            duration,
                        },
                    });

                    results.push({
                        nodeId: node.id,
                        status: 'FAILED',
                        error: errorMessage,
                        duration,
                    });
                }
            });

            await Promise.all(layerPromises);
        }

        // Determine final status
        const hasFailures = results.some(r => r.status === 'FAILED');
        const allSuccessful = results.every(r => r.status === 'SUCCESS');
        const finalStatus = allSuccessful ? 'SUCCESS' : hasFailures ? 'PARTIAL' : 'SUCCESS';
        const totalDuration = Date.now() - startTime;

        // Update run record
        await prisma.workflowRun.update({
            where: { id: run.id },
            data: {
                status: finalStatus,
                completedAt: new Date(),
                duration: totalDuration,
            },
        });

        return NextResponse.json({
            runId: run.id,
            status: finalStatus,
            results,
            duration: totalDuration,
        });
    } catch (error) {
        console.error('Failed to execute workflow:', error);
        return NextResponse.json(
            { error: 'Failed to execute workflow' },
            { status: 500 }
        );
    }
}

// ============================================
// TRIGGER.DEV WRAPPER FUNCTIONS
// These use tasks.triggerAndPoll to run via Trigger.dev
// ============================================

async function executeLLMViaTrigger(
    node: Node,
    inputs: Record<string, unknown>,
    runId: string
): Promise<string> {
    const userMessage = (inputs['user_message'] as string) || (node.data as { userMessage?: string })?.userMessage;
    if (!userMessage) {
        throw new Error('User message is required');
    }

    const systemPrompt = (inputs['system_prompt'] as string) || (node.data as { systemPrompt?: string })?.systemPrompt || '';
    const images = (inputs['images'] as string[]) || [];

    // Combine system prompt and user message into a single prompt (matches trigger task schema)
    const prompt = [
        systemPrompt ? `System: ${systemPrompt}` : '',
        userMessage,
    ].filter(Boolean).join('\n\n');

    const payload = {
        prompt,
        model: (node.data as { model?: string })?.model || 'groq:meta-llama/llama-4-scout-17b-16e-instruct',
        images,
    };

    try {
        // Trigger the task (fire it off to Trigger.dev)
        const handle = await tasks.trigger('llm-execution', payload);
        console.log('[Trigger.dev] LLM task triggered, run ID:', handle.id);

        // Poll for result (works from API routes, unlike triggerAndWait)
        const completed = await runs.poll(handle.id, { pollIntervalMs: 500 });

        if (completed.status === 'COMPLETED') {
            return (completed.output as any)?.text || (completed.output as any)?.response || '';
        } else {
            throw new Error(`LLM task failed with status: ${completed.status}`);
        }
    } catch (error) {
        // Fallback to direct execution if Trigger.dev is unavailable
        console.warn('Trigger.dev unavailable, falling back to direct execution:', error);
        return executeLLM(node, inputs);
    }
}

async function executeCropImageViaTrigger(
    node: Node,
    inputs: Record<string, unknown>,
    runId: string
): Promise<string> {
    const imageUrl = inputs['image_url'] as string;
    if (!imageUrl) {
        throw new Error('Image URL is required');
    }

    // Check for blob: URLs - Transloadit cannot access browser-only URLs
    if (imageUrl.startsWith('blob:')) {
        console.warn('[Crop] blob: URL detected, returning original');
        return imageUrl;
    }

    // Compute actual pixel crop coordinates from the node's dimension data
    const data = node.data as {
        sourceWidth?: number;
        sourceHeight?: number;
        outputWidth?: number;
        outputHeight?: number;
        xPercent?: number;
        yPercent?: number;
        widthPercent?: number;
        heightPercent?: number;
    };

    const sourceW = data.sourceWidth || 1024;
    const sourceH = data.sourceHeight || 1024;
    const cropW = data.outputWidth || sourceW;
    const cropH = data.outputHeight || sourceH;

    // Center the crop within the source image
    const x = Math.max(0, Math.round((sourceW - cropW) / 2));
    const y = Math.max(0, Math.round((sourceH - cropH) / 2));

    console.log(`[Crop] Source: ${sourceW}x${sourceH}, Crop: ${cropW}x${cropH}, Offset: (${x}, ${y})`);

    const payload = {
        imageUrl,
        x,
        y,
        width: Math.min(cropW, sourceW),
        height: Math.min(cropH, sourceH),
    };

    try {
        const handle = await tasks.trigger('crop-image', payload);
        console.log('[Trigger.dev] Crop task triggered, run ID:', handle.id);

        const completed = await runs.poll(handle.id, { pollIntervalMs: 500 });

        if (completed.status === 'COMPLETED') {
            return (completed.output as any)?.imageUrl || '';
        } else {
            throw new Error(`Crop image task failed with status: ${completed.status}`);
        }
    } catch (error) {
        console.warn('Trigger.dev unavailable, falling back to direct execution:', error);
        return executeCropImage(node, inputs);
    }
}

async function executeExtractFrameViaTrigger(
    node: Node,
    inputs: Record<string, unknown>,
    runId: string
): Promise<string> {
    const videoUrl = inputs['video_url'] as string;
    if (!videoUrl) {
        throw new Error('Video URL is required');
    }

    // Guard against blob: URLs which cannot be accessed by the server
    if (videoUrl.startsWith('blob:')) {
        throw new Error('Video upload incomplete: The video URL is a local blob. Please re-upload the video before running the workflow.');
    }

    // Parse timestamp
    const timestampStr = (inputs['timestamp'] ?? (node.data as { timestamp?: string })?.timestamp ?? '0') as string;
    let timestampSeconds = 0;

    if (timestampStr.includes(':')) {
        const parts = timestampStr.split(':').map(Number);
        if (parts.length === 3) {
            timestampSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            timestampSeconds = parts[0] * 60 + parts[1];
        }
    } else {
        timestampSeconds = parseFloat(timestampStr) || 0;
    }

    const payload = {
        videoUrl,
        timestamp: timestampSeconds,
    };

    try {
        const handle = await tasks.trigger('extract-frame', payload);
        console.log('[Trigger.dev] Extract frame task triggered, run ID:', handle.id);

        const completed = await runs.poll(handle.id, { pollIntervalMs: 500 });

        if (completed.status === 'COMPLETED') {
            return (completed.output as any)?.frameUrl || '';
        } else {
            throw new Error(`Extract frame task failed with status: ${completed.status}`);
        }
    } catch (error) {
        console.warn('Trigger.dev unavailable, falling back to direct execution:', error);
        return executeExtractFrame(node, inputs);
    }
}

// ============================================
// FALLBACK DIRECT EXECUTION FUNCTIONS
// Used when Trigger.dev is unavailable
// ============================================

// LLM execution - supports both Gemini and Groq models
async function executeLLM(node: Node, inputs: Record<string, unknown>): Promise<string> {
    console.log('[executeLLM] Starting direct LLM execution');

    const modelId = (node.data as { model?: string })?.model || 'groq:meta-llama/llama-4-scout-17b-16e-instruct';
    console.log('[executeLLM] Using model:', modelId);

    const systemPrompt = (inputs['system_prompt'] as string) || (node.data as { systemPrompt?: string })?.systemPrompt || '';
    const userMessage = (inputs['user_message'] as string) || (node.data as { userMessage?: string })?.userMessage;
    if (!userMessage) {
        throw new Error('User message is required');
    }

    const images = (inputs['images'] as string[]) || [];
    console.log('[executeLLM] Images count:', images.length);

    // Route to Groq or Gemini based on model ID prefix
    if (modelId.startsWith('groq:')) {
        return executeLLMViaGroq(modelId.replace('groq:', ''), systemPrompt, userMessage, images);
    } else {
        return executeLLMViaGemini(modelId, systemPrompt, userMessage, images);
    }
}

// Groq LLM execution
async function executeLLMViaGroq(
    modelId: string,
    systemPrompt: string,
    userMessage: string,
    images: string[]
): Promise<string> {
    const Groq = (await import('groq-sdk')).default;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('Groq API key not configured (GROQ_API_KEY)');
    }

    const groq = new Groq({ apiKey });

    const messages: Array<{ role: 'system' | 'user'; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    // Build user message with optional images
    if (images.length > 0) {
        const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
            { type: 'text', text: userMessage },
        ];

        for (const imageUrl of images) {
            if (imageUrl.startsWith('blob:')) continue;

            try {
                let base64Url = imageUrl;
                // If it's a URL, fetch and convert to base64
                if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                    const response = await fetch(imageUrl);
                    if (!response.ok) continue;
                    const buffer = await response.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString('base64');
                    const mimeType = response.headers.get('content-type') || 'image/jpeg';
                    base64Url = `data:${mimeType};base64,${base64}`;
                }
                contentParts.push({ type: 'image_url', image_url: { url: base64Url } });
            } catch (error) {
                console.warn('[executeLLM] Failed to process image for Groq:', error);
            }
        }

        messages.push({ role: 'user', content: contentParts });
    } else {
        messages.push({ role: 'user', content: userMessage });
    }

    console.log('[executeLLM] Calling Groq API with model:', modelId);
    const startTime = Date.now();

    const completion = await groq.chat.completions.create({
        model: modelId,
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 4096,
    });

    const text = completion.choices[0]?.message?.content || '';
    console.log('[executeLLM] Groq responded in', Date.now() - startTime, 'ms');
    console.log('[executeLLM] Response length:', text.length, 'chars');

    return text;
}

// Gemini LLM execution
async function executeLLMViaGemini(
    modelId: string,
    systemPrompt: string,
    userMessage: string,
    images: string[]
): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
        throw new Error('Google AI API key not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: systemPrompt || undefined,
    });

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [{ text: userMessage }];

    for (const imageUrl of images) {
        if (imageUrl.startsWith('blob:')) continue;

        try {
            const response = await fetch(imageUrl);
            if (!response.ok) continue;
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const mimeType = response.headers.get('content-type') || 'image/jpeg';
            parts.push({ inlineData: { data: base64, mimeType } });
        } catch (error) {
            console.warn('[executeLLM] Failed to fetch image:', error);
        }
    }

    console.log('[executeLLM] Calling Gemini API with', parts.length, 'parts');
    const startTime = Date.now();

    const result = await model.generateContent(parts);
    const text = result.response.text();

    console.log('[executeLLM] Gemini responded in', Date.now() - startTime, 'ms');
    console.log('[executeLLM] Response length:', text.length, 'chars');

    return text;
}

// Crop image execution using Transloadit
async function executeCropImage(node: Node, inputs: Record<string, unknown>): Promise<string> {
    console.log('[executeCropImage] Starting crop execution');
    console.log('[executeCropImage] Inputs:', JSON.stringify(inputs, null, 2));

    const imageUrl = inputs['image_url'] as string;
    if (!imageUrl) {
        throw new Error('Image URL is required');
    }

    // Check for blob: URLs - they can't be processed by Transloadit
    if (imageUrl.startsWith('blob:')) {
        console.warn('[executeCropImage] blob: URL detected - Transloadit cannot access browser-only URLs');
        console.warn('[executeCropImage] Returning original URL as fallback (no crop applied)');
        // Return the original URL as-is since we can't crop blob: URLs server-side
        // The crop would need to happen in the browser for blob: URLs
        return imageUrl;
    }

    // Get crop parameters
    const xPercent = inputs['x_percent'] ?? (node.data as { xPercent?: number })?.xPercent ?? 0;
    const yPercent = inputs['y_percent'] ?? (node.data as { yPercent?: number })?.yPercent ?? 0;
    const widthPercent = inputs['width_percent'] ?? (node.data as { widthPercent?: number })?.widthPercent ?? 100;
    const heightPercent = inputs['height_percent'] ?? (node.data as { heightPercent?: number })?.heightPercent ?? 100;

    console.log('[executeCropImage] Crop params:', { xPercent, yPercent, widthPercent, heightPercent });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    console.log('[executeCropImage] Calling /api/process at', baseUrl);

    const response = await fetch(`${baseUrl}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'crop',
            fileUrl: imageUrl,
            x: Number(xPercent),
            y: Number(yPercent),
            width: Number(widthPercent) || 100,
            height: Number(heightPercent) || 100,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('[executeCropImage] Crop failed:', error);
        throw new Error(`Crop failed: ${error.error || response.statusText}`);
    }

    const result = await response.json();
    console.log('[executeCropImage] Crop successful, result URL:', result.resultUrl?.substring(0, 80));
    return result.resultUrl;
}

// Extract frame execution using Transloadit
async function executeExtractFrame(node: Node, inputs: Record<string, unknown>): Promise<string> {
    const videoUrl = inputs['video_url'] as string;
    if (!videoUrl) {
        throw new Error('Video URL is required');
    }

    // Parse timestamp
    const timestampStr = (inputs['timestamp'] ?? (node.data as { timestamp?: string })?.timestamp ?? '0') as string;
    let timestampSeconds = 0;

    if (timestampStr.includes('%')) {
        // Percentage - default to 0 for now (would need video duration)
        timestampSeconds = 0;
    } else if (timestampStr.includes(':')) {
        const parts = timestampStr.split(':').map(Number);
        if (parts.length === 3) {
            timestampSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            timestampSeconds = parts[0] * 60 + parts[1];
        }
    } else {
        timestampSeconds = parseFloat(timestampStr) || 0;
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'frame',
            fileUrl: videoUrl,
            timestamp: timestampSeconds,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Frame extraction failed: ${error.error || response.statusText}`);
    }

    const result = await response.json();
    return result.resultUrl;
}

