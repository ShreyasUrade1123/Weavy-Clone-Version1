import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react';
import { WorkflowNodeData, NodeType, NODE_CONFIG } from '@/types/nodes';
import { getEdgeColor } from '@/lib/connector-colors';

// History state for undo/redo
interface HistoryState {
    nodes: Node<WorkflowNodeData>[];
    edges: Edge[];
}

interface WorkflowState {
    // Core state
    workflowId: string | null;
    workflowName: string;
    nodes: Node<WorkflowNodeData>[];
    edges: Edge[];

    // Selection state
    selectedNodeIds: string[];
    selectedEdgeId: string | null;

    // Execution state
    isExecuting: boolean;
    executingNodeIds: string[];

    // History for undo/redo
    history: HistoryState[];
    historyIndex: number;

    // Actions
    setWorkflow: (id: string, name: string, nodes: Node<WorkflowNodeData>[], edges: Edge[]) => void;
    setWorkflowName: (name: string) => void;

    // Node actions
    addNode: (type: NodeType, position: { x: number; y: number }, initialData?: Partial<WorkflowNodeData>) => string;
    updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
    deleteNode: (nodeId: string) => void;
    onNodesChange: (changes: NodeChange[]) => void;

    // Edge actions
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    deleteEdge: (edgeId: string) => void;

    // Selection actions
    setSelectedNodeIds: (ids: string[]) => void;
    setSelectedEdgeId: (id: string | null) => void;
    clearSelection: () => void;

    // Execution actions
    setExecuting: (isExecuting: boolean) => void;
    setNodeExecuting: (nodeId: string, isExecuting: boolean) => void;
    setNodeStatus: (nodeId: string, status: 'idle' | 'running' | 'success' | 'error', output?: unknown, error?: string) => void;
    resetNodeStatuses: () => void;

    // History actions
    undo: () => void;
    redo: () => void;
    saveToHistory: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;

    // Workflow persistence
    createNewWorkflow: () => Promise<string>;
    duplicateWorkflow: () => Promise<string>;
    saveWorkflow: () => Promise<void>;
    loadWorkflow: (id: string) => Promise<void>;

    // Utility
    reset: () => void;
    getNodeById: (id: string) => Node<WorkflowNodeData> | undefined;
}

const generateNodeId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const initialState = {
    workflowId: null,
    workflowName: 'Untitled Workflow',
    nodes: [],
    edges: [],
    selectedNodeIds: [],
    selectedEdgeId: null,
    isExecuting: false,
    executingNodeIds: [],
    history: [],
    historyIndex: -1,
};

export const useWorkflowStore = create<WorkflowState>()(
    devtools(
        persist(
            (set, get) => ({
                ...initialState,

                setWorkflow: (id, name, nodes, edges) => {
                    set({
                        workflowId: id,
                        workflowName: name,
                        nodes,
                        edges,
                        history: [{ nodes, edges }],
                        historyIndex: 0,
                    });
                },

                setWorkflowName: (name) => set({ workflowName: name }),

                addNode: (type, position, initialData) => {
                    const config = NODE_CONFIG[type];
                    const newNodeId = generateNodeId();
                    const newNode: Node<WorkflowNodeData> = {
                        id: newNodeId,
                        type,
                        position,
                        data: {
                            label: config.label,
                            status: 'idle',
                            // Type-specific defaults
                            ...(type === 'text' && { text: '' }),
                            ...(type === 'uploadImage' && { imageUrl: undefined, fileName: undefined }),
                            ...(type === 'uploadVideo' && { videoUrl: undefined, fileName: undefined }),
                            ...(type === 'llm' && { model: 'groq:meta-llama/llama-4-scout-17b-16e-instruct', systemPrompt: '', userMessage: '', images: [], response: '' }),
                            ...(type === 'cropImage' && { imageUrl: undefined, xPercent: 0, yPercent: 0, widthPercent: 100, heightPercent: 100 }),
                            ...(type === 'extractFrame' && { videoUrl: undefined, timestamp: '0' }),
                            // Override with initial data
                            ...initialData,
                        } as WorkflowNodeData,
                    };

                    set((state) => ({ nodes: [...state.nodes, newNode] }));
                    get().saveToHistory();
                    return newNodeId;
                },

                updateNodeData: (nodeId, data) => {
                    set((state) => ({
                        nodes: state.nodes.map((node) =>
                            node.id === nodeId
                                ? { ...node, data: { ...node.data, ...data } }
                                : node
                        ),
                    }));
                },

                deleteNode: (nodeId) => {
                    set((state) => ({
                        nodes: state.nodes.filter((n) => n.id !== nodeId),
                        edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
                        selectedNodeIds: state.selectedNodeIds.filter((id) => id !== nodeId),
                    }));
                    get().saveToHistory();
                },

                onNodesChange: (changes) => {
                    set((state) => ({
                        nodes: applyNodeChanges(changes, state.nodes as unknown as Node[]) as unknown as Node<WorkflowNodeData>[],
                    }));
                },

                onEdgesChange: (changes) => {
                    set((state) => ({
                        edges: applyEdgeChanges(changes, state.edges),
                    }));
                },

                onConnect: (connection) => {
                    if (!connection.source || !connection.target) return;

                    // Look up source node type for edge color
                    const sourceNode = get().nodes.find(n => n.id === connection.source);
                    const sourceNodeType = sourceNode?.type || 'text';
                    const sourceHandleId = connection.sourceHandle || 'output';
                    const edgeColor = getEdgeColor(sourceNodeType, sourceHandleId);

                    const newEdge: Edge = {
                        id: `edge_${connection.source}_${connection.target}_${Date.now()}`,
                        source: connection.source,
                        target: connection.target,
                        sourceHandle: sourceHandleId,
                        targetHandle: connection.targetHandle || 'input',
                        type: 'default',
                        animated: false,
                        data: { color: edgeColor },
                    };

                    set((state) => ({
                        edges: addEdge(newEdge, state.edges),
                    }));
                    get().saveToHistory();
                },

                deleteEdge: (edgeId) => {
                    set((state) => ({
                        edges: state.edges.filter((e) => e.id !== edgeId),
                    }));
                    get().saveToHistory();
                },

                setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
                setSelectedEdgeId: (id) => set({ selectedEdgeId: id }),
                clearSelection: () => set({ selectedNodeIds: [], selectedEdgeId: null }),

                setExecuting: (isExecuting) => set({ isExecuting }),

                setNodeExecuting: (nodeId, isExecuting) => {
                    set((state) => ({
                        executingNodeIds: isExecuting
                            ? [...state.executingNodeIds, nodeId]
                            : state.executingNodeIds.filter((id) => id !== nodeId),
                    }));
                },

                setNodeStatus: (nodeId, status, output, error) => {
                    set((state) => ({
                        nodes: state.nodes.map((node) =>
                            node.id === nodeId
                                ? {
                                    ...node,
                                    data: {
                                        ...node.data,
                                        status,
                                        ...(output !== undefined && { output }),
                                        ...(error !== undefined && { error }),
                                    }
                                }
                                : node
                        ),
                    }));
                },

                resetNodeStatuses: () => {
                    set((state) => ({
                        nodes: state.nodes.map((node) => ({
                            ...node,
                            data: { ...node.data, status: 'idle' as const, error: undefined },
                        })),
                        executingNodeIds: [],
                    }));
                },

                saveToHistory: () => {
                    const { nodes, edges, history, historyIndex } = get();
                    const newHistory = history.slice(0, historyIndex + 1);
                    newHistory.push({ nodes: [...nodes], edges: [...edges] });

                    // Keep only last 50 history states
                    if (newHistory.length > 50) {
                        newHistory.shift();
                    }

                    set({
                        history: newHistory,
                        historyIndex: newHistory.length - 1,
                    });
                },

                undo: () => {
                    const { history, historyIndex } = get();
                    if (historyIndex > 0) {
                        const prevState = history[historyIndex - 1];
                        set({
                            nodes: prevState.nodes,
                            edges: prevState.edges,
                            historyIndex: historyIndex - 1,
                        });
                    }
                },

                redo: () => {
                    const { history, historyIndex } = get();
                    if (historyIndex < history.length - 1) {
                        const nextState = history[historyIndex + 1];
                        set({
                            nodes: nextState.nodes,
                            edges: nextState.edges,
                            historyIndex: historyIndex + 1,
                        });
                    }
                },

                canUndo: () => get().historyIndex > 0,
                canRedo: () => get().historyIndex < get().history.length - 1,

                reset: () => set(initialState),

                // Workflow persistence
                createNewWorkflow: async () => {
                    try {
                        const response = await fetch('/api/workflows', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: 'Untitled Workflow',
                                nodes: [],
                                edges: [],
                            }),
                        });

                        if (!response.ok) throw new Error('Failed to create workflow');

                        const { workflow } = await response.json();
                        set({
                            workflowId: workflow.id,
                            workflowName: workflow.name,
                            nodes: [],
                            edges: [],
                            history: [{ nodes: [], edges: [] }],
                            historyIndex: 0,
                        });

                        return workflow.id;
                    } catch (error) {
                        console.error('Error creating workflow:', error);
                        throw error;
                    }
                },

                duplicateWorkflow: async () => {
                    try {
                        const { workflowId, nodes, edges, workflowName } = get();
                        if (!workflowId || workflowId === 'temp') {
                            // Create new workflow with current state
                            const response = await fetch('/api/workflows', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    name: `${workflowName} (Copy)`,
                                    nodes,
                                    edges,
                                }),
                            });

                            if (!response.ok) throw new Error('Failed to duplicate workflow');
                            const { workflow } = await response.json();
                            return workflow.id;
                        }

                        // Duplicate existing workflow
                        const response = await fetch(`/api/workflows/${workflowId}/duplicate`, {
                            method: 'POST',
                        });

                        if (!response.ok) throw new Error('Failed to duplicate workflow');
                        const { workflow } = await response.json();
                        return workflow.id;
                    } catch (error) {
                        console.error('Error duplicating workflow:', error);
                        throw error;
                    }
                },

                saveWorkflow: async () => {
                    try {
                        const { workflowId, workflowName, nodes, edges } = get();

                        if (!workflowId || workflowId === 'temp') {
                            // Create new workflow
                            const response = await fetch('/api/workflows', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    name: workflowName,
                                    nodes,
                                    edges,
                                }),
                            });

                            if (!response.ok) throw new Error('Failed to save workflow');
                            const { workflow } = await response.json();
                            set({ workflowId: workflow.id });
                        } else {
                            // Update existing workflow
                            await fetch(`/api/workflows/${workflowId}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    name: workflowName,
                                    nodes,
                                    edges,
                                }),
                            });
                        }
                    } catch (error) {
                        console.error('Error saving workflow:', error);
                        throw error;
                    }
                },

                loadWorkflow: async (id: string) => {
                    try {
                        const response = await fetch(`/api/workflows/${id}`);
                        if (!response.ok) throw new Error('Failed to load workflow');

                        const { workflow } = await response.json();
                        set({
                            workflowId: workflow.id,
                            workflowName: workflow.name,
                            nodes: workflow.nodes || [],
                            edges: workflow.edges || [],
                            history: [{ nodes: workflow.nodes || [], edges: workflow.edges || [] }],
                            historyIndex: 0,
                        });
                    } catch (error) {
                        console.error('Error loading workflow:', error);
                        throw error;
                    }
                },

                getNodeById: (id) => get().nodes.find((n) => n.id === id),
            }),
            {
                name: 'weavy-workflow-store',
                partialize: (state) => ({
                    workflowId: state.workflowId,
                    workflowName: state.workflowName,
                    nodes: state.nodes,
                    edges: state.edges,
                }),
            }
        ),
        { name: 'WorkflowStore' }
    )
);
