import React, { useEffect, useState } from 'react';
import { getBannedMembers, unbanMember } from '../services/memberService';
import ConfirmDialog from './ConfirmDialog';

/**
 * Panel for viewing and managing banned members
 */
const BanListPanel = ({ serverId, isOpen, onClose }) => {
    const [bans, setBans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [unbanningUserId, setUnbanningUserId] = useState(null);
    const [showUnbanDialog, setShowUnbanDialog] = useState(false);
    const [selectedBan, setSelectedBan] = useState(null);

    useEffect(() => {
        if (isOpen && serverId) {
            fetchBans();
        }
    }, [isOpen, serverId]);

    const fetchBans = async () => {
        setLoading(true);
        try {
            const data = await getBannedMembers(serverId);
            setBans(data.bans || []);
        } catch (err) {
            console.error('Failed to fetch bans:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUnbanClick = (ban) => {
        setSelectedBan(ban);
        setShowUnbanDialog(true);
    };

    const handleUnban = async () => {
        if (!selectedBan) return;

        setUnbanningUserId(selectedBan.userId);
        try {
            await unbanMember(serverId, selectedBan.userId);
            await fetchBans(); // Refresh list
            setShowUnbanDialog(false);
            setSelectedBan(null);
        } catch (err) {
            console.error('Unban error:', err);
            alert(err.response?.data?.message || 'Failed to unban user');
        } finally {
            setUnbanningUserId(null);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
                <div
                    className="bg-white dark:bg-[#1e1e24] rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col border border-gray-200 dark:border-white/10"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Banned Members</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <svg className="w-8 h-8 animate-spin text-rose-500" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                        ) : bans.length === 0 ? (
                            <div className="text-center py-12">
                                <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                                <p className="text-gray-500 dark:text-gray-400 font-medium">No banned members</p>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">When you ban someone, they'll appear here</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {bans.map((ban) => (
                                    <div
                                        key={ban.id}
                                        className="bg-gray-50 dark:bg-[#2b2d31] rounded-lg p-4 border border-gray-200 dark:border-white/10 hover:border-red-300 dark:hover:border-red-800/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-bold">
                                                    {ban.user?.username?.[0]?.toUpperCase() || 'U'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                                                        {ban.user?.username}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        Banned by {ban.bannedByUser?.username} • {formatDate(ban.bannedAt)}
                                                    </p>
                                                    {ban.reason && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                                                            "{ban.reason}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleUnbanClick(ban)}
                                                disabled={unbanningUserId === ban.userId}
                                                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {unbanningUserId === ban.userId ? (
                                                    <>
                                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Unbanning...
                                                    </>
                                                ) : (
                                                    'Unban'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Unban Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showUnbanDialog}
                onClose={() => {
                    setShowUnbanDialog(false);
                    setSelectedBan(null);
                }}
                onConfirm={handleUnban}
                title="Unban Member"
                message={`Are you sure you want to unban ${selectedBan?.user?.username}? They will be able to rejoin the server.`}
                confirmText="Unban"
                isDangerous={false}
                isLoading={unbanningUserId !== null}
            />
        </>
    );
};

export default BanListPanel;
