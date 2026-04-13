'use client';

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow, useHandleConnections } from '@xyflow/react';
import { MoreHorizontal, Loader2, Asterisk } from 'lucide-react';
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
    const nodeData = data as unknown as ExtractFrameNodeData;
    const label = String(nodeData.label || 'Extract Video Frame');
    const isLocked = Boolean(nodeData.isLocked);
    const status = String(nodeData.status || 'idle');
    const videoUrl = nodeData.videoUrl as string | undefined;
    const frameUrl = nodeData.frameUrl as string | undefined;
    const output = nodeData.output as string | undefined;
    const error = nodeData.error as string | undefined;
    const frame = nodeData.frame as number | undefined;
    const timecode = nodeData.timecode as string | undefined;
    const timestamp = String(nodeData.timestamp || '0');
    const { updateNodeData, deleteNode } = useWorkflowStore();
    const edges = useWorkflowStore((state) => state.edges);
    const { getNode } = useReactFlow();
    const isExecuting = status === 'running';

    // Check connectivity for handles — only video_url input and output
    const videoConnections = useHandleConnections({ type: 'target', id: 'video_url' });
    const outputConnections = useHandleConnections({ type: 'source', id: 'output' });
    const isVideoConnected = videoConnections.length > 0;
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
    const sourceVideoUrl = (sourceNode?.data?.output ?? sourceNode?.data?.videoUrl) as string | undefined;

    // Sync source video to node data
    useEffect(() => {
        if (sourceVideoUrl && sourceVideoUrl !== videoUrl) {
            updateNodeData(id, { videoUrl: sourceVideoUrl, frameUrl: undefined });
            setIsCaptured(false);
        }
    }, [sourceVideoUrl, videoUrl, id, updateNodeData, isVideoConnected]);

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

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameDataUrl = canvas.toDataURL('image/png');

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

    // Store video duration when metadata is loaded — needed by the execute route
    // to convert percentage timestamps (e.g. '50%') into actual seconds
    const handleLoadedMetadata = useCallback(() => {
        const video = videoRef.current;
        if (!video || !isFinite(video.duration)) return;
        updateNodeData(id, { videoDuration: video.duration });
    }, [id, updateNodeData]);

    // Handle timestamp manual input change
    const handleTimestampChange = (value: string) => {
        updateNodeData(id, { timestamp: value });
    };

    // Actions
    const handleDuplicate = () => setIsMenuOpen(false);
    const handleRename = (newName: string) => {
        updateNodeData(id, { label: newName });
        setIsRenameModalOpen(false);
    };
    const handleLock = () => {
        updateNodeData(id, { isLocked: !isLocked });
        setIsMenuOpen(false);
    };
    const handleDelete = () => {
        deleteNode(id);
        setIsMenuOpen(false);
    };

    // Fix: Accept both http URLs and data: URLs as valid output
    const hasOutput = output && (
        output.startsWith('http') || output.startsWith('data:image')
    );

    return (
        <>
            <div
                className={`
                    group relative rounded-2xl shadow-2xl transition-all duration-200
                    ${selected ? 'bg-[#2B2B2F] ring-2 ring-inset ring-[#333337]' : 'bg-[#212126]'}
                    ${isExecuting ? 'ring-2 ring-[#F7FFA8]/50 node-executing' : ''}
                    ${status === 'error' ? 'ring-2 ring-red-500' : ''}
                    ${status === 'success' ? 'ring-2 ring-green-500/30' : ''}
                    ${videoUrl ? 'min-w-[300px] max-w-[600px] w-fit' : 'min-w-[460px] w-[460px]'}
                `}
                style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
                {/* Input Handle: Video URL only (Left Side) */}
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
                                className={`!w-4 !h-4 transition-transform duration-200 ${isVideoConnected
                                    ? '!bg-[#2B2B2F] !border-[3.3px] !border-[#EF9192] hover:scale-110'
                                    : '!bg-transparent !border-0 hover:scale-100'
                                } flex items-center justify-center`}
                            >
                                {isVideoConnected ? (
                                    <div className="w-1.5 h-1.5 bg-[#EF9192] rounded-full" />
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-[#2B2B2F] flex items-center justify-center border-[3.3px] border-[#2B2B2F]">
                                        <div className="w-4 h-4 rounded-full bg-[#FFFFF0] flex items-center justify-center">
                                            <Asterisk className="w-6 h-6 text-[#1C1C1E]" strokeWidth={3.5} />
                                        </div>
                                    </div>
                                )}
                            </Handle>
                        </div>

                        <div className={`
                            absolute right-full mr-2 top-0 -translate-y-1/2 flex items-center
                            transition-opacity duration-200
                            ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                        `}>
                            <span className={`${isVideoConnected ? 'text-[#EF9192]' : 'text-white'} font-medium text-[14px] whitespace-nowrap`} style={{ fontFamily: 'var(--font-dm-mono)' }}>
                                Video{!isVideoConnected ? <span className="text-[#E1E476]">*</span> : ''}
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

                        <div className={`
                            absolute left-full ml-2 top-0 -translate-y-1/2 flex items-center
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
                            {label}
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
                            isLocked={isLocked}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="px-4.5 pb-4.5">
                    {/* Preview Area */}
                    <div className={`
                        relative rounded-lg overflow-hidden border border-[#2C2C2E]
                        ${videoUrl ? 'w-auto h-auto bg-black' : 'aspect-square w-full bg-[#1C1C1E]'}
                    `}>
                        {/* Checkerboard Pattern (only when no video) */}
                        {!videoUrl && (
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

                        {/* Video Player */}
                        {videoUrl ? (
                            <div className="relative flex items-center justify-center min-h-[200px]">
                                <video
                                    ref={videoRef}
                                    src={videoUrl}
                                    controls
                                    className="block max-h-[600px] w-auto h-auto object-contain"
                                    preload="metadata"
                                    onTimeUpdate={handleTimeUpdate}
                                    onPause={handlePause}
                                    onLoadedMetadata={handleLoadedMetadata}
                                    crossOrigin="anonymous"
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full min-h-[200px]">
                                <span className="text-gray-500 text-sm z-10">Connect a video</span>
                            </div>
                        )}
                    </div>

                    {/* Timestamp Input Field — Dynamic UI Input */}
                    <div className="mt-3 flex items-center gap-3 px-1">
                        <span className="text-gray-300 text-[13px]">Timestamp</span>
                        <input
                            type="text"
                            value={timestamp}
                            onChange={(e) => {
                                e.stopPropagation();
                                handleTimestampChange(e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder='e.g. "50%" or "5.0"'
                            className="flex-1 bg-[#1C1C1E] border border-[#2C2C2E] rounded px-2 py-1.5 text-[13px] text-white focus:outline-none focus:border-[#3C3C3E] transition-colors"
                        />
                    </div>

                    {/* Bottom Bar Controls — Dynamic Frame & Timecode Display */}
                    <div className="mt-3 flex items-center gap-4 px-1">
                        {/* Frame Display */}
                        <div className="flex items-center gap-3">
                            <span className="text-gray-300 text-[13px]">Frame</span>
                            <span className="bg-[#1C1C1E] border border-[#2C2C2E] rounded px-2 py-1 min-w-[48px] text-[13px] text-white tabular-nums">
                                {frame ?? currentFrame}
                            </span>
                        </div>

                        {/* Timecode Display */}
                        <div className="flex items-center gap-3">
                            <span className="text-gray-300 text-[13px]">Timecode</span>
                            <span className="bg-[#1C1C1E] border border-[#2C2C2E] rounded px-2 py-1 min-w-[80px] text-[13px] text-white tabular-nums">
                                {timecode ?? currentTimecode}
                            </span>
                        </div>

                        {/* Capture indicator */}
                        {isCaptured && (
                            <span className="text-[#34D399] text-[11px] ml-auto">✓ Captured</span>
                        )}
                    </div>

                    {/* Output Result Display */}
                    {hasOutput && output && (
                        <div className="mt-4 space-y-2">
                            <span className="text-[#34D399] text-[12px] uppercase tracking-wider">✓ Extracted Frame</span>
                            <div className="relative rounded-lg overflow-hidden bg-[#1A1A1D] border border-[#2C2C2E]">
                                <img
                                    src={output}
                                    alt="Extracted frame"
                                    className="w-full h-auto max-h-[200px] object-contain"
                                />
                            </div>
                            <p className="text-[11px] text-gray-500 truncate" title={output}>
                                {output.substring(0, 60)}...
                            </p>
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="mt-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                            <p className="text-xs text-red-400">{error}</p>
                        </div>
                    )}
                </div>

                {/* Hidden canvas for frame capture */}
                <canvas ref={canvasRef} className="hidden" />
            </div>

            <RenameModal
                isOpen={isRenameModalOpen}
                initialValue={label}
                onClose={() => setIsRenameModalOpen(false)}
                onRename={handleRename}
            />
        </>
    );
}

export const ExtractFrameNode = memo(ExtractFrameNodeComponent);
