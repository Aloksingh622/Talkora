import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import ServerSidebar from '../components/ServerSidebar';
import ChannelList from '../components/ChannelList';
import ChatArea from '../components/ChatArea';
import MemberList from '../components/MemberList';
import { initSocket, disconnectSocket, getSocket } from '../utils/socket';
import { getMyServers } from '../services/serverService';
import { useNotification } from '../context/NotificationContext';

const ChatPage = () => {
    const { serverId, channelId } = useParams();
    const navigate = useNavigate();
    const [channelName, setChannelName] = useState('');
    const [currentServer, setCurrentServer] = useState(null);
    const [servers, setServers] = useState([]);
    const { showNotification } = useNotification();

    useEffect(() => {
        // Initialize Socket
        initSocket();

        // Load servers
        loadServers();

        return () => {
            disconnectSocket();
        }
    }, []);

    // Listen for server deletion
    useEffect(() => {
        const socket = getSocket();
        if (socket) {
            const handleServerDeleted = (data) => {
                console.log('SERVER_DELETED event:', data);

                // Show notification
                showNotification(
                    `Server "${data.serverName}" has been deleted by the owner`,
                    'warning'
                );

                // Remove server from list
                setServers(prev => prev.filter(s => s.id !== data.serverId));

                // If we're in the deleted server, navigate away
                if (parseInt(serverId) === data.serverId) {
                    navigate('/channels');
                }
            };

            socket.on('SERVER_DELETED', handleServerDeleted);

            return () => {
                socket.off('SERVER_DELETED', handleServerDeleted);
            };
        }
    }, [serverId, navigate, showNotification]);

    // Update current server when serverId changes
    useEffect(() => {
        if (serverId && servers.length > 0) {
            const server = servers.find(s => s.id === parseInt(serverId));
            setCurrentServer(server || null);
        } else {
            setCurrentServer(null);
        }
    }, [serverId, servers]);

    const loadServers = async () => {
        try {
            const data = await getMyServers();
            setServers(data.servers || []);
        } catch (err) {
            console.error("Failed to load servers", err);
        }
    };

    const handleServerSelect = (id) => {
        navigate(`/channels/${id}`);
    };

    const handleChannelSelect = (id) => {
        navigate(`/channels/${serverId}/${id}`);
    };

    const handleServerUpdate = () => {
        // Reload servers when one is deleted or left
        loadServers();
    };

    return (
        <div className="flex bg-white dark:bg-black overflow-hidden h-screen">
            <ServerSidebar
                onServerSelect={handleServerSelect}
                selectedServerId={serverId ? parseInt(serverId) : null}
                servers={servers}
                onServerUpdate={handleServerUpdate}
            />

            {serverId ? (
                <ChannelList
                    serverId={serverId}
                    server={currentServer}
                    onChannelSelect={handleChannelSelect}
                    selectedChannelId={channelId ? parseInt(channelId) : null}
                    onServerUpdate={handleServerUpdate}
                />
            ) : (
                <div className="w-60 bg-gray-100 dark:bg-[#111] h-screen border-r border-gray-200 dark:border-gray-800"></div>
            )}

            {channelId ? (
                <>
                    <ChatArea
                        channelId={channelId}
                        channelName={channelName}
                    />
                    {serverId && <MemberList serverId={serverId} channelId={channelId} />}
                </>
            ) : (
                <div className="flex-1 bg-white dark:bg-black flex items-center justify-center text-gray-500 dark:text-gray-400">
                    {serverId ? 'Select a channel' : 'Select a server'}
                </div>
            )}
        </div>
    );
};

export default ChatPage;
