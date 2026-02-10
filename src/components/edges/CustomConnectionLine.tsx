'use client';

import { ConnectionLineComponentProps, getBezierPath, Position } from '@xyflow/react';
import { useReactFlow } from '@xyflow/react';
import { getConnectorColor } from '@/lib/connector-colors';

export function CustomConnectionLine({
    fromX,
    fromY,
    toX,
    toY,
    fromPosition,
    toPosition,
    fromHandle,
    fromNode,
}: ConnectionLineComponentProps) {
    // Determine color from the source node type and handle
    const nodeType = fromNode?.type || 'text';
    const handleId = fromHandle?.id || 'output';
    const color = getConnectorColor(nodeType, handleId);

    const [path] = getBezierPath({
        sourceX: fromX,
        sourceY: fromY,
        targetX: toX,
        targetY: toY,
        sourcePosition: fromPosition || Position.Right,
        targetPosition: toPosition || Position.Left,
    });

    return (
        <g>
            {/* Connection line */}
            <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={4}
                style={{ opacity: 0.85 }}
            />

            {/* Source end ring + dot */}
            <circle
                cx={fromX}
                cy={fromY}
                r={8}
                fill="none"
                stroke={color}
                strokeWidth={3}
            />
            <circle
                cx={fromX}
                cy={fromY}
                r={3}
                fill={color}
            />

            {/* Cursor end dot */}
            <circle
                cx={toX}
                cy={toY}
                r={5}
                fill={color}
            />
        </g>
    );
}
