'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MoreHorizontal, Play, Loader2 } from 'lucide-react';
import { LLMNodeData } from '@/types/nodes';
import { useWorkflowStore } from '@/stores/workflow-store';

function LLMNodeComponent({ id, data, selected }: NodeProps) {
    const nodeData = data as LLMNodeData;
    const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
    const edges = useWorkflowStore((state) => state.edges);
    const isExecuting = nodeData.status === 'running';

    // Connection checks
    const hasSystemPrompt = edges.some(e => e.target === id && e.targetHandle === 'system_prompt');
    const hasUserMessage = edges.some(e => e.target === id && e.targetHandle === 'user_message');
    const hasImages = edges.some(e => e.target === id && e.targetHandle === 'images');

    const handleRunNode = async (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('Run node:', id);
        // Logic to trigger run would go here
    };

    return (
        <div
            className={`
                relative bg-[#1C1C1E] rounded-xl border transition-all duration-200 group
                ${selected ? 'border-[#E1E476] shadow-[0_0_0_1px_rgba(225,228,118,0.1)] min-w-[320px]' : 'border-[#2C2C2E] min-w-[300px] hover:border-[#3C3C3E]'}
                ${isExecuting ? 'ring-2 ring-[#E1E476]/50' : ''}
                ${nodeData.status === 'error' ? '!border-red-500' : ''}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2C2C2E]/50">
                <span className="font-medium text-gray-200 text-sm">Run Any LLM</span>
                <button className="text-gray-500 hover:text-white transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </div>

            {/* Content Area */}
            <div className="p-4 bg-[#151517]/50">
                {nodeData.response ? (
                    <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto custom-scrollbar">
                        {nodeData.response}
                    </div>
                ) : (
                    <textarea
                        value={nodeData.userMessage || ''}
                        onChange={(e) => updateNodeData(id, { userMessage: e.target.value })}
                        placeholder="The generated text will appear here..."
                        className="w-full bg-transparent border-0 p-0 text-sm text-gray-400 placeholder-gray-600 resize-none focus:ring-0 min-h-[120px]"
                        disabled={isExecuting || hasUserMessage}
                    />
                )}
            </div>

            {/* Footer Actions */}
            <div className="px-4 py-3 border-t border-[#2C2C2E]/50 flex justify-between items-center bg-[#1C1C1E] rounded-b-xl">
                <div className="text-[10px] text-gray-500">
                    {selected ? '+ Add another image input' : ''}
                </div>
                <button
                    onClick={handleRunNode}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2C2C2E] hover:bg-[#3C3C3E] text-white text-[10px] font-medium rounded-lg transition-colors border border-transparent hover:border-gray-600"
                >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    Run Model
                </button>
            </div>

            {/* Input Handles */}
            <div className="absolute top-0 bottom-0 left-0 w-4 flex flex-col justify-center gap-6 h-full pointer-events-none">
                {/* Prompt Handle (Purple) */}
                <div className="relative pointer-events-auto flex items-center" style={{ top: '-40px' }}>
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="user_message"
                        className={`!w-3 !h-3 !border-2 !border-[#1C1C1E] transition-all !left-[-6px]
                            ${hasUserMessage ? '!bg-[#A855F7]' : '!bg-[#2C2C2E] group-hover:!bg-[#A855F7]'}
                        `}
                    />
                    {selected && (
                        <span className="absolute left-[-80px] text-[10px] text-[#A855F7] font-medium w-[70px] text-right pointer-events-none">
                            Prompt *
                        </span>
                    )}
                </div>

                {/* System Prompt Handle (Purple) */}
                <div className="relative pointer-events-auto flex items-center" style={{ top: '-10px' }}>
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="system_prompt"
                        className={`!w-3 !h-3 !border-2 !border-[#1C1C1E] transition-all !left-[-6px]
                            ${hasSystemPrompt ? '!bg-[#A855F7]' : '!bg-[#2C2C2E] group-hover:!bg-[#A855F7]'}
                        `}
                    />
                    {selected && (
                        <span className="absolute left-[-100px] text-[10px] text-[#A855F7] font-medium w-[90px] text-right pointer-events-none">
                            System prompt
                        </span>
                    )}
                </div>

                {/* Image Handle (Green/Teal) */}
                <div className="relative pointer-events-auto flex items-center" style={{ top: '20px' }}>
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="images"
                        className={`!w-3 !h-3 !border-2 !border-[#1C1C1E] transition-all !left-[-6px]
                            ${hasImages ? '!bg-[#10B981]' : '!bg-[#2C2C2E] group-hover:!bg-[#10B981]'}
                        `}
                    />
                    {selected && (
                        <span className="absolute left-[-80px] text-[10px] text-[#10B981] font-medium w-[70px] text-right pointer-events-none">
                            Image 1
                        </span>
                    )}
                </div>
            </div>

            {/* Output Handle */}
            <div className="absolute top-8 right-0 pointer-events-none">
                <div className="relative pointer-events-auto flex items-center">
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="output"
                        className={`!w-3 !h-3 !border-2 !border-[#1C1C1E] transition-all !right-[-6px]
                             !bg-[#A855F7]
                        `}
                    />
                    {selected && (
                        <span className="absolute right-[-40px] text-[10px] text-[#A855F7] font-medium w-[30px] text-left pointer-events-none">
                            Text
                        </span>
                    )}
                </div>
            </div>

            {/* Status Overlay */}
            {isExecuting && (
                <div className="absolute top-2 right-2">
                    <Loader2 className="w-3 h-3 text-[#E1E476] animate-spin" />
                </div>
            )}
        </div>
    );
}

export const LLMNode = memo(LLMNodeComponent);
