import React, { useEffect, useState, useRef } from 'react';
import { getMessages, sendMessageREST, editMessage, deleteMessage, uploadFile, enhanceMessage, summarizeChat, askChatbot } from '../services/messageService';
import { getDMMessages, sendDMMessage, getDMChannel } from '../services/dmService';
import { getSocket } from '../utils/socket';
import { getUserPresence } from '../services/presenceService';
import { getMyMemberStatus } from '../services/memberService';
import { useSelector, useDispatch } from 'react-redux';
import { fetchMessages as fetchMessagesThunk, setActiveChannel, addMessage, updateMessage, deleteMessage as deleteMessageRedux } from '../redux/message_slice';
import OnlineIndicator from './OnlineIndicator';
import imageCompression from 'browser-image-compression';
import UserProfilePopup from './UserProfilePopup';
import DMCall from './DMCall';
import { Sparkles, Loader2, FileText, History, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MAX_FILE_SIZE_MB = 30;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ChatArea = ({ channelId, channelName, serverId }) => {
    const isDM = serverId === '@me'; // Check if it's a DM
    const dispatch = useDispatch();

    // Redux selectors for messages
    const messageData = useSelector(state => state.message.messages[channelId]);
    const messages = messageData?.messages || [];

    useEffect(() => {
        console.log('[ChatArea] messageData updated:', {
            count: messages.length,
            lastMsg: messages[0]?.content,
            channelId
        });
    }, [messages, channelId]);

    const loading = messageData?.loading || false;
    const error = messageData?.error || null;

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
    
    // AI Features State
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summary, setSummary] = useState(null);
    const [showSummaryOptions, setShowSummaryOptions] = useState(false);
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');

    // User Profile Popup State
    const [selectedUser, setSelectedUser] = useState(null);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
    const [otherUser, setOtherUser] = useState(null); // For DMs

    // Call State
    const [activeCall, setActiveCall] = useState(null); // { type: 'audio'|'video', channelId }

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [messageToDelete, setMessageToDelete] = useState(null);

    useEffect(() => {
        if (!channelId || !serverId || channelId === 'undefined') return;

        fetchMessagesLocal();
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
                console.log(`channelId check: message.channelId=${message.channelId} (type: ${typeof message.channelId}), current channelId=${channelId} (type: ${typeof channelId})`);

                // Ensure message belongs to this channel
                if (parseInt(message.channelId) === parseInt(channelId)) {
                    console.log('✅ channelId validation passed, dispatching addMessage...');
                    // Redux handles: duplicate checking, optimistic replacement, size pruning, unread counts
                    dispatch(addMessage({ channelId: message.channelId, message }));
                    scrollToBottom();
                } else {
                    console.log('❌ channelId validation FAILED, message not for this channel');
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
                    dispatch(updateMessage({
                        channelId: message.channelId,
                        messageId: message.id,
                        updates: message
                    }));
                }
            };

            const handleMessageDeleted = (data) => {
                console.log('MESSAGE_DELETED received:', data);
                if (parseInt(data.channelId) === parseInt(channelId)) {
                    dispatch(deleteMessageRedux({
                        channelId: data.channelId,
                        messageId: data.id
                    }));
                }
            };

            // Add listeners
            if (isDM) {
                const handleNewDM = (message) => {
                    console.log('NEW_DM received:', message);
                    // Only process if we're in DM mode AND channelId matches
                    if (isDM && parseInt(message.channelId) === parseInt(channelId)) {
                        dispatch(addMessage({ channelId: message.channelId, message }));
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

                const handleUserUpdated = (updatedUser) => {
                    // Update messages in Redux cache to reflect updated user info
                    if (messages.length > 0) {
                        messages.forEach(msg => {
                            if (msg.sender?.id === updatedUser.id || msg.receiver?.id === updatedUser.id) {
                                const updatedMsg = { ...msg };
                                if (msg.sender?.id === updatedUser.id) {
                                    updatedMsg.sender = { ...msg.sender, ...updatedUser };
                                }
                                if (msg.receiver?.id === updatedUser.id) {
                                    updatedMsg.receiver = { ...msg.receiver, ...updatedUser };
                                }
                                dispatch(updateMessage({
                                    channelId,
                                    messageId: msg.id,
                                    updates: updatedMsg
                                }));
                            }
                        });
                    }
                };

                socket.on('NEW_DM', handleNewDM);
                socket.on('TYPING_DM', handleTypingDM);
                socket.on('USER_UPDATED', handleUserUpdated);

                // Call event listeners (Only for updates to ACTIVE calls you initiated)
                // INCOMING_CALL is now handled globally by GlobalCallManager

                // We still listen for ENDED/DECLINED to close our active call view if we are the caller
                const handleCallDeclined = (data) => {
                    console.log('CALL_DECLINED received:', data);
                    if (parseInt(data.channelId) === parseInt(channelId)) {
                        setActiveCall(null);
                        alert('Call declined');
                    }
                };

                const handleCallEnded = (data) => {
                    console.log('CALL_ENDED received:', data);
                    if (parseInt(data.channelId) === parseInt(channelId)) {
                        setActiveCall(null);
                    }
                };
                
                // Answered: If we are the caller, we might want to know it was answered?
                // Currently initiation sets activeCall immediately on success ack.
                // But we could update state here if needed.

                socket.on('CALL_DECLINED', handleCallDeclined);
                socket.on('CALL_ENDED', handleCallEnded);

                // Join DM Room - wait for socket to be connected
                const joinDMRoom = () => {
                    if (socket.connected) {
                        console.log('[DM] Emitting JOIN_DM for channel:', channelId);
                        socket.emit('JOIN_DM', { channelId });
                    } else {
                        console.log('[DM] Socket not connected yet, waiting...');
                        socket.once('connect', () => {
                            console.log('[DM] Socket connected! Now emitting JOIN_DM for channel:', channelId);
                            socket.emit('JOIN_DM', { channelId });
                        });
                    }
                };

                joinDMRoom();

                // Handle socket reconnection for DMs
                const handleDMReconnect = () => {
                    console.log('[DM RECONNECT] Socket reconnected, rejoining DM:', channelId);
                    socket.emit('JOIN_DM', { channelId });
                };

                socket.on('connect', handleDMReconnect);


                return () => {
                    socket.off('NEW_DM', handleNewDM);
                    socket.off('TYPING_DM', handleTypingDM);
                    // socket.off('INCOMING_CALL', handleIncomingCall); // Handled globally
                    // socket.off('CALL_ANSWERED', handleCallAnswered);
                    socket.off('CALL_DECLINED', handleCallDeclined);
                    socket.off('CALL_ENDED', handleCallEnded);
                    // socket.off('CALL_CANCELLED', handleCallCancelled);
                    socket.off('USER_UPDATED', handleUserUpdated);
                    socket.off('connect', handleDMReconnect);
                    // socket.emit('LEAVE_DM', { channelId }); // Keep user in DM room for stability
                };

            } else {
                // SERVER CHANNEL API
                const handleNewMessage = (message) => {
                    console.log('NEW_MESSAGE received:', message);
                    // Ensure message belongs to this channel AND we're not in DM mode
                    if (!isDM && parseInt(message.channelId) === parseInt(channelId)) {
                        dispatch(addMessage({ channelId: message.channelId, message }));
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
                        dispatch(updateMessage({
                            channelId: message.channelId,
                            messageId: message.id,
                            updates: message
                        }));
                    }
                };

                const handleMessageDeleted = (data) => {
                    console.log('MESSAGE_DELETED received:', data);
                    if (parseInt(data.channelId) === parseInt(channelId)) {
                        dispatch(deleteMessageRedux({
                            channelId: data.channelId,
                            messageId: data.id
                        }));
                    }
                };

                const handleUserUpdated = (updatedUser) => {
                    // Update messages in Redux cache
                    if (messages.length > 0) {
                        messages.forEach(msg => {
                            if (msg.user?.id === updatedUser.id) {
                                dispatch(updateMessage({
                                    channelId,
                                    messageId: msg.id,
                                    updates: { ...msg, user: { ...msg.user, ...updatedUser } }
                                }));
                            }
                        });
                    }
                };

                // Add listeners
                socket.on('NEW_MESSAGE', handleNewMessage);
                socket.on('TYPING_START', handleTypingStart);
                socket.on('TYPING_STOP', handleTypingStop);
                socket.on('MESSAGE_EDITED', handleMessageEdited);
                socket.on('MESSAGE_DELETED', handleMessageDeleted);
                socket.on('USER_UPDATED', handleUserUpdated);

                // Join channel - wait for socket to be connected
                console.log('Preparing to join channel:', channelId, 'Socket connected:', socket.connected);
                if (socket.connected) {
                    // Add small delay to ensure backend handlers are registered
                    setTimeout(() => {
                        console.log('Emitting JOIN_CHANNEL for:', channelId);
                        socket.emit('JOIN_CHANNEL', { channelId });
                    }, 100);
                } else {
                    console.log('Socket not connected yet, waiting for connection...');
                    // Wait for connection before joining
                    const onConnect = () => {
                        console.log('Socket connected, waiting 100ms before emitting JOIN_CHANNEL for:', channelId);
                        setTimeout(() => {
                            socket.emit('JOIN_CHANNEL', { channelId });
                        }, 100);
                        socket.off('connect', onConnect);
                    };
                    socket.on('connect', onConnect);
                }

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

                // Handle socket reconnection (e.g., after page refresh)
                const handleReconnect = () => {
                    console.log('[RECONNECT] Socket reconnected, rejoining channel:', channelId);
                    socket.emit('JOIN_CHANNEL', { channelId });
                };

                socket.on('connect', handleReconnect);

                // Cleanup
                return () => {
                    socket.off('NEW_MESSAGE', handleNewMessage);
                    socket.off('TYPING_START', handleTypingStart);
                    socket.off('TYPING_STOP', handleTypingStop);
                    socket.off('MESSAGE_EDITED', handleMessageEdited);
                    socket.off('MESSAGE_DELETED', handleMessageDeleted);
                    socket.off('USER_UPDATED', handleUserUpdated);
                    socket.off('JOINED_CHANNEL', handleJoinedChannel);
                    socket.off('MEMBER_BANNED', handleMemberBanned);
                    socket.off('MEMBER_UNBANNED', handleMemberUnbanned);
                    socket.off('MEMBER_TIMED_OUT', handleMemberTimedOut);
                    socket.off('TIMEOUT_REMOVED', handleTimeoutRemoved);
                    socket.off('connect', handleReconnect);
                    console.log('Emitting LEAVE_CHANNEL for:', channelId);
                    socket.emit('LEAVE_CHANNEL', { channelId });
                };
            }
        }
    }, [channelId, serverId, currentUserBanned, currentUser, socket, isDM]);

    // DEBUG: Monitor currentUser changes
    useEffect(() => {
        console.log('DEBUG: currentUser updated in ChatArea:', currentUser);
    }, [currentUser]);

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

    const fetchMessagesLocal = async () => {
        // Set active channel for LRU tracking
        dispatch(setActiveChannel(channelId));

        // Check if cached and fresh (less than 5 minutes old)
        const cached = messageData;
        const now = Date.now();
        const lastFetched = cached?.lastFetched || 0;
        const age = now - lastFetched;
        // Increased to 5 minutes (300000ms) as requested
        const isFresh = cached && lastFetched && (age < 300000);

        console.log(`[Frontend] Channel ${channelId} Refresh check:`, {
            hasCached: !!cached,
            lastFetched: new Date(lastFetched).toLocaleTimeString(),
            age: `${(age / 1000).toFixed(1)}s`,
            isFresh
        });

        if (!cached || !isFresh) {
            // Dispatch Redux thunk to fetch messages
            dispatch(fetchMessagesThunk({ channelId, isDM }));
        }

        // Fetch presence for users (after messages load)
        if (messages.length > 0) {
            const uniqueUserIds = [...new Set(messages.map(m => {
                // For DMs, messages have 'sender' field, for channels they have 'user'
                const userId = isDM ? m.sender?.id : m.user?.id;
                return userId;
            }).filter(Boolean))];
            uniqueUserIds.forEach(userId => {
                if (userId) fetchUserPresence(userId);
            });
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

    const handleEnhance = async () => {
        if (!input.trim() || isEnhancing) return;

        try {
            setIsEnhancing(true);
            const response = await enhanceMessage(input);
            if (response.enhanced) {
                setInput(response.enhanced);
            }
        } catch (err) {
            console.error("Enhancement failed:", err);
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleSummarize = async (type, value) => {
        if (isSummarizing) return;

        setIsSummarizing(true);
        setShowSummaryOptions(false);
        try {
            const data = await summarizeChat(channelId, type, value);
            setSummary(data.summary);
        } catch (err) {
            console.error("Summarize error:", err);
            alert("Failed to summarize chat. Please try again.");
        } finally {
            setIsSummarizing(false);
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
                avatar: currentUser?.avatar || null,
                displayName: currentUser?.displayName // Add displayName to optimistic message
            },
            pending: true, // Flag to show it's being sent
            fileUrl: previewUrl, // Local preview
            fileType: fileToSend ? (fileToSend.type.startsWith('image/') ? 'IMAGE' : fileToSend.type.startsWith('video/') ? 'VIDEO' : 'FILE') : null,
            fileName: fileToSend ? fileToSend.name : null
        };

        // Add optimistically to UI via Redux
        console.log('📤 Adding optimistic message:', { tempId, content: optimisticMessage.content, pending: optimisticMessage.pending });
        dispatch(addMessage({ channelId, message: optimisticMessage }));
        scrollToBottom();

        if (fileToSend) {
            try {
                // 1. Upload file via REST
                const uploadResponse = await uploadFile(fileToSend);
                const { fileUrl, fileType, fileName } = uploadResponse;

                // 2. Emit via Socket with file details
                socket.emit('SEND_MESSAGE', {
                    channelId,
                    content: contentToSend,
                    fileUrl,
                    fileType,
                    fileName
                }, (ack) => {
                    if (ack?.error) {
                        console.error("Msg failed", ack.error);
                        dispatch(deleteMessageRedux({ channelId, messageId: tempId }));
                    } else if (ack?.message) {
                        // Success - replace optimistic with real message
                        // We do this manually to ensure immediate feedback for sender
                        dispatch(deleteMessageRedux({ channelId, messageId: tempId }));
                        dispatch(addMessage({ channelId, message: ack.message }));
                    }
                });

            } catch (err) {
                console.error("Upload failed", err);
                // Remove optimistic message via Redux
                dispatch(deleteMessageRedux({ channelId, messageId: tempId }));
                alert('File upload failed');
            }
        } else if (socket) {
            // Text only - use socket
            if (isDM) {
                // DM Logic - assume SEND_DM is available and works
                socket.emit('SEND_DM', { channelId, content: contentToSend }, (ack) => {
                    if (ack?.error) {
                        console.log("DM send failed", ack.error);
                        dispatch(deleteMessageRedux({ channelId, messageId: tempId }));
                    } else if (ack?.status === 'OK') {
                        // Success - remove optimistic message, real message will come via NEW_DM
                        dispatch(deleteMessageRedux({ channelId, messageId: tempId }));
                    }
                });
            } else {
                socket.emit('SEND_MESSAGE', { channelId, content: contentToSend }, (ack) => {
                    if (ack?.error) {
                        console.error("Msg failed", ack.error);
                        // Remove optimistic message via Redux
                        dispatch(deleteMessageRedux({ channelId, messageId: tempId }));

                        // Check if error is ban or timeout
                        if (ack.error?.toLowerCase().includes('banned')) {
                            setCurrentUserBanned(true);
                        } else if (ack.error?.toLowerCase().includes('timed out')) {
                            // .. handle timeout
                        } else {
                            setInput(contentToSend);
                        }
                    } else if (ack?.message) {
                        // Success - replace optimistic with real message
                        // We do this manually to ensure immediate feedback for sender
                        dispatch(deleteMessageRedux({ channelId, messageId: tempId }));
                        dispatch(addMessage({ channelId, message: ack.message }));
                    }
                });
            }
        }

        // --- SparkHub Chatbot Logic ---
        if (contentToSend.toLowerCase().includes('@sparkhub')) {
            console.log("DEBUG: @SparkHub mention detected in:", contentToSend);
            try {
                // Case-insensitive replacement
                const question = contentToSend.replace(/@sparkhub/i, '').trim();
                console.log("DEBUG: Extracted question:", question);

                if (question) {
                    console.log("DEBUG: Calling askChatbot AI service...");
                    const response = await askChatbot(question);
                    console.log("DEBUG: AI service response:", response);

                    if (response && response.answer) {
                        console.log("DEBUG: Scheduling AI response emission...");
                        // Send AI response as a message from the same user (or ideally a bot user) 
                        // For this user script, it sends as the user themselves as per original code
                        setTimeout(() => {
                            if (socket) {
                                console.log("DEBUG: Emitting AI response via socket:", response.answer);
                                if (isDM) {
                                     socket.emit('SEND_DM', { channelId, content: response.answer });
                                } else {
                                     socket.emit('SEND_MESSAGE', { channelId, content: response.answer });
                                }
                            }
                        }, 1000);
                    }
                }
            } catch (err) {
                console.error("DEBUG: Chatbot response failed:", err);
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

    // Handle mention autocomplete
    const handleInputChange = (e) => {
        const value = e.target.value;
        setInput(value);
        handleTyping();

        // Check if user typed @ at the end
        const lastChar = value[value.length - 1];
        const secondLastChar = value[value.length - 2];
        
        // Show dropdown if @ is typed (and it's either at start or after a space)
        if (lastChar === '@' && (!secondLastChar || secondLastChar === ' ')) {
            setShowMentionDropdown(true);
            setMentionQuery('');
        } else if (showMentionDropdown) {
            // If dropdown is open, check if still in mention mode
            const lastAtIndex = value.lastIndexOf('@');
            if (lastAtIndex !== -1) {
                const afterAt = value.substring(lastAtIndex + 1);
                // Close dropdown if user typed space after @
                if (afterAt.includes(' ')) {
                    setShowMentionDropdown(false);
                } else {
                    setMentionQuery(afterAt.toLowerCase());
                }
            } else {
                setShowMentionDropdown(false);
            }
        }
    };

    const handleMentionSelect = () => {
        const lastAtIndex = input.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const beforeAt = input.substring(0, lastAtIndex);
            const updatedInput = beforeAt + '@SparkHub ';
            setInput(updatedInput);
        }
        setShowMentionDropdown(false);
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

        // Optimistic update via Redux
        dispatch(updateMessage({
            channelId,
            messageId,
            updates: { content: editContent.trim(), editedAt: new Date().toISOString() }
        }));
        setEditingMessageId(null);
        setEditContent('');

        // Send to server via Socket
        if (socket) {
            socket.emit('EDIT_MESSAGE', {
                channelId,
                messageId,
                content: editContent
            }, (ack) => {
                if (ack?.error) {
                    console.error("Edit failed", ack.error);
                    alert("Failed to edit message");
                    fetchMessagesLocal(); // Revert
                }
            });
        }
    };

    const handleDeleteMessageClick = (msg) => {
        setMessageToDelete(msg);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteMessage = async () => {
        if (!messageToDelete) return;

        // Optimistic update via Redux
        dispatch(deleteMessageRedux({ channelId, messageId: messageToDelete.id }));

        // Send to server via Socket
        if (socket) {
            socket.emit('DELETE_MESSAGE', {
                channelId,
                messageId: messageToDelete.id
            }, (ack) => {
                if (ack?.error) {
                    console.error("Delete failed", ack.error);
                    alert("Failed to delete message");
                    fetchMessagesLocal(); // Revert
                }
            });
        }
        setIsDeleteModalOpen(false);
        setMessageToDelete(null);
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

    // Call Handlers
    const handleInitiateCall = (callType) => {
        console.log('[CALL] Initiating call:', { socket: !!socket, isDM, channelId, callType });

        if (!socket) {
            console.error('[CALL] Socket not available');
            alert('Connection error. Please refresh the page.');
            return;
        }

        if (!isDM) {
            console.error('[CALL] Not a DM channel');
            alert('Calls are only available in direct messages');
            return;
        }

        socket.emit('INITIATE_CALL', { channelId, callType }, (ack) => {
            console.log('[CALL] INITIATE_CALL response:', ack);
            if (ack?.success) {
                setActiveCall({ type: callType, channelId: parseInt(channelId) });
            } else {
                console.error('[CALL] Failed to initiate:', ack);
                alert(ack?.error || 'Failed to initiate call');
            }
        });
    };



    const handleEndCall = () => {
        if (socket && activeCall) {
            socket.emit('END_CALL', { channelId: activeCall.channelId });
            setActiveCall(null);
        }
    };

    // Components for ReactMarkdown to handle styling
    const MarkdownComponents = {
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-md font-bold mb-2">{children}</h3>,
        code: ({ children }) => <code className="bg-gray-100 dark:bg-[#1e1f22] px-1 rounded text-rose-500">{children}</code>,
        strong: ({ children }) => <strong className="font-bold text-gray-900 dark:text-white">{children}</strong>,
    };

    // Function to highlight @SparkHub
    const renderTextWithMentions = (text) => {
        if (!text) return null;
        const parts = text.split(/(@SparkHub)/i);
        return parts.map((part, i) =>
            part.toLowerCase() === '@sparkhub' ? (
                <span key={i} className="bg-indigo-500/20 text-indigo-500 px-1 rounded font-semibold cursor-pointer hover:bg-indigo-500/30 transition-colors">
                    {part}
                </span>
            ) : (
                <span key={i} className="inline markdown-content">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={MarkdownComponents}
                    >
                        {part}
                    </ReactMarkdown>
                </span>
            )
        );
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
                        <span className="font-bold text-gray-900 dark:text-gray-100">{otherUser?.displayName || otherUser?.username || 'User'}</span>

                        {/* Call Buttons */}
                        <div className="ml-auto flex items-center gap-2">
                            {activeCall ? (
                        <span className="text-sm text-green-500 font-semibold animate-pulse">In Call</span>
                    ) : (
                        <>
                            {/* AI Summarize Feature */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowSummaryOptions(!showSummaryOptions)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-indigo-500 transition-all flex items-center gap-1"
                                    title="Summarize Chat"
                                >
                                    {isSummarizing ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <FileText className="w-5 h-5" />
                                    )}
                                </button>

                                {showSummaryOptions && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1e1f22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                        <div className="p-2 text-xs font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-white/10 px-3">
                                            Summarize last...
                                        </div>
                                        <button onClick={() => handleSummarize('count', 50)} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-2">
                                            <History className="w-4 h-4" /> 50 Messages
                                        </button>
                                        <button onClick={() => handleSummarize('count', 100)} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-2">
                                            <History className="w-4 h-4" /> 100 Messages
                                        </button>
                                        <button onClick={() => handleSummarize('time', 1)} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-2">
                                            <History className="w-4 h-4" /> 1 Hour
                                        </button>
                                        <button onClick={() => handleSummarize('time', 2)} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-2">
                                            <History className="w-4 h-4" /> 2 Hours
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => handleInitiateCall('audio')}
                                className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors group"
                                title="Start Audio Call"
                            >
                                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                            </button>
                                    <button
                                        onClick={() => handleInitiateCall('video')}
                                        className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors group"
                                        title="Start Video Call"
                                    >
                                        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <span className="text-2xl text-rose-500 mr-2">#</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{channelName || 'channel'}</span>
                        
                        {/* AI Summarize Feature for Channels */}
                        <div className="ml-auto flex items-center gap-2">
                            <div className="relative">
                                <button
                                    onClick={() => setShowSummaryOptions(!showSummaryOptions)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-indigo-500 transition-all flex items-center gap-1"
                                    title="Summarize Chat"
                                >
                                    {isSummarizing ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <FileText className="w-5 h-5" />
                                    )}
                                </button>

                                {showSummaryOptions && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1e1f22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                        <div className="p-2 text-xs font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-white/10 px-3">
                                            Summarize last...
                                        </div>
                                        <button onClick={() => handleSummarize('count', 50)} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-2">
                                            <History className="w-4 h-4" /> 50 Messages
                                        </button>
                                        <button onClick={() => handleSummarize('count', 100)} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-2">
                                            <History className="w-4 h-4" /> 100 Messages
                                        </button>
                                        <button onClick={() => handleSummarize('time', 1)} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-2">
                                            <History className="w-4 h-4" /> 1 Hour
                                        </button>
                                        <button onClick={() => handleSummarize('time', 2)} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-2">
                                            <History className="w-4 h-4" /> 2 Hours
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Summary Modal overlay */}
            {summary && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setSummary(null)}>
                    <div className="bg-white dark:bg-[#2b2d31] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-indigo-600 p-4 flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                <h3 className="font-bold">Chat Summary</h3>
                            </div>
                            <button onClick={() => setSummary(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 text-sm leading-relaxed max-h-96 overflow-y-auto custom-scrollbar">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={MarkdownComponents}
                                >
                                    {summary}
                                </ReactMarkdown>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-black/20 border-t border-gray-200 dark:border-white/5 flex justify-end">
                            <button
                                onClick={() => setSummary(null)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-indigo-500/20"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                        {msgUser?.displayName || msgUser?.username}
                                        {msgUser?.id === currentUser?.id && <span className="text-gray-500 dark:text-gray-400 text-xs ml-1 font-normal">(You)</span>}
                                    </span>
                                    {bannedUsers.has(msgUser?.id) && (
                                        <span className="text-xs text-red-500 dark:text-red-400 font-bold mr-2">(Banned)</span>
                                    )}
                                    <span className="text-xs text-gray-500 dark:text-gray-500 font-medium">
                                        {msg.createdAt && !isNaN(new Date(msg.createdAt))
                                            ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : 'Just now'
                                        }
                                    </span>
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
                                        onClick={() => handleDeleteMessageClick(msg)}
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
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-500 font-medium"
                                placeholder={`Message ${isDM ? '@' + (otherUser?.displayName || otherUser?.username || 'User') : '#' + (channelName || 'channel')}`}
                                value={input}
                                onChange={handleInputChange}
                            />
                            
                            {/* Mention Autocomplete Dropdown */}
                            {showMentionDropdown && 'sparkhub'.includes(mentionQuery) && (
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-[#1e1f22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                                    <button
                                        onClick={handleMentionSelect}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-2"
                                    >
                                        <Sparkles className="w-4 h-4 text-indigo-500" />
                                        <span className="font-semibold">SparkHub</span>
                                        <span className="text-xs opacity-70 ml-auto">AI Assistant</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center space-x-2 ml-2">
                            {/* AI Enhance Button */}
                            {input.trim() && (
                                <button
                                    type="button"
                                    onClick={handleEnhance}
                                    disabled={isEnhancing}
                                    className={`p-2 rounded-full transition-all flex items-center justify-center ${isEnhancing
                                        ? 'bg-indigo-500/20 text-indigo-500 animate-pulse'
                                        : 'text-indigo-500 hover:bg-indigo-500/10'
                                        }`}
                                    title="Enhance with AI"
                                >
                                    {isEnhancing ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-5 h-5" />
                                    )}
                                </button>
                            )}
                            
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



            {/* Active Call */}
            {activeCall && (
                <DMCall
                    channelId={activeCall.channelId}
                    callType={activeCall.type}
                    otherUser={otherUser}
                    onEnd={handleEndCall}
                />
            )}

            {/* Delete Message Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#313338] rounded-md shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Message</h2>
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
                                Are you sure you want to delete this message?
                                <br /><br />
                                <div className="p-3 bg-gray-100 dark:bg-[#2b2d31] rounded-md border border-gray-200 dark:border-white/5 text-xs italic text-gray-500 dark:text-gray-400 line-clamp-3 break-all">
                                    "{messageToDelete?.content || (messageToDelete?.fileUrl ? '[Attachment]' : '')}"
                                </div>
                            </p>
                            <div className="flex justify-end space-x-2 bg-gray-100 dark:bg-[#2b2d31] p-4 -m-6 mt-0">
                                <button
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:underline transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteMessage}
                                    className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded text-sm font-bold transition-colors shadow-sm"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatArea;
