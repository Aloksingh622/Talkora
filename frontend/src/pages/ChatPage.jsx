import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import ServerSidebar from '../components/ServerSidebar';
import ChannelList from '../components/ChannelList';
import ChatArea from '../components/ChatArea';
import MemberList from '../components/MemberList';
import DMList from '../components/DMList';
import FriendsHome from '../components/FriendsHome';
import ServerDiscovery from './ServerDiscovery';
import { initSocket, disconnectSocket, getSocket } from '../utils/socket';
import { useNotification } from '../context/NotificationContext';
import sparkHubLogo from '../assets/sparkhub.png';
import mainLogo from '../assets/logo.png';
import VoiceRoom from '../components/VoiceRoom';
import { fetchMyServers, removeServer, setCurrentServer, setCurrentChannel } from '../redux/server_slice';

const ChatPage = () => {
    const { serverId, channelId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth);
    const { servers, serversLoading } = useSelector((state) => state.server);
    const [channelName, setChannelName] = useState('');
    const [currentServer, setCurrentServerLocal] = useState(null);
    const { showNotification } = useNotification();
    const [activeVoiceChannel, setActiveVoiceChannel] = useState(null);
    const [showDiscovery, setShowDiscovery] = useState(false);

    useEffect(() => {
        initSocket();
        // Load servers from Redux if not already loaded
        if (servers.length === 0 && !serversLoading) {
            dispatch(fetchMyServers());
        }
        return () => disconnectSocket();
    }, []);

    // Redirect if channelId is "undefined" string
    useEffect(() => {
        if (channelId === 'undefined') {
            navigate('/channels/@me');
        }
    }, [channelId, navigate]);

    // Listen for server deletion
    useEffect(() => {
        const socket = getSocket();
        if (socket) {
            const handleServerDeleted = (data) => {
                showNotification(`Server "${data.serverName}" has been deleted by the owner`, 'warning');
                dispatch(removeServer(data.serverId));
                if (parseInt(serverId) === data.serverId) {
                    navigate('/channels');
                }
            };
            socket.on('SERVER_DELETED', handleServerDeleted);
            return () => socket.off('SERVER_DELETED', handleServerDeleted);
        }
    }, [serverId, navigate, showNotification, dispatch]);

    // Update current server when serverId changes
    useEffect(() => {
        if (serverId && servers.length > 0) {
            const server = servers.find(s => s.id === parseInt(serverId));
            setCurrentServerLocal(server || null);
            dispatch(setCurrentServer(serverId ? parseInt(serverId) : null));
        } else {
            setCurrentServerLocal(null);
            dispatch(setCurrentServer(null));
        }
    }, [serverId, servers, dispatch]);

    // Update current channel in Redux
    useEffect(() => {
        dispatch(setCurrentChannel(channelId ? parseInt(channelId) : null));
    }, [channelId, dispatch]);

    const handleServerSelect = (id) => {
        navigate(`/channels/${id}`);
        setShowDiscovery(false);
    };
    const handleHomeClick = () => {
        navigate('/channels/@me');
        setShowDiscovery(false);
    };
    const handleChannelSelect = (id) => navigate(`/channels/${serverId}/${id}`);
    const handleServerUpdate = () => dispatch(fetchMyServers());

    const handleVoiceSelect = (channel) => {
        setActiveVoiceChannel(channel);
        // Clear text channel selection if needed, or keep it to allow returning
        // We'll prioritize showing VoiceRoom if set
    };


    return (
        <div className="flex w-full h-screen overflow-hidden bg-[#F3F4F6] dark:bg-[#0a0a10] transition-colors duration-300 relative">

            {/* SIDEBARS - Handler for @me logic */}
            <ServerSidebar
                onServerSelect={handleServerSelect}
                selectedServerId={serverId ? (serverId === '@me' ? null : parseInt(serverId)) : null}
                servers={servers}
                onServerUpdate={handleServerUpdate}
                onDiscoverClick={() => setShowDiscovery(true)}
                onHomeClick={handleHomeClick}
            />

            {/* CHANNEL LIST OR DM LIST */}
            {!showDiscovery && (
                <>
                    {serverId === '@me' ? (
                        <DMList selectedChannelId={channelId} />
                    ) : serverId ? (
                        <ChannelList
                            serverId={serverId}
                            server={currentServer}
                            onChannelSelect={handleChannelSelect}
                            selectedChannelId={channelId ? parseInt(channelId) : null}
                            onServerUpdate={handleServerUpdate}
                            onVoiceSelect={handleVoiceSelect}
                            activeVoiceChannelId={activeVoiceChannel?.id}
                            onChannelNameChange={setChannelName}
                        />
                    ) : (
                        <div className="hidden md:block w-72 bg-[#F9FAFB] dark:bg-[#111116] border-r border-gray-200 dark:border-white/5 h-full relative overflow-hidden">
                            <div className="absolute inset-0 opacity-10 dark:opacity-5 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-500 via-transparent to-transparent"></div>
                        </div>
                    )}
                </>
            )}

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex relative overflow-hidden">
                {showDiscovery ? (
                    /* DISCOVERY VIEW */
                    <ServerDiscovery onBack={() => setShowDiscovery(false)} />
                ) : serverId === '@me' && !channelId ? (
                    /* FRIENDS HOME VIEW */
                    <FriendsHome />
                ) : activeVoiceChannel ? (
                    /* VOICE ROOM VIEW (Replaces Chat/Friends Area) */
                    <VoiceRoom
                        channelId={activeVoiceChannel.id}
                        channelName={activeVoiceChannel.name}
                        channelType={activeVoiceChannel.type}
                        onLeave={() => setActiveVoiceChannel(null)}
                    />
                ) : channelId ? (
                    <>
                        <ChatArea channelId={channelId} channelName={channelName} serverId={serverId} />
                        {serverId && serverId !== '@me' && <MemberList serverId={serverId} channelId={channelId} />}
                    </>
                ) : (
                    /* WELCOME / EMPTY STATE */
                    <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
                        {/* Animated Background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-rose-500/5 pointer-events-none" />
                        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="bg-white/40 dark:bg-black/30 backdrop-blur-xl border border-white/20 dark:border-white/10 p-12 rounded-3xl shadow-2xl text-center max-w-2xl w-full relative z-10"
                        >
                            {/* Logo Static */}
                            <div className="flex justify-center mb-8 relative">
                                <img src={sparkHubLogo} alt="SparkHub" className="h-24 w-auto relative z-10" />
                            </div>

                            <motion.h1
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4 tracking-tight"
                            >
                                Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-rose-600">{user?.displayName || user?.username || 'SparkHub User'}</span>!
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto leading-relaxed"
                            >
                                {serverId
                                    ? "Select a channel from the left to start chatting."
                                    : "You're all set! Select a server from the sidebar or creating a new one to begin your journey."}
                            </motion.p>

                            {!serverId && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6 }}
                                    className="flex justify-center gap-4"
                                >
                                    <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-full">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        Connected to SparkHub Network
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>

                        {/* Footer Branding - CENTERED */}
                        <div className="absolute bottom-6 w-full text-center opacity-70">
                            <img src={mainLogo} alt="Logo" className="h-8 w-auto mx-auto mb-2" />
                            <p className="text-xs font-mono tracking-widest uppercase text-rose-400">Designed for connection</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatPage;
