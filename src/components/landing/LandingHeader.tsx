'use client';

import Link from 'next/link';

export function LandingHeader() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 px-6 py-5 bg-[#EAEAEA]/80 backdrop-blur-sm">
            <div className="max-w-[1920px] mx-auto flex items-center justify-between">
                {/* Left: Logo & Branding */}
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-black flex items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 4H20V20H4V4Z" stroke="white" strokeWidth="2" />
                            <path d="M8 8V16M12 8V16M16 8V16" stroke="white" strokeWidth="2" />
                        </svg>
                    </div>
                    <div className="h-8 w-[1px] bg-black/20 mx-2"></div>
                    <div className="flex flex-col leading-none">
                        <span className="font-bold text-xs tracking-wider text-black">WEAVY</span>
                        <span className="font-medium text-[10px] tracking-wide text-black/60">ARTISTIC INTELLIGENCE</span>
                    </div>
                </div>

                {/* Right: Navigation */}
                <div className="flex items-center gap-8">
                    <nav className="hidden md:flex items-center gap-8 text-xs font-medium tracking-wide text-black/80">
                        <Link href="#collective" className="hover:text-black transition-colors">COLLECTIVE</Link>
                        <Link href="#enterprise" className="hover:text-black transition-colors">ENTERPRISE</Link>
                        <Link href="#pricing" className="hover:text-black transition-colors">PRICING</Link>
                        <Link href="#demo" className="hover:text-black transition-colors">REQUEST A DEMO</Link>
                        <Link href="/sign-in" className="hover:text-black transition-colors">SIGN IN</Link>
                    </nav>
                    <Link
                        href="/sign-up"
                        className="bg-[#EBFF00] hover:bg-[#D4E600] text-black text-sm font-medium px-6 py-3 transition-colors rounded-sm"
                    >
                        Start Now
                    </Link>
                </div>
            </div>
        </header>
    );
}
