'use client';

import { useState } from 'react';
import { X, Lock } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
    const { user } = useUser();
    const [email, setEmail] = useState('');
    const [isCopied, setIsCopied] = useState(false);

    if (!isOpen) return null;

    const handleInvite = () => {
        // TODO: Implement actual invite logic
        console.log('Inviting:', email);
        setEmail('');
    };

    const handleCopyLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
                onClick={onClose}
            >
                {/* Modal */}
                <div
                    className="bg-[#1C1C1E] rounded-2xl w-full max-w-lg p-6 relative font-[family-name:var(--font-dm-sans)] text-[12px] font-normal"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Title */}
                    <h2 className="text-white text-2xl font-semibold mb-8 mt-3">
                        Invite others
                    </h2>

                    {/* Email input */}
                    <div className="flex gap-3 mb-8">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="example@email.com"
                            className="flex-1 bg-[#2B2B2F] border border-[#3C3C3E] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E1E476] transition-all"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && email) {
                                    handleInvite();
                                }
                            }}
                        />
                        <button
                            onClick={handleInvite}
                            disabled={!email}
                            className="px-6 py-3 bg-[#2B2B2F] hover:bg-[#3C3C3E] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                        >
                            Invite
                        </button>
                    </div>

                    {/* Who has access */}
                    <div className="mb-8">
                        <h3 className="text-white text-[12px] font-medium mb-4">
                            Who has access
                        </h3>

                        {/* Current user */}
                        <div className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                                    {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <div>
                                    <div className="text-white font-medium flex items-center gap-2">
                                        {user?.firstName || user?.emailAddresses[0]?.emailAddress}
                                        <span className="text-gray-500 text-[10px]">You</span>
                                    </div>
                                    <div className="text-gray-400 text-[10px]">
                                        {user?.emailAddresses[0]?.emailAddress}
                                    </div>
                                </div>
                            </div>
                            <div className="text-white font-medium">
                                Owner
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-[#2C2C2E] my-6" />

                    {/* Footer actions */}
                    <div className="flex items-center justify-between">
                        {/* Privacy dropdown */}
                        <button className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors">
                            <Lock className="w-4 h-4" />
                            <span className="text-sm">Only invited people can view</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {/* Copy link */}
                        <button
                            onClick={handleCopyLink}
                            className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span className="text-sm">{isCopied ? 'Copied!' : 'Copy link'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
