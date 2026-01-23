import React from 'react';

/**
 * Reusable Confirmation Dialog Component
 * @param {boolean} isOpen - Whether the dialog is open
 * @param {function} onClose - Callback when user clicks cancel or outside
 * @param {function} onConfirm - Callback when user confirms
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message/description
 * @param {string} confirmText - Text for confirm button (default: "Confirm")
 * @param {string} cancelText - Text for cancel button (default: "Cancel")
 * @param {boolean} isDangerous - Whether this is a dangerous/destructive action (red styling)
 * @param {boolean} isLoading - Whether an action is currently loading
 * @param {React.ReactNode} children - Optional custom content to render instead of message
 */
const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isDangerous = false,
    isLoading = false,
    children
}) => {
    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn"
            onClick={handleBackdropClick}
        >
            <div className="bg-white dark:bg-[#1e1e24] rounded-xl shadow-2xl max-w-md  w-full mx-4 transform transition-all animate-scaleIn border border-gray-200 dark:border-white/10">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-white/10">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {title}
                    </h2>
                </div>

                {/* Content */}
                <div className="p-6">
                    {children || (
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            {message}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-gray-200 dark:border-white/10 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[#2b2d31] hover:bg-gray-200 dark:hover:bg-[#3b3d41] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${isDangerous
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-rose-500 hover:bg-rose-600 text-white'
                            }`}
                    >
                        {isLoading && (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {confirmText}
                    </button>
                </div>
            </div>

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                .animate-fadeIn {
                    animation: fadeIn 150ms ease-out;
                }
                .animate-scaleIn {
                    animation: scaleIn 200ms ease-out;
                }
            `}</style>
        </div>
    );
};

export default ConfirmDialog;
