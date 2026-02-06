import React, { useState, useEffect } from 'react';
import { LiveKitRoom, VideoConference, RoomAudioRenderer, ControlBar, useTracks } from '@livekit/components-react';
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
            <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-rose-500 mx-auto mb-4"></div>
                    <p className="text-white text-lg">Connecting to {channelName}...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-[#1e1e24] p-8 rounded-2xl max-w-md border border-white/10 shadow-2xl">
                    <h2 className="text-2xl font-bold text-rose-500 mb-4">Connection Failed</h2>
                    <p className="text-gray-300 mb-6">{error}</p>
                    <button
                        onClick={onLeave}
                        className="w-full px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all"
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
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50">
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="bg-[#1e1e24]/90 border-b border-white/10 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <h2 className="text-xl font-bold text-white">
                            {channelName}
                        </h2>
                    </div>
                    <button
                        onClick={onLeave}
                        className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Leave
                    </button>
                </div>

                {/* LiveKit Room */}
                <div className="flex-1 overflow-hidden">
                    <LiveKitRoom
                        video={channelType === 'VIDEO'}
                        audio={true}
                        token={token}
                        serverUrl={serverUrl}
                        data-lk-theme="default"
                        style={{ height: '100%' }}
                    >
                        {channelType === 'VIDEO' ? (
                            <VideoConference />
                        ) : (
                            <AudioOnlyConference />
                        )}
                        <RoomAudioRenderer />
                    </LiveKitRoom>
                </div>
            </div>
        </div>
    );
};

// Custom component for audio-only channels
const AudioOnlyConference = () => {
    const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });

    return (
        <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-20 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Header */}
            <div className="relative z-10 p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <h3 className="text-xl font-bold text-white">Voice Connected</h3>
                    <span className="ml-auto text-sm text-gray-400">{tracks.length} participant{tracks.length !== 1 ? 's' : ''}</span>
                </div>
            </div>

            {/* Participants Grid */}
            <div className="relative z-10 flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto">
                    {tracks.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-rose-500/20 to-purple-600/20 flex items-center justify-center mb-6">
                                <svg className="w-16 h-16 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-400 text-lg">Waiting for others to join...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {tracks.map((track) => {
                                const isSpeaking = track.participant.isSpeaking;
                                const isMuted = !track.participant.isMicrophoneEnabled;
                                
                                return (
                                    <div
                                        key={track.participant.identity}
                                        className="group relative"
                                    >
                                        {/* Card */}
                                        <div className={`
                                            relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 
                                            backdrop-blur-sm border-2 rounded-2xl p-6 
                                            transition-all duration-300 transform
                                            hover:scale-105 hover:shadow-2xl
                                            ${isSpeaking ? 'border-green-500 shadow-lg shadow-green-500/20' : 'border-gray-700/50'}
                                        `}>
                                            {/* Speaking Ring Animation */}
                                            {isSpeaking && (
                                                <div className="absolute inset-0 rounded-2xl border-2 border-green-400 animate-ping opacity-75"></div>
                                            )}

                                            {/* Avatar */}
                                            <div className="flex flex-col items-center gap-3 relative z-10">
                                                <div className={`
                                                    relative w-24 h-24 rounded-full 
                                                    bg-gradient-to-br from-rose-500 to-purple-600 
                                                    flex items-center justify-center
                                                    transition-all duration-300
                                                    ${isSpeaking ? 'ring-4 ring-green-400 ring-offset-4 ring-offset-gray-900' : ''}
                                                `}>
                                                    <span className="text-4xl font-bold text-white">
                                                        {track.participant.name?.charAt(0).toUpperCase() || 'U'}
                                                    </span>
                                                    
                                                    {/* Muted Badge */}
                                                    {isMuted && (
                                                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                                                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                                            </svg>
                                                        </div>
                                                    )}

                                                    {/* Active Badge */}
                                                    {!isMuted && (
                                                        <div className={`
                                                            absolute -bottom-2 -right-2 w-10 h-10 
                                                            ${isSpeaking ? 'bg-green-500' : 'bg-gray-600'} 
                                                            rounded-full flex items-center justify-center shadow-lg
                                                            transition-all duration-200
                                                        `}>
                                                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Name */}
                                                <div className="text-center">
                                                    <p className="text-white font-bold text-sm truncate max-w-[120px]">
                                                        {track.participant.name || 'Unknown'}
                                                    </p>
                                                    {isSpeaking && (
                                                        <p className="text-green-400 text-xs mt-1 font-semibold animate-pulse">
                                                            Speaking...
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Control Bar */}
            <div className="relative z-10 border-t border-white/5 bg-black/30 backdrop-blur-md">
                <ControlBar controls={{ camera: false, screenShare: false }} />
            </div>
        </div>
    );
};

export default VoiceRoom;
