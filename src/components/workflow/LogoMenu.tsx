'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useWorkflowStore } from '@/stores/workflow-store';

interface RecentWorkflow {
    id: string;
    name: string;
}

export function LogoMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [isRecentOpen, setIsRecentOpen] = useState(false);
    const [recentWorkflows, setRecentWorkflows] = useState<RecentWorkflow[]>([]);
    const router = useRouter();
    const { workflowId, workflowName, createNewWorkflow, duplicateWorkflow, saveWorkflow } = useWorkflowStore();

    // Fetch recent workflows
    useEffect(() => {
        if (isRecentOpen) {
            fetch('/api/workflows?limit=2')
                .then(res => res.json())
                .then(data => setRecentWorkflows(data.workflows || []))
                .catch(console.error);
        }
    }, [isRecentOpen]);

    const handleBackToFiles = () => {
        setIsOpen(false);
        router.push('/dashboard');
    };

    const handleNewFile = async () => {
        setIsOpen(false);
        const newId = await createNewWorkflow();
        router.push(`/workflows/${newId}`);
    };

    const handleOpenRecent = (id: string) => {
        setIsOpen(false);
        router.push(`/workflows/${id}`);
    };

    const handleDuplicate = async () => {
        setIsOpen(false);
        if (!workflowId || workflowId === 'temp') {
            // Save current workflow first
            await saveWorkflow();
        }
        const newId = await duplicateWorkflow();
        router.push(`/workflows/${newId}`);
    };

    const handleRename = () => {
        setIsOpen(false);
        // Focus the title input in the header
        const titleInput = document.querySelector('input[value="' + workflowName + '"]') as HTMLInputElement;
        if (titleInput) {
            titleInput.focus();
            titleInput.select();
        }
    };

    const handleShare = () => {
        setIsOpen(false);
        // Open share modal (implement in next step)
        const event = new CustomEvent('openShareModal');
        window.dispatchEvent(event);
    };

    return (
        <div className="relative">
            {/* Logo Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#2B2B2F] transition-colors"
                aria-label="File menu"
            >
                <Image src="/logo.svg" alt="Galaxy.ai" width={24} height={24} className="w-6 h-6" />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div
                        className="absolute left-0 top-full mt-2 w-46 bg-[#212126] border border-[#2C2C2E] rounded-lg shadow-2xl z-50 py-1 text-[12px] font-normal"
                        style={{ fontFamily: 'DM Sans, sans-serif' }}
                    >
                        {/* Back to files */}
                        <button
                            onClick={handleBackToFiles}
                            className="w-full px-3 py-1 text-left text-white hover:bg-[#2B2B2F] transition-colors"
                        >
                            Back to files
                        </button>

                        <div className="border-t border-[#3C3C40] my-[3px]" />

                        {/* New file */}
                        <button
                            onClick={handleNewFile}
                            className="w-full px-3 py-[5px] text-left text-white hover:bg-[#2B2B2F] transition-colors"
                        >
                            New file
                        </button>

                        {/* Open recent */}
                        <div
                            className="relative"
                            onMouseEnter={() => setIsRecentOpen(true)}
                            onMouseLeave={() => setIsRecentOpen(false)}
                        >
                            <button
                                className="w-full px-3 py-[5px] text-left text-white hover:bg-[#2B2B2F] transition-colors flex items-center justify-between"
                            >
                                <span>Open recent</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>

                            {/* Recent submenu */}
                            {isRecentOpen && (
                                <div
                                    className="absolute left-full top-0 ml-1 w-56 bg-[#1C1C1E] border border-[#2C2C2E] rounded-lg shadow-2xl py-1 text-[12px] font-normal"
                                    style={{ fontFamily: 'DM Sans, sans-serif' }}
                                >
                                    {recentWorkflows.length > 0 ? (
                                        recentWorkflows.map((workflow) => (
                                            <button
                                                key={workflow.id}
                                                onClick={() => handleOpenRecent(workflow.id)}
                                                className="w-full px-3 py-[5px] text-left text-white hover:bg-[#2B2B2F] transition-colors truncate"
                                            >
                                                {workflow.name}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-1 text-gray-500">
                                            No recent files
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-[#3C3C40] my-[3px]" />

                        {/* Duplicate */}
                        <button
                            onClick={handleDuplicate}
                            className="w-full px-3 py-[5px] text-left text-white hover:bg-[#2B2B2F] transition-colors"
                        >
                            Duplicate
                        </button>

                        {/* Rename */}
                        <button
                            onClick={handleRename}
                            className="w-full px-3 py-[5px] text-left text-white hover:bg-[#2B2B2F] transition-colors"
                        >
                            Rename
                        </button>

                        {/* Share */}
                        <button
                            onClick={handleShare}
                            className="w-full px-3 py-[5px] text-left text-white hover:bg-[#2B2B2F] transition-colors"
                        >
                            Share
                        </button>

                        <div className="border-t border-[#3C3C40] my-[3px]" />

                        {/* Preferences */}
                        <button
                            className="w-full px-3 py-[2px] text-left text-white hover:bg-[#2B2B2F] transition-colors flex items-center justify-between"
                            disabled
                        >
                            <span>Preferences</span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
