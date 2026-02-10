import { Node, Edge } from '@xyflow/react';
import { WorkflowNodeData } from '@/types/nodes';

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    nodes: Node<WorkflowNodeData>[];
    edges: Edge[];
}

export const PRODUCT_MARKETING_KIT: WorkflowTemplate = {
    id: 'product-marketing-kit',
    name: 'Product Marketing Kit Generator',
    description: 'Demonstrates parallel execution with image processing and LLM generation',

    nodes: [
        // Row 1: System Prompt (top-left) - matches node_1770703277498_exg900m47
        {
            id: 'text-system-1',
            type: 'text',
            position: { x: 224, y: 544 },
            data: {
                label: 'System Prompt',
                text: 'You are a professional marketing copywriter. Generate a compelling one-paragraph product description based on the image.',
                output: 'You are a professional marketing copywriter. Generate a compelling one-paragraph product description based on the image.',
                status: 'idle',
            } as WorkflowNodeData,
        },

        // Row 2: Upload Image (left) - matches node_1770705998501_klxnyjk2a
        {
            id: 'upload-image-1',
            type: 'uploadImage',
            position: { x: 160, y: 896 },
            data: {
                label: 'Upload Product Photo',
                imageUrl: '/Zeb-Duke-pic-1.webp',
                fileName: 'Zeb-Duke-pic-1.webp',
                status: 'idle',
            } as WorkflowNodeData,
        },

        // Row 2: Product Details (middle) - matches node_1770712086406_cc6yw71yb
        {
            id: 'text-details-1',
            type: 'text',
            position: { x: 704, y: 848 },
            data: {
                label: 'Product Details',
                text: 'Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.',
                output: 'Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.',
                status: 'idle',
            } as WorkflowNodeData,
        },

        // Row 2: LLM Description (right) - matches node_1770709873338_5k8uuk9cv
        {
            id: 'llm-description',
            type: 'llm',
            position: { x: 1312, y: 816 },
            data: {
                label: 'Generate Product Description',
                model: 'gemini-2.0-flash',
                status: 'idle',
            } as WorkflowNodeData,
        },

        // Row 3: Crop Image (middle-left) - matches node_1770703305598_qx0jg3y06
        {
            id: 'crop-image-1',
            type: 'cropImage',
            position: { x: 704, y: 1184 },
            data: {
                label: 'Crop Product Image',
                xPercent: 10,
                yPercent: 10,
                widthPercent: 80,
                heightPercent: 80,
                status: 'idle',
            } as WorkflowNodeData,
        },

        // Row 3: Social Media Prompt (middle-right) - matches node_1770712302524_kjq34byt4
        {
            id: 'text-system-2',
            type: 'text',
            position: { x: 1328, y: 1376 },
            data: {
                label: 'Social Media Prompt',
                text: 'You are a social media manager. Create a tweet-length marketing post based on the product image and video frame.',
                output: 'You are a social media manager. Create a tweet-length marketing post based on the product image and video frame.',
                status: 'idle',
            } as WorkflowNodeData,
        },

        // Row 4: Upload Video (bottom-left) - matches node_1770706098561_vljgyvwxp
        {
            id: 'upload-video-1',
            type: 'uploadVideo',
            position: { x: 416, y: 1808 },
            data: {
                label: 'Upload Product Demo Video',
                videoUrl: '/Product_Demo_Video_Generated.mp4',
                fileName: 'Product_Demo_Video_Generated.mp4',
                status: 'idle',
            } as WorkflowNodeData,
        },

        // Row 4: Extract Frame (bottom-middle) - matches node_1770712294818_xa5rbbn7n
        {
            id: 'extract-frame-1',
            type: 'extractFrame',
            position: { x: 1168, y: 1808 },
            data: {
                label: 'Extract Frame at 50%',
                timestamp: '50%',
                status: 'idle',
            } as WorkflowNodeData,
        },

        // Row 4: Final LLM (bottom-right) - matches node_1770713326406_x90b8xluk
        {
            id: 'llm-final',
            type: 'llm',
            position: { x: 2176, y: 1632 },
            data: {
                label: 'Generate Marketing Post',
                model: 'gemini-2.0-flash',
                status: 'idle',
            } as WorkflowNodeData,
        },
    ],

    edges: [
        // Branch A connections
        { id: 'e1', source: 'upload-image-1', target: 'crop-image-1', sourceHandle: 'output', targetHandle: 'image_url' },
        { id: 'e2', source: 'text-system-1', target: 'llm-description', sourceHandle: 'output', targetHandle: 'system_prompt' },
        { id: 'e3', source: 'text-details-1', target: 'llm-description', sourceHandle: 'output', targetHandle: 'user_message' },
        { id: 'e4', source: 'crop-image-1', target: 'llm-description', sourceHandle: 'output', targetHandle: 'images' },

        // Branch B connections
        { id: 'e5', source: 'upload-video-1', target: 'extract-frame-1', sourceHandle: 'output', targetHandle: 'video_url' },

        // Convergence connections
        { id: 'e6', source: 'text-system-2', target: 'llm-final', sourceHandle: 'output', targetHandle: 'system_prompt' },
        { id: 'e7', source: 'llm-description', target: 'llm-final', sourceHandle: 'output', targetHandle: 'user_message' },
        { id: 'e8', source: 'crop-image-1', target: 'llm-final', sourceHandle: 'output', targetHandle: 'images' },
        { id: 'e9', source: 'extract-frame-1', target: 'llm-final', sourceHandle: 'output', targetHandle: 'images' },
    ],
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
    PRODUCT_MARKETING_KIT,
];
