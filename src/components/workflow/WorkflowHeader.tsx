'use client';

import { useState, useEffect } from 'react';
import {
    Share2,
    Sparkles,
    ChevronDown,
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useUIStore } from '@/stores/ui-store';
import { HistorySidebar } from './HistorySidebar';
import { ShareModal } from '../modals/ShareModal';

interface WorkflowHeaderProps {
    workflowId?: string;
    onRun: (scope: 'full' | 'selected' | 'single') => Promise<void>;
    onSave: () => Promise<void>;
}

export function WorkflowHeader({ workflowId, onRun, onSave }: WorkflowHeaderProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    // Using store state
    const workflowName = useWorkflowStore((state) => state.workflowName);
    const setWorkflowName = useWorkflowStore((state) => state.setWorkflowName);
    const { toggleHistory, isHistoryOpen } = useUIStore();

    // Listen for share modal open event
    useEffect(() => {
        const handleOpenShareModal = () => setIsShareModalOpen(true);
        window.addEventListener('openShareModal', handleOpenShareModal);
        return () => window.removeEventListener('openShareModal', handleOpenShareModal);
    }, []);

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
                <div className="flex items-start gap-4 pointer-events-auto">
                    {/* Task Manager Panel */}
                    <HistorySidebar
                        workflowId={workflowId}
                        isOpen={isHistoryOpen}
                        onClose={toggleHistory}
                    />

                    {/* Floating Card for Actions */}
                    <div className="bg-[#212126] border border-[#1C1C1E] rounded-2xl p-4 shadow-xl flex flex-col gap-3 min-w-[300px]">
                        {/* Row 1: Credits, Share */}
                        <div className="flex items-center justify-between gap-3">
                            {/* Credits Badge */}
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1C1E] rounded-lg border border-[#2C2C2E]">
                                <Sparkles className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-xs font-medium text-gray-200">149 credits</span>
                            </div>

                            {/* Share Button */}
                            <button
                                onClick={() => setIsShareModalOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[#E1E476] hover:bg-[#d4d765] text-black rounded-lg transition-colors"
                            >
                                <Share2 className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold">Share</span>
                            </button>
                        </div>

                        {/* Row 2: Tasks Dropdown (Open History) */}
                        <div className="flex items-center">
                            <button
                                onClick={toggleHistory}
                                className={`flex items-center gap-2 text-gray-400 hover:text-white transition-colors group ${isHistoryOpen ? 'text-white' : ''}`}
                            >
                                <span className="text-xs font-medium">Tasks</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors ${isHistoryOpen ? 'rotate-180' : ''}`} />
                            </button>
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

