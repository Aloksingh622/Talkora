import React, { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

/**
 * Dialog for transferring server ownership to another member
 */
const TransferOwnershipDialog = ({ isOpen, onClose, serverId, members, currentOwnerId, onSuccess }) => {
    const [selectedMember, setSelectedMember] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Filter out current owner
    const eligibleMembers = members?.filter(m => m.userId !== currentOwnerId) || [];

    const handleTransfer = async () => {
        if (!selectedMember) {
            setError('Please select a member');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { transferOwnership } = await import('../services/serverService');
            await transferOwnership(serverId, parseInt(selectedMember));

            onSuccess?.();
            handleClose();
        } catch (err) {
            console.error('Transfer ownership error:', err);
            setError(err.response?.data?.message || 'Failed to transfer ownership');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedMember('');
        setError(null);
        onClose();
    };

    const selectedMemberData = eligibleMembers.find(m => m.userId === parseInt(selectedMember));

    return (
        <ConfirmDialog
            isOpen={isOpen}
            onClose={handleClose}
            onConfirm={handleTransfer}
            title="Transfer Server Ownership"
            confirmText="Transfer Ownership"
            cancelText="Cancel"
            isDangerous={true}
            isLoading={isLoading}
        >
            <div className="space-y-4">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg">
                    <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <h4 className="font-bold text-red-900 dark:text-red-300 mb-1">⚠️ Warning: This Cannot Be Undone!</h4>
                            <p className="text-sm text-red-800 dark:text-red-400">
                                Transferring ownership is <strong>permanent</strong>. You will become a regular member and the new owner will have complete control over the server.
                            </p>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select New Owner
                    </label>
                    <select
                        value={selectedMember}
                        onChange={(e) => setSelectedMember(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-[#2b2d31] border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                        disabled={isLoading}
                    >
                        <option value="">-- Choose a member --</option>
                        {eligibleMembers.map(member => (
                            <option key={member.userId} value={member.userId}>
                                {member.user?.username} ({member.role})
                            </option>
                        ))}
                    </select>
                </div>

                {selectedMemberData && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
                        <p className="text-sm text-blue-800 dark:text-blue-400">
                            <strong>{selectedMemberData.user?.username}</strong> will become the new server owner. They will have full control and you will become a regular member.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                )}
            </div>
        </ConfirmDialog>
    );
};

export default TransferOwnershipDialog;
