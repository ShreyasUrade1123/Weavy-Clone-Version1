'use client';

export function LandingHero() {
    return (
        <section className="px-6 pb-20 pt-32 lg:pt-40 relative">
            <div className="max-w-[1920px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 relative z-10">
                {/* Left Column: WEAVY */}
                <div className="flex flex-col">
                    <h1 className="text-[120px] lg:text-[180px] leading-[0.85] font-normal tracking-tight text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Weavy
                    </h1>
                </div>

                {/* Right Column: Artistic Intelligence */}
                <div className="flex flex-col pt-4 lg:pt-8">
                    <h2 className="text-[60px] lg:text-[90px] leading-[0.9] font-normal tracking-tight text-black mb-12">
                        Artistic Intelligence
                    </h2>
                    <p className="text-xl lg:text-2xl text-black/70 max-w-lg leading-relaxed font-normal">
                        Turn your creative vision into scalable workflows. Access all AI models and professional editing tools in one node based platform.
                    </p>
                </div>
            </div>

            {/* Grid Background */}
            <div className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    backgroundImage: `
                        linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                    maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)'
                }}
            />
        </section>
    );
}
