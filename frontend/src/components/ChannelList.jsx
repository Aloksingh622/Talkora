import React, { useEffect, useState } from 'react';
import { getChannels, createChannel, deleteChannel } from '../services/channelService';
import { deleteServer, leaveServer } from '../services/serverService';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../utils/socket';
import { useNotification } from '../context/NotificationContext';

const ChannelList = ({ serverId, server, onChannelSelect, selectedChannelId, onServerUpdate }) => {
    const [channels, setChannels] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [isServerMenuOpen, setIsServerMenuOpen] = useState(false);
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
                console.log('CHANNEL_DELETED event:', data);
                if (parseInt(data.serverId) === parseInt(serverId)) {
                    setChannels(prev => prev.filter(ch => ch.id !== data.channelId));

                    if (selectedChannelId === data.channelId) {
                        navigate(`/channels/${serverId}`);
                    }
                }
            };

            const handleChannelCreated = (data) => {
                console.log('CHANNEL_CREATED event:', data);
                if (parseInt(data.serverId) === parseInt(serverId)) {
                    setChannels(prev => {
                        const exists = prev.some(ch => ch.id === data.channel.id);
                        if (!exists) {
                            return [...prev, data.channel];
                        }
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
        if (!confirm(`Are you sure you want to delete ${server?.name}? This action cannot be undone.`)) return;

        try {
            await deleteServer(serverId);
            if (onServerUpdate) onServerUpdate();
            navigate('/channels');
        } catch (err) {
            console.error("Failed to delete server", err);
            alert('Failed to delete server: ' + (err.response?.data?.message || err.message));
        }
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
        return <div className="w-60 bg-gray-50 dark:bg-[#111] h-screen border-r border-gray-200 dark:border-gray-800 p-4">Select a server</div>;
    }

    return (
        <div className="w-60 bg-gray-100 dark:bg-[#111] h-screen flex flex-col border-r border-gray-200 dark:border-gray-800">
            {/* Server Header with Dropdown */}
            <div className="relative">
                <div
                    className="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 font-bold text-gray-700 dark:text-gray-200 shadow-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-900/50 transition-colors"
                    onClick={() => setIsServerMenuOpen(!isServerMenuOpen)}
                >
                    <span className="truncate">{server?.name || 'Server'}</span>
                    <svg className={`w-4 h-4 transition-transform ${isServerMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                {/* Server Dropdown Menu */}
                {isServerMenuOpen && (
                    <div className="absolute top-12 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-b-lg z-50">
                        {isOwner ? (
                            <button
                                onClick={() => {
                                    setIsServerMenuOpen(false);
                                    handleDeleteServer();
                                }}
                                className="w-full px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                Delete Server
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    setIsServerMenuOpen(false);
                                    handleLeaveServer();
                                }}
                                className="w-full px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                Leave Server
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <div className="flex items-center justify-between px-2 pt-4 pb-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                    <span>Text Channels</span>
                    {isOwner && (
                        <button onClick={() => setIsModalOpen(true)} className="hover:text-gray-700 dark:hover:text-gray-200 text-lg leading-none">+</button>
                    )}
                </div>

                {channels.map(channel => (
                    <div
                        key={channel.id}
                        className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group transition-colors ${selectedChannelId === channel.id ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'}`}
                    >
                        <div className="flex items-center flex-1 min-w-0" onClick={() => onChannelSelect(channel.id)}>
                            <span className="text-xl mr-1.5 text-gray-400 dark:text-gray-500">#</span>
                            <span className="truncate font-medium">{channel.name}</span>
                        </div>
                        {isOwner && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteChannel(channel.id, channel.name);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                                title="Delete channel"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* User Info Area (Bottom) */}
            <div className="h-14 bg-gray-200 dark:bg-[#0a0a0a] flex items-center px-2 border-t border-gray-300 dark:border-gray-800">
                <div className="w-8 h-8 rounded-full bg-indigo-500 mr-2 flex items-center justify-center text-white font-bold">
                    {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{currentUser?.username || 'User'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">#{currentUser?.id || '0000'}</div>
                </div>
            </div>

            {/* Create Channel Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg w-96 shadow-xl border border-gray-200 dark:border-gray-700">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create Channel</h2>
                        <form onSubmit={handleCreateChannel}>
                            <input
                                type="text"
                                placeholder="channel-name"
                                className="w-full p-2 mb-4 border rounded dark:bg-black dark:text-white dark:border-gray-700 lowercase"
                                value={newChannelName}
                                onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                autoFocus
                            />
                            <div className="flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChannelList;
