'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Share2,
    Sparkles,
    ChevronDown,
    Save,
    Upload,
    Download,
    FileJson,
    Loader2
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useUIStore } from '@/stores/ui-store';
import { HistorySidebar } from './HistorySidebar';
import { ShareModal } from '../modals/ShareModal';
import { toast } from 'sonner';

interface WorkflowHeaderProps {
    workflowId?: string;
    onRun: (scope: 'full' | 'selected' | 'single') => Promise<void>;
    onSave: () => Promise<void>;
}

export function WorkflowHeader({ workflowId, onRun, onSave }: WorkflowHeaderProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Using store state
    const workflowName = useWorkflowStore((state) => state.workflowName);
    const setWorkflowName = useWorkflowStore((state) => state.setWorkflowName);
    const { nodes, edges, setNodes, setEdges } = useWorkflowStore();
    const { toggleHistory, isHistoryOpen } = useUIStore();

    // Listen for share modal open event
    useEffect(() => {
        const handleOpenShareModal = () => setIsShareModalOpen(true);
        window.addEventListener('openShareModal', handleOpenShareModal);
        return () => window.removeEventListener('openShareModal', handleOpenShareModal);
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave();
            toast.success('Workflow saved successfully');
        } catch (error) {
            console.error('Failed to save workflow:', error);
            toast.error('Failed to save workflow');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = () => {
        const data = {
            workflow: {
                name: workflowName,
                nodes,
                edges,
            },
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${workflowName.replace(/\s+/g, '-').toLowerCase() || 'workflow'}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Workflow exported to JSON');
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const data = JSON.parse(content);

                if (data.workflow && Array.isArray(data.workflow.nodes) && Array.isArray(data.workflow.edges)) {
                    setNodes(data.workflow.nodes);
                    setEdges(data.workflow.edges);
                    if (data.workflow.name) setWorkflowName(data.workflow.name);
                    toast.success('Workflow imported successfully');
                } else {
                    toast.error('Invalid workflow JSON format');
                }
            } catch (error) {
                console.error('Import failed:', error);
                toast.error('Failed to parse workflow file');
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    return (
        <>
            <header className="absolute top-0 left-0 right-0 h-auto p-4 flex items-start justify-between z-20 pointer-events-none">
                {/* Left: Workflow Name */}
                <div className="flex items-center pointer-events-auto bg-[#212126] border border-[#1C1C1E] rounded-lg p-1">
                    <input
                        type="text"
                        value={workflowName}
                        onChange={(e) => setWorkflowName(e.target.value)}
                        className="bg-transparent text-gray-200 font-medium text-sm focus:outline-none focus:text-white px-3 py-1.5 rounded hover:bg-[#1C1C1E] transition-colors w-[200px]"
                        placeholder="Untitled workflow"
                    />
                </div>

                {/* Right: Actions */}
                <div className="flex items-start gap-4 pointer-events-auto" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {/* Task Manager Panel */}
                    <HistorySidebar
                        workflowId={workflowId}
                        isOpen={isHistoryOpen}
                        onClose={toggleHistory}
                    />

                    {/* Floating Card for Actions */}
                    <div className="bg-[#212126] border border-[#27272A] rounded-lg px-2 pt-2 pb-2 shadow-lg flex flex-col gap-3 min-w-[220px]">
                        {/* Row 1: Credits, Share, Save */}
                        <div className="flex items-center justify-between gap-2">
                            {/* Credits Badge */}
                            <div className="flex items-center gap-1.5 px-2 py-1 text-gray-200">
                                <Sparkles className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-[12px] font-normal leading-none">149 credits</span>
                            </div>

                            <div className="flex items-center gap-1">
                                {/* Save Button */}
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333336] rounded-md transition-colors"
                                    title="Save Workflow"
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Save className="w-3.5 h-3.5" />
                                    )}
                                </button>

                                {/* Share Button */}
                                <button
                                    onClick={() => setIsShareModalOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E1E476] hover:bg-[#d4d765] text-black rounded-lg transition-colors"
                                >
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span className="text-[12px] font-normal leading-none">Share</span>
                                </button>
                            </div>
                        </div>

                        {/* Row 2: Tasks Dropdown + Import/Export */}
                        <div className="flex items-center justify-between px-2">
                            <button
                                onClick={toggleHistory}
                                className={`flex items-center gap-1 text-gray-400 hover:text-white transition-colors group ${isHistoryOpen ? 'text-white' : ''}`}
                            >
                                <span className="text-[12px] font-normal leading-none">Tasks</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors ${isHistoryOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleExport}
                                    className="p-1 text-gray-400 hover:text-white hover:bg-[#333336] rounded transition-colors"
                                    title="Export JSON"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={handleImportClick}
                                    className="p-1 text-gray-400 hover:text-white hover:bg-[#333336] rounded transition-colors"
                                    title="Import JSON"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImportFile}
                                    className="hidden"
                                    accept=".json"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Share Modal */}
            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
            />
        </>
    );
}

