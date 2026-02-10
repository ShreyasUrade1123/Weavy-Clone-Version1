'use client';

import { memo } from 'react';
import {
    EdgeProps,
    getBezierPath,
    useReactFlow,
} from '@xyflow/react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { CONNECTOR_COLORS } from '@/lib/connector-colors';

function CustomEdgeComponent({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
}: EdgeProps) {
    const edgeColor = (data?.color as string) || CONNECTOR_COLORS.pink;
    const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);
    const setSelectedEdgeId = useWorkflowStore((s) => s.setSelectedEdgeId);
    const isSelected = selected || selectedEdgeId === id;

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

            {/* Visible edge path */}
            <path
                d={edgePath}
                fill="none"
                stroke={edgeColor}
                strokeWidth={strokeWidth}
                style={{
                    transition: 'stroke-width 0.15s ease',
                    filter: isSelected ? `drop-shadow(0 0 6px ${edgeColor}80)` : 'none',
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
