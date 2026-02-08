import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const showNotification = useCallback((message, type = 'info') => {
        const id = Date.now();
        const notification = { id, message, type };

        setNotifications(prev => [...prev, notification]);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ showNotification, removeNotification }}>
            {children}
            <NotificationContainer notifications={notifications} onRemove={removeNotification} />
        </NotificationContext.Provider>
    );
};

const NotificationContainer = ({ notifications, onRemove }) => {
    return (
        <div className="fixed top-4 right-4 z-50 space-y-2">
            {notifications.map(notification => (
                <NotificationToast
                    key={notification.id}
                    notification={notification}
                    onRemove={onRemove}
                />
            ))}
        </div>
    );
};

const NotificationToast = ({ notification, onRemove }) => {
    const { id, message, type } = notification;

    const baseStyles = "relative overflow-hidden rounded-lg shadow-lg border p-4 flex items-start gap-3 min-w-[320px] max-w-md animate-slide-in transition-all duration-300 backdrop-blur-sm";

    // Theme-aware styles: White bg for light, Dark Gray for dark
    const themeStyles = "bg-white/95 dark:bg-[#1e1f22]/95 border-gray-200 dark:border-black/20 text-gray-900 dark:text-gray-100";

    const typeConfig = {
        info: {
            iconColor: "text-blue-500",
            borderColor: "border-blue-500",
            bgHighlight: "bg-blue-500",
            icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        success: {
            iconColor: "text-green-500",
            borderColor: "border-green-500",
            bgHighlight: "bg-green-500",
            icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        warning: {
            iconColor: "text-yellow-500",
            borderColor: "border-yellow-500",
            bgHighlight: "bg-yellow-500",
            icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            )
        },
        error: {
            iconColor: "text-rose-500",
            borderColor: "border-rose-500",
            bgHighlight: "bg-rose-500",
            icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
    };

    const config = typeConfig[type] || typeConfig.info;

    return (
        <div className={`${baseStyles} ${themeStyles}`}>
            {/* Colored left strip */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${config.bgHighlight}`} />

            {/* Icon */}
            <div className={`flex-shrink-0 ${config.iconColor} mt-0.5`}>
                {config.icon}
            </div>

            {/* Content */}
            <div className="flex-1 mr-2">
                <p className="text-sm font-semibold leading-5">{message}</p>
            </div>

            {/* Close Button */}
            <button
                onClick={() => onRemove(id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Dismiss"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};
