'use client';

import { memo } from 'react';
import {
    EdgeProps,
    getBezierPath,
} from '@xyflow/react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { CONNECTOR_COLORS, getEdgeColor } from '@/lib/connector-colors';

function CustomEdgeComponent({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
    sourceHandleId,
}: EdgeProps) {
    // Derive color from source node type when data.color is not set (e.g. template edges)
    const derivedColor = useWorkflowStore((s) => {
        if (data?.color) return data.color as string;
        const sourceNode = s.nodes.find((n) => n.id === source);
        if (sourceNode?.type) return getEdgeColor(sourceNode.type, sourceHandleId || 'output');
        return CONNECTOR_COLORS.pink;
    });
    const edgeColor = derivedColor;
    const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);
    const setSelectedEdgeId = useWorkflowStore((s) => s.setSelectedEdgeId);
    const isSelected = selected || selectedEdgeId === id;

    // Reactively check if either connected node is executing
    const isFlowing = useWorkflowStore((s) => {
        const sourceNode = s.nodes.find((n) => n.id === source);
        const targetNode = s.nodes.find((n) => n.id === target);
        return sourceNode?.data?.status === 'running' || targetNode?.data?.status === 'running';
    });

    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
    });

    const strokeWidth = isSelected ? 7 : 4;
    const dotRadius = 5;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedEdgeId(id);
    };

    return (
        <g onClick={handleClick} style={{ cursor: 'pointer' }}>
            {/* Invisible fat path for easier clicking */}
            <path
                d={edgePath}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
                style={{ cursor: 'pointer' }}
            />

            {/* Visible edge path — animated only when nodes are running */}
            <path
                d={edgePath}
                fill="none"
                stroke={edgeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={isFlowing ? '8 4' : 'none'}
                style={{
                    transition: 'stroke-width 0.15s ease',
                    filter: isSelected ? `drop-shadow(0 0 6px ${edgeColor}80)` : 'none',
                    animation: isFlowing ? 'dash-flow 0.6s linear infinite' : 'none',
                }}
            />

            {/* Source dot (ring with inner dot) */}
            <circle
                cx={sourceX}
                cy={sourceY}
                r={8}
                fill="none"
                stroke={edgeColor}
                strokeWidth={3}
            />
            <circle
                cx={sourceX}
                cy={sourceY}
                r={3}
                fill={edgeColor}
            />

            {/* Target dot (ring with inner dot) */}
            <circle
                cx={targetX}
                cy={targetY}
                r={8}
                fill="none"
                stroke={edgeColor}
                strokeWidth={3}
            />
            <circle
                cx={targetX}
                cy={targetY}
                r={3}
                fill={edgeColor}
            />
        </g>
    );
}

export const CustomEdge = memo(CustomEdgeComponent);
