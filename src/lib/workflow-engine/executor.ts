import { Node, Edge } from '@xyflow/react';
import { WorkflowNodeData, NodeType } from '@/types/nodes';
import { topologicalSort, getConnectedInputs } from './validation';
import prisma from '@/lib/db';
import { tasks, runs } from "@trigger.dev/sdk/v3";
import type { llmTask, cropImageTask, extractFrameTask } from "@/trigger";

export type ExecutionScope = 'FULL' | 'PARTIAL' | 'SINGLE';

export interface ExecutionResult {
    nodeId: string;
    status: 'SUCCESS' | 'FAILED';
    output?: unknown;
    error?: string;
    duration: number;
}

export interface WorkflowExecutionResult {
    runId: string;
    status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
    results: ExecutionResult[];
    duration: number;
}

/**
 * WorkflowExecutor class handles the execution of workflow nodes
 * with parallel processing of independent branches
 */
export class WorkflowExecutor {
    private results: Map<string, ExecutionResult> = new Map();

    constructor(
        private nodes: Node<WorkflowNodeData>[],
        private edges: Edge[],
        private workflowId: string,
        private userId: string
    ) { }

    /**
     * Execute the workflow with the specified scope
     */
    async execute(
        scope: ExecutionScope,
        selectedNodeIds?: string[],
        onNodeStart?: (nodeId: string) => void,
        onNodeComplete?: (nodeId: string, result: ExecutionResult) => void
    ): Promise<WorkflowExecutionResult> {
        const startTime = Date.now();

        // Determine which nodes to execute
        let nodesToExecute: Node<WorkflowNodeData>[];

        switch (scope) {
            case 'FULL':
                nodesToExecute = this.nodes;
                break;
            case 'SINGLE':
                nodesToExecute = this.nodes.filter(n => selectedNodeIds?.includes(n.id));
                break;
            case 'PARTIAL':
                nodesToExecute = this.nodes.filter(n => selectedNodeIds?.includes(n.id));
                break;
            default:
                nodesToExecute = this.nodes;
        }

        if (nodesToExecute.length === 0) {
            return {
                runId: '',
                status: 'FAILED',
                results: [],
                duration: 0,
            };
        }

        // Create workflow run record
        const run = await prisma.workflowRun.create({
            data: {
                workflowId: this.workflowId,
                userId: this.userId,
                scope,
                status: 'RUNNING',
            },
        });

        try {
            // Get execution layers (nodes that can run in parallel)
            const executionLayers = topologicalSort(nodesToExecute, this.edges);

            // Execute layer by layer
            for (const layer of executionLayers) {
                // All nodes in a layer can execute concurrently
                const layerPromises = layer.map(async (nodeId) => {
                    const node = this.nodes.find(n => n.id === nodeId);
                    if (!node) return;

                    onNodeStart?.(nodeId);

                    const result = await this.executeNode(node, run.id);
                    this.results.set(nodeId, result);

                    onNodeComplete?.(nodeId, result);

                    return result;
                });

                await Promise.all(layerPromises);

                // Check if any node in the layer failed
                const layerResults = layer.map(id => this.results.get(id));
                const hasFailed = layerResults.some(r => r?.status === 'FAILED');

                // For strict mode, stop execution on failure
                // For now, continue execution
            }

            // Determine final status
            const allResults = Array.from(this.results.values());
            const hasFailures = allResults.some(r => r.status === 'FAILED');
            const allSuccessful = allResults.every(r => r.status === 'SUCCESS');

            const finalStatus = allSuccessful ? 'SUCCESS' : hasFailures ? 'PARTIAL' : 'SUCCESS';
            const duration = Date.now() - startTime;

            // Update run record
            await prisma.workflowRun.update({
                where: { id: run.id },
                data: {
                    status: finalStatus,
                    completedAt: new Date(),
                    duration,
                },
            });

            return {
                runId: run.id,
                status: finalStatus,
                results: allResults,
                duration,
            };
        } catch (error) {
            const duration = Date.now() - startTime;

            await prisma.workflowRun.update({
                where: { id: run.id },
                data: {
                    status: 'FAILED',
                    completedAt: new Date(),
                    duration,
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            });

            throw error;
        }
    }

    /**
     * Execute a single node
     */
    private async executeNode(
        node: Node<WorkflowNodeData>,
        runId: string
    ): Promise<ExecutionResult> {
        const startTime = Date.now();
        const nodeType = node.type as NodeType;

        // Create node result record
        const nodeResult = await prisma.nodeResult.create({
            data: {
                runId,
                nodeId: node.id,
                nodeType,
                status: 'RUNNING',
                startedAt: new Date(),
            },
        });

        try {
            // Build inputs from execution results (prioritize runtime data over static data)
            const inputs: Record<string, unknown> = {};

            console.log(`[Executor] Executing node: ${node.id} (${nodeType})`);

            // Find all incoming edges
            const incomingEdges = this.edges.filter(e => e.target === node.id);

            for (const edge of incomingEdges) {
                if (!edge.targetHandle) continue;

                // First, try to get output from already-executed nodes (runtime results)
                const sourceResult = this.results.get(edge.source);

                if (sourceResult?.output !== undefined) {
                    // Use execution result
                    console.log(`[Executor] Input from executed node ${edge.source} -> ${edge.targetHandle}:`,
                        typeof sourceResult.output === 'string' && sourceResult.output.startsWith('data:')
                            ? `${sourceResult.output.substring(0, 50)}... (base64 data)`
                            : sourceResult.output
                    );

                    if (edge.targetHandle === 'images') {
                        // Handle multiple images
                        const currentImages = (inputs['images'] as string[]) || [];
                        if (typeof sourceResult.output === 'string') {
                            currentImages.push(sourceResult.output);
                        }
                        inputs['images'] = currentImages;
                    } else {
                        inputs[edge.targetHandle] = sourceResult.output;
                    }
                } else {
                    // Fallback to static node data if not executed yet
                    const sourceNode = this.nodes.find(n => n.id === edge.source);
                    if (sourceNode?.data.output !== undefined) {
                        console.log(`[Executor] Input from static data ${edge.source} -> ${edge.targetHandle}:`, sourceNode.data.output);

                        if (edge.targetHandle === 'images') {
                            const currentImages = (inputs['images'] as string[]) || [];
                            if (typeof sourceNode.data.output === 'string') {
                                currentImages.push(sourceNode.data.output);
                            }
                            inputs['images'] = currentImages;
                        } else {
                            inputs[edge.targetHandle] = sourceNode.data.output;
                        }
                    }
                }
            }

            console.log(`[Executor] Final inputs for ${node.id}:`, inputs);

            // Execute based on node type
            let output: unknown;

            switch (nodeType) {
                case 'text':
                    output = await this.executeTextNode(node);
                    break;
                case 'uploadImage':
                    output = await this.executeUploadImageNode(node);
                    break;
                case 'uploadVideo':
                    output = await this.executeUploadVideoNode(node);
                    break;
                case 'llm':
                    output = await this.executeLLMNode(node, inputs, runId);
                    break;
                case 'cropImage':
                    output = await this.executeCropImageNode(node, inputs, runId);
                    break;
                case 'extractFrame':
                    output = await this.executeExtractFrameNode(node, inputs, runId);
                    break;
                default:
                    throw new Error(`Unknown node type: ${nodeType}`);
            }

            const duration = Date.now() - startTime;

            console.log(`[Executor] Node ${node.id} completed in ${duration}ms with output:`,
                typeof output === 'string' && output.startsWith('data:')
                    ? `${output.substring(0, 50)}... (base64 data)`
                    : output
            );

            // Update node result
            await prisma.nodeResult.update({
                where: { id: nodeResult.id },
                data: {
                    status: 'SUCCESS',
                    input: inputs as object,
                    output: output as object,
                    completedAt: new Date(),
                    duration,
                },
            });

            return {
                nodeId: node.id,
                status: 'SUCCESS',
                output,
                duration,
            };
        } catch (error) {
            const duration = Date.now() - startTime;
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

            return {
                nodeId: node.id,
                status: 'FAILED',
                error: errorMessage,
                duration,
            };
        }
    }

    /**
     * Execute text node - just returns the text value
     */
    private async executeTextNode(node: Node<WorkflowNodeData>): Promise<string> {
        const data = node.data as { text?: string };
        return data.text || '';
    }

    /**
     * Execute upload image node - returns the image URL
     */
    private async executeUploadImageNode(node: Node<WorkflowNodeData>): Promise<string> {
        const data = node.data as { imageUrl?: string };
        if (!data.imageUrl) {
            throw new Error('No image uploaded');
        }
        return data.imageUrl;
    }

    /**
     * Execute upload video node - returns the video URL
     */
    private async executeUploadVideoNode(node: Node<WorkflowNodeData>): Promise<string> {
        const data = node.data as { videoUrl?: string };
        if (!data.videoUrl) {
            throw new Error('No video uploaded');
        }
        return data.videoUrl;
    }

    /**
     * Execute LLM node via Trigger.dev task
     */
    private async executeLLMNode(
        node: Node<WorkflowNodeData>,
        inputs: Record<string, unknown>,
        runId: string
    ): Promise<string> {
        const data = node.data as {
            model?: string;
            systemPrompt?: string;
            userMessage?: string;
        };

        const prompt = [
            data.systemPrompt ? `System: ${data.systemPrompt}` : '',
            (inputs['system_prompt'] as string) || '',
            (inputs['user_message'] as string) || data.userMessage || '',
        ].filter(Boolean).join('\n\n');

        const payload = {
            prompt,
            model: data.model || 'gemini-2.0-flash',
            images: (inputs['images'] as string[]) || [],
        };

        if (!prompt) {
            throw new Error('User message is required');
        }

        // Trigger the task and wait for result
        const result = await tasks.triggerAndWait<typeof llmTask>("llm-execution", payload);

        if (!result.ok) {
            throw new Error('LLM execution failed');
        }

        return result.output.text;
    }

    /**
     * Execute crop image node via Trigger.dev task
     */
    private async executeCropImageNode(
        node: Node<WorkflowNodeData>,
        inputs: Record<string, unknown>,
        runId: string
    ): Promise<string> {
        const data = node.data as {
            sourceWidth?: number;
            sourceHeight?: number;
            outputWidth?: number;
            outputHeight?: number;
        };

        const imageUrl = (inputs['image_url'] as string) || '';
        if (!imageUrl) {
            throw new Error('Image URL is required');
        }

        // Compute actual pixel crop coordinates
        const sourceW = data.sourceWidth || 1024;
        const sourceH = data.sourceHeight || 1024;
        const cropW = data.outputWidth || sourceW;
        const cropH = data.outputHeight || sourceH;
        const x = Math.max(0, Math.round((sourceW - cropW) / 2));
        const y = Math.max(0, Math.round((sourceH - cropH) / 2));

        const payload = {
            imageUrl,
            x,
            y,
            width: Math.min(cropW, sourceW),
            height: Math.min(cropH, sourceH),
        };

        const handle = await tasks.trigger<typeof cropImageTask>("crop-image", payload);
        const completed = await runs.poll(handle.id, { pollIntervalMs: 500 });

        if (completed.status !== 'COMPLETED') {
            throw new Error(`Crop image failed with status: ${completed.status}`);
        }

        return (completed.output as any).imageUrl;
    }

    /**
     * Execute extract frame node via Trigger.dev task
     */
    private async executeExtractFrameNode(
        node: Node<WorkflowNodeData>,
        inputs: Record<string, unknown>,
        runId: string
    ): Promise<string> {
        const data = node.data as { timestamp?: string };

        const videoUrl = inputs['video_url'] as string;
        if (!videoUrl) {
            throw new Error('Video URL is required');
        }

        const payload = {
            videoUrl,
            timestamp: parseFloat((inputs['timestamp'] as string) ?? data.timestamp ?? '0'),
        };

        const handle = await tasks.trigger<typeof extractFrameTask>("extract-frame", payload);
        const completed = await runs.poll(handle.id, { pollIntervalMs: 500 });

        if (completed.status !== 'COMPLETED') {
            throw new Error(`Extract frame failed with status: ${completed.status}`);
        }

        return (completed.output as any).frameUrl;
    }
}
