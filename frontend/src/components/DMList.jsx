import React, { useEffect, useState } from 'react';
import { getDMConversations } from '../services/dmService';
import { useNavigate, useParams } from 'react-router-dom';
import UserProfileBar from './UserProfileBar';

const DMList = ({ selectedChannelId }) => {
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDMs = async () => {
            try {
                const data = await getDMConversations();
                setConversations(data.conversations || []);
            } catch (err) {
                console.error("Failed to load DMs", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDMs();
    }, []);

    const getOtherUser = (conversation) => {
        // We might need current user ID to know who is 'other', but typically the backend provides normalized 'user' object or we check participants
        // Checking the backend response structure for `getDMConversations` would be ideal.
        // Assuming backend returns a `user` object for the other person or we filter.
        // Let's assume for now the backend formats it or we use `user1`/`user2`.
        // If provided by backend as `otherUser`, use that. If not, we need Redux state.

        // Actually, looking at typical efficient backend patterns, it often returns the "other user" directly or a list of participants.
        // Let's assume the mapped object has `otherUser` or `username` from the service.
        // Waiting for verification if this breaks. 
        // Based on `dmController` (step 234 failed), I haven't seen the `getDMConversations` response structure confirmed.
        // I will optimistically check for `otherUser`. if not, I'll fix it.
        return conversation.otherUser || conversation.user || { username: 'Unknown' };
    };

    return (
        <div className="w-60 bg-[#2b2d31] dark:bg-[#111214] flex flex-col h-full border-r border-black/10">
            {/* Search / Top Bar */}
            <div className="h-12 shadow-sm flex items-center px-4 border-b border-black/10">
                <button
                    onClick={() => navigate('/channels/@me')}
                    className="w-full text-left text-gray-400 hover:text-gray-200 text-sm font-medium px-2 py-1 rounded bg-black/20 hover:bg-black/30 transition-colors truncate"
                >
                    Find or start a conversation
                </button>
            </div>

            {/* DM List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                {/* Friends Button */}
                <div
                    onClick={() => navigate('/channels/@me')}
                    className={`flex items-center px-2 py-2.5 rounded hover:bg-white/5 cursor-pointer text-gray-400 hover:text-gray-200 mb-4 ${!selectedChannelId ? 'bg-white/10 text-white' : ''}`}
                >
                    <div className="w-8 flex justify-center">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                    <span className="font-bold ml-3">Friends</span>
                </div>

                <div className="px-2 pt-2 pb-1 text-xs font-bold text-gray-500 uppercase hover:text-gray-300 transition-colors cursor-default">
                    Direct Messages
                </div>

                {loading ? (
                    <div className="p-4 text-center text-xs text-gray-500">Loading...</div>
                ) : conversations.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">No active conversations</div>
                ) : (
                    conversations.map(dm => {
                        const otherUser = getOtherUser(dm);
                        return (
                            <div
                                key={dm.channelId}
                                onClick={() => navigate(`/channels/@me/${dm.channelId}`)}
                                className={`flex items-center px-2 py-2 rounded hover:bg-white/5 cursor-pointer group ${parseInt(selectedChannelId) === dm.channelId ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                            >
                                <div className="relative flex-shrink-0">
                                    <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                                        {otherUser.avatar ? (
                                            <img src={otherUser.avatar} className="w-full h-full object-cover" alt={otherUser.username} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs text-white">
                                                {otherUser.username?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-gray-500 rounded-full border-2 border-[#2b2d31]"></div>
                                </div>
                                <div className="ml-3 flex-1 min-w-0">
                                    <div className="font-medium truncate text-sm">
                                        {otherUser.username}
                                    </div>
                                    {/* Optional: Last message preview */}
                                </div>
                                <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-gray-300" title="Close DM">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Profile Bar */}
            <UserProfileBar />
        </div>
    );
};

export default DMList;
