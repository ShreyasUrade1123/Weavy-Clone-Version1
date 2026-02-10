'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useUIStore } from '@/stores/ui-store';
import { Info, Sparkles, ChevronDown, Share2, ArrowRight } from 'lucide-react';
import { LLMNodeData } from '@/types/nodes';

const MODELS = [
    // Groq models (free tier, currently active)
    { id: 'groq:meta-llama/llama-4-scout-17b-16e-instruct', name: '⚡👁 Llama 4 Scout 17B (Groq)' },
    { id: 'groq:meta-llama/llama-4-maverick-17b-128e-instruct', name: '⚡ Llama 4 Maverick 17B (Groq)' },
    { id: 'groq:llama-3.1-8b-instant', name: '⚡ Llama 3.1 8B Instant (Groq)' },
    { id: 'groq:qwen/qwen3-32b', name: '⚡ Qwen 3 32B (Groq)' },
    // Gemini models (free tier)
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
];

export default function PropertiesSidebar() {
    const params = useParams();
    const workflowId = (params?.id as string[] | undefined)?.[0];
    const selectedNodeIds = useWorkflowStore((state) => state.selectedNodeIds);
    const nodes = useWorkflowStore((state) => state.nodes);
    const edges = useWorkflowStore((state) => state.edges);
    const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
    const setNodeStatus = useWorkflowStore((state) => state.setNodeStatus);
    const { toggleHistory, isHistoryOpen } = useUIStore();

    // Internal state for run configuration
    const [runCount, setRunCount] = React.useState(1);

    const selectedNode = nodes.find(n => n.id === selectedNodeIds[0]);

    if (!selectedNode || selectedNodeIds.length !== 1) {
        return null; // Only show when exactly one node is selected
    }

    // Only supporting LLM node properties for now as per request
    if (selectedNode.type !== 'llm') {
        return null;
    }

    const data = selectedNode.data as LLMNodeData;

    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateNodeData(selectedNode.id, { model: e.target.value });
    };

    const handleThinkingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(selectedNode.id, { thinking: e.target.checked });
    };

    const handleTemperatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(selectedNode.id, { temperature: parseFloat(e.target.value) });
    };

    const handleOpenShare = () => {
        window.dispatchEvent(new Event('openShareModal'));
    };

    const handleRunSelected = async () => {
        // Run logic duplicated from page.tsx (simplified for single/selected node run)
        const node = selectedNode;
        setNodeStatus(node.id, 'running');

        try {
            // We run this 'runCount' times? For now just once as per standard execution
            // If user wants loop, we'd loop here.
            // Let's loop if runCount > 1
            for (let i = 0; i < runCount; i++) {
                const response = await fetch('/api/workflows/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workflowId: workflowId || 'temp',
                        nodes,
                        edges,
                        scope: 'PARTIAL',
                        nodeIds: [node.id],
                    }),
                });

                if (!response.ok) throw new Error('Execution failed');

                const result = await response.json();

                // Update specific node result
                if (result.results) {
                    const nodeResult = result.results.find((r: any) => r.nodeId === node.id);
                    if (nodeResult) {
                        const status = nodeResult.status === 'SUCCESS' ? 'success' : 'error';
                        setNodeStatus(node.id, status, nodeResult.output, nodeResult.error);
                        if (nodeResult.output !== undefined) {
                            updateNodeData(node.id, { response: nodeResult.output as string });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Run failed:', error);
            setNodeStatus(node.id, 'error', undefined, 'Execution failed');
        }
    };

    return (
        <div className="fixed top-0 right-0 h-full w-[240px] bg-[#212126] border-l border-[#27272A] flex flex-col z-30 font-[family-name:var(--font-dm-sans)]">
            {/* Header Overlay Replica */}
            <div className="p-4 flex flex-col gap-2 border-b border-[#27272A]/50 pb-6">
                {/* Row 1: Credits, Share */}
                <div className="flex items-center justify-between gap-2">
                    {/* Credits Badge */}
                    <div className="flex items-center gap-1.5 px-2 py-1 text-gray-200">
                        <Sparkles className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-[12px] font-normal leading-none text-white">148 credits</span>
                    </div>

                    {/* Share Button */}
                    <button
                        onClick={handleOpenShare}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E1E476] hover:bg-[#d4d765] text-black rounded-lg transition-colors"
                    >
                        <Share2 className="w-3.5 h-3.5" />
                        <span className="text-[12px] font-normal leading-none">Share</span>
                    </button>
                </div>

                {/* Row 2: Tasks Dropdown */}
                <div className="flex items-center px-2">
                    <button
                        onClick={toggleHistory}
                        className={`flex items-center gap-1 text-gray-400 hover:text-white transition-colors group ${isHistoryOpen ? 'text-white' : ''}`}
                    >
                        <span className="text-[12px] font-normal leading-none">Tasks</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors ${isHistoryOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Title */}
                <div className="flex items-center justify-between text-gray-200">
                    <span className="text-sm font-medium">Any LLM</span>
                    <div className="flex items-center gap-1 text-gray-400">
                        <Sparkles className="w-3 h-3" />
                        <span className="text-xs">1</span>
                    </div>
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                        <label className="text-xs text-gray-400">Model</label>
                        <Info className="w-3 h-3 text-gray-600" />
                    </div>
                    <div className="relative">
                        <select
                            value={data.model || 'groq:meta-llama/llama-4-scout-17b-16e-instruct'}
                            onChange={handleModelChange}
                            className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-gray-500 appearance-none"
                        >
                            {MODELS.map(model => (
                                <option key={model.id} value={model.id}>{model.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                    </div>
                </div>

                {/* Temperature Slider */}
                <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                        <label className="text-xs text-gray-400">Temperature</label>
                        <Info className="w-3 h-3 text-gray-600" />
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 h-1 bg-[#27272A] rounded-full group cursor-pointer">
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={data.temperature ?? 0}
                                onChange={handleTemperatureChange}
                                className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div
                                className="absolute h-full bg-gray-500 rounded-full"
                                style={{ width: `${(data.temperature ?? 0) * 100}%` }}
                            />
                            <div
                                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full margin-left-[-6px]"
                                style={{ left: `${(data.temperature ?? 0) * 100}%` }}
                            />
                        </div>
                        <div className="w-8 py-1 bg-[#18181B] border border-[#27272A] rounded text-center text-xs text-gray-300">
                            {data.temperature ?? 0}
                        </div>
                    </div>
                </div>

                {/* Thinking Toggle */}
                <div className="flex items-center gap-2">
                    <div className="relative flex items-center">
                        <input
                            type="checkbox"
                            checked={data.thinking || false}
                            onChange={handleThinkingChange}
                            id="thinking-toggle"
                            className="peer w-4 h-4 rounded border border-[#27272A] bg-[#18181B] text-transparent checked:bg-[#18181B] checked:text-white focus:ring-0 focus:ring-offset-0 cursor-pointer appearance-none"
                        />
                        {data.thinking && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white">
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        )}
                    </div>
                    <label htmlFor="thinking-toggle" className="text-xs text-gray-400 cursor-pointer select-none">Thinking</label>
                    <Info className="w-3 h-3 text-gray-600" />
                </div>

            </div>

            {/* Footer */}
            {/* Footer */}
            <div className="border-t border-[#27272A] bg-[#212126]">
                <div className="h-px bg-[#3C3C40] w-full" />
                <div className="p-4 flex flex-col gap-3">
                    <span className="text-xs text-gray-400 font-mono">Run selected nodes</span>


                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-21">
                            <span className="text-[12px] font-medium text-gray-200">Runs</span>
                            <div className="flex items-center bg-[#212126] border border-gray-600 rounded px-1">
                                <button
                                    className="px-3 py-0 text-gray-400 hover:text-white"
                                    onClick={() => setRunCount(Math.max(1, runCount - 1))}
                                >-</button>
                                <span className="text-sm font-mono w-6 text-center text-gray-200">{runCount}</span>
                                <button
                                    className="px-3 py-0 text-gray-400 hover:text-white"
                                    onClick={() => setRunCount(runCount + 1)}
                                >+</button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-[12px]">
                        <span className="text-gray-500 font-mono">Total cost</span>
                        <div className="flex items-center gap-1  text-gray-200">
                            <Sparkles className="w-3 h-3" />
                            <span>{1 * runCount} credits</span>
                        </div>
                    </div>

                    <button
                        onClick={handleRunSelected}
                        className="w-full bg-[#E1E476] hover:bg-[#d4d765] text-black text-[12px] font-regular py-1 rounded-sm flex items-center justify-center gap-1 transition-colors"
                    >
                        <ArrowRight className="w-4 h-4" />
                        Run selected
                    </button>
                </div>
            </div>
        </div>
    );
}
