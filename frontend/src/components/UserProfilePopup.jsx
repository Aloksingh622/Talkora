import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { sendFriendRequest, getFriends, getPendingRequests } from '../services/friendService';
import { createOrGetDMChannel } from '../services/dmService';
import { useNotification } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import OnlineIndicator from './OnlineIndicator';

const UserProfilePopup = ({ user, position, onClose, currentUser, isOnline }) => {
    const { showNotification } = useNotification();
    const navigate = useNavigate();
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
                const [friendsRes, requestsRes] = await Promise.all([
                    getFriends(),
                    getPendingRequests()
                ]);

                const friends = friendsRes.friends || [];
                const requests = requestsRes.requests || [];

                const isFriend = friends.some(f => f.id === user.id);

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

    const handleStartChat = async () => {
        setIsLoading(true);
        try {
            const data = await createOrGetDMChannel(user.id);
            navigate(`/channels/@me/${data.dmChannel.id}`);
            onClose();
        } catch (err) {
            console.error("Failed to start chat", err);
            if (err.response && err.response.status === 403) {
                showNotification("To chat with this person, please add them as a friend first.", "warning");
            } else {
                showNotification("Failed to start chat", "error");
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    // Get user's custom colors with fallbacks
    const bannerColor = user.bannerColor || '#f43f5e';
    const bannerImage = user.bannerImage;
    const ringColor = user.ringColor || bannerColor;

    // Get banner style
    const getBannerStyle = () => {
        if (bannerImage) {
            return {
                backgroundImage: `url(${bannerImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            };
        }
        return { backgroundColor: bannerColor };
    };

    // Adjust position to keep on screen
    const style = {
        top: Math.min(position.y, window.innerHeight - 380),
        left: Math.min(position.x, window.innerWidth - 340),
    };

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose}></div>
            <div
                className="fixed z-50 w-80 bg-[#111214] rounded-xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                style={style}
            >
                {/* Dynamic Banner */}
                <div
                    className="h-20 relative transition-all"
                    style={getBannerStyle()}
                >
                    {/* Gradient overlay for better text readability */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30"></div>
                </div>

                {/* Header (Avatar + Badges) */}
                <div className="px-4 pb-4 relative">
                    {/* Avatar with Ring Color */}
                    <div className="absolute -top-10 left-4">
                        <div
                            className="w-20 h-20 rounded-full p-[3px] shadow-xl"
                            style={{
                                background: `linear-gradient(135deg, ${ringColor}, ${ringColor}88)`,
                                boxShadow: `0 0 20px ${ringColor}40`
                            }}
                        >
                            <div className="w-full h-full rounded-full border-4 border-[#111214] bg-[#111214] overflow-hidden">
                                {user.avatar ? (
                                    <img src={user.avatar} className="w-full h-full object-cover" alt={user.username} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-2xl">
                                        {user.username?.[0]?.toUpperCase()}
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Status Indicator */}
                        <div className="absolute bottom-1 right-1">
                            <OnlineIndicator online={isOnline} size="md" />
                        </div>
                    </div>

                    {/* Action Buttons Top Right */}
                    <div className="flex justify-end pt-3 gap-2">
                        {status !== 'self' && (
                            <button
                                onClick={handleStartChat}
                                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white hover:scale-105"
                                title="Message"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </button>
                        )}
                    </div>

                    <div className="mt-12">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-white">{user.displayName || user.username}</h3>
                            {status === 'friend' && (
                                <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Friend</span>
                            )}
                        </div>
                        <div className="text-sm text-gray-400 font-medium">@{user.username}</div>

                        {/* Divider */}
                        <div className="h-[1px] bg-white/10 my-3"></div>

                        {/* About Me Section */}
                        <div className="mb-4">
                            <h4 className="text-xs font-bold text-gray-300 uppercase mb-1.5 tracking-wide">About Me</h4>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                {user.bio || 'This user has not added a bio yet.'}
                            </p>
                        </div>

                        {/* Member Since */}
                        <div className="mb-4">
                            <h4 className="text-xs font-bold text-gray-300 uppercase mb-1.5 tracking-wide">Member Since</h4>
                            <p className="text-sm text-gray-400">
                                {new Date(user.createdAt || Date.now()).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>

                        {/* Add Friend Button */}
                        {status === 'none' && !isLoading && (
                            <button
                                onClick={handleAddFriend}
                                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 hover:shadow-lg shadow-rose-900/20"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                                Add Friend
                            </button>
                        )}

                        {/* Pending Button */}
                        {status === 'pending' && (
                            <button
                                disabled
                                className="w-full py-2.5 bg-gray-600 text-gray-300 rounded-lg text-sm font-medium cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Request Pending
                            </button>
                        )}

                        {/* Self View */}
                        {status === 'self' && (
                            <div
                                className="w-full py-2.5 rounded-lg text-sm font-medium text-center"
                                style={{ backgroundColor: `${ringColor}20`, color: ringColor }}
                            >
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
