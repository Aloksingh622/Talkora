import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { updateServerSettings, deleteServer } from '../services/serverService';
import TransferOwnershipDialog from './TransferOwnershipDialog';
import BanListPanel from './BanListPanel';
import ConfirmDialog from './ConfirmDialog';

/**
 * Comprehensive Server Settings Modal
 */
const ServerSettingsModal = ({ isOpen, onClose, server, members, onServerUpdate, onServerDeleted }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [serverName, setServerName] = useState('');
    const [serverType, setServerType] = useState('FRIENDS');
    const [isPrivate, setIsPrivate] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showTransferDialog, setShowTransferDialog] = useState(false);
    const [showBanList, setShowBanList] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const currentUser = useSelector(state => state.auth.user);

    const serverTypes = ['FRIENDS', 'COMMUNITY', 'GAMING', 'SCHOOL', 'STUDY', 'ART'];

    useEffect(() => {
        if (server) {
            setServerName(server.name || '');
            setServerType(server.type || 'FRIENDS');
            setIsPrivate(server.isPrivate || false);
            setPreviewUrl(server.icon || null);
        }
    }, [server]);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('Only image files are allowed');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB
            setError('Image must be smaller than 5MB');
            return;
        }

        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setError(null);
    };

    const handleSaveSettings = async () => {
        if (!serverName.trim()) {
            setError('Server name is required');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('name', serverName.trim());
            formData.append('type', serverType);
            formData.append('isPrivate', isPrivate);

            if (selectedFile) {
                formData.append('icon', selectedFile);
            }

            const response = await updateServerSettings(server.id, formData);
            onServerUpdate?.(response.server);
            setSelectedFile(null);
            setError(null);
            alert('Server settings updated successfully!');
        } catch (err) {
            console.error('Update settings error:', err);
            setError(err.response?.data?.message || 'Failed to update settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteServer = async () => {
        if (deleteConfirmText !== server.name) {
            setError('Server name does not match');
            return;
        }

        setIsLoading(true);
        try {
            await deleteServer(server.id);
            onServerDeleted?.();
            onClose();
        } catch (err) {
            console.error('Delete server error:', err);
            setError(err.response?.data?.message || 'Failed to delete server');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const isOwner = server?.ownerId === currentUser?.id;

    if (!isOwner) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
                <div className="bg-white dark:bg-[#1e1e24] rounded-xl shadow-2xl p-8 max-w-md">
                    <p className="text-gray-700 dark:text-gray-300">Only the server owner can access settings.</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-rose-500 text-white rounded-lg">Close</button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
                <div
                    className="bg-white dark:bg-[#1e1e24] rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex border border-gray-200 dark:border-white/10"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Sidebar Tabs */}
                    <div className="w-64 bg-gray-50 dark:bg-[#111116] rounded-l-xl border-r border-gray-200 dark:border-white/10 p-4 flex flex-col">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 px-2">Server Settings</h2>

                        <div className="space-y-1 flex-1">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${activeTab === 'overview'
                                        ? 'bg-rose-500 text-white'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/5'
                                    }`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setActiveTab('bans')}
                                className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${activeTab === 'bans'
                                        ? 'bg-rose-500 text-white'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/5'
                                    }`}
                            >
                                Bans
                            </button>
                            <button
                                onClick={() => setActiveTab('transfer')}
                                className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${activeTab === 'transfer'
                                        ? 'bg-rose-500 text-white'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/5'
                                    }`}
                            >
                                Transfer Ownership
                            </button>
                            <button
                                onClick={() => setActiveTab('delete')}
                                className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${activeTab === 'delete'
                                        ? 'bg-red-500 text-white'
                                        : 'text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20'
                                    }`}
                            >
                                Delete Server
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="mt-4 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            Close
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-8">
                            {/* Overview Tab */}
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Server Overview</h3>
                                        <p className="text-gray-600 dark:text-gray-400">Manage your server's basic settings</p>
                                    </div>

                                    {/* Server Icon */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Server Icon
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl overflow-hidden">
                                                {previewUrl ? (
                                                    <img src={previewUrl} alt="Server icon" className="w-full h-full object-cover" />
                                                ) : (
                                                    serverName?.[0]?.toUpperCase() || 'S'
                                                )}
                                            </div>
                                            <div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileSelect}
                                                    className="hidden"
                                                    id="serverIcon"
                                                />
                                                <label
                                                    htmlFor="serverIcon"
                                                    className="px-4 py-2 bg-gray-200 dark:bg-[#2b2d31] hover:bg-gray-300 dark:hover:bg-[#3b3d41] text-gray-900 dark:text-white rounded-lg cursor-pointer transition-colors inline-block"
                                                >
                                                    Change Icon
                                                </label>
                                                <p className="text-xs text-gray-500 mt-1">Max 5MB, PNG/JPG</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Server Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Server Name
                                        </label>
                                        <input
                                            type="text"
                                            value={serverName}
                                            onChange={(e) => setServerName(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-100 dark:bg-[#2b2d31] border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                                            disabled={isLoading}
                                        />
                                    </div>

                                    {/* Server Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Server Type
                                        </label>
                                        <select
                                            value={serverType}
                                            onChange={(e) => setServerType(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-100 dark:bg-[#2b2d31] border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                                            disabled={isLoading}
                                        >
                                            {serverTypes.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Privacy */}
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="isPrivate"
                                            checked={isPrivate}
                                            onChange={(e) => setIsPrivate(e.target.checked)}
                                            className="w-4 h-4 text-rose-600 bg-gray-100 border-gray-300 rounded focus:ring-rose-500"
                                            disabled={isLoading}
                                        />
                                        <label htmlFor="isPrivate" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                                            Private Server (Users must request to join)
                                        </label>
                                    </div>

                                    {/* Invite Code */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Invite Code
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={server?.inviteCode || 'loading...'}
                                                readOnly
                                                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-[#2b2d31] border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white font-mono"
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(server?.inviteCode || '');
                                                    alert('Invite code copied!');
                                                }}
                                                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg">
                                            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSaveSettings}
                                        disabled={isLoading}
                                        className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isLoading && (
                                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        )}
                                        Save Changes
                                    </button>
                                </div>
                            )}

                            {/* Bans Tab */}
                            {activeTab === 'bans' && (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Banned Members</h3>
                                        <p className="text-gray-600 dark:text-gray-400">View and manage banned users</p>
                                    </div>
                                    <button
                                        onClick={() => setShowBanList(true)}
                                        className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg transition-colors"
                                    >
                                        View Ban List
                                    </button>
                                </div>
                            )}

                            {/* Transfer Ownership Tab */}
                            {activeTab === 'transfer' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Transfer Ownership</h3>
                                        <p className="text-gray-600 dark:text-gray-400">Give complete control to another member</p>
                                    </div>

                                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-lg">
                                        <div className="flex items-start gap-3">
                                            <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <div>
                                                <h4 className="font-bold text-yellow-900 dark:text-yellow-300 mb-1">This action is permanent!</h4>
                                                <p className="text-sm text-yellow-800 dark:text-yellow-400">
                                                    Once you transfer ownership, you will become a regular member. Only the new owner can transfer it back.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowTransferDialog(true)}
                                        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
                                    >
                                        Transfer Ownership
                                    </button>
                                </div>
                            )}

                            {/* Delete Server Tab */}
                            {activeTab === 'delete' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Delete Server</h3>
                                        <p className="text-gray-600 dark:text-gray-400">Permanently delete this server</p>
                                    </div>

                                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg">
                                        <div className="flex items-start gap-3">
                                            <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <div>
                                                <h4 className="font-bold text-red-900 dark:text-red-300 mb-1">⚠️ Danger Zone</h4>
                                                <ul className="text-sm text-red-800 dark:text-red-400 space-y-1">
                                                    <li>• All channels will be deleted</li>
                                                    <li>• All messages will be lost</li>
                                                    <li>• All members will be removed</li>
                                                    <li>• This action cannot be undone</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowDeleteDialog(true)}
                                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                                    >
                                        Delete Server
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Transfer Ownership Dialog */}
            <TransferOwnershipDialog
                isOpen={showTransferDialog}
                onClose={() => setShowTransferDialog(false)}
                serverId={server?.id}
                members={members}
                currentOwnerId={currentUser?.id}
                onSuccess={() => {
                    setShowTransferDialog(false);
                    onClose();
                    window.location.reload(); // Reload to update permissions
                }}
            />

            {/* Ban List Panel */}
            <BanListPanel
                serverId={server?.id}
                isOpen={showBanList}
                onClose={() => setShowBanList(false)}
            />

            {/* Delete Server Confirmation */}
            <ConfirmDialog
                isOpen={showDeleteDialog}
                onClose={() => {
                    setShowDeleteDialog(false);
                    setDeleteConfirmText('');
                }}
                onConfirm={handleDeleteServer}
                title="Delete Server"
                confirmText="Delete Forever"
                isDangerous={true}
                isLoading={isLoading}
            >
                <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">
                        Are you absolutely sure you want to delete <strong className="text-red-500">{server?.name}</strong>?
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        To confirm, please type the server name below:
                    </p>
                    <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder={server?.name}
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-[#2b2d31] border border-red-300 dark:border-red-800 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    )}
                </div>
            </ConfirmDialog>
        </>
    );
};

export default ServerSettingsModal;
