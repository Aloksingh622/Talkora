import React, { useState, useEffect, useCallback } from 'react';
import { searchUsers } from '../services/friendService';
import { createOrGetDMChannel } from '../services/dmService';
import { useNavigate } from 'react-router-dom';
import UserProfilePopup from './UserProfilePopup';
import { getSocket } from '../utils/socket';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-hot-toast';
import friendImage from '../assets/friend.png';
import happyFriendImage from '../assets/happyfriend.png';
import {
    fetchFriends,
    fetchPendingRequests,
    acceptFriendRequestThunk,
    rejectOrRemoveFriendThunk,
    sendFriendRequestThunk,
    updateFriendPresence,
    addFriend,
    removeFriend,
    addPendingRequest
} from '../redux/friend_slice';

const FriendsHome = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user } = useSelector(state => state.auth);

    // Redux state
    const {
        friends,
        friendsLoading,
        friendsLastFetched,
        pendingRequests,
        pendingLoading,
        pendingLastFetched
    } = useSelector(state => state.friend);

    // Local UI state
    const [activeTab, setActiveTab] = useState('online'); // online, all, pending, add_friend
    const [searchQuery, setSearchQuery] = useState('');
    const [addFriendUsername, setAddFriendUsername] = useState('');
    const [selectedUserForPopup, setSelectedUserForPopup] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Derived state for loading
    const loading = activeTab === 'pending' ? pendingLoading : friendsLoading;
    const pending = pendingRequests;

    // Load data based on active tab
    useEffect(() => {
        if (activeTab === 'pending') {
            // Always fetch pending requests (unless already loading)
            if (!pendingLoading) {
                dispatch(fetchPendingRequests());
            }
        } else if (activeTab !== 'add_friend') {
            // Fetch friends only if never fetched AND not currently loading
            if (!friendsLastFetched && !friendsLoading) {
                dispatch(fetchFriends());
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, dispatch, friendsLastFetched]);

    // Socket listeners for real-time updates
    useEffect(() => {
        const socket = getSocket();
        if (socket) {
            const handlePresenceUpdate = ({ userId, status, lastSeen }) => {
                dispatch(updateFriendPresence({ userId, online: status === 'online', lastSeen }));
            };

            const handleFriendRequest = (data) => {
                // Determine if incoming or outgoing based on data structure
                // Assuming data contains the request object
                dispatch(addPendingRequest({ request: data.request, isIncoming: true }));
                toast.success("New friend request received!");
            };

            const handleFriendAccepted = (data) => {
                // Add friend directly to store
                if (data.friend) {
                    dispatch(addFriend(data.friend));
                    toast.success("Friend request accepted!");
                }
            };

            const handleFriendRemoved = (data) => {
                if (data.userId) {
                    dispatch(removeFriend(data.userId));
                }
            };

            socket.on('PRESENCE_UPDATE', handlePresenceUpdate);
            socket.on('FRIEND_REQUEST', handleFriendRequest);
            socket.on('FRIEND_ACCEPTED', handleFriendAccepted);
            socket.on('FRIEND_REMOVED', handleFriendRemoved);

            return () => {
                socket.off('PRESENCE_UPDATE', handlePresenceUpdate);
                socket.off('FRIEND_REQUEST', handleFriendRequest);
                socket.off('FRIEND_ACCEPTED', handleFriendAccepted);
                socket.off('FRIEND_REMOVED', handleFriendRemoved);
            };
        }
    }, [dispatch]);

    const handleMessage = async (userId) => {
        try {
            const data = await createOrGetDMChannel(userId);
            if (data.dmChannel?.id) {
                navigate(`/channels/@me/${data.dmChannel.id}`);
            } else if (data.channel?.id) {
                navigate(`/channels/@me/${data.channel.id}`);
            }
        } catch (err) {
            console.error("Failed to open DM", err);
            toast.error("Failed to open DM");
        }
    };

    const handleAccept = async (requestId) => {
        try {
            await dispatch(acceptFriendRequestThunk(requestId)).unwrap();
            toast.success("Friend added!");
        } catch (err) {
            console.error("Failed to accept", err);
            toast.error("Failed to accept friend request");
        }
    };

    const handleReject = async (requestId) => {
        try {
            await dispatch(rejectOrRemoveFriendThunk(requestId)).unwrap();
            toast.success("Request ignored");
        } catch (err) {
            console.error("Failed to reject", err);
            toast.error("Failed to ignore request");
        }
    };

    const handleSendFriendRequest = async (userIdOrUsername) => {
        const target = userIdOrUsername || addFriendUsername;
        if (!target) return;
        try {
            await dispatch(sendFriendRequestThunk(target)).unwrap();
            if (!userIdOrUsername) setAddFriendUsername('');
            toast.success(`Friend request sent!`);
            // Update search results to reflect pending status
            setSearchResults(prev => prev.map(u =>
                u.id === target ? { ...u, friendshipStatus: 'pending_outgoing' } : u
            ));
        } catch (err) {
            console.error("Failed to send request", err);
            toast.error(err?.message || "Failed to send friend request");
        }
    };

    // Debounced search for Add Friend
    useEffect(() => {
        if (activeTab !== 'add_friend') {
            setSearchResults([]);
            return;
        }

        if (addFriendUsername.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        const timeout = setTimeout(async () => {
            setSearchLoading(true);
            try {
                console.log('Searching for:', addFriendUsername.trim());
                const data = await searchUsers(addFriendUsername.trim());
                console.log('Search response:', data);
                setSearchResults(data.users || []);
            } catch (err) {
                console.error("Search failed", err);
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timeout);
    }, [addFriendUsername, activeTab]);

    // Filter Logic
    const filteredFriends = friends.filter(friend => {
        // 1. Search Filter
        const matchesSearch = friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (friend.displayName && friend.displayName.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch) return false;

        // 2. Tab Filter
        if (activeTab === 'online') {
            return friend.online;
        }
        return true;
    });

    const renderFriendItem = (friend) => (
        <div key={friend.friendshipId || friend.id} className="flex items-center justify-between p-2.5 hover:bg-[#35373c] rounded-lg group border-t border-white/5 cursor-pointer transition-colors duration-200">
            <div className="flex items-center gap-3 flex-1" onClick={() => setSelectedUserForPopup({ ...friend, position: { x: 300, y: 300 } })}>
                <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden shadow-sm">
                        {friend.avatar ? (
                            <img src={friend.avatar} className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-sm font-bold text-white">
                                {friend.username?.[0]?.toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-[#313338] ${friend.online ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                </div>
                <div>
                    <div className="font-bold text-gray-200 group-hover:text-white transition-colors text-sm flex items-center gap-1.5">
                        {friend.displayName || friend.username}
                        <span className="text-gray-500 font-medium text-xs hidden group-hover:inline">#{friend.username}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {friend.online ? (
                            <>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                                <span className="text-xs text-gray-300 font-medium">Online</span>
                            </>
                        ) : (
                            <span className="text-xs text-gray-500 font-medium">Offline</span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => { e.stopPropagation(); handleMessage(friend.id); }}
                    className="p-2 bg-[#2b2d31] hover:bg-[#1e1f22] rounded-full text-gray-400 hover:text-white transition-all shadow-sm"
                    title="Message"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); /* More options */ }}
                    className="p-2 bg-[#2b2d31] hover:bg-[#1e1f22] rounded-full text-gray-400 hover:text-rose-500 transition-all shadow-sm"
                    title="More"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                </button>
            </div>
        </div>
    );

    const renderPendingItem = (req, isIncoming) => {
        const user = isIncoming ? req.requester : req.addressee;
        return (
            <div key={req.id} className="flex items-center justify-between p-2.5 hover:bg-[#35373c] rounded-lg group border-t border-white/5 transition-colors duration-200">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden shadow-sm">
                        {user.avatar ? (
                            <img src={user.avatar} className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-sm font-bold text-white">
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
                            className="p-2 bg-[#2b2d31] hover:bg-green-600 rounded-full text-gray-400 hover:text-white transition-all shadow-sm"
                            title="Accept"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                    )}
                    <button
                        onClick={() => handleReject(req.id)}
                        className="p-2 bg-[#2b2d31] hover:bg-rose-600 rounded-full text-gray-400 hover:text-white transition-all shadow-sm"
                        title={isIncoming ? "Ignore" : "Cancel"}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 bg-gradient-to-br from-[#1a1d21] via-[#0d0f12] to-[#1a1d21] h-full flex flex-col font-sans relative">
            {/* Header */}
            <div className="h-12 border-b border-white/5 flex items-center px-4 gap-4 shadow-sm bg-[#1a1d21]/80 backdrop-blur-sm flex-shrink-0 z-10">
                <div className="flex items-center gap-2 mr-4 text-white font-bold select-none">
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                    Friends
                </div>
                <div className="h-6 w-[1px] bg-white/10"></div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('online')} className={`px-2.5 py-0.5 rounded hover:bg-[#393c41] hover:text-gray-100 transition-all font-medium text-sm ${activeTab === 'online' ? 'text-white bg-[#404249]' : 'text-gray-400'}`}>Online</button>
                    <button onClick={() => setActiveTab('all')} className={`px-2.5 py-0.5 rounded hover:bg-[#393c41] hover:text-gray-100 transition-all font-medium text-sm ${activeTab === 'all' ? 'text-white bg-[#404249]' : 'text-gray-400'}`}>All</button>
                    <button onClick={() => setActiveTab('pending')} className={`px-2.5 py-0.5 rounded hover:bg-[#393c41] hover:text-gray-100 transition-all font-medium text-sm ${activeTab === 'pending' ? 'text-white bg-[#404249]' : 'text-gray-400'}`}>
                        Pending
                        {(pending.incoming.length > 0) && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full">{pending.incoming.length}</span>
                        )}
                    </button>
                    <button onClick={() => setActiveTab('add_friend')} className={`px-2.5 py-0.5 rounded transition-all font-medium text-sm ${activeTab === 'add_friend' ? 'text-rose-400 bg-transparent' : 'bg-green-700 text-white hover:bg-green-800'}`}>Add Friend</button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">

                {/* Search Bar */}
                {activeTab !== 'add_friend' && activeTab !== 'pending' && (
                    <div className="mb-6 relative">
                        <input
                            type="text"
                            placeholder="Search"
                            className="w-full bg-[#1e1f22] text-gray-200 placeholder-gray-400 rounded-md py-1.5 px-3 pl-9 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 transition-all border border-transparent focus:border-red-600/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <div className="absolute left-2.5 top-2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                    </div>
                )}

                {activeTab === 'add_friend' ? (
                    <div className="flex flex-col items-center py-8 animate-in fade-in zoom-in duration-300">
                        {/* Top Section - Title and Search Bar (Always Fixed) */}
                        <h2 className="text-white font-bold text-2xl mb-2">Add a Friend</h2>
                        <p className="text-gray-400 text-sm mb-6 text-center max-w-md">Search for users by username or display name</p>

                        {/* Search Input - Always at top */}
                        <div className="w-full max-w-lg relative mb-8">
                            <div className="absolute left-4 top-4 text-gray-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search by username or display name..."
                                className="w-full bg-[#1e1f22] border border-white/10 focus:border-red-600 rounded-xl p-4 pl-12 text-white focus:outline-none transition-all placeholder-gray-500 font-medium shadow-lg"
                                value={addFriendUsername}
                                onChange={(e) => setAddFriendUsername(e.target.value)}
                            />
                            {searchLoading && (
                                <div className="absolute right-4 top-4">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-rose-500"></div>
                                </div>
                            )}
                        </div>

                        {/* Content Section - Below Search */}
                        <div className="w-full max-w-lg">
                            {/* State 1: Idle - Show Happy SparkBot */}
                            {addFriendUsername.trim().length < 2 && !searchLoading && (
                                <div className="flex flex-col items-center py-4 animate-in fade-in duration-200">
                                    <img src={happyFriendImage} alt="Happy SparkBot" className="w-48 h-48 object-contain mb-4" />
                                    <p className="text-gray-500 text-sm">Type at least 2 characters to search</p>
                                </div>
                            )}

                            {/* State 2: Loading */}
                            {searchLoading && (
                                <div className="flex flex-col items-center py-8">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500 mb-4"></div>
                                    <p className="text-gray-400 text-sm">Searching...</p>
                                </div>
                            )}

                            {/* State 3: Search Results Found */}
                            {!searchLoading && searchResults.length > 0 && (
                                <div className="space-y-2 animate-in fade-in duration-200">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-2">
                                        Search Results — {searchResults.length}
                                    </div>
                                    {searchResults.map(result => (
                                        <div key={result.id} className="flex items-center justify-between p-3 bg-[#1e1f22] hover:bg-[#2b2d31] rounded-xl transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden">
                                                    {result.avatar ? (
                                                        <img src={result.avatar} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-sm font-bold text-white">{result.username?.[0]?.toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-white">{result.displayName || result.username}</div>
                                                    <div className="text-xs text-gray-400">@{result.username}</div>
                                                </div>
                                            </div>
                                            <div>
                                                {result.friendshipStatus === 'none' && (
                                                    <button
                                                        onClick={() => handleSendFriendRequest(result.id)}
                                                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-rose-900/20"
                                                    >
                                                        Add Friend
                                                    </button>
                                                )}
                                                {result.friendshipStatus === 'pending_outgoing' && (
                                                    <span className="px-4 py-2 bg-gray-600 text-gray-300 text-sm font-medium rounded-lg">
                                                        Request Sent
                                                    </span>
                                                )}
                                                {result.friendshipStatus === 'pending_incoming' && (
                                                    <button
                                                        onClick={() => handleAccept(result.id)}
                                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-all"
                                                    >
                                                        Accept
                                                    </button>
                                                )}
                                                {result.friendshipStatus === 'friends' && (
                                                    <span className="px-4 py-2 bg-gray-700 text-green-400 text-sm font-medium rounded-lg flex items-center gap-1">
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                        Friends
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* State 4: No Results - Show Sad SparkBot */}
                            {!searchLoading && searchResults.length === 0 && addFriendUsername.trim().length >= 2 && (
                                <div className="flex flex-col items-center py-4 animate-in fade-in duration-200">
                                    <img src={friendImage} alt="No results" className="w-48 h-48 object-contain mb-4" />
                                    <p className="text-gray-400 font-medium">No users found matching "{addFriendUsername}"</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4 pl-2">
                            {activeTab === 'pending' ? `Pending - ${pending.incoming.length + pending.outgoing.length}` : `${activeTab === 'online' ? 'Online' : 'All'} Friends - ${filteredFriends.length}`}
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center p-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {activeTab === 'pending' ? (
                                    <>
                                        {pending.incoming.map(req => renderPendingItem(req, true))}
                                        {pending.outgoing.map(req => renderPendingItem(req, false))}
                                        {pending.incoming.length === 0 && pending.outgoing.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in duration-300">
                                                <img
                                                    src={friendImage}
                                                    alt="SparkBot is lonely"
                                                    className="w-72 h-72 object-contain mb-4"
                                                />
                                                <h3 className="text-white font-bold text-xl mb-1">No Sparks Yet</h3>
                                                <p className="text-gray-400 font-medium">
                                                    There are no pending friend requests.
                                                </p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {filteredFriends.map(renderFriendItem)}
                                        {filteredFriends.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in duration-300">
                                                <img
                                                    src={friendImage}
                                                    alt="SparkBot is lonely"
                                                    className="w-72 h-72 object-contain mb-4"
                                                />
                                                <h3 className="text-white font-bold text-xl mb-1">No Sparks Yet</h3>
                                                <p className="text-gray-400 font-medium">
                                                    {searchQuery ? 'No friends found matching your search.' :
                                                        activeTab === 'online' ? 'SparkBot is lonely. No one is online.' :
                                                            'SparkBot is lonely. Add some friends!'}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* User Profile Popup */}
            {selectedUserForPopup && (
                <div onClick={() => setSelectedUserForPopup(null)} className="absolute inset-0 z-50 overflow-hidden">
                    <div onClick={(e) => e.stopPropagation()}>
                        <UserProfilePopup
                            user={selectedUserForPopup}
                            position={{ x: 340, y: 120 }} // Approximate position
                            currentUser={user}
                            onClose={() => setSelectedUserForPopup(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default FriendsHome;
