'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkflowStore } from '@/stores/workflow-store';
import {
    History,
    ChevronDown,
    ChevronRight,
    CheckCircle,
    XCircle,
    Clock,
    Loader2,
    Circle,
    X
} from 'lucide-react';

interface NodeResultDisplay {
    id: string;
    nodeId: string;
    nodeType: string;
    status: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING';
    duration?: number;
    output?: unknown;
    error?: string;
    input?: unknown;
}

interface WorkflowRunDisplay {
    id: string;
    status: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PARTIAL';
    scope: 'FULL' | 'PARTIAL' | 'SINGLE';
    startedAt: string;
    duration?: number;
    nodeResults: NodeResultDisplay[];
}

interface HistorySidebarProps {
    workflowId?: string;
    isOpen: boolean;
    onClose: () => void;
}

export function HistorySidebar({ workflowId, isOpen, onClose }: HistorySidebarProps) {
    const [runs, setRuns] = useState<WorkflowRunDisplay[]>([]);
    const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const isExecuting = useWorkflowStore((state) => state.isExecuting);


    // Use ref to access runs without re-triggering effect
    const runsRef = useRef<WorkflowRunDisplay[]>([]);
    runsRef.current = runs;

    useEffect(() => {
        if (!isOpen || !workflowId || workflowId === 'new') {
            if (!workflowId || workflowId === 'new') setRuns([]);
            return;
        }

        const fetchRuns = async (isPolling = false) => {
            // Only show loading on initial fetch if we have no runs
            // and we are not polling
            if (!isPolling && runsRef.current.length === 0) setIsLoading(true);
            try {
                const response = await fetch(`/api/workflows/${workflowId}/runs?t=${Date.now()}`, {
                    cache: 'no-store'
                });
                if (response.ok) {
                    const data = await response.json();
                    setRuns(data.runs || []);
                }
            } catch (error) {
                console.error('Failed to fetch runs:', error);
            } finally {
                if (!isPolling) setIsLoading(false);
            }
        };

        // Always fetch when opened or when execution state changes
        fetchRuns();

        const interval = setInterval(() => {
            // Poll if explicitly executing OR if we have running tasks in the list
            if (isExecuting || runsRef.current.some(r => r.status === 'RUNNING')) {
                fetchRuns(true);
            }
        }, 2000); // Poll more frequently (2s) when running

        return () => clearInterval(interval);
    }, [workflowId, isExecuting, isOpen]); // Re-fetch when sidebar opens or execution state changes

    const toggleExpand = (runId: string) => {
        setExpandedRuns(prev => {
            const next = new Set(prev);
            if (next.has(runId)) {
                next.delete(runId);
            } else {
                next.add(runId);
            }
            return next;
        });
    };

    const handleClearAll = async () => {
        if (!workflowId || workflowId === 'new') return;
        try {
            const response = await fetch(`/api/workflows/${workflowId}/runs`, {
                method: 'DELETE',
            });
            if (response.ok) {
                setRuns([]);
            }
        } catch (error) {
            console.error('Failed to clear runs:', error);
        }
    };

    const handleDeleteRun = async (runId: string) => {
        if (!workflowId || workflowId === 'new') return;
        try {
            const response = await fetch(`/api/workflows/${workflowId}/runs/${runId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                setRuns(prevRuns => prevRuns.filter(r => r.id !== runId));
            }
        } catch (error) {
            console.error('Failed to delete run:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="w-[380px] bg-[#1E1E21] border border-[#2C2C2E] rounded-lg flex flex-col max-h-[600px] shadow-2xl overflow-hidden pointer-events-auto" style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '9pt', fontWeight: 400 }}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 px-5 pb-2.5 border-b border-[#2A2A2D]">
                <h2 className="text-[12px] font-normal text-[#E5E5E5] tracking-wide" style={{ fontFamily: 'var(--font-dm-mono)' }}>Task manager</h2>
                <div className="flex items-center gap-5">
                    {runs.length > 0 && (
                        <button
                            onClick={handleClearAll}
                            className="text-[9pt] font-normal text-white hover:text-gray-300 transition-colors"
                        >
                            Clear all
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-[18px] h-[18px]" strokeWidth={1.5} />
                    </button>
                </div>
            </div>

            {/* Runs List */}
            <div className="flex-1 overflow-y-auto min-h-[100px] custom-scrollbar p-2">
                {isLoading && runs.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                    </div>
                ) : runs.length === 0 ? (
                    <div className="p-4 text-gray-500 text-[9pt] text-center">
                        No active tasks
                    </div>
                ) : (
                    <div className="space-y-1">
                        {runs.map((run) => (
                            <div key={run.id} className="flex flex-col space-y-1">
                                <div
                                    onClick={() => toggleExpand(run.id)}
                                    className="group relative flex items-center justify-between px-3 py-3 rounded-xl hover:bg-[#2A2A2D] cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <button className="text-[#828282] hover:text-white transition-colors focus:outline-none">
                                            {expandedRuns.has(run.id) ? (
                                                <ChevronDown className="w-[16px] h-[16px]" strokeWidth={1.5} />
                                            ) : (
                                                <ChevronRight className="w-[16px] h-[16px]" strokeWidth={1.5} />
                                            )}
                                        </button>
                                        {run.status === 'SUCCESS' ? (
                                            <CheckCircle className="w-[18px] h-[18px] text-white" strokeWidth={1.5} />
                                        ) : run.status === 'FAILED' ? (
                                            <XCircle className="w-[18px] h-[18px] text-[#EF9192]" strokeWidth={1.5} />
                                        ) : run.status === 'RUNNING' ? (
                                            <Loader2 className="w-[18px] h-[18px] text-[#A855F7] animate-spin" strokeWidth={1.5} />
                                        ) : (
                                            <Circle className="w-[18px] h-[18px] text-[#828282]" strokeWidth={1.5} />
                                        )}
                                        <div className="flex flex-col">
                                            <span className="text-[9pt] text-[#E5E5E5] font-normal tracking-wide">
                                                Run #{run.id.slice(-8)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <span className={`text-[9pt] font-normal capitalize tracking-wide transition-colors ${run.status === 'SUCCESS' ? 'text-[#828282]' :
                                            run.status === 'FAILED' ? 'text-[#EF9192]' :
                                                run.status === 'PARTIAL' ? 'text-[#828282]' :
                                                    run.status === 'RUNNING' ? 'text-[#E5E5E5]' : 'text-[#828282]'
                                            }`}>
                                            {run.status.toLowerCase()}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteRun(run.id);
                                            }}
                                            className="hidden group-hover:block ml-6 text-[9pt] font-normal text-white hover:text-gray-300 transition-colors"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                                {expandedRuns.has(run.id) && run.nodeResults && run.nodeResults.length > 0 && (
                                    <div className="pl-[52px] pr-3 py-1 space-y-2 mb-2">
                                        {run.nodeResults.map((node) => (
                                            <div key={node.id} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {node.status === 'SUCCESS' ? (
                                                        <CheckCircle className="w-[14px] h-[14px] text-white" strokeWidth={1.5} />
                                                    ) : node.status === 'FAILED' ? (
                                                        <XCircle className="w-[14px] h-[14px] text-[#EF9192]" strokeWidth={1.5} />
                                                    ) : node.status === 'RUNNING' ? (
                                                        <Loader2 className="w-[14px] h-[14px] text-[#A855F7] animate-spin" strokeWidth={1.5} />
                                                    ) : (
                                                        <Circle className="w-[14px] h-[14px] text-[#828282]" strokeWidth={1.5} />
                                                    )}
                                                    <span className="text-[12px] text-[#A0A0A0] capitalize font-medium">
                                                        {node.nodeType.replace(/([A-Z])/g, ' $1').trim()}
                                                    </span>
                                                </div>
                                                {node.duration !== undefined && node.duration > 0 && (
                                                    <span className="text-[12px] text-[#6B7280] flex items-center gap-1.5 font-medium">
                                                        <Clock className="w-3 h-3" />
                                                        {(node.duration / 1000).toFixed(1)}s
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
