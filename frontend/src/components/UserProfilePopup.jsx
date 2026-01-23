import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { sendFriendRequest, getFriends, getPendingRequests } from '../services/friendService';
import { useNotification } from '../context/NotificationContext';

const UserProfilePopup = ({ user, position, onClose, currentUser }) => {
    const { showNotification } = useNotification();
    const [status, setStatus] = useState('loading'); // loading, friend, pending, none, self
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            if (!user || !currentUser) return;

            if (user.id === currentUser.id) {
                setStatus('self');
                setIsLoading(false);
                return;
            }

            try {
                // Fetch friends and pending requests to determine status
                // In a real app, we might want to optimize this or pass status in
                const [friendsRes, requestsRes] = await Promise.all([
                    getFriends(),
                    getPendingRequests()
                ]);

                const friends = friendsRes.friends || [];
                const requests = requestsRes.requests || [];

                const isFriend = friends.some(f => f.id === user.id);
                const isPending = requests.some(r => r.user.id === user.id || (r.userId === currentUser.id && r.friendId === user.id)); // Logic depends on backend response structure

                // Check pending logic properly assuming requests list contains requests SENT and RECEIVED
                // If the backend only returns received requests, we might not know if WE sent one. 
                // However, let's assume 'none' for now if not friend. 
                // NOTE: The backend `getPendingRequests` usually returns requests waiting for ME to accept (incoming).
                // Backend `getFriends` returns accepted friends.
                // We might need a check for 'Request Sent' but for now 'Add Friend' is safe.

                if (isFriend) setStatus('friend');
                else setStatus('none');

            } catch (err) {
                console.error("Error checking friend status", err);
                setStatus('none');
            } finally {
                setIsLoading(false);
            }
        };

        checkStatus();
    }, [user, currentUser]);

    const handleAddFriend = async () => {
        setIsLoading(true);
        try {
            await sendFriendRequest(user.username);
            showNotification(`Friend request sent to ${user.username}`, 'success');
            setStatus('pending');
            onClose();
        } catch (err) {
            console.error("Add friend failed", err);
            showNotification(err.response?.data?.message || "Failed to send request", "error");
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    // Adjust position to keep on screen
    const style = {
        top: Math.min(position.y, window.innerHeight - 300),
        left: Math.min(position.x, window.innerWidth - 320),
    };

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose}></div>
            <div
                className="fixed z-50 w-80 bg-[#111214] dark:bg-[#111214] rounded-lg shadow-2xl border border-black/20 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                style={style}
            >
                {/* Banner (matching user banner color or default) */}
                <div className="h-16 bg-rose-600"></div>

                {/* Header (Avatar + Badges) */}
                <div className="px-4 pb-4 relative">
                    <div className="absolute -top-10 left-4">
                        <div className="w-20 h-20 rounded-full border-[6px] border-[#111214] bg-[#111214] overflow-hidden">
                            {user.avatar ? (
                                <img src={user.avatar} className="w-full h-full object-cover" alt={user.username} />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-700 text-white font-bold text-2xl">
                                    {user.username?.[0]?.toUpperCase()}
                                </div>
                            )}
                        </div>
                        {/* Status Indicator */}
                        <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-[4px] border-[#111214]"></div>
                    </div>

                    {/* Action Buttons Top Right */}
                    <div className="flex justify-end pt-3 gap-2">
                        {/* Only show actions if not self */}
                        {status !== 'self' && (
                            <button className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-md transition-colors text-white" title="Message">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </button>
                        )}
                        <button className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-md transition-colors text-white">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                        </button>
                    </div>

                    <div className="mt-12">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-white">{user.username}</h3>
                            {status === 'friend' && (
                                <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Friend</span>
                            )}
                        </div>
                        <div className="text-sm text-gray-400 font-medium">#{user.id}</div>

                        {/* Divider */}
                        <div className="h-[1px] bg-white/10 my-3"></div>

                        {/* About Me Section (Placeholder) */}
                        <div className="mb-4">
                            <h4 className="text-xs font-bold text-gray-300 uppercase mb-1">About Me</h4>
                            <p className="text-sm text-gray-400">
                                This user has not added a bio yet.
                            </p>
                        </div>

                        {/* Mutuals (Placeholder) */}
                        <div className="mb-4">
                            <h4 className="text-xs font-bold text-gray-300 uppercase mb-1">Member Since</h4>
                            <p className="text-sm text-gray-400">
                                {new Date(user.createdAt || Date.now()).toLocaleDateString()}
                            </p>
                        </div>

                        {/* Add Friend Button */}
                        {status === 'none' && !isLoading && (
                            <button
                                onClick={handleAddFriend}
                                className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                                Add Friend
                            </button>
                        )}

                        {/* Pending Button */}
                        {status === 'pending' && (
                            <button
                                disabled
                                className="w-full py-2 bg-gray-600 text-gray-300 rounded text-sm font-medium cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Request Pending
                            </button>
                        )}

                        {/* Self View - Edit? */}
                        {status === 'self' && (
                            <div className="w-full py-2 bg-gray-700/50 text-gray-400 rounded text-sm font-medium text-center">
                                This is you!
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default UserProfilePopup;
