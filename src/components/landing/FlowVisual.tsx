'use client';

import { motion } from 'framer-motion';

// Node Component for consistent styling
const FlowNode = ({
    title,
    subtitle,
    children,
    className,
    width = 300,
    hasInput = true,
    hasOutput = true
}: {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
    className?: string;
    width?: number;
    hasInput?: boolean;
    hasOutput?: boolean;
}) => (
    <div
        className={`absolute bg-[#EAEAEA] rounded-3xl p-4 shadow-xl border border-white/50 backdrop-blur-sm ${className}`}
        style={{ width }}
    >
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold tracking-widest text-black/50 uppercase">
                {subtitle}
            </span>
            <span className="text-[10px] font-bold tracking-widest text-black uppercase">
                {title}
            </span>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-inner relative group">
            {children}

            {/* Handles */}
            {hasInput && (
                <div className="absolute top-1/2 -left-5 w-3 h-3 bg-white border-2 border-[#EAEAEA] rounded-full transform -translate-y-1/2 shadow-sm z-20" />
            )}
            {hasOutput && (
                <div className="absolute top-1/2 -right-5 w-3 h-3 bg-white border-2 border-[#EAEAEA] rounded-full transform -translate-y-1/2 shadow-sm z-20" />
            )}
        </div>
    </div>
);

// SVGCurve for connections
const Connection = ({ start, end }: { start: { x: number, y: number }, end: { x: number, y: number } }) => {
    const midX = (start.x + end.x) / 2;
    const path = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;

    return (
        <path
            d={path}
            fill="none"
            stroke="#D4D4D4"
            strokeWidth="1.5"
            className="drop-shadow-sm"
        />
    );
};

export function FlowVisual() {
    return (
        <div className="relative w-full h-[800px] overflow-hidden bg-transparent mt-[-100px] z-0">
            <div className="absolute inset-0 max-w-[1920px] mx-auto scale-[0.85] origin-top md:scale-100">
                {/* SVG Layer for Connections */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    {/* 3D -> Image */}
                    <Connection start={{ x: 350, y: 300 }} end={{ x: 550, y: 450 }} />
                    {/* Color -> Image */}
                    <Connection start={{ x: 350, y: 650 }} end={{ x: 550, y: 450 }} />
                    {/* Image -> Text (Input) */}
                    <Connection start={{ x: 800, y: 450 }} end={{ x: 950, y: 350 }} />
                    {/* Text -> Video */}
                    <Connection start={{ x: 1250, y: 350 }} end={{ x: 1400, y: 450 }} />
                    {/* Flux -> Video */}
                    <Connection start={{ x: 1250, y: 650 }} end={{ x: 1400, y: 450 }} />
                </svg>

                {/* 1. 3D Node (Top Left) */}
                <FlowNode
                    title="RODIN 2.0"
                    subtitle="3D"
                    className="top-[100px] left-[100px]"
                    width={220}
                    hasInput={false}
                >
                    <div className="h-[220px] bg-gradient-to-b from-gray-200 to-gray-300 flex items-center justify-center">
                        <span className="text-4xl">🗿</span>
                    </div>
                </FlowNode>

                {/* 2. Color Ref (Bottom Left) */}
                <FlowNode
                    title="REFERENCE"
                    subtitle="COLOR"
                    className="top-[500px] left-[50px]"
                    width={280}
                    hasInput={false}
                >
                    <div className="h-[140px] bg-gradient-to-r from-blue-900 via-purple-900 to-orange-200" />
                </FlowNode>

                {/* 3. Stable Diffusion (Center Left - Large) */}
                <FlowNode
                    title="STABLE DIFFUSION"
                    subtitle="IMAGE"
                    className="top-[150px] left-[520px] z-10"
                    width={320}
                >
                    <div className="h-[400px] bg-gray-100 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-purple-100/50" />
                        {/* Placeholder for portrait */}
                        <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">👤</div>
                    </div>
                </FlowNode>

                {/* 4. Text Node (Center Right - Small) */}
                <FlowNode
                    title=""
                    subtitle="TEXT"
                    className="top-[250px] left-[900px]"
                    width={300}
                >
                    <div className="p-6 bg-white min-h-[120px] flex items-center">
                        <p className="text-[11px] leading-relaxed text-gray-500 font-mono">
                            a Great-Tailed Grackle bird is flying from the background and seating on the model's shoulder slowly and barely moves. the model looks at the camera. then bird flies away. cinematic.
                        </p>
                    </div>
                </FlowNode>

                {/* 5. Flux Pro (Bottom Center) */}
                <FlowNode
                    title="FLUX PRO 1.1"
                    subtitle="IMAGE"
                    className="top-[550px] left-[950px]"
                    width={240}
                >
                    <div className="h-[300px] bg-gray-800 relative overflow-hidden">
                        {/* Placeholder for bird */}
                        <div className="w-full h-full flex items-center justify-center text-4xl">🐦‍⬛</div>
                    </div>
                </FlowNode>

                {/* 6. MiniMax Video (Far Right - Large) */}
                <FlowNode
                    title="MINIMAX VIDEO"
                    subtitle="VIDEO"
                    className="top-[100px] left-[1350px]"
                    width={380}
                    hasOutput={false}
                >
                    <div className="h-[500px] bg-gray-100 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-purple-200/30 to-blue-200/30" />
                        {/* Placeholder for final video */}
                        <div className="w-full h-full flex items-center justify-center text-7xl opacity-20">🎥</div>
                    </div>
                </FlowNode>

            </div>
        </div>
    );
}
