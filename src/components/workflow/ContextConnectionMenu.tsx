import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useReactFlow, useStore, ReactFlowState, Node as FlowNode, Edge, Connection } from '@xyflow/react';
import { Bot, Crop, Film, Search } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { NodeType, NODE_CONFIG } from '@/types/nodes';
import { getEdgeColor } from '@/lib/connector-colors';

interface ContextConnectionMenuProps {
    position: { x: number; y: number };
    sourceNodeId: string;
    sourceHandleId: string | null;
    onClose: () => void;
    onSelect: (type: NodeType) => void;
}

export function ContextConnectionMenu({
    position,
    sourceNodeId,
    sourceHandleId,
    onClose,
    onSelect
}: ContextConnectionMenuProps) {
    const { nodes } = useWorkflowStore();
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Get source node to determine available options
    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    const sourceType = sourceNode?.type;

    // Determine options based on source node type
    const options = useMemo(() => {
        if (!sourceType) return [];

        const baseOptions = [
            { id: 'llm', label: 'Run any LLM', icon: Bot, type: 'llm' as NodeType }
        ];

        if (sourceType === 'uploadImage' || sourceType === 'cropImage' || sourceType === 'extractFrame') {
            baseOptions.push({ id: 'cropImage', label: 'Crop Image', icon: Crop, type: 'cropImage' as NodeType });
        }

        if (sourceType === 'uploadVideo') {
            baseOptions.push({ id: 'extractFrame', label: 'Extract Frame', icon: Film, type: 'extractFrame' as NodeType });
        }

        return baseOptions;
    }, [sourceType]);

    // Filter options based on search query
    const filteredOptions = useMemo(() => {
        if (!searchQuery) return options;
        return options.filter(option =>
            option.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [options, searchQuery]);

    // Handle clicking outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as unknown as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // Focus input on mount
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    return (
        <div
            ref={menuRef}
            className="absolute z-50 overflow-hidden rounded-lg border border-[#27272A] bg-[#18181B] shadow-2xl w-64 flex flex-col"
            style={{
                top: position.y,
                left: position.x,
                fontFamily: 'var(--font-dm-sans)',
            }}
        >
            <div className="px-1 pt-1 pb-">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search"
                        className="w-full bg-transparent border border-[#3F3F46] rounded-md py-1.5 pl-8 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors bg-[#27272A]/30"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="p-1 max-h-64 overflow-y-auto">
                {filteredOptions.length > 0 ? (
                    filteredOptions.map((option) => (
                        <button
                            key={option.id}
                            className="flex w-full items-center gap-0 rounded-md px-2 py-1.5 text-sm font-normal text-gray-200 hover:bg-[#27272A] transition-colors text-left"
                            onClick={() => onSelect(option.type)}
                        >
                            {option.label}
                        </button>
                    ))
                ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
                )}
            </div>
        </div>
    );
}
