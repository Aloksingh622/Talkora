import React, { useEffect, useState } from 'react';
import { createChannel, deleteChannel } from '../services/channelService';
import { getCategories, createCategory, deleteCategory as deleteCategoryService } from '../services/categoryService';
import { deleteServer, leaveServer } from '../services/serverService';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../utils/socket';
import { useNotification } from '../context/NotificationContext';
import ServerRequests from './ServerRequests';
import ServerSettingsModal from './ServerSettingsModal';
import UserProfileBar from './UserProfileBar';
import ChannelItem from './ChannelItem';
import { fetchServerChannels, fetchServerCategories, addChannel, removeChannel } from '../redux/server_slice';

const ChannelList = ({ serverId, server, onChannelSelect, onVoiceSelect, selectedChannelId, onServerUpdate, activeVoiceChannelId, onChannelNameChange }) => {
    const dispatch = useDispatch();

    // Get channels and categories from Redux
    const serverDetails = useSelector(state => state.server.serverDetails[serverId] || {});
    const channels = serverDetails.channels || [];
    const categories = serverDetails.categories || [];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelType, setNewChannelType] = useState('TEXT');
    // State to track which category we are creating a channel in
    const [newChannelCategoryId, setNewChannelCategoryId] = useState(null);

    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [isServerMenuOpen, setIsServerMenuOpen] = useState(false);
    const [serverMembers, setServerMembers] = useState([]);

    // State for collapsible categories
    const [collapsedCategories, setCollapsedCategories] = useState(new Set());

    const toggleCategory = (categoryId) => {
        setCollapsedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId);
            } else {
                newSet.add(categoryId);
            }
            return newSet;
        });
    };

    const currentUser = useSelector(state => state.auth.user);
    const navigate = useNavigate();
    const socket = getSocket();
    const { showNotification } = useNotification();

    // Check if current user is the owner
    const isOwner = server && currentUser && server.ownerId === currentUser.id;

    // Fetch channels and categories from Redux
    useEffect(() => {
        if (serverId) {
            // Fetch channels if not cached AND not currently loading
            if (!serverDetails.channels && !serverDetails.channelsLoading) {
                dispatch(fetchServerChannels(serverId));
            }

            // Fetch categories if not cached AND not currently loading (New caching logic)
            if (!serverDetails.categories && !serverDetails.categoriesLoading) {
                dispatch(fetchServerCategories(serverId));
            }
        }
    }, [serverId, dispatch, serverDetails.channels, serverDetails.channelsLoading, serverDetails.categories, serverDetails.categoriesLoading]);

    // Listen for channel events
    useEffect(() => {
        if (socket && serverId) {
            const handleChannelDeleted = (data) => {
                if (parseInt(data.serverId) === parseInt(serverId)) {
                    dispatch(removeChannel({ serverId, channelId: data.channelId }));
                    if (selectedChannelId === data.channelId) {
                        navigate(`/channels/${serverId}`);
                    }
                }
            };
            const handleChannelCreated = (data) => {
                if (parseInt(data.serverId) === parseInt(serverId)) {
                    dispatch(addChannel({ serverId, channel: data.channel }));
                }
            };
            socket.on('CHANNEL_DELETED', handleChannelDeleted);
            socket.on('CHANNEL_CREATED', handleChannelCreated);
            return () => {
                socket.off('CHANNEL_DELETED', handleChannelDeleted);
                socket.off('CHANNEL_CREATED', handleChannelCreated);
            };
        }
    }, [socket, serverId, selectedChannelId, navigate, dispatch]);

    // Update channel name in parent
    useEffect(() => {
        if (selectedChannelId && channels.length > 0) {
            const channel = channels.find(c => c.id === parseInt(selectedChannelId));
            if (channel && onChannelNameChange) {
                onChannelNameChange(channel.name);
            }
        }
    }, [selectedChannelId, channels, onChannelNameChange]);

    // loadCategories removed - using Redux

    const handleCreateChannel = async (e) => {
        e.preventDefault();
        if (!newChannelName.trim()) return;
        try {
            const result = await createChannel(serverId, newChannelName, newChannelType, newChannelCategoryId);
            setNewChannelName('');
            setNewChannelType('TEXT');
            setNewChannelCategoryId(null);
            setIsModalOpen(false);
            // Channel will be added via socket event or force refresh
            dispatch(fetchServerChannels(serverId));
        } catch (err) {
            console.error("Failed to create channel", err);
            alert('Failed to create channel: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        try {
            await createCategory(serverId, newCategoryName);
            setNewCategoryName('');
            setIsCategoryModalOpen(false);
            dispatch(fetchServerCategories(serverId));
        } catch (err) {
            console.error("Failed to create category", err);
            alert('Failed to create category: ' + (err.response?.data?.message || err.message));
        }
    };

    const [isDeleteChannelModalOpen, setIsDeleteChannelModalOpen] = useState(false);
    const [channelToDelete, setChannelToDelete] = useState(null);

    const handleDeleteChannel = (channelId, channelName) => {
        setChannelToDelete({ id: channelId, name: channelName });
        setIsDeleteChannelModalOpen(true);
    };

    const confirmDeleteChannel = async () => {
        if (!channelToDelete) return;
        try {
            await deleteChannel(channelToDelete.id);
            setIsDeleteChannelModalOpen(false);
            setChannelToDelete(null);
            // Channel will be removed via socket event or force refresh
            dispatch(fetchServerChannels(serverId));
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

    const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);

    const handleDeleteCategory = (categoryId, categoryName) => {
        setCategoryToDelete({ id: categoryId, name: categoryName });
        setIsDeleteCategoryModalOpen(true);
    };

    const confirmDeleteCategory = async () => {
        if (!categoryToDelete) return;
        try {
            await deleteCategoryService(categoryToDelete.id);
            setIsDeleteCategoryModalOpen(false);
            setCategoryToDelete(null);
            dispatch(fetchServerCategories(serverId));
        } catch (err) {
            console.error("Failed to delete category", err);
            alert('Failed to delete category');
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
                                    showNotification('Invite link copied to clipboard!', 'success');
                                } else {
                                    showNotification('No invite link available.', 'error');
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
                                    onClick={() => { setIsServerMenuOpen(false); setIsCategoryModalOpen(true); }}
                                    className="w-full px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors font-medium text-sm flex items-center justify-between border-b border-gray-200 dark:border-white/5"
                                >
                                    Create Category
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                </button>
                                <button
                                    onClick={() => { setIsServerMenuOpen(false); setIsRequestsModalOpen(true); }}
                                    className="w-full px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors font-medium text-sm flex items-center justify-between border-b border-gray-200 dark:border-white/5"
                                >
                                    Member Requests
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                                </button>
                                <button
                                    onClick={() => {
                                        setNewChannelCategoryId(null);
                                        setIsServerMenuOpen(false);
                                        setIsModalOpen(true);
                                    }}
                                    className="w-full px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors font-medium text-sm flex items-center justify-between border-b border-gray-200 dark:border-white/5"
                                >
                                    Create Channel
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
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
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {/* Uncategorized Channels */}
                {channels.filter(ch => !ch.categoryId && ch.type === 'TEXT').length > 0 && (
                    <div className="mb-4">
                        {channels.filter(ch => !ch.categoryId && ch.type === 'TEXT').map(channel => (
                            <ChannelItem
                                key={channel.id}
                                channel={channel}
                                selectedChannelId={selectedChannelId}
                                activeVoiceChannelId={activeVoiceChannelId}
                                onChannelSelect={onChannelSelect}
                                onVoiceSelect={onVoiceSelect}
                                isOwner={isOwner}
                                handleDeleteChannel={handleDeleteChannel}
                            />
                        ))}
                    </div>
                )}

                {/* Categories */}
                {categories.map(category => (
                    <div key={category.id} className="mb-4">
                        <div
                            className="flex items-center justify-between px-2 pt-2 pb-1 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider group hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer select-none"
                            onClick={() => toggleCategory(category.id)}
                        >
                            <div className="flex items-center">
                                <svg
                                    className={`w-3 h-3 mr-1 transition-transform duration-200 ${collapsedCategories.has(category.id) ? '-rotate-90' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                                <span>{category.name}</span>
                            </div>
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                {isOwner && (
                                    <>
                                        <button onClick={() => {
                                            setNewChannelCategoryId(category.id);
                                            setIsModalOpen(true);
                                        }} className="text-lg leading-none hover:text-rose-500 transition-colors" title="Create Channel">+</button>

                                        <button onClick={() => handleDeleteCategory(category.id, category.name)} className="p-0.5 hover:text-rose-500 transition-colors" title="Delete Category">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {!collapsedCategories.has(category.id) && (
                            channels.filter(ch => ch.categoryId === category.id).map(channel => (
                                <ChannelItem
                                    key={channel.id}
                                    channel={channel}
                                    selectedChannelId={selectedChannelId}
                                    activeVoiceChannelId={activeVoiceChannelId}
                                    onChannelSelect={onChannelSelect}
                                    onVoiceSelect={onVoiceSelect}
                                    isOwner={isOwner}
                                    handleDeleteChannel={handleDeleteChannel}
                                />
                            ))
                        )}
                    </div>
                ))}

                {/* Voice Channels (Uncategorized) - Logic from before kept, but usually Voice Channels are also categorized in Discord now. 
                     For simplicity, let's strictly follow category structure. If a voice channel has a category, it goes there. 
                     If not, it goes to "Voice Channels" pseudo-category or just uncategorized list?
                     Let's put uncategorized voice channels at the bottom.
                 */}
                {channels.filter(ch => !ch.categoryId && (ch.type === 'AUDIO' || ch.type === 'VIDEO')).length > 0 && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between px-2 pt-4 pb-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            <span>Voice Channels</span>
                        </div>
                        {channels.filter(ch => !ch.categoryId && (ch.type === 'AUDIO' || ch.type === 'VIDEO')).map(channel => (
                            <ChannelItem
                                key={channel.id}
                                channel={channel}
                                selectedChannelId={selectedChannelId}
                                activeVoiceChannelId={activeVoiceChannelId}
                                onChannelSelect={onChannelSelect}
                                onVoiceSelect={onVoiceSelect}
                                isOwner={isOwner}
                                handleDeleteChannel={handleDeleteChannel}
                            />
                        ))}
                    </div>
                )}

                {/* Helper to create generic Channel Item component to avoid repetition */}
            </div>

            {/* User Info Area (Bottom) */}
            <UserProfileBar />

            {/* Delete Channel Confirmation Modal */}
            {isDeleteChannelModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#313338] rounded-md shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Channel</h2>
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
                                Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white">#{channelToDelete?.name}</span>?
                                <br /><br />
                                <span className="text-rose-500 font-semibold">This action cannot be undone.</span>
                            </p>
                            <div className="flex justify-end space-x-2 bg-gray-100 dark:bg-[#2b2d31] p-4 -m-6 mt-0">
                                <button
                                    onClick={() => setIsDeleteChannelModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:underline transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteChannel}
                                    className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded text-sm font-bold transition-colors shadow-sm"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Category Confirmation Modal */}
            {isDeleteCategoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#313338] rounded-md shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Category</h2>
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
                                Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white">'{categoryToDelete?.name}'</span>?
                                <br /><br />
                                <span className="text-amber-500 font-semibold">Note:</span> Channels inside it will become uncategorized.
                            </p>
                            <div className="flex justify-end space-x-2 bg-gray-100 dark:bg-[#2b2d31] p-4 -m-6 mt-0">
                                <button
                                    onClick={() => setIsDeleteCategoryModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:underline transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteCategory}
                                    className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded text-sm font-bold transition-colors shadow-sm"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Category Modal */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#1e1e24] p-6 rounded-3xl w-full max-w-md shadow-2xl border border-white/5 relative overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        {/* Glow Effect */}
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-rose-500/20 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="text-center relative z-10">
                            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight leading-none">Create Category</h2>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wide mb-6">
                                Organize your channels
                            </p>

                            <form onSubmit={handleCreateCategory} className="text-left">
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5 transition-colors">
                                        Category Name
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            className="w-full py-2.5 px-4 bg-black/40 border-2 border-transparent focus:border-rose-500 rounded-lg text-white placeholder-gray-500 focus:outline-none transition-all font-medium"
                                            placeholder="New Category"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mt-8">
                                    <button
                                        type="button"
                                        onClick={() => setIsCategoryModalOpen(false)}
                                        className="text-gray-400 hover:text-white transition-colors text-sm font-medium hover:underline"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!newCategoryName.trim()}
                                        className="px-8 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-rose-900/30 disabled:opacity-50 disabled:shadow-none transform active:scale-95"
                                    >
                                        Create Category
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Channel Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-[#1e1e24] p-6 rounded-3xl w-96 shadow-2xl border border-white/5 relative overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Glow Effect */}
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-rose-500/20 rounded-full blur-3xl pointer-events-none"></div>

                        <h2 className="text-xl font-bold mb-6 text-white relative z-10">Create Channel</h2>
                        <form onSubmit={handleCreateChannel} className="relative z-10">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5 block">
                                Channel Name
                            </label>
                            <div className="relative mb-6">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-lg">#</span>
                                <input
                                    type="text"
                                    placeholder="new-channel"
                                    className="w-full py-2.5 pl-8 pr-3 bg-black/40 border-2 border-transparent focus:border-rose-500 rounded-lg text-white placeholder-gray-500 focus:outline-none transition-all font-medium lowercase"
                                    value={newChannelName}
                                    onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                    autoFocus
                                />
                            </div>

                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5 block">
                                Channel Type
                            </label>
                            <div className="mb-8 grid grid-cols-3 gap-3">
                                {['TEXT', 'AUDIO', 'VIDEO'].map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setNewChannelType(type)}
                                        className={`p-4 rounded-xl border-2 transition-all duration-200 relative overflow-hidden group ${newChannelType === type
                                            ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-900/40'
                                            : 'bg-black/40 border-transparent hover:bg-black/60 text-gray-400 hover:text-gray-200'
                                            }`}
                                    >
                                        <div className="flex flex-col items-center gap-1.5 relative z-10">
                                            {type === 'TEXT' && (
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                                </svg>
                                            )}
                                            {type === 'AUDIO' && (
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                </svg>
                                            )}
                                            {type === 'VIDEO' && (
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            )}
                                            <span className="text-[10px] font-bold tracking-wide">{type}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-between items-center px-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-gray-400 hover:text-white transition-colors text-sm font-medium hover:underline"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-rose-900/30 transition-all transform active:scale-95"
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
                    onServerUpdate={() => dispatch(fetchServerChannels(serverId))}
                    onServerDeleted={handleServerDeleted}
                />
            )}
        </div>
    );
};

export default ChannelList;
