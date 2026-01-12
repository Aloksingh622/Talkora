import React, { useEffect, useState } from 'react';
import { getUserPresence } from '../services/presenceService';
import OnlineIndicator from './OnlineIndicator';
import { useSelector } from 'react-redux';
import axios from '../utils/axios';

const MemberList = ({ serverId, channelId }) => {
    const [members, setMembers] = useState([]);
    const [memberPresence, setMemberPresence] = useState({});
    const currentUser = useSelector(state => state.auth.user);

    useEffect(() => {
        if (serverId) {
            fetchMembers();
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
        }, 10000); // 10 seconds

        return () => clearInterval(interval);
    }, [members]);

    const onlineMembers = members.filter(m => memberPresence[m.userId]?.online);
    const offlineMembers = members.filter(m => !memberPresence[m.userId]?.online);

    return (
        <div className="w-60 bg-gray-100 dark:bg-[#111] h-screen border-l border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="p-4">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                    Members — {members.length}
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto px-2">
                {/* Online Members */}
                {onlineMembers.length > 0 && (
                    <div className="mb-4">
                        <div className="px-2 py-1 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase flex items-center">
                            <OnlineIndicator online={true} size="xs" />
                            <span className="ml-2">Online — {onlineMembers.length}</span>
                        </div>
                        {onlineMembers.map(member => (
                            <div
                                key={member.userId}
                                className="flex items-center px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer group"
                            >
                                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm mr-3 relative">
                                    {member.user?.username?.[0]?.toUpperCase() || 'U'}
                                    <div className="absolute bottom-0 right-0">
                                        <OnlineIndicator online={true} size="xs" />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {member.user?.username}
                                        {member.userId === currentUser?.id && (
                                            <span className="ml-1 text-xs text-gray-500">(you)</span>
                                        )}
                                    </div>
                                    {member.role === 'OWNER' && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Owner</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Offline Members */}
                {offlineMembers.length > 0 && (
                    <div>
                        <div className="px-2 py-1 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase flex items-center">
                            <OnlineIndicator online={false} size="xs" />
                            <span className="ml-2">Offline — {offlineMembers.length}</span>
                        </div>
                        {offlineMembers.map(member => (
                            <div
                                key={member.userId}
                                className="flex items-center px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer opacity-60 group"
                            >
                                <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-sm mr-3 relative">
                                    {member.user?.username?.[0]?.toUpperCase() || 'U'}
                                    <div className="absolute bottom-0 right-0">
                                        <OnlineIndicator online={false} size="xs" />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-700 dark:text-gray-400 truncate">
                                        {member.user?.username}
                                        {member.userId === currentUser?.id && (
                                            <span className="ml-1 text-xs text-gray-500">(you)</span>
                                        )}
                                    </div>
                                    {memberPresence[member.userId]?.lastSeen && (
                                        <div className="text-xs text-gray-500 dark:text-gray-500">
                                            {getRelativeTime(memberPresence[member.userId].lastSeen)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {members.length === 0 && (
                    <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                        No members found
                    </div>
                )}
            </div>
        </div>
    );
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

export default MemberList;
