import React, { useEffect, useState } from 'react';
import { getUserPresence } from '../services/presenceService';
import OnlineIndicator from './OnlineIndicator';
import { useSelector, useDispatch } from 'react-redux';
import BanMemberDialog from './BanMemberDialog';
import KickMemberDialog from './KickMemberDialog';
import TimeoutMemberDialog from './TimeoutMemberDialog';
import UserProfilePopup from './UserProfilePopup';
import { fetchServerMembers, fetchBannedMembers } from '../redux/server_slice';

const MemberList = ({ serverId, channelId }) => {
    const dispatch = useDispatch();

    // Get data from Redux
    const currentUser = useSelector(state => state.auth.user);
    const servers = useSelector(state => state.server.servers);
    const serverDetails = useSelector(state => state.server.serverDetails[serverId] || {});

    // Local UI state
    const [memberPresence, setMemberPresence] = useState({});
    const [isExpanded, setIsExpanded] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [selectedMember, setSelectedMember] = useState(null);
    const [showBanDialog, setShowBanDialog] = useState(false);
    const [showKickDialog, setShowKickDialog] = useState(false);
    const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
    const [profilePopup, setProfilePopup] = useState({ visible: false, user: null, position: { x: 0, y: 0 } });

    // Derived data from Redux
    const members = serverDetails.members || [];
    const bannedUsers = serverDetails.bannedUsers || [];
    const currentServer = servers.find(s => s.id === parseInt(serverId));

    // Fetch members and banned users from Redux
    useEffect(() => {
        if (serverId) {
            // Always fetch fresh members when switching servers (no cache)
            dispatch(fetchServerMembers(serverId));

            // Always fetch fresh banned users
            dispatch(fetchBannedMembers(serverId));
        }
    }, [serverId, dispatch]);


    const fetchMemberPresence = async (userId) => {
        try {
            const presence = await getUserPresence(userId);
            setMemberPresence(prev => ({
                ...prev,
                [userId]: presence
            }));
        } catch (err) {
            console.error(`Failed to fetch presence for ${userId}`, err);
        }
    };

    // Fetch presence for all members
    useEffect(() => {
        if (members.length === 0) return;

        // Initial fetch
        members.forEach(member => {
            if (member.userId) {
                fetchMemberPresence(member.userId);
            }
        });

        // Refresh presence every 10 seconds
        const interval = setInterval(() => {
            members.forEach(member => {
                if (member.userId) {
                    fetchMemberPresence(member.userId);
                }
            });
        }, 10000);

        return () => clearInterval(interval);
    }, [members]);

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) {
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [contextMenu]);

    const isOwner = currentServer?.ownerId === currentUser?.id;

    const handleContextMenu = (e, member) => {
        e.preventDefault();

        // Don't show menu for yourself or if you're not the owner
        if (member.userId === currentUser?.id || !isOwner) return;

        // Don't show menu for the server owner
        if (member.userId === currentServer?.ownerId) return;

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            member
        });
    };

    const handleKick = (member) => {
        setSelectedMember(member);
        setShowKickDialog(true);
        setContextMenu(null);
    };

    const handleBan = (member) => {
        setSelectedMember(member);
        setShowBanDialog(true);
        setContextMenu(null);
    };

    const handleTimeout = (member) => {
        setSelectedMember(member);
        setShowTimeoutDialog(true);
        setContextMenu(null);
    };

    const handleActionSuccess = () => {
        // Refresh members and banned users via Redux
        dispatch(fetchServerMembers(serverId));
        dispatch(fetchBannedMembers(serverId));
    };

    const handleMemberClick = (e, member) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        // Position popup to the left of the member list
        setProfilePopup({
            visible: true,
            user: {
                id: member.userId,
                username: member.user?.username,
                displayName: member.user?.displayName,
                avatar: member.user?.avatar,
                bannerColor: member.user?.bannerColor,
                bannerImage: member.user?.bannerImage,
                ringColor: member.user?.ringColor,
                bio: member.user?.bio,
                createdAt: member.user?.createdAt,
                role: member.role
            },
            position: { x: rect.left - 320, y: rect.top },
            isOnline: memberPresence[member.userId]?.online || false
        });
    };

    // Helper to check if member is online (always true for current user)
    const isMemberOnline = (userId) => {
        if (currentUser && userId === currentUser.id) return true;
        return memberPresence[userId]?.online || false;
    };

    const onlineMembers = members.filter(m => isMemberOnline(m.userId));
    const offlineMembers = members.filter(m => !isMemberOnline(m.userId));

    // Helper function to check if user is banned
    const isBanned = (userId) => {
        return bannedUsers.some(ban => ban.userId === userId);
    };

    // Helper function to format relative time
    const getRelativeTime = (timestamp) => {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    };

    const renderMember = (member, isOnline) => {
        const banned = isBanned(member.userId);
        const canManage = isOwner && member.userId !== currentUser?.id && member.userId !== currentServer?.ownerId;
        const userRingColor = member.user?.ringColor || '#8b5cf6';
        const isServerOwner = member.role === 'OWNER';
        const isAdmin = member.role === 'ADMIN';

        return (
            <div
                key={member.userId}
                className={`flex items-center px-2.5 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.06] cursor-pointer group transition-all duration-200 relative ${!isOnline && 'opacity-50 hover:opacity-100'}`}
                onClick={(e) => handleMemberClick(e, member)}
            >
                {/* Avatar with ring color support */}
                <div className="relative mr-3 flex-shrink-0">
                    <div
                        className={`w-11 h-11 rounded-full p-[2.5px] transition-all duration-300 ${!isOnline && 'grayscale group-hover:grayscale-0'} group-hover:scale-105`}
                        style={{
                            background: isOnline ? `linear-gradient(135deg, ${userRingColor}, ${userRingColor}88)` : 'linear-gradient(135deg, #6b7280, #4b5563)',
                            boxShadow: isOnline ? `0 0 15px ${userRingColor}40` : 'none'
                        }}
                    >
                        <div className="w-full h-full rounded-full bg-[#F9FAFB] dark:bg-[#111116] p-[1.5px]">
                            {member.user?.avatar ? (
                                <img
                                    src={member.user.avatar}
                                    alt={member.user?.username}
                                    className="w-full h-full rounded-full object-cover"
                                />
                            ) : (
                                <div className={`w-full h-full rounded-full flex items-center justify-center text-white font-bold text-sm ${isOnline ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gray-400 dark:bg-gray-600'}`}>
                                    {member.user?.username?.[0]?.toUpperCase() || 'U'}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 rounded-full">
                        <OnlineIndicator online={isOnline} size="xs" />
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-semibold truncate transition-colors ${banned
                            ? 'text-red-500 dark:text-red-400'
                            : isOnline
                                ? 'text-gray-900 dark:text-white group-hover:text-rose-500'
                                : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200'
                            }`}>
                            {member.user?.displayName || member.user?.username}
                        </span>
                        {banned && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-medium">Banned</span>}
                        {member.userId === currentUser?.id && (
                            <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-medium">you</span>
                        )}
                    </div>
                    {/* Role Badge */}
                    {isServerOwner && (
                        <div className="flex items-center mt-0.5">
                            <span className="inline-flex items-center text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                Owner
                            </span>
                        </div>
                    )}
                    {isAdmin && !isServerOwner && (
                        <div className="flex items-center mt-0.5">
                            <span className="inline-flex items-center text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                Admin
                            </span>
                        </div>
                    )}
                    {!isOnline && memberPresence[member.userId]?.lastSeen && (
                        <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 flex items-center">
                            <svg className="w-3 h-3 mr-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {getRelativeTime(memberPresence[member.userId].lastSeen)}
                        </div>
                    )}
                </div>

                {/* Menu Button (Shows on Hover for Owner) */}
                {canManage && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleContextMenu(e, member);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg"
                        title="Manage member"
                    >
                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                    </button>
                )}
            </div>
        );
    };

    return (
        <>
            <div
                className={`transition-all duration-300 ease-in-out border-l border-gray-200 dark:border-white/5 flex flex-col h-screen ${isExpanded ? 'w-60 bg-[#F9FAFB] dark:bg-[#111116]' : 'w-16 bg-[#F9FAFB] dark:bg-[#0e0e12] cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5'}`}
                onClick={() => !isExpanded && setIsExpanded(true)}
            >
                {/* Header */}
                <div className="p-4 shadow-sm border-b border-gray-200 dark:border-white/5 flex items-center justify-between h-14 bg-[#F9FAFB] dark:bg-[#111116] z-10 sticky top-0">
                    {isExpanded ? (
                        <>
                            <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest whitespace-nowrap">
                                Members — {members.length}
                            </h3>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                                className="text-gray-400 hover:text-rose-500 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center w-full space-y-2">
                            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar overflow-x-hidden">
                    {isExpanded ? (
                        <>
                            {/* Online Members */}
                            {onlineMembers.length > 0 && (
                                <div className="mb-6">
                                    <div className="px-2 py-2 text-xs font-bold text-gray-500 dark:text-gray-500 uppercase flex items-center mb-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                                        <span className="tracking-wider">Online — {onlineMembers.length}</span>
                                    </div>
                                    {onlineMembers.map(member => renderMember(member, true))}
                                </div>
                            )}

                            {/* Offline Members */}
                            {offlineMembers.length > 0 && (
                                <div>
                                    <div className="px-2 py-2 text-xs font-bold text-gray-500 dark:text-gray-500 uppercase flex items-center mb-1">
                                        <span className="w-2 h-2 rounded-full border border-gray-500 mr-2"></span>
                                        <span className="tracking-wider">Offline — {offlineMembers.length}</span>
                                    </div>
                                    {offlineMembers.map(member => renderMember(member, false))}
                                </div>
                            )}

                            {members.length === 0 && (
                                <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8 italic opacity-50">
                                    It's quiet here...
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center pt-2 space-y-4">
                            <div className="flex flex-col items-center" title={`${onlineMembers.length} Online`}>
                                <span className="w-3 h-3 rounded-full bg-green-500 mb-1"></span>
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{onlineMembers.length}</span>
                            </div>

                            <div className="flex flex-col items-center space-y-2">
                                {onlineMembers.slice(0, 5).map(member => {
                                    const userRingColor = member.user?.ringColor || '#8b5cf6';
                                    return (
                                        <div
                                            key={member.userId}
                                            className="relative"
                                            title={member.user?.displayName || member.user?.username}
                                        >
                                            <div
                                                className="w-9 h-9 rounded-full p-[2px] transition-all hover:scale-110"
                                                style={{
                                                    background: `linear-gradient(135deg, ${userRingColor}, ${userRingColor}88)`,
                                                    boxShadow: `0 0 8px ${userRingColor}30`
                                                }}
                                            >
                                                <div className="w-full h-full rounded-full bg-[#F9FAFB] dark:bg-[#0e0e12] p-[1px]">
                                                    {member.user?.avatar ? (
                                                        <img
                                                            src={member.user.avatar}
                                                            alt={member.user?.username}
                                                            className="w-full h-full rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                                            {member.user?.username?.[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="absolute -bottom-0.5 -right-0.5 rounded-full">
                                                <OnlineIndicator online={true} size="xs" />
                                            </div>
                                        </div>
                                    );
                                })}
                                {(onlineMembers.length > 5) && (
                                    <div className="text-xs text-gray-400 font-bold">+{onlineMembers.length - 5}</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-[#1e1e24] rounded-lg shadow-2xl border border-white/10 py-2 min-w-[200px] z-50 animate-scaleIn"
                    style={{
                        left: `${contextMenu.x - 220}px`, // Position to the LEFT (subtract menu width)
                        top: `${contextMenu.y}px`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-2 border-b border-white/10 mb-1">
                        <p className="text-sm font-bold text-white">{contextMenu.member.user?.username}</p>
                        <p className="text-xs text-gray-400">{contextMenu.member.role}</p>
                    </div>

                    <button
                        onClick={() => handleKick(contextMenu.member)}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-rose-500/20 hover:text-rose-400 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Kick Member
                    </button>

                    <button
                        onClick={() => handleBan(contextMenu.member)}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-red-500/20 hover:text-red-400 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        Ban Member
                    </button>

                    <button
                        onClick={() => handleTimeout(contextMenu.member)}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-yellow-500/20 hover:text-yellow-400 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Timeout Member
                    </button>
                </div>
            )}

            {/* Dialogs */}
            <KickMemberDialog
                isOpen={showKickDialog}
                onClose={() => setShowKickDialog(false)}
                member={selectedMember}
                serverId={serverId}
                onSuccess={handleActionSuccess}
            />

            <BanMemberDialog
                isOpen={showBanDialog}
                onClose={() => setShowBanDialog(false)}
                member={selectedMember}
                serverId={serverId}
                onSuccess={handleActionSuccess}
            />

            <TimeoutMemberDialog
                isOpen={showTimeoutDialog}
                onClose={() => setShowTimeoutDialog(false)}
                member={selectedMember}
                serverId={serverId}
                onSuccess={handleActionSuccess}
            />

            {/* User Profile Popup */}
            {profilePopup.visible && profilePopup.user && (
                <UserProfilePopup
                    user={profilePopup.user}
                    position={profilePopup.position}
                    currentUser={currentUser}
                    isOnline={profilePopup.isOnline}
                    onClose={() => setProfilePopup({ visible: false, user: null, position: { x: 0, y: 0 } })}
                />
            )}

            <style jsx>{`
                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                .animate-scaleIn {
                    animation: scaleIn 150ms ease-out;
                }
            `}</style>
        </>
    );
};

export default MemberList;
