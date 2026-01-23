import React, { useEffect, useState } from 'react';
import { getChannels, createChannel, deleteChannel } from '../services/channelService';
import { deleteServer, leaveServer } from '../services/serverService';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../utils/socket';
import { useNotification } from '../context/NotificationContext';
import ServerRequests from './ServerRequests';
import ServerSettingsModal from './ServerSettingsModal';
import UserProfileBar from './UserProfileBar';

const ChannelList = ({ serverId, server, onChannelSelect, selectedChannelId, onServerUpdate }) => {
    const [channels, setChannels] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [isServerMenuOpen, setIsServerMenuOpen] = useState(false);
    const [serverMembers, setServerMembers] = useState([]);
    const currentUser = useSelector(state => state.auth.user);
    const navigate = useNavigate();
    const socket = getSocket();
    const { showNotification } = useNotification();

    // Check if current user is the owner
    const isOwner = server && currentUser && server.ownerId === currentUser.id;

    useEffect(() => {
        if (serverId) {
            loadChannels();
        }
    }, [serverId]);

    // Listen for channel events
    useEffect(() => {
        if (socket && serverId) {
            const handleChannelDeleted = (data) => {
                if (parseInt(data.serverId) === parseInt(serverId)) {
                    setChannels(prev => prev.filter(ch => ch.id !== data.channelId));
                    if (selectedChannelId === data.channelId) {
                        navigate(`/channels/${serverId}`);
                    }
                }
            };
            const handleChannelCreated = (data) => {
                if (parseInt(data.serverId) === parseInt(serverId)) {
                    setChannels(prev => {
                        const exists = prev.some(ch => ch.id === data.channel.id);
                        if (!exists) return [...prev, data.channel];
                        return prev;
                    });
                }
            };
            socket.on('CHANNEL_DELETED', handleChannelDeleted);
            socket.on('CHANNEL_CREATED', handleChannelCreated);
            return () => {
                socket.off('CHANNEL_DELETED', handleChannelDeleted);
                socket.off('CHANNEL_CREATED', handleChannelCreated);
            };
        }
    }, [socket, serverId, selectedChannelId, navigate]);

    const loadChannels = async () => {
        try {
            const data = await getChannels(serverId);
            setChannels(data.channels || []);
        } catch (err) {
            console.error("Failed to load channels", err);
        }
    };

    const handleCreateChannel = async (e) => {
        e.preventDefault();
        if (!newChannelName.trim()) return;
        try {
            await createChannel(serverId, newChannelName);
            setNewChannelName('');
            setIsModalOpen(false);
            loadChannels();
        } catch (err) {
            console.error("Failed to create channel", err);
            alert('Failed to create channel: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleDeleteChannel = async (channelId, channelName) => {
        if (!confirm(`Are you sure you want to delete #${channelName}?`)) return;
        try {
            await deleteChannel(channelId);
            loadChannels();
        } catch (err) {
            console.error("Failed to delete channel", err);
            alert('Failed to delete channel: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleDeleteServer = async () => {
        // Deletion is now handled in ServerSettingsModal
        setIsSettingsModalOpen(true);
    };

    const handleServerDeleted = () => {
        if (onServerUpdate) onServerUpdate();
        navigate('/channels');
    };

    const handleLeaveServer = async () => {
        if (!confirm(`Are you sure you want to leave ${server?.name}?`)) return;
        try {
            await leaveServer(serverId);
            if (onServerUpdate) onServerUpdate();
            navigate('/channels');
        } catch (err) {
            console.error("Failed to leave server", err);
            alert('Failed to leave server: ' + (err.response?.data?.message || err.message));
        }
    };

    if (!serverId) {
        return <div className="w-60 bg-[#F9FAFB] dark:bg-[#111116] h-screen border-r border-gray-200 dark:border-white/5 p-4 text-gray-500">Select a server</div>;
    }

    return (
        <div className="w-60 bg-[#F9FAFB] dark:bg-[#111116] h-screen flex flex-col border-r border-gray-200 dark:border-white/5 transition-colors duration-300">
            {/* Server Header */}
            <div className="relative">
                <div
                    className="h-12 border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-4 font-bold text-gray-800 dark:text-gray-100 shadow-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition-colors"
                    onClick={() => setIsServerMenuOpen(!isServerMenuOpen)}
                >
                    <span className="truncate">{server?.name || 'Server'}</span>
                    <svg className={`w-4 h-4 transition-transform ${isServerMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                {/* Dropdown Menu */}
                {isServerMenuOpen && (
                    <div className="absolute top-12 left-2 right-2 bg-white dark:bg-[#1e1e24] shadow-2xl border border-gray-200 dark:border-white/10 rounded-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <button
                            onClick={() => {
                                setIsServerMenuOpen(false);
                                if (server?.inviteCode) {
                                    navigator.clipboard.writeText(`${window.location.origin}/invite/${server.inviteCode}`);
                                    alert('Invite link copied to clipboard!');
                                } else {
                                    alert('No invite link available.');
                                }
                            }}
                            className="w-full px-4 py-3 text-left text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors font-medium text-sm flex items-center justify-between border-b border-gray-200 dark:border-white/5"
                        >
                            Invite People
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                        </button>
                        {isOwner ? (
                            <>
                                <button
                                    onClick={() => { setIsServerMenuOpen(false); setIsSettingsModalOpen(true); }}
                                    className="w-full px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors font-medium text-sm flex items-center justify-between border-b border-gray-200 dark:border-white/5"
                                >
                                    Server Settings
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </button>
                                <button
                                    onClick={() => { setIsServerMenuOpen(false); setIsRequestsModalOpen(true); }}
                                    className="w-full px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors font-medium text-sm flex items-center justify-between border-b border-gray-200 dark:border-white/5"
                                >
                                    Member Requests
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => { setIsServerMenuOpen(false); handleLeaveServer(); }}
                                className="w-full px-4 py-3 text-left text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors font-medium text-sm flex items-center justify-between"
                            >
                                Leave Server
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Channels List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <div className="flex items-center justify-between px-2 pt-4 pb-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider group hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                    <span>Text Channels</span>
                    {isOwner && (
                        <button onClick={() => setIsModalOpen(true)} className="text-lg leading-none hover:text-rose-500 transition-colors">+</button>
                    )}
                </div>

                {channels.map(channel => (
                    <div
                        key={channel.id}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer group transition-all duration-200 ${selectedChannelId === channel.id ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'}`}
                    >
                        <div className="flex items-center flex-1 min-w-0" onClick={() => onChannelSelect(channel.id)}>
                            <span className="text-lg mr-1.5 opacity-60">#</span>
                            <span className={`truncate font-medium ${selectedChannelId === channel.id ? 'font-bold' : ''}`}>{channel.name}</span>
                        </div>
                        {isOwner && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteChannel(channel.id, channel.name); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity"
                                title="Delete channel"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* User Info Area (Bottom) */}
            <UserProfileBar />

            {/* Create Channel Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#1e1e24] p-6 rounded-2xl w-96 shadow-2xl border border-white/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-rose-500/20 rounded-full blur-2xl pointer-events-none"></div>

                        <h2 className="text-xl font-bold mb-4 text-white relative z-10">Create Channel</h2>
                        <form onSubmit={handleCreateChannel} className="relative z-10">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">
                                Channel Name
                            </label>
                            <div className="relative mb-6">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">#</span>
                                <input
                                    type="text"
                                    placeholder="new-channel"
                                    className="w-full p-2 pl-7 bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all font-medium lowercase"
                                    value={newChannelName}
                                    onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold shadow-lg shadow-rose-900/20 transition-all transform hover:scale-105"
                                >
                                    Create Channel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Server Requests Modal */}
            {isRequestsModalOpen && (
                <ServerRequests
                    serverId={serverId}
                    onClose={() => setIsRequestsModalOpen(false)}
                />
            )}

            {/* Server Settings Modal */}
            {isSettingsModalOpen && (
                <ServerSettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => setIsSettingsModalOpen(false)}
                    server={server}
                    members={serverMembers}
                    onServerUpdate={loadChannels}
                    onServerDeleted={handleServerDeleted}
                />
            )}
        </div>
    );
};

export default ChannelList;
