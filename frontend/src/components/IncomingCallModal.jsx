import React, { useEffect, useState } from 'react';

const IncomingCallModal = ({ caller, callType, onAnswer, onDecline }) => {
    const [secondsLeft, setSecondsLeft] = useState(30);

    useEffect(() => {
        // Auto-dismiss after 30 seconds
        const timer = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    onDecline();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [onDecline]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 shadow-2xl border border-white/10 max-w-md w-full mx-4 animate-scale-in">
                {/* Pulsing Animation */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-green-500/20 to-blue-500/20 animate-pulse pointer-events-none"></div>

                <div className="relative z-10">
                    {/* Call Type Badge */}
                    <div className="flex justify-center mb-4">
                        <div className="px-4 py-1.5 bg-white/10 rounded-full border border-white/20">
                            <span className="text-xs font-semibold text-white uppercase tracking-wide">
                                {callType === 'video' ? '📹 Video Call' : '📞 Audio Call'}
                            </span>
                        </div>
                    </div>

                    {/* Caller Avatar */}
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center shadow-2xl ring-4 ring-white/20 animate-pulse-slow">
                                {caller.avatar ? (
                                    <img 
                                        src={caller.avatar} 
                                        alt={caller.username} 
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                ) : (
                                    <span className="text-6xl font-bold text-white">
                                        {caller.username?.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            {/* Animated Ring */}
                            <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-ping opacity-75"></div>
                        </div>
                    </div>

                    {/* Caller Info */}
                    <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold text-white mb-2">
                            {caller.username}
                        </h3>
                        <p className="text-gray-400 text-sm">
                            Incoming {callType} call...
                        </p>
                    </div>

                    {/* Timer */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm text-gray-400">
                                {secondsLeft}s
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        {/* Decline Button */}
                        <button
                            onClick={onDecline}
                            className="flex-1 group relative overflow-hidden px-6 py-4 bg-red-600 hover:bg-red-700 rounded-xl font-semibold text-white transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-red-500/50"
                        >
                            <div className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Decline</span>
                            </div>
                        </button>

                        {/* Answer Button */}
                        <button
                            onClick={onAnswer}
                            className="flex-1 group relative overflow-hidden px-6 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 rounded-xl font-semibold text-white transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-green-500/50"
                        >
                            <div className="flex items-center justify-center gap-2">
                                {callType === 'video' ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                )}
                                <span>Answer</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scale-in {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes pulse-slow {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out;
                }
                .animate-scale-in {
                    animation: scale-in 0.3s ease-out;
                }
                .animate-pulse-slow {
                    animation: pulse-slow 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default IncomingCallModal;
