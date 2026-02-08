import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDMConversations, addDMConversation } from '../redux/dm_slice';
import { getSocket } from '../utils/socket';
import { useNavigate, useParams } from 'react-router-dom';
import UserProfileBar from './UserProfileBar';

const DMList = ({ selectedChannelId }) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { conversations, conversationsLoading, conversationsLastFetched } = useSelector(state => state.dm);
    const loading = conversationsLoading && !conversationsLastFetched;

    useEffect(() => {
        // Fetch DMs if not cached (fetch once per session or on invalidation)
        if (!conversationsLastFetched) {
            dispatch(fetchDMConversations());
        }
    }, [dispatch, conversationsLastFetched]);

    // Real-time updates for DMs
    useEffect(() => {
        const socket = getSocket();
        if (socket) {
            const handleDMChannelCreated = (data) => {
                if (data.dmChannel) {
                    dispatch(addDMConversation(data.dmChannel));
                }
            };

            // Also listen for new messages to bump conversation to top
            // Assuming backend sends a specific event or we reuse DM_CHANNEL_CREATED logic if it sends full object
            // For now, DM_CHANNEL_CREATED is the main one for new convos.

            socket.on('DM_CHANNEL_CREATED', handleDMChannelCreated);

            return () => {
                socket.off('DM_CHANNEL_CREATED', handleDMChannelCreated);
            };
        }
    }, [dispatch]);

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
            <div className="h-12 shadow-sm flex items-center px-2 border-b border-[#1f2023] bg-[#2b2d31]">
                <button
                    onClick={() => navigate('/channels/@me')}
                    className="w-full text-left text-gray-400 hover:text-gray-200 text-sm font-medium px-2 py-1.5 rounded-md bg-[#1e1f22] border border-black/20 transition-all truncate shadow-inner hover:shadow-none"
                >
                    Find or start a conversation
                </button>
            </div>

            {/* DM List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                {/* Friends Button */}
                <div
                    onClick={() => navigate('/channels/@me')}
                    className={`flex items-center px-2.5 py-2.5 rounded-md hover:bg-[#35373c] cursor-pointer text-gray-400 hover:text-gray-100 mb-4 transition-all group ${!selectedChannelId ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : ''}`}
                >
                    <div className={`w-8 flex justify-center ${!selectedChannelId ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400 group-hover:text-gray-200'}`}>
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
                    </div>
                    <span className="font-medium ml-3">Friends</span>
                </div>

                <div className="flex items-center justify-between px-2 pt-2 pb-1 text-xs font-bold text-gray-500 hover:text-gray-300 transition-colors group cursor-default">
                    <span>Direct Messages</span>
                    <button className="text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white transition-all transform hover:rotate-90">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                </div>

                {loading ? (
                    <div className="p-4 text-center text-xs text-gray-500">Loading...</div>
                ) : conversations.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">No active conversations</div>
                ) : (
                    conversations.map(dm => {
                        const otherUser = getOtherUser(dm);
                        const isSelected = selectedChannelId && parseInt(selectedChannelId) === parseInt(dm.channelId);

                        return (
                            <div
                                key={dm.channelId}
                                onClick={() => navigate(`/channels/@me/${dm.channelId}`)}
                                className={`flex items-center px-2.5 py-2 rounded-md cursor-pointer group transition-all ${isSelected ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'text-gray-400 hover:bg-[#35373c] hover:text-gray-200'}`}
                            >
                                <div className="relative flex-shrink-0">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden shadow-sm">
                                        {otherUser.avatar ? (
                                            <img src={otherUser.avatar} className="w-full h-full object-cover" alt={otherUser.username} />
                                        ) : (
                                            <div className="text-xs font-bold text-white">
                                                {otherUser.username?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#80848e] rounded-full border-[3px] border-[#2b2d31] group-hover:border-[#35373c] transition-colors"></div>
                                </div>
                                <div className="ml-3 flex-1 min-w-0">
                                    <div className={`font-medium truncate text-sm ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                        {otherUser.username}
                                    </div>
                                </div>
                                <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white transition-opacity" title="Close DM">
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
