import React, { useEffect, useState, useRef } from 'react';
import { getMessages, sendMessageREST, editMessage, deleteMessage } from '../services/messageService';
import { getDMMessages, sendDMMessage, getDMChannel } from '../services/dmService';
import { getSocket } from '../utils/socket';
import { getUserPresence } from '../services/presenceService';
import { getMyMemberStatus } from '../services/memberService';
import { useSelector } from 'react-redux';
import OnlineIndicator from './OnlineIndicator';
import imageCompression from 'browser-image-compression';
import UserProfilePopup from './UserProfilePopup';

const MAX_FILE_SIZE_MB = 30;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ChatArea = ({ channelId, channelName, serverId }) => {
    const isDM = serverId === '@me'; // Check if it's a DM
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [typingUser, setTypingUser] = useState(null);
    const [userPresence, setUserPresence] = useState({}); // {userId: {online: bool, lastSeen: timestamp}}
    const [bannedUsers, setBannedUsers] = useState(new Set()); // Set of banned user IDs
    const [timedOutUsers, setTimedOutUsers] = useState({}); // {userId: {expiresAt, reason}}
    const [currentUserBanned, setCurrentUserBanned] = useState(false);
    const [currentUserTimeout, setCurrentUserTimeout] = useState(null);
    const messagesEndRef = useRef(null);
    const socket = getSocket();
    const currentUser = useSelector(state => state.auth.user);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editContent, setEditContent] = useState('');

    // User Profile Popup State
    const [selectedUser, setSelectedUser] = useState(null);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
    const [otherUser, setOtherUser] = useState(null); // For DMs

    useEffect(() => {
        if (!channelId || !serverId || channelId === 'undefined') return;

        fetchMessages();
        if (isDM) {
            fetchDMInfo();
        } else {
            fetchBanAndTimeoutStatus();
        }

        // Setup socket listeners and join channel
        if (socket) {
            // Define event handlers
            const handleNewMessage = (message) => {
                console.log('NEW_MESSAGE received:', message);
                // Ensure message belongs to this channel
                if (parseInt(message.channelId) === parseInt(channelId)) {
                    setMessages(prev => {
                        // Check if this exact message already exists (by ID)
                        const existsById = prev.some(msg => msg.id === message.id);
                        if (existsById) {
                            return prev; // Already have this message
                        }

                        // Check if we have a pending optimistic message from the same user with same content
                        // If so, replace it with the real message
                        const optimisticIndex = prev.findIndex(msg =>
                            msg.pending &&
                            msg.user?.id === message.user?.id &&
                            (msg.content || '') === (message.content || '') &&
                            (msg.fileName || null) === (message.fileName || null) &&
                            Math.abs(new Date(msg.createdAt) - new Date(message.createdAt)) < 5000 // Within 5 seconds
                        );

                        if (optimisticIndex !== -1) {
                            // Replace optimistic message with real one
                            const newMessages = [...prev];
                            newMessages[optimisticIndex] = message;
                            return newMessages;
                        }

                        // New message from another user or no optimistic match
                        return [message, ...prev];
                    });
                    scrollToBottom();
                }
            };

            const handleTypingStart = (data) => {
                if (parseInt(data.channelId) === parseInt(channelId)) {
                    setTypingUser(data.username);
                }
            };

            const handleTypingStop = (data) => {
                if (parseInt(data.channelId) === parseInt(channelId)) {
                    setTypingUser(null);
                }
            };

            const handleMessageEdited = (message) => {
                console.log('MESSAGE_EDITED received:', message);
                if (parseInt(message.channelId) === parseInt(channelId)) {
                    setMessages(prev => prev.map(msg => msg.id === message.id ? message : msg));
                }
            };

            const handleMessageDeleted = (data) => {
                console.log('MESSAGE_DELETED received:', data);
                if (parseInt(data.channelId) === parseInt(channelId)) {
                    setMessages(prev => prev.filter(msg => msg.id !== data.id));
                }
            };

            // Add listeners
            if (isDM) {
                const handleNewDM = (message) => {
                    console.log('NEW_DM received:', message);
                    if (parseInt(message.channelId) === parseInt(channelId)) {
                        setMessages(prev => {
                            const existsById = prev.some(msg => msg.id === message.id);
                            if (existsById) return prev;

                            // Optimistic replace logic similar to server messages
                            const optimisticIndex = prev.findIndex(msg =>
                                msg.pending &&
                                (msg.content || '') === (message.content || '') &&
                                Math.abs(new Date(msg.createdAt) - new Date(message.createdAt)) < 5000
                            );

                            if (optimisticIndex !== -1) {
                                const newMessages = [...prev];
                                newMessages[optimisticIndex] = message;
                                return newMessages;
                            }
                            return [message, ...prev];
                        });
                        scrollToBottom();
                    }
                };

                const handleTypingDM = (data) => {
                    if (parseInt(data.channelId) === parseInt(channelId)) {
                        setTypingUser(data.username);
                        // Auto clear after 3s handled by sender usually, but here we just show it
                        // Ideally we set a timeout to clear it if STOP isn't received
                        setTimeout(() => setTypingUser(null), 3000);
                    }
                };

                // DM doesn't have explicit STOP event in backend provided in snippet, 
                // but TYPING_DM is broadcast. We can just show it for a few seconds.

                socket.on('NEW_DM', handleNewDM);
                socket.on('TYPING_DM', handleTypingDM);

                // Join DM Room
                socket.emit('JOIN_DM', { channelId });

                return () => {
                    socket.off('NEW_DM', handleNewDM);
                    socket.off('TYPING_DM', handleTypingDM);
                    socket.emit('LEAVE_DM', { channelId });
                };

            } else {
                // SERVER CHANNEL API
                const handleNewMessage = (message) => {
                    console.log('NEW_MESSAGE received:', message);
                    // Ensure message belongs to this channel
                    if (parseInt(message.channelId) === parseInt(channelId)) {
                        setMessages(prev => {
                            // Check if this exact message already exists (by ID)
                            const existsById = prev.some(msg => msg.id === message.id);
                            if (existsById) {
                                return prev; // Already have this message
                            }

                            // Check if we have a pending optimistic message from the same user with same content
                            // If so, replace it with the real message
                            const optimisticIndex = prev.findIndex(msg =>
                                msg.pending &&
                                msg.user?.id === message.user?.id &&
                                (msg.content || '') === (message.content || '') &&
                                (msg.fileName || null) === (message.fileName || null) &&
                                Math.abs(new Date(msg.createdAt) - new Date(message.createdAt)) < 5000 // Within 5 seconds
                            );

                            if (optimisticIndex !== -1) {
                                // Replace optimistic message with real one
                                const newMessages = [...prev];
                                newMessages[optimisticIndex] = message;
                                return newMessages;
                            }

                            // New message from another user or no optimistic match
                            return [message, ...prev];
                        });
                        scrollToBottom();
                    }
                };

                const handleTypingStart = (data) => {
                    if (parseInt(data.channelId) === parseInt(channelId)) {
                        setTypingUser(data.username);
                    }
                };

                const handleTypingStop = (data) => {
                    if (parseInt(data.channelId) === parseInt(channelId)) {
                        setTypingUser(null);
                    }
                };

                const handleMessageEdited = (message) => {
                    console.log('MESSAGE_EDITED received:', message);
                    if (parseInt(message.channelId) === parseInt(channelId)) {
                        setMessages(prev => prev.map(msg => msg.id === message.id ? message : msg));
                    }
                };

                const handleMessageDeleted = (data) => {
                    console.log('MESSAGE_DELETED received:', data);
                    if (parseInt(data.channelId) === parseInt(channelId)) {
                        setMessages(prev => prev.filter(msg => msg.id !== data.id));
                    }
                };

                // Add listeners
                socket.on('NEW_MESSAGE', handleNewMessage);
                socket.on('TYPING_START', handleTypingStart);
                socket.on('TYPING_STOP', handleTypingStop);
                socket.on('MESSAGE_EDITED', handleMessageEdited);
                socket.on('MESSAGE_DELETED', handleMessageDeleted);

                // Join channel
                console.log('Emitting JOIN_CHANNEL for:', channelId);
                socket.emit('JOIN_CHANNEL', { channelId });

                // Listen for join confirmation
                const handleJoinedChannel = (data) => {
                    console.log('Successfully joined channel:', data.channelId);
                };
                socket.on('JOINED_CHANNEL', handleJoinedChannel);

                // Listen for ban/timeout updates
                const handleMemberBanned = (data) => {
                    if (data.serverId === serverId) {
                        setBannedUsers(prev => new Set([...prev, data.userId]));
                        if (data.userId === currentUser?.id) {
                            setCurrentUserBanned(true);
                        }
                    }
                };

                const handleMemberUnbanned = (data) => {
                    if (data.serverId === serverId) {
                        setBannedUsers(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(data.userId);
                            return newSet;
                        });
                        if (data.userId === currentUser?.id) {
                            setCurrentUserBanned(false);
                        }
                    }
                };

                const handleMemberTimedOut = (data) => {
                    if (data.serverId === serverId) {
                        setTimedOutUsers(prev => ({ ...prev, [data.userId]: data }));
                        if (data.userId === currentUser?.id) {
                            setCurrentUserTimeout(data);
                        }
                    }
                };

                const handleTimeoutRemoved = (data) => {
                    if (data.serverId === serverId) {
                        setTimedOutUsers(prev => {
                            const newState = { ...prev };
                            delete newState[data.userId];
                            return newState;
                        });
                        if (data.userId === currentUser?.id) {
                            setCurrentUserTimeout(null);
                        }
                    }
                };

                socket.on('MEMBER_BANNED', handleMemberBanned);
                socket.on('MEMBER_UNBANNED', handleMemberUnbanned);
                socket.on('MEMBER_TIMED_OUT', handleMemberTimedOut);
                socket.on('TIMEOUT_REMOVED', handleTimeoutRemoved);

                // Cleanup
                return () => {
                    socket.off('NEW_MESSAGE', handleNewMessage);
                    socket.off('TYPING_START', handleTypingStart);
                    socket.off('TYPING_STOP', handleTypingStop);
                    socket.off('MESSAGE_EDITED', handleMessageEdited);
                    socket.off('MESSAGE_DELETED', handleMessageDeleted);
                    socket.off('JOINED_CHANNEL', handleJoinedChannel);
                    socket.off('MEMBER_BANNED', handleMemberBanned);
                    socket.off('MEMBER_UNBANNED', handleMemberUnbanned);
                    socket.off('MEMBER_TIMED_OUT', handleMemberTimedOut);
                    socket.off('TIMEOUT_REMOVED', handleTimeoutRemoved);
                    console.log('Emitting LEAVE_CHANNEL for:', channelId);
                    socket.emit('LEAVE_CHANNEL', { channelId });
                };
            }
        }
    }, [channelId, serverId, currentUserBanned, currentUser, socket, isDM]);

    const fetchBanAndTimeoutStatus = async () => {
        if (!serverId) return;
        try {
            const status = await getMyMemberStatus(serverId);

            if (status.banned) {
                setCurrentUserBanned(true);
            }

            if (status.timedOut && status.timeout) {
                setCurrentUserTimeout(status.timeout);
            }
        } catch (err) {
            console.log('Could not fetch member status', err);
        }
    };

    const fetchMessages = async () => {
        try {
            let data;
            if (isDM) {
                // Fetch DM messages
                data = await getDMMessages(channelId);
            } else {
                // Fetch Server messages
                data = await getMessages(channelId);
            }

            setMessages(data.messages || []);

            // Fetch presence for unique users in messages
            const uniqueUserIds = [...new Set(data.messages?.map(m => {
                // For DMs, messages have 'sender' field, for channels they have 'user'
                const userId = isDM ? m.sender?.id : m.user?.id;
                return userId;
            }).filter(Boolean))];
            uniqueUserIds.forEach(userId => {
                if (userId) fetchUserPresence(userId);
            });
        } catch (err) {
            console.error("Failed to load messages", err);
        }
    };

    const fetchDMInfo = async () => {
        try {
            const data = await getDMChannel(channelId);
            setOtherUser(data.channel?.otherUser);
        } catch (err) {
            console.error("Failed to load DM info", err);
        }
    };

    const fetchUserPresence = async (userId) => {
        try {
            const presence = await getUserPresence(userId);
            setUserPresence(prev => ({
                ...prev,
                [userId]: presence
            }));
        } catch (err) {
            console.error(`Failed to fetch presence for user ${userId}`, err);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();

        // Silently prevent sending if banned or timed out
        if (currentUserBanned || currentUserTimeout) {
            return; // No error, just ignore
        }

        if (!input.trim() && !selectedFile) return;

        // Clear typing indicator when sending message
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        if (socket && isTypingRef.current) {
            socket.emit('TYPING_STOP', { channelId });
            isTypingRef.current = false;
        }

        let contentToSend = input;
        let fileToSend = selectedFile;

        // Reset state immediately
        setInput('');
        setSelectedFile(null);
        setPreviewUrl(null);

        // Compress image if needed (and not already compressed logic - but we do it on select usually)
        // actually we did compression on select.

        // Create optimistic message (shown immediately)
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempId,
            content: contentToSend.trim(),
            channelId: parseInt(channelId),
            createdAt: new Date().toISOString(),
            user: {
                id: currentUser?.id || 'unknown',
                username: currentUser?.username || 'You',
                avatar: currentUser?.avatar || null
            },
            pending: true, // Flag to show it's being sent
            fileUrl: previewUrl, // Local preview
            fileType: fileToSend ? (fileToSend.type.startsWith('image/') ? 'IMAGE' : fileToSend.type.startsWith('video/') ? 'VIDEO' : 'FILE') : null,
            fileName: fileToSend ? fileToSend.name : null
        };

        // Add optimistically to UI
        setMessages(prev => [optimisticMessage, ...prev]);
        scrollToBottom();

        // Emitting via Socket is preferred BUT specific socket event doesn't support file upload usually unless using binary streams.
        // For file uploads, we MUST use REST.
        if (fileToSend) {
            try {
                let response;
                if (isDM) {
                    response = await sendDMMessage(channelId, contentToSend, fileToSend);
                } else {
                    response = await sendMessageREST(channelId, contentToSend, fileToSend);
                }

                // Replace optimistic message with real one
                setMessages(prev => {
                    const actualMessage = isDM ? response.message : response.data;
                    const alreadyExists = prev.some(m => m.id === actualMessage.id);
                    if (alreadyExists) {
                        // Socket already added the real message, just remove the optimistic one
                        return prev.filter(msg => msg.id !== tempId);
                    }
                    return prev.map(msg => msg.id === tempId ? actualMessage : msg);
                });
            } catch (err) {
                console.error("REST send failed", err);
                // Remove optimistic message
                setMessages(prev => prev.filter(msg => msg.id !== tempId));

                // Check if error is ban or timeout
                if (err.response?.data?.message?.toLowerCase().includes('banned')) {
                    setCurrentUserBanned(true);
                } else if (err.response?.data?.message?.toLowerCase().includes('timed out')) {
                    setCurrentUserTimeout({
                        expiresAt: err.response?.data?.expiresAt,
                        reason: err.response?.data?.reason
                    });
                } else {
                    // Only restore input for other errors
                    setInput(contentToSend);
                }
            }
        } else if (socket) {
            // Text only - use socket
            // For DM, we might need a different event or the same if backend handles it
            // Assuming SEND_MESSAGE works if channelId is unique for DMs too.
            // If backend distinguishes, we need SEND_DM_MESSAGE
            // Let's rely on REST for DMs for safety unless we verify socket event

            if (isDM) {
                // Use REST for DMs to ensure distinct logic if socket event assumes Server Channel
                try {
                    const response = await sendDMMessage(channelId, contentToSend);
                    setMessages(prev => {
                        const actualMessage = response.message;
                        const alreadyExists = prev.some(m => m.id === actualMessage.id);
                        if (alreadyExists) return prev.filter(msg => msg.id !== tempId);
                        return prev.map(msg => msg.id === tempId ? actualMessage : msg);
                    });
                } catch (err) {
                    console.error("DM Send failed", err);
                    setMessages(prev => prev.filter(msg => msg.id !== tempId));
                    setInput(contentToSend);
                }
            } else {
                socket.emit('SEND_MESSAGE', { channelId, content: contentToSend }, (ack) => {
                    if (ack?.error) {
                        console.error("Msg failed", ack.error);
                        // Remove optimistic message
                        setMessages(prev => prev.filter(msg => msg.id !== tempId));

                        // Check if error is ban or timeout
                        if (ack.error?.toLowerCase().includes('banned')) {
                            setCurrentUserBanned(true);
                        } else if (ack.error?.toLowerCase().includes('timed out')) {
                            setCurrentUserTimeout({
                                expiresAt: ack.expiresAt,
                                reason: ack.reason
                            });
                        } else {
                            // Only restore input for other errors
                            setInput(contentToSend);
                        }
                    } else if (ack?.message) {
                        // Success - replace optimistic message with real one from server
                        setMessages(prev => prev.map(msg =>
                            msg.id === tempId ? ack.message : msg
                        ));
                    }
                });
            }
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > MAX_FILE_SIZE_BYTES) {
            if (file.type.startsWith('image/')) {
                const confirmCompress = window.confirm(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Limit is ${MAX_FILE_SIZE_MB}MB. Would you like to compress it?`);
                if (confirmCompress) {
                    try {
                        const options = {
                            maxSizeMB: MAX_FILE_SIZE_MB,
                            maxWidthOrHeight: 1920,
                            useWebWorker: true
                        };
                        const compressedFile = await imageCompression(file, options);
                        setSelectedFile(compressedFile);
                        setPreviewUrl(URL.createObjectURL(compressedFile));
                    } catch (error) {
                        console.error("Compression failed", error);
                        alert("Compression failed. Please try a smaller file.");
                    }
                }
            } else {
                alert(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
            }
            return;
        }

        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const removeFile = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const renderMessageContent = (msg) => {
        return (
            <div>
                {msg.fileUrl && (
                    <div className="mb-2">
                        {msg.fileType === 'IMAGE' ? (
                            <img
                                src={msg.fileUrl}
                                alt={msg.fileName}
                                className="max-w-sm max-h-80 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(msg.fileUrl, '_blank')}
                            />
                        ) : msg.fileType === 'VIDEO' ? (
                            <video controls className="max-w-sm max-h-80 rounded-lg">
                                <source src={msg.fileUrl} type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                        ) : (
                            <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-[#2b2d31] rounded-lg border border-gray-200 dark:border-white/10 max-w-xs">
                                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate">{msg.fileName || 'Attachment'}</p>
                                    <p className="text-xs text-gray-500">{(msg.fileType || 'FILE').toLowerCase()}</p>
                                </div>
                                <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors" download>
                                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                </a>
                            </div>
                        )}
                    </div>
                )}
                <p className="text-gray-800 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
            </div>
        );
    };

    const handleEditMessage = async (messageId) => {
        if (!editContent.trim()) return;

        try {
            // Optimistic update
            setMessages(prev => prev.map(msg =>
                msg.id === messageId
                    ? { ...msg, content: editContent.trim(), editedAt: new Date().toISOString() }
                    : msg
            ));
            setEditingMessageId(null);
            setEditContent('');

            // Send to server
            await editMessage(channelId, messageId, editContent);
        } catch (err) {
            console.error("Edit message failed", err);
            alert('Failed to edit message');
            // Revert on error - refetch messages
            fetchMessages();
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!window.confirm('Are you sure you want to delete this message?')) return;

        try {
            // Optimistic update
            setMessages(prev => prev.filter(msg => msg.id !== messageId));

            // Send to server
            await deleteMessage(channelId, messageId);
        } catch (err) {
            console.error("Delete message failed", err);
            alert('Failed to delete message');
            // Revert on error - refetch messages
            fetchMessages();
        }
    };

    const startEdit = (msg) => {
        setEditingMessageId(msg.id);
        setEditContent(msg.content || '');
    };

    const cancelEdit = () => {
        setEditingMessageId(null);
        setEditContent('');
    };

    const handleTyping = () => {
        if (!socket) return;

        // Emit TYPING_START only once
        if (!isTypingRef.current) {
            socket.emit('TYPING_START', { channelId });
            isTypingRef.current = true;
        }

        // Reset the stop typing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Auto-stop after 3 seconds of no typing
        typingTimeoutRef.current = setTimeout(() => {
            if (socket) {
                socket.emit('TYPING_STOP', { channelId });
                isTypingRef.current = false;
            }
        }, 3000);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleUserClick = (e, user) => {
        e.preventDefault();
        e.stopPropagation();

        // Calculate position (try to keep it near the click but on screen)
        const x = e.clientX + 20;
        const y = e.clientY - 50;

        setPopupPosition({ x, y });
        setSelectedUser(user);
    };

    if (!channelId) {
        return (
            <div className="flex-1 bg-white dark:bg-[#0a0a10] flex items-center justify-center text-gray-500 dark:text-gray-400">
                Select a channel to start chatting
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#0a0a10] h-screen transition-colors duration-300">
            {/* Header */}
            <div className="h-12 border-b border-gray-200 dark:border-white/5 flex items-center px-4 shadow-sm bg-white dark:bg-[#0a0a10] z-10 transition-colors">
                {isDM ? (
                    <>
                        <span className="text-2xl text-rose-500 mr-2">@</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{otherUser?.username || 'User'}</span>
                    </>
                ) : (
                    <>
                        <span className="text-2xl text-rose-500 mr-2">#</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{channelName || 'channel'}</span>
                    </>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse custom-scrollbar">
                <div ref={messagesEndRef} />
                {messages.map((msg) => {
                    const msgUser = isDM ? msg.sender : msg.user; // DM messages have 'sender', channel messages have 'user'
                    return (
                        <div key={msg.id} className={`mb-1 flex group hover:bg-black/5 dark:hover:bg-white/5 px-4 py-2 -mx-4 transition-colors ${msg.pending ? 'opacity-60' : ''} relative`}>
                            <div
                                className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 mr-4 cursor-pointer overflow-hidden shadow-sm hover:ring-2 ring-indigo-500 transition-all"
                                onClick={(e) => handleUserClick(e, msgUser)}
                            >
                                {msgUser?.avatar ?
                                    <img src={msgUser.avatar} className="w-full h-full object-cover" /> :
                                    <div className="w-full h-full flex items-center justify-center text-white font-bold">{msgUser?.username?.[0]?.toUpperCase()}</div>
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline mb-1">
                                    <span
                                        className={`font-bold mr-2 hover:underline cursor-pointer transition-colors ${bannedUsers.has(msgUser?.id)
                                            ? 'text-red-500 dark:text-red-400 hover:text-red-600'
                                            : 'text-gray-900 dark:text-white hover:text-rose-400'
                                            }`}
                                        onClick={(e) => handleUserClick(e, msgUser)}
                                    >
                                        {msgUser?.username}
                                    </span>
                                    {bannedUsers.has(msgUser?.id) && (
                                        <span className="text-xs text-red-500 dark:text-red-400 font-bold mr-2">(Banned)</span>
                                    )}
                                    <span className="text-xs text-gray-500 dark:text-gray-500 font-medium">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {msg.editedAt && (
                                        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(edited)</span>
                                    )}
                                    {msg.pending && (
                                        <span className="ml-2 text-xs text-rose-400 flex items-center">
                                            <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Sending...
                                        </span>
                                    )}
                                </div>
                                {editingMessageId === msg.id ? (
                                    <div className="flex gap-2 items-start">
                                        <input
                                            type="text"
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleEditMessage(msg.id);
                                                if (e.key === 'Escape') cancelEdit();
                                            }}
                                            className="flex-1 bg-gray-100 dark:bg-[#2b2d31] border border-rose-500 rounded px-2 py-1 text-sm text-gray-900 dark:text-white outline-none"
                                            autoFocus
                                        />
                                        <button onClick={() => handleEditMessage(msg.id)} className="text-green-500 hover:text-green-600 text-sm font-medium">Save</button>
                                        <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-600 text-sm font-medium">Cancel</button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        {renderMessageContent(msg)}
                                    </div>
                                )}
                            </div>
                            {/* Show edit/delete buttons only for own messages */}
                            {!msg.pending && msgUser?.id === currentUser?.id && editingMessageId !== msg.id && (
                                <div className="absolute right-4 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button
                                        onClick={() => startEdit(msg)}
                                        className="p-1.5 bg-gray-200 dark:bg-[#2b2d31] hover:bg-gray-300 dark:hover:bg-[#3b3d41] rounded text-gray-600 dark:text-gray-400 transition-colors"
                                        title="Edit message"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteMessage(msg.id)}
                                        className="p-1.5 bg-gray-200 dark:bg-[#2b2d31] hover:bg-red-500 dark:hover:bg-red-600 hover:text-white rounded text-gray-600 dark:text-gray-400 transition-colors"
                                        title="Delete message"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Typing Indicator */}
            {typingUser && (
                <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-2 animate-pulse bg-transparent">
                    <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-xs font-bold text-rose-500">{typingUser} is typing...</span>
                </div>
            )}

            {/* Input Area OR Ban/Timeout Message */}
            <div className="p-4 bg-white dark:bg-[#0a0a10] border-t border-gray-200 dark:border-white/5">
                {currentUserBanned ? (
                    /* WhatsApp-style Ban Message */
                    <div className="flex flex-col items-center justify-center py-8 px-4">
                        <div className="bg-red-500/10 dark:bg-red-900/20 rounded-full p-4 mb-4">
                            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 text-center">
                            You're banned from this server
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
                            You can no longer send messages in this server. You can leave the server if you wish.
                        </p>
                    </div>
                ) : currentUserTimeout ? (
                    /* WhatsApp-style Timeout Message */
                    <div className="flex flex-col items-center justify-center py-8 px-4">
                        <div className="bg-yellow-500/10 dark:bg-yellow-900/20 rounded-full p-4 mb-4">
                            <svg className="w-12 h-12 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 text-center">
                            You're timed out
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md mb-1">
                            You cannot send messages until {new Date(currentUserTimeout.expiresAt).toLocaleString()}
                        </p>
                        {currentUserTimeout.reason && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                                Reason: {currentUserTimeout.reason}
                            </p>
                        )}
                    </div>
                ) : (
                    /* Normal Input Form */
                    <form onSubmit={handleSendMessage} className="bg-gray-100 dark:bg-[#1e1e24] rounded-xl px-4 py-2.5 flex items-center shadow-inner border border-transparent focus-within:border-rose-500/50 transition-all relative">
                        {/* File Input hidden */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileSelect}
                            accept="image/*,video/*,application/pdf"
                        />

                        {/* Preview Area (Above input) */}
                        {previewUrl && (
                            <div className="absolute bottom-full left-0 mb-2 ml-2 bg-[#1e1e24] p-2 rounded-lg border border-white/10 shadow-xl flex items-center gap-2">
                                {selectedFile && selectedFile.type.startsWith('image/') ? (
                                    <img src={previewUrl} className="h-16 w-16 object-cover rounded-md" />
                                ) : (
                                    <div className="h-16 w-16 bg-gray-700 rounded-md flex items-center justify-center text-xs text-white p-1 text-center truncate">
                                        {selectedFile?.name}
                                    </div>
                                )}
                                <button onClick={removeFile} type="button" className="bg-rose-500 rounded-full p-1 text-white hover:bg-rose-600">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        )}

                        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 mr-3 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        </button>
                        <input
                            type="text"
                            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-500 font-medium"
                            placeholder={`Message #${channelName || 'channel'}`}
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                handleTyping();
                            }}
                        />
                        <div className="flex items-center space-x-2 ml-2">
                            {/* Send icon shows when input has text */}
                            <button
                                type="submit"
                                disabled={!input.trim() && !selectedFile}
                                className={`p-2 rounded-full transition-all ${(input.trim() || selectedFile) ? 'text-rose-500 hover:bg-rose-500/10 cursor-pointer' : 'text-gray-400 cursor-not-allowed'}`}
                            >
                                <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                            </button>
                        </div>
                    </form>
                )}
            </div>
            {/* User Profile Popup */}
            {selectedUser && (
                <UserProfilePopup
                    user={selectedUser}
                    position={popupPosition}
                    currentUser={currentUser}
                    onClose={() => setSelectedUser(null)}
                />
            )}
        </div>
    );
};

export default ChatArea;
