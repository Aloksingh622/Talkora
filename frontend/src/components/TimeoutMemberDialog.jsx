import React, { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

/**
 * Dialog for timing out a member
 */
const TimeoutMemberDialog = ({ isOpen, onClose, member, serverId, onSuccess }) => {
    const [duration, setDuration] = useState(300); // Default 5 minutes (300 seconds)
    const [reason, setReason] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Duration options in seconds
    const durationOptions = [
        { label: '60 seconds', value: 60 },
        { label: '5 minutes', value: 300 },
        { label: '10 minutes', value: 600 },
        { label: '1 hour', value: 3600 },
        { label: '1 day', value: 86400 },
        { label: '1 week', value: 604800 },
    ];

    const handleTimeout = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { timeoutMember } = await import('../services/memberService');
            await timeoutMember(serverId, member.userId, duration, reason || null);

            onSuccess?.();
            handleClose();
        } catch (err) {
            console.error('Timeout member error:', err);
            setError(err.response?.data?.message || 'Failed to timeout member');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setDuration(300);
        setReason('');
        setError(null);
        onClose();
    };

    return (
        <ConfirmDialog
            isOpen={isOpen}
            onClose={handleClose}
            onConfirm={handleTimeout}
            title="Timeout Member"
            confirmText="Apply Timeout"
            cancelText="Cancel"
            isDangerous={false}
            isLoading={isLoading}
        >
            <div className="space-y-4">
                <p className="text-gray-700 dark:text-gray-300">
                    Temporarily restrict <span className="font-bold text-rose-500">{member?.user?.username}</span> from sending messages.
                </p>

                {/* Duration Picker */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Duration
                    </label>
                    <select
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-[#2b2d31] border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                        disabled={isLoading}
                    >
                        {durationOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Reason Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Reason (Optional)
                    </label>
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g., Excessive caps, Off-topic..."
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-[#2b2d31] border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        disabled={isLoading}
                    />
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
                    <p className="text-xs text-blue-800 dark:text-blue-400">
                        ℹ️ The timeout will automatically expire after the selected duration. You can remove it early anytime.
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

export default TimeoutMemberDialog;
