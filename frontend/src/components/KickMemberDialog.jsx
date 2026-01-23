import React, { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

/**
 * Dialog for kicking a member from the server
 */
const KickMemberDialog = ({ isOpen, onClose, member, serverId, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleKick = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { kickMember } = await import('../services/memberService');
            await kickMember(serverId, member.userId);

            onSuccess?.();
            handleClose();
        } catch (err) {
            console.error('Kick member error:', err);
            setError(err.response?.data?.message || 'Failed to kick member');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setError(null);
        onClose();
    };

    return (
        <ConfirmDialog
            isOpen={isOpen}
            onClose={handleClose}
            onConfirm={handleKick}
            title="Kick Member"
            confirmText="Kick User"
            cancelText="Cancel"
            isDangerous={true}
            isLoading={isLoading}
        >
            <div className="space-y-4">
                <p className="text-gray-700 dark:text-gray-300">
                    Are you sure you want to kick <span className="font-bold text-rose-500">{member?.user?.username}</span>?
                </p>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                    They will be removed from the server but can rejoin if they have an invite link.
                </p>

                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800/30">
                    <p className="text-xs text-yellow-800 dark:text-yellow-400">
                        💡 <strong>Note:</strong> Message history will be kept. Use <strong>Ban</strong> if you want to prevent them from rejoining.
                    </p>
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

export default KickMemberDialog;
