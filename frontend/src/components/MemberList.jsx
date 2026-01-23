import React, { useEffect, useState } from 'react';
import { getUserPresence } from '../services/presenceService';
import OnlineIndicator from './OnlineIndicator';
import { useSelector } from 'react-redux';
import axios from '../utils/axios';
import BanMemberDialog from './BanMemberDialog';
import KickMemberDialog from './KickMemberDialog';
import TimeoutMemberDialog from './TimeoutMemberDialog';
import { getBannedMembers } from '../services/memberService';

const MemberList = ({ serverId, channelId }) => {
    const [members, setMembers] = useState([]);
    const [bannedUsers, setBannedUsers] = useState([]);
    const [memberPresence, setMemberPresence] = useState({});
    const [isExpanded, setIsExpanded] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [selectedMember, setSelectedMember] = useState(null);
    const [showBanDialog, setShowBanDialog] = useState(false);
    const [showKickDialog, setShowKickDialog] = useState(false);
    const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
    const currentUser = useSelector(state => state.auth.user);
    const [currentServer, setCurrentServer] = useState(null);

    useEffect(() => {
        if (serverId) {
            fetchMembers();
            fetchBannedUsers();
            fetchServerInfo();
        }
    }, [serverId]);

    const fetchMembers = async () => {
        try {
            console.log('Fetching members for server:', serverId);
            const response = await axios.get(`/api/servers/${serverId}/members`);
            console.log('Members received:', response.data.members);
            setMembers(response.data.members || []);
        } catch (err) {
            console.error('Failed to fetch members:', err);
        }
    };

    const fetchBannedUsers = async () => {
        try {
            const data = await getBannedMembers(serverId);
            setBannedUsers(data.bans || []);
        } catch (err) {
            // Not owner or error - ignore
            console.log('Could not fetch banned users:', err.response?.data?.message);
        }
    };

    const fetchServerInfo = async () => {
        try {
            const response = await axios.get(`/api/servers`);
            const server = response.data.servers?.find(s => s.id === parseInt(serverId));
            setCurrentServer(server);
        } catch (err) {
            console.error('Failed to fetch server info:', err);
        }
    };

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
        // Refresh members and banned users
        fetchMembers();
        fetchBannedUsers();
    };

    const onlineMembers = members.filter(m => memberPresence[m.userId]?.online);
    const offlineMembers = members.filter(m => !memberPresence[m.userId]?.online);

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

        return (
            <div
                key={member.userId}
                className={`flex items-center px-2 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/5 cursor-pointer group transition-all relative ${!isOnline && 'opacity-60 hover:opacity-100'}`}
            >
                <div className={`w-9 h-9 rounded-full ${isOnline ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gray-400 dark:bg-gray-700 grayscale group-hover:grayscale-0'} flex items-center justify-center text-white font-bold text-sm mr-3 relative transition-all flex-shrink-0`}>
                    {member.user?.username?.[0]?.toUpperCase() || 'U'}
                    <div className="absolute bottom-0 right-0 ring-2 ring-[#F9FAFB] dark:ring-[#111116] rounded-full">
                        <OnlineIndicator online={isOnline} size="xs" />
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold truncate transition-colors ${banned
                        ? 'text-red-500 dark:text-red-400'
                        : isOnline
                            ? 'text-gray-900 dark:text-gray-200 group-hover:text-rose-500'
                            : 'text-gray-700 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200'
                        }`}>
                        {member.user?.username}
                        {banned && <span className="ml-1 text-xs font-normal">(Banned)</span>}
                        {member.userId === currentUser?.id && (
                            <span className={`ml-1 text-xs font-normal ${banned ? 'text-red-400' : 'text-rose-400'}`}>(you)</span>
                        )}
                    </div>
                    {member.role === 'OWNER' && (
                        <div className="text-[10px] font-bold text-rose-500 flex items-center mt-0.5">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            Owner
                        </div>
                    )}
                    {!isOnline && memberPresence[member.userId]?.lastSeen && (
                        <div className="text-xs text-gray-500 dark:text-gray-600 mt-0.5">
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
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-300 dark:hover:bg-white/10 rounded-lg"
                        title="Manage member"
                    >
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                {onlineMembers.slice(0, 5).map(member => (
                                    <div key={member.userId} className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold relative shadow-sm ring-2 ring-transparent hover:ring-rose-500 transition-all">
                                        {member.user?.username?.[0]?.toUpperCase()}
                                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#F9FAFB] dark:border-[#0e0e12] rounded-full"></div>
                                    </div>
                                ))}
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
