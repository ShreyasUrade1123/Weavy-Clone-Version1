'use client';

import { memo, useState, useEffect, useMemo } from 'react';
import { Handle, Position, NodeProps, useReactFlow, useHandleConnections } from '@xyflow/react';
import { MoreHorizontal, Link as LinkIcon, ChevronDown, Asterisk } from 'lucide-react';
import { CropImageNodeData } from '@/types/nodes';
import { useWorkflowStore } from '@/stores/workflow-store';
import { NodeContextMenu } from '../ui/NodeContextMenu';
import { RenameModal } from '../ui/RenameModal';

// ─── Aspect Ratio Helpers ────────────────────────────────────────────────────

type AspectRatioOption = '1:1' | '3:4' | '4:3' | '16:9' | '9:16' | 'custom';

const ASPECT_RATIOS: { label: string; value: AspectRatioOption; ratio: number | null }[] = [
    { label: 'Custom', value: 'custom', ratio: null },
    { label: '1:1', value: '1:1', ratio: 1 },
    { label: '3:4', value: '3:4', ratio: 3 / 4 },
    { label: '4:3', value: '4:3', ratio: 4 / 3 },
    { label: '16:9', value: '16:9', ratio: 16 / 9 },
    { label: '9:16', value: '9:16', ratio: 9 / 16 },
];

/** Detect the closest preset aspect ratio from pixel dimensions */
function detectAspectRatio(width: number, height: number): AspectRatioOption {
    const ratio = width / height;
    const tolerance = 0.05;
    for (const ar of ASPECT_RATIOS) {
        if (ar.ratio && Math.abs(ratio - ar.ratio) < tolerance) {
            return ar.value;
        }
    }
    return 'custom';
}

/** Given a source size and a target aspect ratio, compute the largest
 *  crop rectangle that fits inside the source. */
function calculateDimensions(
    sourceWidth: number,
    sourceHeight: number,
    aspectRatio: AspectRatioOption,
): { width: number; height: number } {
    if (aspectRatio === 'custom') {
        return { width: sourceWidth, height: sourceHeight };
    }
    const targetRatio = ASPECT_RATIOS.find(ar => ar.value === aspectRatio)?.ratio || 1;
    const sourceRatio = sourceWidth / sourceHeight;

    if (sourceRatio > targetRatio) {
        // Source is wider → constrain by height
        return { width: Math.round(sourceHeight * targetRatio), height: sourceHeight };
    } else {
        // Source is taller → constrain by width
        return { width: sourceWidth, height: Math.round(sourceWidth / targetRatio) };
    }
}

// ─── Component ───────────────────────────────────────────────────────────────

function CropImageNodeComponent({ id, data, selected }: NodeProps) {
    // ── typed accessors ──────────────────────────────────────────────────────
    const nodeData = data as unknown as CropImageNodeData;
    const label       = String(nodeData.label || 'Crop Image');
    const isLocked    = Boolean(nodeData.isLocked);
    const status      = String(nodeData.status || 'idle');
    const imgUrl      = nodeData.imageUrl as string | undefined;
    const output      = nodeData.output as string | undefined;
    const error       = nodeData.error as string | undefined;
    const sourceW     = (nodeData.sourceWidth  ?? 0) as number;
    const sourceH     = (nodeData.sourceHeight ?? 0) as number;
    const outputW     = (nodeData.outputWidth   ?? 1024) as number;
    const outputH     = (nodeData.outputHeight  ?? 1024) as number;
    const aspectRatio = (nodeData.aspectRatio ?? 'custom') as AspectRatioOption;

    const { updateNodeData, deleteNode, edges } = useWorkflowStore();
    const { getNode } = useReactFlow();

    // ── handle connectivity ──────────────────────────────────────────────────
    const imageConnections  = useHandleConnections({ type: 'target', id: 'image_url' });
    const outputConnections = useHandleConnections({ type: 'source', id: 'output' });
    const isImageConnected  = imageConnections.length > 0;
    const isOutputConnected = outputConnections.length > 0;

    // ── local UI state ───────────────────────────────────────────────────────
    const [isMenuOpen, setIsMenuOpen]             = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen]       = useState(false);
    const [linkedDims, setLinkedDims]               = useState(true); // link icon toggle
    const [previousRatio, setPreviousRatio]         = useState<AspectRatioOption | null>(null); // remember ratio before unlink

    // Local editing state for W/H so user can freely clear & retype values
    const [editingW, setEditingW] = useState<string | null>(null);
    const [editingH, setEditingH] = useState<string | null>(null);

    // ── resolve upstream source image ────────────────────────────────────────
    const connectedEdge  = edges.find(e => e.target === id && e.targetHandle === 'image_url');
    const sourceNode     = connectedEdge ? getNode(connectedEdge.source) : null;
    const sourceImageUrl = (sourceNode?.data?.output ?? sourceNode?.data?.imageUrl) as string | undefined;

    // Sync source image → detect dimensions & aspect ratio on first connect
    useEffect(() => {
        if (sourceImageUrl && sourceImageUrl !== imgUrl) {
            const img = new window.Image();
            img.onload = () => {
                const detected = detectAspectRatio(img.width, img.height);
                const dims = calculateDimensions(img.width, img.height, detected);
                updateNodeData(id, {
                    imageUrl: sourceImageUrl,
                    sourceWidth: img.width,
                    sourceHeight: img.height,
                    aspectRatio: detected,
                    outputWidth: dims.width,
                    outputHeight: dims.height,
                    // Compute percent values for executor compatibility
                    xPercent: 0,
                    yPercent: 0,
                    widthPercent: Math.round((dims.width / img.width) * 100),
                    heightPercent: Math.round((dims.height / img.height) * 100),
                });
            };
            img.src = sourceImageUrl;
        } else if (!sourceImageUrl && imgUrl) {
            // Disconnected — clear image state
            updateNodeData(id, {
                imageUrl: undefined,
                sourceWidth: undefined, sourceHeight: undefined,
                aspectRatio: 'custom',
                outputWidth: 1024, outputHeight: 1024,
                xPercent: 0, yPercent: 0, widthPercent: 100, heightPercent: 100,
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceImageUrl, imgUrl, id]);

    // ── crop overlay geometry (for preview) ──────────────────────────────────
    const cropOverlay = useMemo(() => {
        if (!sourceW || !sourceH) return null;

        const containerSize = 420; // approximate preview container size
        const srcRatio = sourceW / sourceH;

        // Compute preview image dimensions (fit source into container)
        let previewW: number, previewH: number;
        if (srcRatio > 1) { previewW = containerSize; previewH = containerSize / srcRatio; }
        else              { previewH = containerSize; previewW = containerSize * srcRatio; }

        // Compute crop rectangle as actual pixel proportion of the source
        // e.g. 30px crop in 1200px source = 30/1200 = 2.5% of preview width
        const cropW = (outputW / sourceW) * previewW;
        const cropH = (outputH / sourceH) * previewH;

        // Center the crop rectangle within the preview
        const x = (previewW - cropW) / 2;
        const y = (previewH - cropH) / 2;

        return {
            width: cropW, height: cropH,
            x, y,
            previewWidth: previewW,
            previewHeight: previewH,
        };
    }, [sourceW, sourceH, outputW, outputH]);

    // ── handlers ─────────────────────────────────────────────────────────────

    const handleAspectRatioChange = (ratio: AspectRatioOption) => {
        const sw = sourceW || 1024;
        const sh = sourceH || 1024;
        const dims = calculateDimensions(sw, sh, ratio);
        updateNodeData(id, {
            aspectRatio: ratio,
            outputWidth: dims.width,
            outputHeight: dims.height,
            xPercent: ratio === 'custom' ? 0 : Math.round(((sw - dims.width) / 2 / sw) * 100),
            yPercent: ratio === 'custom' ? 0 : Math.round(((sh - dims.height) / 2 / sh) * 100),
            widthPercent: Math.round((dims.width / sw) * 100),
            heightPercent: Math.round((dims.height / sh) * 100),
        });
        setIsDropdownOpen(false);
    };

    const handleWidthChange = (val: string) => {
        const w = parseInt(val, 10);
        if (isNaN(w) || w <= 0) return;
        const sw = sourceW || 1024;
        const sh = sourceH || 1024;
        const clampedW = Math.min(w, sw);
        let h = outputH;
        let newRatio: AspectRatioOption = aspectRatio;

        // If a preset ratio is active, auto-compute h to maintain it
        if (aspectRatio !== 'custom') {
            const r = ASPECT_RATIOS.find(a => a.value === aspectRatio)?.ratio;
            if (r) h = Math.round(clampedW / r);
        } else if (linkedDims) {
            // Custom but linked — maintain current proportional ratio
            const currentRatio = outputW / outputH;
            h = Math.round(clampedW / currentRatio);
        } else {
            // Unlinked custom — only change width
            newRatio = 'custom';
        }

        const clampedH = Math.min(h, sh);
        updateNodeData(id, {
            outputWidth: clampedW,
            outputHeight: clampedH,
            aspectRatio: newRatio,
            widthPercent: Math.round((clampedW / sw) * 100),
            heightPercent: Math.round((clampedH / sh) * 100),
            xPercent: Math.round(((sw - clampedW) / 2 / sw) * 100),
            yPercent: Math.round(((sh - clampedH) / 2 / sh) * 100),
        });
    };

    const handleHeightChange = (val: string) => {
        const h = parseInt(val, 10);
        if (isNaN(h) || h <= 0) return;
        const sw = sourceW || 1024;
        const sh = sourceH || 1024;
        const clampedH = Math.min(h, sh);
        let w = outputW;
        let newRatio: AspectRatioOption = aspectRatio;

        // If a preset ratio is active, auto-compute w to maintain it
        if (aspectRatio !== 'custom') {
            const r = ASPECT_RATIOS.find(a => a.value === aspectRatio)?.ratio;
            if (r) w = Math.round(clampedH * r);
        } else if (linkedDims) {
            // Custom but linked — maintain current proportional ratio
            const currentRatio = outputW / outputH;
            w = Math.round(clampedH * currentRatio);
        } else {
            // Unlinked custom — only change height
            newRatio = 'custom';
        }

        const clampedW = Math.min(w, sw);
        updateNodeData(id, {
            outputWidth: clampedW,
            outputHeight: clampedH,
            aspectRatio: newRatio,
            widthPercent: Math.round((clampedW / sw) * 100),
            heightPercent: Math.round((clampedH / sh) * 100),
            xPercent: Math.round(((sw - clampedW) / 2 / sw) * 100),
            yPercent: Math.round(((sh - clampedH) / 2 / sh) * 100),
        });
    };

    const handleReset = () => {
        if (sourceW && sourceH) {
            const detected = detectAspectRatio(sourceW, sourceH);
            handleAspectRatioChange(detected);
        } else {
            handleAspectRatioChange('custom');
        }
    };

    // Node actions
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

    const isExecuting = status === 'running';
    const hasOutput   = output && output.length > 0;
    const currentRatioLabel = ASPECT_RATIOS.find(ar => ar.value === aspectRatio)?.label || 'Custom';

    // ── JSX ──────────────────────────────────────────────────────────────────
    return (
        <>
            <div
                className={`
                    group relative rounded-2xl min-w-[460px] shadow-2xl transition-all duration-200
                    ${selected ? 'bg-[#2B2B2F] ring-2 ring-inset ring-[#333337]' : 'bg-[#212126]'}
                    ${isExecuting ? 'ring-2 ring-[#F7FFA8]/50 node-executing' : ''}
                    ${status === 'error' ? 'ring-2 ring-red-500' : ''}
                    ${status === 'success' ? 'ring-2 ring-green-500/30' : ''}
                `}
                style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
                {/* ── Left Handle: image_url ────────────────────────────── */}
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
                                id="image_url"
                                className={`!w-4 !h-4 transition-transform duration-200 ${isImageConnected
                                    ? '!bg-[#2B2B2F] !border-[3.3px] !border-[#6FDDB3] hover:scale-110'
                                    : '!bg-transparent !border-0 hover:scale-100'
                                } flex items-center justify-center`}
                                style={isImageConnected ? { borderColor: '#6FDDB3' } : {}}
                            >
                                {isImageConnected ? (
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#6FDDB3]" />
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
                            <span
                                className="font-medium text-[14px] whitespace-nowrap"
                                style={{ fontFamily: 'var(--font-dm-mono)', color: isImageConnected ? '#6FDDB3' : 'white' }}
                            >
                                File{!isImageConnected ? <span className="text-[#E1E476]">*</span> : null}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Right Handle: output ──────────────────────────────── */}
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
                                className={`!w-4 !h-4 !bg-[#2B2B2F] !border-[3.3px] transition-transform duration-200
                                    ${isOutputConnected ? '!border-[#6FDDB3]' : '!border-white'} hover:scale-110
                                    flex items-center justify-center`}
                            >
                                {isOutputConnected && <div className="w-1.5 h-1.5 bg-[#6FDDB3] rounded-full" />}
                            </Handle>
                        </div>
                        <div className={`
                            absolute left-full ml-2 top-0 -translate-y-1/2 flex items-center
                            transition-opacity duration-200
                            ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                        `}>
                            <span className={`${isOutputConnected ? 'text-[#6FDDB3]' : 'text-white'} font-medium text-[14px] whitespace-nowrap`} style={{ fontFamily: 'var(--font-dm-mono)' }}>
                                File
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Header ───────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-4.5 pt-4 pb-2">
                    <span className="font-normal text-gray-200 text-[16px]">{label}</span>
                    <div className="relative">
                        <button
                            className="text-gray-500 hover:text-white transition-colors"
                            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                        >
                            <MoreHorizontal className="w-5 h-5" />
                        </button>
                        <NodeContextMenu
                            isOpen={isMenuOpen}
                            position={{ x: -10, y: -2 }}
                            onClose={() => setIsMenuOpen(false)}
                            onDuplicate={handleDuplicate}
                            onRename={() => { setIsMenuOpen(false); setIsRenameModalOpen(true); }}
                            onLock={handleLock}
                            onDelete={handleDelete}
                            isLocked={isLocked}
                        />
                    </div>
                </div>

                {/* ── Body ─────────────────────────────────────────────── */}
                <div className="px-4.5 pb-4.5">

                    {/* Image Preview with crop overlay */}
                    <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-4 bg-[#1A1A1D] flex items-center justify-center">
                        {/* Checkerboard */}
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage: `
                                    linear-gradient(45deg, #252529 25%, transparent 25%),
                                    linear-gradient(-45deg, #252529 25%, transparent 25%),
                                    linear-gradient(45deg, transparent 75%, #252529 75%),
                                    linear-gradient(-45deg, transparent 75%, #252529 75%)`,
                                backgroundSize: '20px 20px',
                                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                            }}
                        />

                        {/* Image + Crop Overlay */}
                        {imgUrl && cropOverlay ? (
                            <div
                                className="relative z-10"
                                style={{ width: cropOverlay.previewWidth, height: cropOverlay.previewHeight }}
                            >
                                <img src={imgUrl} alt="To crop" className="w-full h-full object-contain" />

                                {/* Dark overlay outside crop area — show whenever crop ≠ source */}
                                {(outputW !== sourceW || outputH !== sourceH) && (cropOverlay.x > 0.5 || cropOverlay.y > 0.5) && (
                                    <>
                                        {/* Top */}
                                        <div className="absolute bg-black/50 left-0 right-0 top-0" style={{ height: cropOverlay.y }} />
                                        {/* Bottom */}
                                        <div className="absolute bg-black/50 left-0 right-0 bottom-0" style={{ height: cropOverlay.y }} />
                                        {/* Left */}
                                        <div className="absolute bg-black/50 left-0" style={{ top: cropOverlay.y, width: cropOverlay.x, height: cropOverlay.height }} />
                                        {/* Right */}
                                        <div className="absolute bg-black/50 right-0" style={{ top: cropOverlay.y, width: cropOverlay.x, height: cropOverlay.height }} />
                                        {/* Dashed crop border */}
                                        <div
                                            className="absolute border-2 border-dashed border-[#E1E476]"
                                            style={{
                                                left: cropOverlay.x,   top: cropOverlay.y,
                                                width: cropOverlay.width, height: cropOverlay.height,
                                            }}
                                        />
                                    </>
                                )}
                            </div>
                        ) : imgUrl ? (
                            <img src={imgUrl} alt="To crop" className="relative z-10 w-full h-full object-contain" />
                        ) : (
                            <div className="text-gray-500 text-sm z-10">Connect an image to crop</div>
                        )}
                    </div>

                    {/* ── Controls ──────────────────────────────────────── */}
                    <div className="space-y-3">

                        {/* Aspect Ratio Dropdown */}
                        <div className="flex items-center justify-between">
                            <span className="text-[#9CA3AF] text-[13px]">Aspect ratio</span>
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <button
                                        className="flex items-center justify-between w-[140px] bg-[#1C1C1E] border border-[#2C2C2E] rounded px-2 py-1 text-white text-[13px] hover:border-[#3C3C3E] transition-colors"
                                        onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
                                    >
                                        <span>{currentRatioLabel}</span>
                                        <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isDropdownOpen && (
                                        <div className="absolute top-full left-0 mt-1 w-[140px] bg-[#1C1C1E] border border-[#2C2C2E] rounded shadow-xl z-50">
                                            {ASPECT_RATIOS.map((ar) => (
                                                <button
                                                    key={ar.value}
                                                    className={`w-full text-left px-2 py-1.5 text-[13px] hover:bg-[#2B2B2F] transition-colors
                                                        ${aspectRatio === ar.value ? 'text-[#E1E476]' : 'text-white'}`}
                                                    onClick={(e) => { e.stopPropagation(); handleAspectRatioChange(ar.value); }}
                                                >
                                                    {ar.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="text-white text-[13px] hover:text-gray-200 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                                >
                                    Reset
                                </button>
                            </div>
                        </div>

                        {/* Dimensions (W × H) */}
                        <div className="flex items-center justify-between">
                            <span className="text-[#9CA3AF] text-[13px]">Dimensions</span>
                            <div className="flex items-center gap-2">
                                {/* Width */}
                                <div className="flex items-center w-[72px] bg-[#1C1C1E] border border-[#2C2C2E] rounded px-2 py-1">
                                    <span className="text-[#6B7280] text-[10px] mr-1">W</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={editingW !== null ? editingW : String(outputW)}
                                        onFocus={(e) => { setEditingW(String(outputW)); e.target.select(); }}
                                        onChange={(e) => {
                                            const v = e.target.value.replace(/[^0-9]/g, '');
                                            setEditingW(v);
                                            if (v && parseInt(v, 10) > 0) handleWidthChange(v);
                                        }}
                                        onBlur={() => {
                                            if (!editingW || parseInt(editingW, 10) <= 0) setEditingW(null);
                                            else setEditingW(null);
                                        }}
                                        onKeyDown={(e) => {
                                            e.stopPropagation();
                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-transparent text-white text-[12px] focus:outline-none"
                                    />
                                </div>

                                {/* Height */}
                                <div className="flex items-center w-[72px] bg-[#1C1C1E] border border-[#2C2C2E] rounded px-2 py-1">
                                    <span className="text-[#6B7280] text-[10px] mr-1">H</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={editingH !== null ? editingH : String(outputH)}
                                        onFocus={(e) => { setEditingH(String(outputH)); e.target.select(); }}
                                        onChange={(e) => {
                                            const v = e.target.value.replace(/[^0-9]/g, '');
                                            setEditingH(v);
                                            if (v && parseInt(v, 10) > 0) handleHeightChange(v);
                                        }}
                                        onBlur={() => {
                                            if (!editingH || parseInt(editingH, 10) <= 0) setEditingH(null);
                                            else setEditingH(null);
                                        }}
                                        onKeyDown={(e) => {
                                            e.stopPropagation();
                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-transparent text-white text-[12px] focus:outline-none"
                                    />
                                </div>

                                {/* Link toggle */}
                                <button
                                    className={`p-1 rounded transition-colors border ${linkedDims ? 'border-[#E1E476] bg-[#E1E476]/10' : 'border-[#2C2C2E] hover:bg-[#2C2C2E]'}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (linkedDims) {
                                            // Unlinking → save current ratio, switch to custom
                                            setPreviousRatio(aspectRatio);
                                            setLinkedDims(false);
                                            updateNodeData(id, { aspectRatio: 'custom' });
                                        } else {
                                            // Re-linking → restore saved ratio & recalculate dims
                                            setLinkedDims(true);
                                            const ratioToRestore = previousRatio && previousRatio !== 'custom' ? previousRatio : detectAspectRatio(outputW, outputH);
                                            const sw = sourceW || 1024;
                                            const sh = sourceH || 1024;
                                            const dims = calculateDimensions(sw, sh, ratioToRestore);
                                            // Scale to keep close to the current size
                                            const scale = Math.min(outputW / dims.width, outputH / dims.height, 1);
                                            const newW = Math.round(dims.width * scale);
                                            const newH = Math.round(dims.height * scale);
                                            updateNodeData(id, {
                                                aspectRatio: ratioToRestore,
                                                outputWidth: newW,
                                                outputHeight: newH,
                                                widthPercent: Math.round((newW / sw) * 100),
                                                heightPercent: Math.round((newH / sh) * 100),
                                                xPercent: Math.round(((sw - newW) / 2 / sw) * 100),
                                                yPercent: Math.round(((sh - newH) / 2 / sh) * 100),
                                            });
                                        }
                                    }}
                                    title={linkedDims ? 'Dimensions linked' : 'Dimensions unlinked'}
                                >
                                    <LinkIcon className={`w-3 h-3 ${linkedDims ? 'text-[#E1E476]' : 'text-[#6B7280]'}`} />
                                </button>
                            </div>
                        </div>

                        {/* Source info (small helper text) */}
                        {sourceW > 0 && sourceH > 0 && (
                            <div className="text-[11px] text-gray-600 text-right">
                                Source: {sourceW} × {sourceH}px
                            </div>
                        )}
                    </div>

                    {/* ── Output Result ─────────────────────────────────── */}
                    {hasOutput && output && (
                        <div className="mt-4 space-y-2">
                            <span className="text-[#34D399] text-[12px] uppercase tracking-wider">✓ Cropped Result</span>
                            <div className="relative rounded-lg overflow-hidden bg-[#1A1A1D] border border-[#2C2C2E]">
                                <img src={output} alt="Cropped result" className="w-full h-auto max-h-[200px] object-contain" />
                            </div>
                            <p className="text-[11px] text-gray-500 truncate" title={output}>
                                {output.substring(0, 60)}...
                            </p>
                        </div>
                    )}

                    {/* ── Error ─────────────────────────────────────────── */}
                    {error && (
                        <div className="mt-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                            <p className="text-xs text-red-400">{error}</p>
                        </div>
                    )}
                </div>
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

export const CropImageNode = memo(CropImageNodeComponent);
