import React from 'react';

const OnlineIndicator = ({ online, size = 'sm' }) => {
    const sizeClasses = {
        xs: 'w-2 h-2',
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
    };

    return (
        <div className="relative inline-block">
            <div
                className={`${sizeClasses[size]} rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'} border-2 border-white dark:border-gray-900`}
                title={online ? 'Online' : 'Offline'}
            />
            {online && (
                <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-green-500 animate-ping opacity-75`} />
            )}
        </div>
    );
};

export default OnlineIndicator;
