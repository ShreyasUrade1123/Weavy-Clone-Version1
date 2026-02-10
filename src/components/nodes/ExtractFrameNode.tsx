'use client';

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow, useHandleConnections } from '@xyflow/react';
import { MoreHorizontal, Loader2 } from 'lucide-react';
import { ExtractFrameNodeData } from '@/types/nodes';
import { useWorkflowStore } from '@/stores/workflow-store';
import { NodeContextMenu } from '../ui/NodeContextMenu';
import { RenameModal } from '../ui/RenameModal';

const DEFAULT_FPS = 30;

function formatTimecode(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 100);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function ExtractFrameNodeComponent({ id, data, selected }: NodeProps) {
    const nodeData = data as ExtractFrameNodeData;
    const { updateNodeData, deleteNode } = useWorkflowStore();
    const edges = useWorkflowStore((state) => state.edges);
    const { getNode } = useReactFlow();
    const isExecuting = nodeData.status === 'running';

    // Check connectivity for handles
    const inputConnections = useHandleConnections({ type: 'target', id: 'video_url' });
    const outputConnections = useHandleConnections({ type: 'source', id: 'output' });
    const isInputConnected = inputConnections.length > 0;
    const isOutputConnected = outputConnections.length > 0;

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Local State
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [currentFrame, setCurrentFrame] = useState(0);
    const [currentTimecode, setCurrentTimecode] = useState('00:00:00.00');
    const [isCaptured, setIsCaptured] = useState(false);

    // Find connected source video
    const connectedEdge = edges.find(e => e.target === id && e.targetHandle === 'video_url');
    const sourceNode = connectedEdge ? getNode(connectedEdge.source) : null;
    const sourceVideoUrl = (sourceNode?.data?.videoUrl ?? sourceNode?.data?.output) as string | undefined;

    // Sync source video to node data
    useEffect(() => {
        if (sourceVideoUrl && sourceVideoUrl !== nodeData.videoUrl) {
            updateNodeData(id, { videoUrl: sourceVideoUrl, frameUrl: undefined });
            setIsCaptured(false);
        } else if (!sourceVideoUrl && nodeData.videoUrl) {
            updateNodeData(id, { videoUrl: undefined, frameUrl: undefined });
            setIsCaptured(false);
        }
    }, [sourceVideoUrl, nodeData.videoUrl, id, updateNodeData]);

    // Auto-compute frame and timecode on timeupdate
    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        const time = video.currentTime;
        const frame = Math.floor(time * DEFAULT_FPS);
        setCurrentFrame(frame);
        setCurrentTimecode(formatTimecode(time));
    }, []);

    // Capture frame on pause
    const handlePause = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        // Set canvas to video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw current frame onto canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to data URL
        const frameDataUrl = canvas.toDataURL('image/png');

        // Update node data with captured frame
        const time = video.currentTime;
        const frame = Math.floor(time * DEFAULT_FPS);

        updateNodeData(id, {
            frameUrl: frameDataUrl,
            frame: frame,
            timecode: formatTimecode(time),
            timestamp: String(time),
            output: frameDataUrl,
        });

        setCurrentFrame(frame);
        setCurrentTimecode(formatTimecode(time));
        setIsCaptured(true);
    }, [id, updateNodeData]);

    const hasVideoConnection = !!connectedEdge;

    // Actions
    const handleDuplicate = () => {
        setIsMenuOpen(false);
    };

    const handleRename = (newName: string) => {
        updateNodeData(id, { label: newName });
        setIsRenameModalOpen(false);
    };

    const handleLock = () => {
        updateNodeData(id, { isLocked: !nodeData.isLocked });
        setIsMenuOpen(false);
    };

    const handleDelete = () => {
        deleteNode(id);
        setIsMenuOpen(false);
    };

    return (
        <>
            <div
                className={`
                    group relative rounded-2xl shadow-2xl transition-all duration-200
                    ${selected ? 'bg-[#2B2B2F] ring-2 ring-inset ring-[#333337]' : 'bg-[#212126]'}
                    ${isExecuting ? 'ring-2 ring-[#C084FC]/50' : ''}
                    ${nodeData.status === 'error' ? 'ring-2 ring-red-500' : ''}
                    ${nodeData.videoUrl ? 'min-w-[300px] max-w-[600px] w-fit' : 'min-w-[460px] w-[460px]'}
                `}
                style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
                {/* Input Handle (Video) - Left Side */}
                <div className="absolute top-[80px] -left-0">
                    <div className={`
                        absolute w-8 h-8 rounded-full flex items-center justify-center -left-4
                        transition-colors duration-200 pointer-events-auto
                        ${selected ? 'bg-[#2B2B2F]' : 'bg-[#212126]'}
                    `}>
                        <div className="relative z-10 flex items-center justify-center">
                            <Handle
                                type="target"
                                position={Position.Left}
                                id="video_url"
                                className={`!w-4 !h-4 !bg-[#2B2B2F] !border-[3.3px] !border-[#EF9192] transition-transform duration-200 hover:scale-110 flex items-center justify-center`}
                            >
                                {isInputConnected && (
                                    <div className="w-1.5 h-1.5 bg-[#EF9192] rounded-full" />
                                )}
                            </Handle>
                        </div>

                        {/* Label */}
                        <div className={`
                            absolute right-full mr-2 top-0 -translate-y-1/2
                            flex items-center
                            transition-opacity duration-200
                            ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                        `}>
                            <span className="text-[#EF9192] font-medium text-[14px] whitespace-nowrap" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                                Video
                            </span>
                        </div>
                    </div>
                </div>

                {/* Output Handle (Frame) - Right Side */}
                <div className="absolute top-[80px] -right-0">
                    <div className={`
                        absolute w-8 h-8 rounded-full flex items-center justify-center -right-4
                        transition-colors duration-200 pointer-events-auto
                        ${selected ? 'bg-[#2B2B2F]' : 'bg-[#212126]'}
                    `}>
                        <div className="relative z-10 flex items-center justify-center">
                            <Handle
                                type="source"
                                position={Position.Right}
                                id="output"
                                className={`!w-4 !h-4 !bg-[#2B2B2F] !border-[3.3px] !border-[#6FDDB3] transition-transform duration-200 hover:scale-110 flex items-center justify-center`}
                            >
                                {isOutputConnected && (
                                    <div className="w-1.5 h-1.5 bg-[#6FDDB3] rounded-full" />
                                )}
                            </Handle>
                        </div>

                        {/* Label */}
                        <div className={`
                            absolute left-full ml-2 top-0 -translate-y-1/2
                            flex items-center
                            transition-opacity duration-200
                            ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                        `}>
                            <span className="text-[#6FDDB3] font-medium text-[14px] whitespace-nowrap" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                                Frame
                            </span>
                        </div>
                    </div>
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4.5 pt-4 pb-2">
                    <div className="flex items-center gap-2">
                        <span className="font-normal text-gray-200 text-[16px]">
                            {nodeData.label || 'Extract Video Frame'}
                        </span>
                    </div>

                    <div className="relative">
                        <button
                            className="text-gray-500 hover:text-white transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMenuOpen(!isMenuOpen);
                            }}
                        >
                            <MoreHorizontal className="w-5 h-5" />
                        </button>
                        {isExecuting && <Loader2 className="w-4 h-4 text-[#C084FC] animate-spin absolute right-8 top-0.5" />}

                        <NodeContextMenu
                            isOpen={isMenuOpen}
                            position={{ x: -10, y: -2 }}
                            onClose={() => setIsMenuOpen(false)}
                            onDuplicate={handleDuplicate}
                            onRename={() => {
                                setIsMenuOpen(false);
                                setIsRenameModalOpen(true);
                            }}
                            onLock={handleLock}
                            onDelete={handleDelete}
                            isLocked={nodeData.isLocked}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="px-4.5 pb-4.5">
                    {/* Preview Area */}
                    <div className={`
                        relative rounded-lg overflow-hidden border border-[#2C2C2E]
                        ${nodeData.videoUrl ? 'w-auto h-auto bg-black' : 'aspect-square w-full bg-[#1C1C1E]'}
                    `}>
                        {/* Checkerboard Pattern (only when no video) */}
                        {!nodeData.videoUrl && (
                            <div
                                className="absolute inset-0 opacity-20"
                                style={{
                                    backgroundImage: `
                                        linear-gradient(45deg, #333 25%, transparent 25%),
                                        linear-gradient(-45deg, #333 25%, transparent 25%),
                                        linear-gradient(45deg, transparent 75%, #333 75%),
                                        linear-gradient(-45deg, transparent 75%, #333 75%)
                                    `,
                                    backgroundSize: '20px 20px',
                                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                                }}
                            />
                        )}

                        {/* Video Player (playback-driven capture) */}
                        {nodeData.videoUrl ? (
                            <div className="relative flex items-center justify-center min-h-[200px]">
                                <video
                                    ref={videoRef}
                                    src={nodeData.videoUrl}
                                    controls
                                    className="block max-h-[600px] w-auto h-auto object-contain"
                                    preload="metadata"
                                    onTimeUpdate={handleTimeUpdate}
                                    onPause={handlePause}
                                    crossOrigin="anonymous"
                                />
                            </div>
                        ) : null}
                    </div>

                    {/* Bottom Bar Controls (read-only, auto-computed) */}
                    <div className="mt-3 flex items-center gap-4 px-1">
                        {/* Frame Display */}
                        <div className="flex items-center gap-3">
                            <span className="text-gray-300 text-[13px]">Frame</span>
                            <span className="bg-[#1C1C1E] border border-[#2C2C2E] rounded px-2 py-1 min-w-[48px] text-[13px] text-white tabular-nums">
                                {nodeData.frame ?? currentFrame}
                            </span>
                        </div>

                        {/* Timecode Display */}
                        <div className="flex items-center gap-3">
                            <span className="text-gray-300 text-[13px]">Timecode</span>
                            <span className="bg-[#1C1C1E] border border-[#2C2C2E] rounded px-2 py-1 min-w-[80px] text-[13px] text-white tabular-nums">
                                {nodeData.timecode ?? currentTimecode}
                            </span>
                        </div>

                        {/* Capture indicator */}
                        {isCaptured && (
                            <span className="text-[#34D399] text-[11px] ml-auto">✓ Captured</span>
                        )}
                    </div>

                    {/* Error Display */}
                    {nodeData.error && (
                        <div className="mt-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                            <p className="text-xs text-red-400">{nodeData.error}</p>
                        </div>
                    )}
                </div>

                {/* Hidden canvas for frame capture */}
                <canvas ref={canvasRef} className="hidden" />
            </div>

            <RenameModal
                isOpen={isRenameModalOpen}
                initialValue={nodeData.label || 'Extract Frame'}
                onClose={() => setIsRenameModalOpen(false)}
                onRename={handleRename}
            />
        </>
    );
}

export const ExtractFrameNode = memo(ExtractFrameNodeComponent);
