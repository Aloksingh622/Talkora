import React, { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

/**
 * Dialog for banning a member with optional message deletion
 */
const BanMemberDialog = ({ isOpen, onClose, member, serverId, onSuccess }) => {
    const [reason, setReason] = useState('');
    const [deleteMessages, setDeleteMessages] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleBan = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { banMember } = await import('../services/memberService');
            await banMember(serverId, member.userId, reason || null, deleteMessages);

            onSuccess?.();
            handleClose();
        } catch (err) {
            console.error('Ban member error:', err);
            setError(err.response?.data?.message || 'Failed to ban member');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setReason('');
        setDeleteMessages(false);
        setError(null);
        onClose();
    };

    return (
        <ConfirmDialog
            isOpen={isOpen}
            onClose={handleClose}
            onConfirm={handleBan}
            title="Ban Member"
            confirmText="Ban User"
            cancelText="Cancel"
            isDangerous={true}
            isLoading={isLoading}
        >
            <div className="space-y-4">
                <p className="text-gray-700 dark:text-gray-300">
                    Are you sure you want to ban <span className="font-bold text-red-500">{member?.user?.username}</span>?
                </p>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                    They will be removed from the server and won't be able to rejoin until unbanned.
                </p>

                {/* Reason Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Reason (Optional)
                    </label>
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g., Spamming, Harassment..."
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-[#2b2d31] border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                        disabled={isLoading}
                    />
                </div>

                {/* Delete Messages Checkbox */}
                <div className="flex items-start space-x-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/30">
                    <input
                        type="checkbox"
                        id="deleteMessages"
                        checked={deleteMessages}
                        onChange={(e) => setDeleteMessages(e.target.checked)}
                        className="mt-1 w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
                        disabled={isLoading}
                    />
                    <label htmlFor="deleteMessages" className="flex-1 cursor-pointer">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                            Delete all messages from this user
                        </span>
                        <span className="block text-xs text-gray-600 dark:text-gray-400 mt-1">
                            This will permanently delete all messages sent by this user in this server. This action cannot be undone.
                        </span>
                    </label>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                )}
            </div>
        </ConfirmDialog>
    );
};

export default BanMemberDialog;
