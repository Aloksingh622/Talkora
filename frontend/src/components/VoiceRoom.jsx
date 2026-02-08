import React, { useState, useEffect } from 'react';
import { LiveKitRoom, VideoConference, RoomAudioRenderer, ControlBar, useTracks, DisconnectButton, LayoutContextProvider } from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import axios from 'axios';

const VoiceRoom = ({ channelId, channelName, channelType, onLeave }) => {
    const [token, setToken] = useState('');
    const [serverUrl, setServerUrl] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchToken();
    }, [channelId]);

    const fetchToken = async () => {
        try {
            setIsLoading(true);
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
            const response = await axios.get(`${API_URL}/api/livekit/token`, {
                params: { channelId },
                headers: { 'Content-Type': 'application/json' },
                withCredentials: true
            });

            setToken(response.data.token);
            setServerUrl(response.data.url);
            setError('');
        } catch (err) {
            console.error('Failed to fetch LiveKit token:', err);
            setError(err.response?.data?.error || 'Failed to join voice channel');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="w-full h-full bg-[#000000] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500 mx-auto mb-4"></div>
                    <p className="text-gray-400 text-sm font-medium">Connecting...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full bg-[#000000] flex items-center justify-center p-6">
                <div className="bg-[#1e1f22] p-8 rounded-xl max-w-sm text-center border border-red-500/20">
                    <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h2 className="text-lg font-bold text-white mb-2">Connection Failed</h2>
                    <p className="text-gray-400 text-sm mb-6">{error}</p>
                    <button
                        onClick={onLeave}
                        className="w-full px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded transition-colors text-sm font-semibold"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    if (!token || !serverUrl) {
        return null;
    }

    return (
        <div className="w-full h-full flex flex-col bg-[#000000] relative overflow-hidden group/room">
            {/* Header Overlay - Auto Hides */}
            <div className="absolute top-0 left-0 w-full p-4 z-20 pointer-events-none opacity-0 group-hover/room:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full inline-flex pointer-events-auto">
                    <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    <span className="text-white font-bold shadow-sm">{channelName}</span>
                    <div className="w-2 h-2 rounded-full bg-green-500 ml-2 animate-pulse"></div>
                    <span className="text-xs text-green-400 font-medium">Connected</span>
                </div>
            </div>

            {/* LiveKit Room */}
            <div className="flex-1 overflow-hidden relative">
                <LiveKitRoom
                    video={channelType === 'VIDEO'}
                    audio={true}
                    token={token}
                    serverUrl={serverUrl}
                    data-lk-theme="default"
                    style={{ height: '100%' }}
                    onDisconnected={onLeave}
                >
                    <LayoutContextProvider>
                        {channelType === 'VIDEO' ? (
                            <VideoConference />
                        ) : (
                            <AudioOnlyConference />
                        )}
                        <RoomAudioRenderer />
                    </LayoutContextProvider>
                </LiveKitRoom>
            </div>
        </div>
    );
};

// Custom component for audio-only channels
const AudioOnlyConference = () => {
    const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });

    return (
        <div className="h-full w-full flex flex-col bg-black relative overflow-hidden">
            {/* Main Content Area - Centered Grid */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
                <div className="flex flex-wrap justify-center gap-4 max-w-full">
                    {/* Participant Cards */}
                    {tracks.map((track) => {
                        const isSpeaking = track.participant.isSpeaking;
                        const isMuted = !track.participant.isMicrophoneEnabled;

                        return (
                            <div
                                key={track.participant.identity}
                                className={`
                                    relative w-[500px] h-[320px] max-w-full bg-[#2b2d31] 
                                    rounded-2xl flex items-center justify-center shrink-0
                                    transition-all duration-200 border-2
                                    ${isSpeaking ? 'border-green-500' : 'border-transparent group hover:bg-[#3f4147] cursor-pointer'}
                                `}
                            >
                                {/* Avatar Circle */}
                                <div className={`
                                    relative w-32 h-32 rounded-full 
                                    bg-indigo-500 flex items-center justify-center
                                    ${isSpeaking ? 'ring-4 ring-green-500/50' : ''}
                                    transition-all duration-200
                                `}>
                                    <span className="text-5xl font-bold text-white">
                                        {track.participant.name?.charAt(0).toUpperCase() || 'U'}
                                    </span>

                                    {/* Mute Indicator on Avatar */}
                                    {isMuted && (
                                        <div className="absolute -bottom-2 -right-2 bg-red-500 rounded-full p-2 border-4 border-[#2b2d31]">
                                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                {/* Name Tag (Floating Capsule) */}
                                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 border border-white/5">
                                    <span className="text-white font-bold text-sm">
                                        {track.participant.name || 'Unknown'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}


                </div>
            </div>

            {/* Bottom Control Bar (Floating) */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
                <div className="bg-[#111214] p-2 rounded-xl flex items-center gap-2 shadow-2xl border border-[#1e1f22]">
                    <ControlBar
                        variation="minimal"
                        controls={{
                            camera: true,
                            microphone: true,
                            screenShare: true,
                            chat: false,
                            leave: false, // We'll add a custom leave button for style
                            settings: true
                        }}
                    />

                    <div className="w-[1px] h-8 bg-gray-700 mx-1"></div>

                    {/* Custom Disconnect Button (Red) */}
                    <DisconnectButton>
                        <div className="p-3 bg-red-600 hover:bg-red-700 rounded-full text-white transition-colors flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                    </DisconnectButton>
                </div>
            </div>
        </div>
    );
};

export default VoiceRoom;
