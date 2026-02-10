// Connector color mapping by node type and handle ID

export const CONNECTOR_COLORS = {
    pink: '#F2A0FB',
    green: '#6FDDB3',
    red: '#EF9192',
} as const;

/**
 * Get the connector color for a specific node type and handle.
 * This is the single source of truth for all connector colors.
 */
export function getConnectorColor(nodeType: string, handleId?: string): string {
    switch (nodeType) {
        case 'text':
            return CONNECTOR_COLORS.pink;

        case 'uploadImage':
            return CONNECTOR_COLORS.green;

        case 'cropImage':
            return CONNECTOR_COLORS.green;

        case 'extractFrame':
            // Input (video_url) = red, Output = green
            if (handleId === 'video_url') return CONNECTOR_COLORS.red;
            return CONNECTOR_COLORS.green;

        case 'uploadVideo':
            return CONNECTOR_COLORS.red;

        case 'llm':
            // LLM has per-handle colors managed internally by LLMNode
            // For edges, use the source node's color
            if (handleId === 'output') return CONNECTOR_COLORS.pink;
            if (handleId === 'system_prompt') return CONNECTOR_COLORS.pink;
            if (handleId === 'user_message') return '#A855F7'; // purple
            if (handleId === 'images') return '#10B981'; // green
            return CONNECTOR_COLORS.pink;

        default:
            return CONNECTOR_COLORS.pink;
    }
}

/**
 * Get the edge color based on the source node's type and handle.
 * Edges inherit their color from the source (output) connector.
 */
export function getEdgeColor(sourceNodeType: string, sourceHandleId?: string): string {
    return getConnectorColor(sourceNodeType, sourceHandleId);
}
