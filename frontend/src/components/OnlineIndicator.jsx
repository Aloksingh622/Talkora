import React from 'react';

const OnlineIndicator = ({ online, size = 'sm' }) => {
    const sizeClasses = {
        xs: 'w-2.5 h-2.5',
        sm: 'w-3.5 h-3.5',
        md: 'w-4 h-4',
    };

    return (
        <div className="relative inline-block">
            {online ? (
                <div
                    className={`${sizeClasses[size]} rounded-full bg-green-500 border-2 border-white dark:border-[#0a0a10]`}
                    title="Online"
                />
            ) : (
                <div
                    className={`${sizeClasses[size]} rounded-full bg-gray-400 dark:bg-gray-600 border-2 border-white dark:border-[#0a0a10]`}
                    title="Offline"
                />
            )}
        </div>
    );
};

export default OnlineIndicator;
