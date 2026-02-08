import React, { useState, useEffect } from 'react';
import { LiveKitRoom, VideoConference, RoomAudioRenderer, ControlBar, useTracks, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import axios from 'axios';

const DMCall = ({ channelId, callType, otherUser, onEnd }) => {
    const [token, setToken] = useState(null);
    const [serverUrl, setServerUrl] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchToken();
    }, [channelId]);

    const fetchToken = async () => {
        try {
            const response = await axios.get(`/api/livekit/dm-token?channelId=${channelId}`);
            console.log('[DMCall] Received from API:', response.data);
            setToken(response.data.token);
            setServerUrl(response.data.url);
            console.log('[DMCall] Set serverUrl to:', response.data.url);
            setLoading(false);
        } catch (err) {
            console.error('Failed to get DM call token:', err);
            setError('Failed to connect to call');
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white text-lg">Connecting...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 text-lg mb-4">{error}</p>
                    <button
                        onClick={onEnd}
                        className="px-6 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-white font-semibold transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center">
                            {otherUser?.avatar ? (
                                <img src={otherUser.avatar} alt={otherUser.username} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <span className="text-xl font-bold text-white">
                                    {otherUser?.username?.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div>
                            <h3 className="text-white font-bold">{otherUser?.username}</h3>
                            <p className="text-gray-400 text-sm">{callType === 'video' ? 'Video Call' : 'Audio Call'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onEnd}
                        className="p-3 bg-red-600 hover:bg-red-700 rounded-full transition-colors shadow-lg"
                        title="End Call"
                    >
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* LiveKit Room */}
            <LiveKitRoom
                video={callType === 'video'}
                audio={true}
                token={token}
                serverUrl={serverUrl}
                data-lk-theme="default"
                style={{ height: '100%' }}
                onDisconnected={onEnd}
                // High-quality audio settings
                options={{
                    audioCaptureDefaults: {
                        autoGainControl: true,
                        echoCancellation: true,
                        noiseSuppression: true,
                    },
                    adaptiveStream: true,
                    dynacast: true,
                }}
            >
                {callType === 'video' ? (
                    <VideoConference />
                ) : (
                    <AudioOnlyDMCall otherUser={otherUser} />
                )}
                <RoomAudioRenderer />
            </LiveKitRoom>
        </div>
    );
};

// Audio-only UI for DM calls
const AudioOnlyDMCall = ({ otherUser }) => {
    const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });
    const participants = useParticipants();

    // Get current and remote participant
    const remoteParticipant = participants.find(p => !p.isLocal);
    const localParticipant = participants.find(p => p.isLocal);

    return (
        <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-20 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
                {/* Other User Avatar */}
                <div className="mb-12">
                    <div className={`
                        relative w-48 h-48 rounded-full 
                        bg-gradient-to-br from-rose-500 to-purple-600 
                        flex items-center justify-center
                        transition-all duration-300
                        ${remoteParticipant?.isSpeaking ? 'ring-8 ring-green-400 ring-offset-8 ring-offset-gray-900' : ''}
                    `}>
                        {otherUser?.avatar ? (
                            <img 
                                src={otherUser.avatar} 
                                alt={otherUser.username} 
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            <span className="text-8xl font-bold text-white">
                                {otherUser?.username?.charAt(0).toUpperCase()}
                            </span>
                        )}

                        {/* Speaking Animation */}
                        {remoteParticipant?.isSpeaking && (
                            <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-ping opacity-75"></div>
                        )}

                        {/* Mic Status Badge */}
                        <div className={`
                            absolute -bottom-4 -right-4 w-16 h-16 
                            ${remoteParticipant?.isMicrophoneEnabled === false ? 'bg-red-500' : remoteParticipant?.isSpeaking ? 'bg-green-500' : 'bg-gray-600'} 
                            rounded-full flex items-center justify-center shadow-lg
                            transition-all duration-200
                        `}>
                            {remoteParticipant?.isMicrophoneEnabled === false ? (
                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                </svg>
                            ) : (
                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                            )}
                        </div>
                    </div>
                </div>

                {/* Other User Name */}
                <h2 className="text-4xl font-bold text-white mb-2">
                    {otherUser?.username}
                </h2>
                {remoteParticipant?.isSpeaking && (
                    <p className="text-green-400 text-lg font-semibold animate-pulse">
                        Speaking...
                    </p>
                )}
            </div>

            {/* Control Bar */}
            <div className="relative z-10 border-t border-white/5 bg-black/30 backdrop-blur-md">
                <ControlBar controls={{ camera: false, screenShare: false }} />
            </div>
        </div>
    );
};

export default DMCall;
