'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
    ChevronDown,
    Play,
    Loader2
} from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useCanvasToolStore, CanvasTool } from '@/stores/canvas-tool-store';

interface FloatingToolbarProps {
    onRun?: (scope: 'full' | 'selected' | 'single') => Promise<void>;
    isExecuting?: boolean;
}

export default function FloatingToolbar({ onRun, isExecuting = false }: FloatingToolbarProps) {
    const reactFlowInstance = useReactFlow();
    const [zoomLevel, setZoomLevel] = React.useState(100);
    const [showRunMenu, setShowRunMenu] = useState(false);

    // Tool state from store
    const activeTool = useCanvasToolStore((state) => state.activeTool);
    const setActiveTool = useCanvasToolStore((state) => state.setActiveTool);

    const undo = useWorkflowStore((state) => state.undo);
    const redo = useWorkflowStore((state) => state.redo);
    const canUndo = useWorkflowStore((state) => state.canUndo());
    const canRedo = useWorkflowStore((state) => state.canRedo());
    const selectedNodeIds = useWorkflowStore((state) => state.selectedNodeIds);
    const nodes = useWorkflowStore((state) => state.nodes);

    // Update zoom level display
    React.useEffect(() => {
        const interval = setInterval(() => {
            setZoomLevel(Math.round(reactFlowInstance.getZoom() * 100));
        }, 100);
        return () => clearInterval(interval);
    }, [reactFlowInstance]);

    // Handle tool switching
    const handleToolChange = useCallback((tool: CanvasTool) => {
        setActiveTool(tool);
    }, [setActiveTool]);

    // Keyboard shortcuts for tool switching
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.key === 'v' || e.key === 'V') {
                handleToolChange('select');
            } else if (e.key === 'h' || e.key === 'H') {
                handleToolChange('pan');
            } else if (e.key === ' ' && !e.repeat) {
                // Space bar temporarily activates pan (hold to pan)
                e.preventDefault();
                handleToolChange('pan');
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            // Release space bar returns to select mode
            if (e.key === ' ') {
                handleToolChange('select');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleToolChange]);

    const handleRun = useCallback(async (scope: 'full' | 'selected' | 'single') => {
        setShowRunMenu(false);
        if (onRun) {
            await onRun(scope);
        }
    }, [onRun]);

    return (
        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#212126] border border-[#2C2C2E] rounded-lg p-1.5 shadow-xl z-50">
            {/* Tool Selection */}
            <div className="flex bg-[#212126] rounded-md p-0.5">
                <button
                    onClick={() => handleToolChange('select')}
                    className={`px-[4px] py-[3px] rounded-sm transition-colors ${activeTool === 'select'
                        ? 'bg-[#F7FFA8] text-black'
                        : 'text-gray-400 hover:text-white hover:bg-[#2C2C2E]'
                        }`}
                    title="Select Tool (V) - Click to select, drag to create selection box"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5.5 h-5.5">
                        <path d="M12.7459 12.7421L20.4662 10.5859C20.6175 10.5395 20.7503 10.4465 20.8455 10.3201C20.9407 10.1936 20.9935 10.0403 20.9963 9.8821C20.9992 9.72386 20.9518 9.56878 20.8612 9.43907C20.7705 9.30935 20.6411 9.21165 20.4915 9.15994L3.9915 3.03994C3.85914 2.99493 3.71682 2.9878 3.58063 3.01937C3.44443 3.05095 3.31977 3.11996 3.22072 3.21863C3.12166 3.31729 3.05216 3.44168 3.02005 3.57775C2.98794 3.71382 2.9945 3.85616 3.039 3.98869L9.159 20.4887C9.2107 20.6383 9.30841 20.7677 9.43812 20.8584C9.56783 20.949 9.72291 20.9964 9.88115 20.9935C10.0394 20.9907 10.1927 20.9379 10.3191 20.8427C10.4455 20.7475 10.5386 20.6147 10.5849 20.4634L12.7459 12.7421Z" stroke="currentColor" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                </button>
                <button
                    onClick={() => handleToolChange('pan')}
                    className={`px-[4px] py-[3px] rounded-sm transition-colors ${activeTool === 'pan'
                        ? 'bg-[#F7FFA8] text-black'
                        : 'text-gray-400 hover:text-white hover:bg-[#2C2C2E]'
                        }`}
                    title="Pan Tool (H or Space) - Drag to pan canvas"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5.5 h-5.5">
                        <path d="M15.7501 7.125C15.7501 6.62772 15.9477 6.15081 16.2993 5.79917C16.6509 5.44754 17.1279 5.25 17.6251 5.25C18.1224 5.25 18.5993 5.44754 18.951 5.79917C19.3026 6.15081 19.5001 6.62772 19.5001 7.125V14.25C19.5001 15.2349 19.3061 16.2102 18.9292 17.1201C18.5523 18.0301 17.9999 18.8569 17.3034 19.5533C16.607 20.2497 15.7802 20.8022 14.8703 21.1791C13.9603 21.556 12.985 21.75 12.0001 21.75C7.85826 21.75 6.30482 19.755 3.25138 13.3125C3.00666 12.8821 2.94213 12.3723 3.07185 11.8945C3.20158 11.4167 3.51504 11.0096 3.94383 10.762C4.37262 10.5144 4.88193 10.4465 5.36061 10.5731C5.83928 10.6996 6.24848 11.0104 6.49888 11.4375L8.25013 14.25V5.625C8.25013 5.12772 8.44768 4.65081 8.79931 4.29917C9.15094 3.94754 9.62785 3.75 10.1251 3.75C10.6224 3.75 11.0993 3.94754 11.451 4.29917C11.8026 4.65081 12.0001 5.12772 12.0001 5.625" stroke="currentColor" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round"></path>
                        <path d="M12 11.25V4.125C12 3.62772 12.1975 3.15081 12.5492 2.79917C12.9008 2.44754 13.3777 2.25 13.875 2.25C14.3723 2.25 14.8492 2.44754 15.2008 2.79917C15.5525 3.15081 15.75 3.62772 15.75 4.125V11.25" stroke="currentColor" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                </button>
            </div>
            <div className="w-px h-5.5 bg-[#C5C5C5]" />

            {/* History Controls */}
            <div className="flex bg-[#212126] rounded-md p-0.5">
                <button
                    onClick={undo}
                    disabled={!canUndo || isExecuting}
                    className="px-[4px] py-[3px] text-gray-400 hover:text-white rounded-sm hover:bg-[#2C2C2E] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Undo (Ctrl+Z)"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                        <path d="M7.125 12.75L2.625 8.25L7.125 3.75" stroke="currentColor" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round"></path>
                        <path d="M7.125 18.75H15.375C16.7674 18.75 18.1027 18.1969 19.0873 17.2123C20.0719 16.2277 20.625 14.8924 20.625 13.5C20.625 12.1076 20.0719 10.7723 19.0873 9.78769C18.1027 8.80312 16.7674 8.25 15.375 8.25H2.625" stroke="currentColor" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                </button>
                <button
                    onClick={redo}
                    disabled={!canRedo || isExecuting}
                    className="px-[4px] py-[3px] text-gray-400 hover:text-white rounded-sm hover:bg-[#2C2C2E] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Redo (Ctrl+Shift+Z)"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                        <path d="M16.875 12.75L21.375 8.25L16.875 3.75" stroke="currentColor" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round"></path>
                        <path d="M16.875 18.75H12.75H8.625C7.23261 18.75 5.89726 18.1969 4.91269 17.2123C3.92812 16.2277 3.375 14.8924 3.375 13.5C3.375 12.1076 3.92812 10.7723 4.91269 9.78769C5.89726 8.80312 7.23261 8.25 8.625 8.25H21.375" stroke="currentColor" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                </button>
            </div>
            <div className="w-px h-5.5 bg-[#C5C5C5]" />

            {/* Run Controls */}
            <div className="relative">
                <button
                    onClick={() => setShowRunMenu(!showRunMenu)}
                    disabled={isExecuting || nodes.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#E1E476] hover:bg-[#d4d765] text-black rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                    style={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' }}
                >
                    {isExecuting ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Running...
                        </>
                    ) : (
                        <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Run
                            <ChevronDown className="w-3 h-3" />
                        </>
                    )}
                </button>

                {/* Run Menu Dropdown */}
                {showRunMenu && !isExecuting && (
                    <div className="absolute bottom-full mb-2 left-0 bg-[#1C1C1E] border border-[#2C2C2E] rounded-lg shadow-xl overflow-hidden min-w-[200px]">
                        <button
                            onClick={() => handleRun('full')}
                            className="w-full px-4 py-2.5 text-left text-white hover:bg-[#2C2C2E] transition-colors text-xs flex items-center justify-between group"
                        >
                            <span>Run Full Workflow</span>
                            <kbd className="px-2 py-0.5 bg-[#0E0E10] rounded text-[10px] text-gray-500 group-hover:text-gray-300">
                                ⌘ R
                            </kbd>
                        </button>

                        <button
                            onClick={() => handleRun('selected')}
                            disabled={selectedNodeIds.length === 0}
                            className="w-full px-2 py-2.5 text-left text-white hover:bg-[#2C2C2E] transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Run Selected Nodes
                            {selectedNodeIds.length > 0 && (
                                <span className="ml-2 text-[#F7FFA8]">({selectedNodeIds.length})</span>
                            )}
                        </button>
                    </div>
                )}
            </div>

            <div className="w-px h-5.5 bg-[#C5C5C5]" />

            {/* Node Count */}
            <div className="px-1 text-[13px] text-gray-400 font-normal whitespace-nowrap" style={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' }}>
                {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}
            </div>

            <div className="w-px h-5.5 bg-[#C5C5C5]" />

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
                <button
                    className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-200 hover:text-white rounded hover:bg-[#2C2C2E] transition-colors min-w-[60px] justify-center"
                    onClick={() => reactFlowInstance.zoomIn()}
                >
                    {zoomLevel}%
                    <ChevronDown className="w-3 h-3 text-gray-500" />
                </button>
            </div>
        </div>
    );
}
