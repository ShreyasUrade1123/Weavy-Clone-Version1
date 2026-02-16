'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { WorkflowCanvas } from '@/components/workflow';
import { WorkflowHeader } from '@/components/workflow/WorkflowHeader';
import IconSidebar from '@/components/workflow/Sidebar/IconSidebar';
import NodeSidebar from '@/components/workflow/Sidebar/NodeSidebar';
import PropertiesSidebar from '@/components/workflow/Sidebar/PropertiesSidebar';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useUIStore } from '@/stores/ui-store';
import { ChevronDown } from 'lucide-react';

export default function WorkflowEditorPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const workflowId = (params?.id as string[] | undefined)?.[0];
    const templateId = searchParams.get('template');
    const [isLoaded, setIsLoaded] = useState(false);
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const { isHistoryOpen, setHistoryOpen } = useUIStore();

    const nodes = useWorkflowStore((state) => state.nodes);
    const edges = useWorkflowStore((state) => state.edges);
    const workflowName = useWorkflowStore((state) => state.workflowName);
    const setWorkflowName = useWorkflowStore((state) => state.setWorkflowName);
    const setWorkflow = useWorkflowStore((state) => state.setWorkflow);
    const setNodeStatus = useWorkflowStore((state) => state.setNodeStatus);
    const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
    const loadWorkflow = useWorkflowStore((state) => state.loadWorkflow);
    const saveWorkflow = useWorkflowStore((state) => state.saveWorkflow);

    // Local state for the canvas name input
    const [localName, setLocalName] = useState(workflowName);

    useEffect(() => {
        setLocalName(workflowName);
    }, [workflowName]);

    const handleNameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            setWorkflowName(localName);
            (e.target as HTMLInputElement).blur();
            handleSave();
        }
    };

    const handleNameBlur = () => {
        if (localName !== workflowName) {
            setWorkflowName(localName);
            handleSave();
        }
    };

    // Toggle sidebar sections
    const handleSectionClick = (section: string) => {
        if (activeSection === section) {
            setActiveSection(null);
        } else {
            setActiveSection(section);
        }
    };

    // Load workflow if editing existing
    useEffect(() => {
        const load = async () => {
            if (workflowId && workflowId !== 'new') {
                try {
                    await loadWorkflow(workflowId);
                } catch (error) {
                    console.error('Failed to load workflow:', error);
                }
            }
            setIsLoaded(true);
        };

        load();
    }, [workflowId, loadWorkflow]);

    // Handle workflow save
    const handleSave = useCallback(async () => {
        try {
            await saveWorkflow();
        } catch (error) {
            console.error('Failed to save workflow:', error);
        }
    }, [saveWorkflow]);

    // Auto-save on changes
    useEffect(() => {
        if (!isLoaded) return; // Don't auto-save during initial load

        const timer = setTimeout(() => {
            saveWorkflow().catch(console.error);
        }, 2000); // Debounce 2 seconds

        return () => clearTimeout(timer);
    }, [nodes, edges, workflowName, isLoaded, saveWorkflow]);

    // Handle workflow run
    const handleRun = useCallback(async (scope: 'full' | 'selected' | 'single') => {
        const selectedNodeIds = useWorkflowStore.getState().selectedNodeIds;

        // Set all nodes to running
        const nodesToRun = scope === 'full'
            ? nodes
            : nodes.filter(n => selectedNodeIds.includes(n.id));

        nodesToRun.forEach(node => {
            setNodeStatus(node.id, 'running');
        });

        try {
            const response = await fetch('/api/workflows/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workflowId: workflowId || 'temp',
                    nodes,
                    edges,
                    scope: scope === 'full' ? 'FULL' : scope === 'single' ? 'SINGLE' : 'PARTIAL',
                    nodeIds: scope !== 'full' ? selectedNodeIds : undefined,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to execute workflow');
            }

            const result = await response.json();

            // Update node statuses based on results
            result.results?.forEach((nodeResult: { nodeId: string; status: string; output?: unknown; error?: string }) => {
                const status = nodeResult.status === 'SUCCESS' ? 'success' : 'error';
                setNodeStatus(nodeResult.nodeId, status, nodeResult.output, nodeResult.error);

                // Update node data with output/response
                if (nodeResult.output !== undefined) {
                    const node = nodes.find(n => n.id === nodeResult.nodeId);
                    if (node) {
                        if (node.type === 'llm') {
                            updateNodeData(nodeResult.nodeId, { response: nodeResult.output as string });
                        } else {
                            updateNodeData(nodeResult.nodeId, { output: nodeResult.output });
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Workflow execution failed:', error);
            // Set all running nodes to error
            nodesToRun.forEach(node => {
                setNodeStatus(node.id, 'error', undefined, 'Execution failed');
            });
        }
    }, [workflowId, nodes, edges, setNodeStatus, updateNodeData]);

    // Handle export
    const handleExport = useCallback(() => {
        const workflow = {
            name: workflowName,
            nodes,
            edges,
            version: '1.0',
            createdAt: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [workflowName, nodes, edges]);

    // Handle import
    const handleImport = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const workflow = JSON.parse(text);

                if (!workflow.nodes || !workflow.edges) {
                    alert('Invalid workflow file');
                    return;
                }

                setWorkflow(
                    workflowId || 'temp',
                    workflow.name || 'Imported Workflow',
                    workflow.nodes,
                    workflow.edges
                );

                await handleSave();
            } catch (error) {
                console.error('Import failed:', error);
                alert('Failed to import workflow');
            }
        };
        input.click();
    }, [workflowId, setWorkflow, handleSave]);

    if (!isLoaded) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#0E0E10]">
                <div className="text-white">Loading...</div>
            </div>
        );
    }

    const isSidebarOpen = activeSection !== null;

    return (
        <div className="h-screen flex bg-[#0E0E10] overflow-hidden">
            {/* Left Sidebars */}
            <IconSidebar
                activeSection={activeSection}
                onSectionClick={handleSectionClick}
            />
            <NodeSidebar
                isOpen={isSidebarOpen}
                onClose={() => setActiveSection(null)}
                onRename={handleSave}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Header is now handled by WorkflowHeader component */}
                <WorkflowHeader
                    workflowId={workflowId}
                    onRun={handleRun}
                    onSave={handleSave}
                />

                {/* Canvas */}
                <WorkflowCanvas />
            </div>

            {/* Properties Sidebar (Right) */}
            <PropertiesSidebar />
        </div>
    );
}
