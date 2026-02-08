import React from 'react';

const ChannelItem = ({ channel, selectedChannelId, activeVoiceChannelId, onChannelSelect, onVoiceSelect, isOwner, handleDeleteChannel }) => {
    return (
        <div
            className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer group transition-all duration-200 ${(selectedChannelId === channel.id && !activeVoiceChannelId && channel.type === 'TEXT') ||
                    (activeVoiceChannelId === channel.id && (channel.type === 'AUDIO' || channel.type === 'VIDEO'))
                    ? (channel.type === 'TEXT' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-green-500/10 text-green-600 dark:text-green-400')
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
        >
            <div
                className="flex items-center flex-1 min-w-0"
                onClick={() => {
                    if (channel.type === 'TEXT') {
                        onChannelSelect(channel.id);
                    } else {
                        onVoiceSelect && onVoiceSelect(channel);
                    }
                }}
            >
                {channel.type === 'TEXT' ? (
                    <span className="text-lg mr-1.5 opacity-60">#</span>
                ) : (
                    <svg className="w-5 h-5 mr-1.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {channel.type === 'VIDEO' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m0 0a5 5 0 007.072 0m-7.072 0l7.072-7.072a5 5 0 000-7.072m0 7.072L13 13" />
                        )}
                    </svg>
                )}
                <span className={`truncate font-medium ${(selectedChannelId === channel.id && !activeVoiceChannelId && channel.type === 'TEXT') ? 'font-bold' : ''}`}>{channel.name}</span>
            </div>
            {isOwner && (
                <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteChannel(channel.id, channel.name); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity"
                    title="Delete channel"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export default ChannelItem;
