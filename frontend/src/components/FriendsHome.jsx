import React, { useState, useEffect } from 'react';
import { getFriends, getPendingRequests, acceptFriendRequest, rejectOrRemoveFriend } from '../services/friendService';
import { createOrGetDMChannel } from '../services/dmService';
import { useNavigate } from 'react-router-dom';
import UserProfilePopup from './UserProfilePopup';

const FriendsHome = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('online'); // online, all, pending, blocked, add_friend
    const [friends, setFriends] = useState([]);
    const [pending, setPending] = useState({ incoming: [], outgoing: [] });
    const [loading, setLoading] = useState(true);
    const [selectedUserForPopup, setSelectedUserForPopup] = useState(null);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'pending') {
                const data = await getPendingRequests();
                setPending(data);
            } else {
                const data = await getFriends();
                setFriends(data.friends || []);
            }
        } catch (err) {
            console.error("Failed to load friend data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleMessage = async (userId) => {
        try {
            const data = await createOrGetDMChannel(userId);
            // According to dmController.js, it returns { dmChannel: { id, ... } }
            if (data.dmChannel?.id) {
                navigate(`/channels/@me/${data.dmChannel.id}`);
            } else if (data.channel?.id) {
                // Fallback request
                navigate(`/channels/@me/${data.channel.id}`);
            }
        } catch (err) {
            console.error("Failed to open DM", err);
        }
    };

    const handleAccept = async (requestId) => {
        try {
            await acceptFriendRequest(requestId);
            loadData(); // Refresh
        } catch (err) {
            console.error("Failed to accept", err);
        }
    };

    const handleReject = async (requestId) => {
        try {
            await rejectOrRemoveFriend(requestId); // Assuming endpoint handles requestId for delete
            loadData();
        } catch (err) {
            console.error("Failed to reject", err);
        }
    };

    const renderFriendItem = (friend) => (
        <div key={friend.id} className="flex items-center justify-between p-2.5 hover:bg-white/5 rounded-lg group border-t border-white/5 cursor-pointer">
            <div className="flex items-center gap-3 flex-1" onClick={() => setSelectedUserForPopup(friend)}>
                <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                    {friend.avatar ? (
                        <img src={friend.avatar} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-white">
                            {friend.username?.[0]?.toUpperCase()}
                        </div>
                    )}
                </div>
                <div>
                    <div className="font-bold text-white text-sm">
                        {friend.username}
                        <span className="text-gray-500 font-normal ml-1">#{friend.id}</span>
                    </div>
                    <div className="text-xs text-gray-400">Online</div>
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={(e) => { e.stopPropagation(); handleMessage(friend.id); }}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
                    title="Message"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </button>
                <button
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                    title="more"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                </button>
            </div>
        </div>
    );

    const renderPendingItem = (req, isIncoming) => {
        const user = isIncoming ? req.requester : req.addressee;
        return (
            <div key={req.id} className="flex items-center justify-between p-2.5 hover:bg-white/5 rounded-lg group border-t border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                        {user.avatar ? (
                            <img src={user.avatar} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-white">
                                {user.username?.[0]?.toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="font-bold text-white text-sm">{user.username}</div>
                        <div className="text-xs text-gray-400">{isIncoming ? 'Incoming Friend Request' : 'Outgoing Friend Request'}</div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isIncoming && (
                        <button
                            onClick={() => handleAccept(req.id)}
                            className="p-2 bg-gray-800 hover:bg-green-600 rounded-full text-gray-400 hover:text-white transition-colors"
                            title="Accept"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                    )}
                    <button
                        onClick={() => handleReject(req.id)}
                        className="p-2 bg-gray-800 hover:bg-red-600 rounded-full text-gray-400 hover:text-white transition-colors"
                        title={isIncoming ? "Ignore" : "Cancel"}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 bg-[#313338] dark:bg-[#313338] h-full flex flex-col">
            {/* Header */}
            <div className="h-12 border-b border-black/20 flex items-center px-4 gap-4 shadow-sm">
                <div className="flex items-center gap-2 mr-4 text-gray-500 font-bold">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                    Friends
                </div>
                <div className="h-6 w-[1px] bg-white/10"></div>

                <button onClick={() => setActiveTab('online')} className={`px-2 py-0.5 rounded hover:bg-white/5 transition-colors font-medium text-sm ${activeTab === 'online' ? 'text-white bg-white/10' : 'text-gray-400'}`}>Online</button>
                <button onClick={() => setActiveTab('all')} className={`px-2 py-0.5 rounded hover:bg-white/5 transition-colors font-medium text-sm ${activeTab === 'all' ? 'text-white bg-white/10' : 'text-gray-400'}`}>All</button>
                <button onClick={() => setActiveTab('pending')} className={`px-2 py-0.5 rounded hover:bg-white/5 transition-colors font-medium text-sm ${activeTab === 'pending' ? 'text-white bg-white/10' : 'text-gray-400'}`}>Pending</button>
                <button onClick={() => setActiveTab('add_friend')} className={`px-2 py-0.5 rounded transition-colors font-medium text-sm ${activeTab === 'add_friend' ? 'text-green-500 bg-transparent' : 'bg-green-600 text-white hover:bg-green-700'}`}>Add Friend</button>
            </div>

            {/* Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                {activeTab === 'add_friend' ? (
                    <div className="max-w-2xl">
                        <h2 className="text-white font-bold text-xl mb-2">ADD FRIEND</h2>
                        <p className="text-gray-400 text-sm mb-4">You can add friends with their username. It's case sensitive!</p>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="You can add friends with their username."
                                className="w-full bg-[#1e1f22] border border-black/20 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                            <button className="absolute right-2 top-1.5 bg-indigo-500 px-4 py-1.5 rounded text-sm text-white font-medium hover:bg-indigo-600">Send Friend Request</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">
                            {activeTab === 'pending' ? `Pending - ${pending.incoming.length + pending.outgoing.length}` : `${activeTab} Friends - ${friends.length}`}
                        </div>

                        {loading ? (
                            <div className="text-gray-500 text-sm">Loading...</div>
                        ) : (
                            <div className="space-y-1">
                                {activeTab === 'pending' ? (
                                    <>
                                        {pending.incoming.map(req => renderPendingItem(req, true))}
                                        {pending.outgoing.map(req => renderPendingItem(req, false))}
                                        {pending.incoming.length === 0 && pending.outgoing.length === 0 && (
                                            <div className="text-gray-500 text-sm flex flex-col items-center mt-10">
                                                <img src="https://discord.com/assets/b61a7a160759021af788.svg" className="w-64 opacity-50 mb-4" />
                                                <p>There are no pending friend requests. Here's Wumpus for now.</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {friends.map(renderFriendItem)}
                                        {friends.length === 0 && (
                                            <div className="text-gray-500 text-sm flex flex-col items-center mt-10">
                                                <img src="https://discord.com/assets/26dae03be86c589b37c0.svg" className="w-64 opacity-50 mb-4" />
                                                <p>No one's around to play with Wumpus.</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Reuse Popup if needed */}
            {selectedUserForPopup && (
                <UserProfilePopup
                    user={selectedUserForPopup}
                    position={{ x: 300, y: 300 }} // Placeholder position 
                    currentUser={{ id: 999 }} // Placeholder
                    onClose={() => setSelectedUserForPopup(null)}
                />
            )}
        </div>
    );
};

export default FriendsHome;
