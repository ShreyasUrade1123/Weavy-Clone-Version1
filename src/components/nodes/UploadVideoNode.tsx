'use client';

import { memo, useCallback, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Upload, X, MoreHorizontal, Loader2 } from 'lucide-react';
import { UploadVideoNodeData } from '@/types/nodes';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useDropzone } from 'react-dropzone';

function UploadVideoNodeComponent({ id, data, selected }: NodeProps) {
    const nodeData = data as UploadVideoNodeData;
    const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
    const isExecuting = nodeData.status === 'running';
    const [isUploading, setIsUploading] = useState(false);

    const uploadToTransloadit = async (file: File): Promise<string> => {
        // Get signed params from our API
        const paramsResponse = await fetch('/api/upload/params', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'video' }),
        });

        const { params, signature } = await paramsResponse.json();

        // Create form data for Transloadit
        const formData = new FormData();
        formData.append('params', params);
        formData.append('signature', signature);
        formData.append('file', file);

        // Upload to Transloadit
        const uploadResponse = await fetch('https://api2.transloadit.com/assemblies', {
            method: 'POST',
            body: formData,
        });

        const assembly = await uploadResponse.json();

        if (assembly.error) {
            throw new Error(assembly.message || 'Upload failed');
        }

        // Poll for completion
        let result = assembly;
        while (result.ok !== 'ASSEMBLY_COMPLETED') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const pollResponse = await fetch(result.assembly_ssl_url);
            result = await pollResponse.json();

            if (result.error) {
                throw new Error(result.message || 'Processing failed');
            }
        }

        // Return the video URL
        if (result.results[':original'] && result.results[':original'].length > 0) {
            return result.results[':original'][0].ssl_url;
        }

        throw new Error('No upload result');
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        const file = acceptedFiles[0];
        setIsUploading(true);

        try {
            // Try Transloadit upload
            const videoUrl = await uploadToTransloadit(file);

            updateNodeData(id, {
                videoUrl,
                fileName: file.name,
                output: videoUrl,
                status: 'success',
            });
        } catch (error) {
            console.error('Upload failed, falling back to local:', error);

            // Fallback to local URL if Transloadit fails
            const localUrl = URL.createObjectURL(file);
            updateNodeData(id, {
                videoUrl: localUrl,
                fileName: file.name,
                output: localUrl,
                status: 'success',
            });
        } finally {
            setIsUploading(false);
        }
    }, [id, updateNodeData]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'video/*': ['.mp4', '.mov', '.webm', '.m4v'],
        },
        maxFiles: 1,
        disabled: isExecuting || isUploading,
    });

    const clearVideo = () => {
        updateNodeData(id, {
            videoUrl: undefined,
            fileName: undefined,
            output: undefined,
            status: 'idle',
        });
    };

    return (
        <div
            className={`
                bg-[#1C1C1E] rounded-2xl border min-w-[320px] max-w-[400px] shadow-xl transition-all
                ${selected ? 'border-[#E1E476]' : 'border-[#2C2C2E]'}
                ${isExecuting ? 'ring-2 ring-[#E1E476]/50' : ''}
                ${nodeData.status === 'error' ? 'border-red-500' : ''}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2C2C2E]">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white text-[10px] font-bold">
                        Vi
                    </div>
                    <span className="font-medium text-gray-200 text-sm">Upload Video</span>
                </div>
                <button className="text-gray-500 hover:text-white transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="p-4">
                {isUploading ? (
                    <div className="border border-dashed border-[#2C2C2E] rounded-xl p-8 text-center bg-[#0E0E10]">
                        <div className="w-10 h-10 rounded-full bg-[#1C1C1E] flex items-center justify-center mx-auto mb-3">
                            <Loader2 className="w-5 h-5 text-[#E1E476] animate-spin" />
                        </div>
                        <p className="text-sm text-gray-300 font-medium">Uploading...</p>
                        <p className="text-[10px] text-gray-500 mt-1">Processing with Transloadit</p>
                    </div>
                ) : nodeData.videoUrl ? (
                    <div className="relative group">
                        <video
                            src={nodeData.videoUrl}
                            controls
                            className="w-full h-40 object-cover rounded-lg border border-[#2C2C2E] bg-black"
                        />
                        <button
                            onClick={clearVideo}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <p className="text-xs text-gray-400 mt-2 truncate">{nodeData.fileName}</p>
                    </div>
                ) : (
                    <div
                        {...getRootProps()}
                        className={`
                            border border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors bg-[#0E0E10]
                            ${isDragActive ? 'border-pink-500 bg-pink-500/5' : 'border-[#2C2C2E] hover:border-gray-500'}
                        `}
                    >
                        <input {...getInputProps()} />
                        <div className="w-10 h-10 rounded-full bg-[#1C1C1E] flex items-center justify-center mx-auto mb-3">
                            <Upload className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-300 font-medium">
                            {isDragActive ? 'Drop video here' : 'Click or drop video'}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">MP4, MOV</p>
                    </div>
                )}
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                id="output"
                className="!w-3 !h-3 !bg-[#EC4899] !border-2 !border-[#1C1C1E]"
            />
        </div>
    );
}

export const UploadVideoNode = memo(UploadVideoNodeComponent);
