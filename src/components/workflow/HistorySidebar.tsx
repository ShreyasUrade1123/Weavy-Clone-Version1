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

    const toggleRun = (runId: string) => {
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

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(date);
    };

    const formatDuration = (ms?: number) => {
        if (!ms) return '';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const getScopeLabel = (scope: string, nodeCount?: number) => {
        switch (scope) {
            case 'FULL':
                return 'Full Workflow';
            case 'SINGLE':
                return 'Single Node';
            case 'PARTIAL':
                return `${nodeCount || 0} Selected Nodes`;
            default:
                return scope;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-green-500/20 text-green-400 font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Success
                    </span>
                );
            case 'FAILED':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400 font-medium">
                        <XCircle className="w-3 h-3" />
                        Failed
                    </span>
                );
            case 'RUNNING':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-400 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Running
                    </span>
                );
            case 'PARTIAL':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-400 font-medium">
                        <Clock className="w-3 h-3" />
                        Partial
                    </span>
                );
            default:
                return null;
        }
    };

    const getNodeStatusIcon = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return <CheckCircle className="w-4 h-4 text-green-400" />;
            case 'FAILED':
                return <XCircle className="w-4 h-4 text-red-400" />;
            case 'RUNNING':
                return <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />;
            case 'PENDING':
                return <Circle className="w-4 h-4 text-gray-500" />;
            default:
                return null;
        }
    };

    const getNodeTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            text: 'Text Input',
            uploadImage: 'Upload Image',
            uploadVideo: 'Upload Video',
            llm: 'LLM Generation',
            cropImage: 'Crop Image',
            extractFrame: 'Extract Frame'
        };
        return labels[type] || type;
    };

    if (!isOpen) return null;

    return (
        <div className="w-[360px] bg-[#212126] border border-[#1C1C1E] rounded-2xl flex flex-col max-h-[600px] shadow-2xl overflow-hidden pointer-events-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1C1C1E]">
                <h2 className="font-mono text-sm text-gray-200">Task manager</h2>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Runs List */}
            <div className="flex-1 overflow-y-auto min-h-[100px]">
                {isLoading && runs.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                    </div>
                ) : runs.length === 0 ? (
                    <div className="p-4 text-gray-500 text-sm font-mono">
                        No active runs
                    </div>
                ) : (
                    <div className="divide-y divide-[#1C1C1E]">
                        {runs.map((run) => (
                            <div key={run.id} className="p-3">
                                <button
                                    onClick={() => toggleRun(run.id)}
                                    className="w-full text-left"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {expandedRuns.has(run.id) ? (
                                                <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                            ) : (
                                                <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                            )}
                                            <span className="text-sm font-medium text-white truncate">
                                                Run #{run.id.slice(-8)}
                                            </span>
                                        </div>
                                        {getStatusBadge(run.status)}
                                    </div>

                                    <div className="ml-5 text-xs text-gray-500 space-y-0.5">
                                        <p>{formatDate(run.startedAt)}</p>
                                        <p className="flex items-center gap-2">
                                            <span>{getScopeLabel(run.scope, run.nodeResults.length)}</span>
                                            {run.duration && (
                                                <>
                                                    <span>•</span>
                                                    <span>{formatDuration(run.duration)}</span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </button>

                                {/* Expanded Node Results */}
                                {expandedRuns.has(run.id) && (
                                    <div className="mt-3 ml-5 space-y-2">
                                        {run.nodeResults.map((result) => (
                                            <div
                                                key={result.id}
                                                className="p-2 bg-[#1C1C1E] rounded-lg"
                                            >
                                                <div className="flex items-start gap-2">
                                                    {getNodeStatusIcon(result.status)}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <span className="text-xs font-medium text-white truncate">
                                                                {getNodeTypeLabel(result.nodeType)}
                                                            </span>
                                                            {result.duration && (
                                                                <span className="text-[10px] text-gray-500 flex-shrink-0">
                                                                    {formatDuration(result.duration)}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {result.output != null && (
                                                            <div className="mt-1 p-2 bg-[#0E0E10] rounded text-[10px] text-gray-400 max-h-20 overflow-y-auto">
                                                                {String(typeof result.output === 'string'
                                                                    ? (result.output.length > 100 ? result.output.slice(0, 100) + '...' : result.output)
                                                                    : JSON.stringify(result.output, null, 2).slice(0, 100) + '...'
                                                                )}
                                                            </div>
                                                        )}

                                                        {result.error && (
                                                            <div className="mt-1 p-2 bg-red-500/10 rounded text-[10px] text-red-400">
                                                                {result.error}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {run.nodeResults.length === 0 && (
                                            <p className="text-gray-600 text-xs">No node results</p>
                                        )}
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
