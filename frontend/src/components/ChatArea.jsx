import React, { useEffect, useState, useRef } from 'react';
import { getMessages, sendMessageREST } from '../services/messageService';
import { getSocket } from '../utils/socket';
import { getUserPresence } from '../services/presenceService';
import { useSelector } from 'react-redux';
import OnlineIndicator from './OnlineIndicator';

const ChatArea = ({ channelId, channelName }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [typingUser, setTypingUser] = useState(null);
    const [userPresence, setUserPresence] = useState({}); // {userId: {online: bool, lastSeen: timestamp}}
    const messagesEndRef = useRef(null);
    const socket = getSocket();
    const currentUser = useSelector(state => state.auth.user);
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    useEffect(() => {
        if (!channelId) return;

        fetchMessages();

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
                            msg.content === message.content &&
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

            // Add listeners
            socket.on('NEW_MESSAGE', handleNewMessage);
            socket.on('TYPING_START', handleTypingStart);
            socket.on('TYPING_STOP', handleTypingStop);

            // Join channel
            socket.emit('JOIN_CHANNEL', { channelId });
            console.log('Joining channel:', channelId);

            // Cleanup
            return () => {
                socket.off('NEW_MESSAGE', handleNewMessage);
                socket.off('TYPING_START', handleTypingStart);
                socket.off('TYPING_STOP', handleTypingStop);
                socket.emit('LEAVE_CHANNEL', { channelId });
                console.log('Leaving channel:', channelId);
            };
        }
    }, [channelId, socket]);

    const fetchMessages = async () => {
        try {
            const data = await getMessages(channelId);
            setMessages(data.messages || []);

            // Fetch presence for unique users in messages
            const uniqueUserIds = [...new Set(data.messages?.map(m => m.user?.id).filter(Boolean))];
            uniqueUserIds.forEach(userId => {
                if (userId) fetchUserPresence(userId);
            });
        } catch (err) {
            console.error("Failed to load messages", err);
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
        // Clear typing indicator when sending message
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        if (socket && isTypingRef.current) {
            socket.emit('TYPING_STOP', { channelId });
            isTypingRef.current = false;
        }


        e.preventDefault();
        if (!input.trim()) return;

        const content = input;
        setInput('');

        // Create optimistic message (shown immediately)
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempId,
            content: content.trim(),
            channelId: parseInt(channelId),
            createdAt: new Date().toISOString(),
            user: {
                id: currentUser?.id || 'unknown',
                username: currentUser?.username || 'You',
                avatar: currentUser?.avatar || null
            },
            pending: true // Flag to show it's being sent
        };

        // Add optimistically to UI
        setMessages(prev => [optimisticMessage, ...prev]);
        scrollToBottom();

        // Emitting via Socket is preferred
        if (socket) {
            socket.emit('SEND_MESSAGE', { channelId, content }, (ack) => {
                if (ack?.error) {
                    console.error("Msg failed", ack.error);
                    // Remove optimistic message and show error
                    setMessages(prev => prev.filter(msg => msg.id !== tempId));
                    alert('Failed to send message: ' + ack.error);
                    // Restore input
                    setInput(content);
                } else if (ack?.message) {
                    // Success - replace optimistic message with real one from server
                    setMessages(prev => prev.map(msg =>
                        msg.id === tempId ? ack.message : msg
                    ));
                }
            });
        } else {
            // Fallback REST
            try {
                const response = await sendMessageREST(channelId, content);
                // Replace optimistic message with real one
                setMessages(prev => prev.map(msg =>
                    msg.id === tempId ? response.data : msg
                ));
            } catch (err) {
                console.error("REST send failed", err);
                // Remove optimistic message
                setMessages(prev => prev.filter(msg => msg.id !== tempId));
                alert('Failed to send message');
                setInput(content);
            }
        }
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

    if (!channelId) {
        return (
            <div className="flex-1 bg-white dark:bg-black flex items-center justify-center text-gray-500 dark:text-gray-400">
                Select a channel to start chatting
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-black h-screen">
            {/* Header */}
            <div className="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 shadow-sm bg-white dark:bg-black z-10">
                <span className="text-2xl text-gray-400 dark:text-gray-500 mr-2">#</span>
                <span className="font-bold text-gray-900 dark:text-white">{channelName || 'channel'}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse">
                <div ref={messagesEndRef} />
                {messages.map((msg) => (
                    <div key={msg.id} className={`mb-4 flex group hover:bg-gray-50 dark:hover:bg-gray-900/30 p-1 -mx-2 px-2 rounded ${msg.pending ? 'opacity-60' : ''}`}>
                        <div className="w-10 h-10 rounded-full bg-indigo-500 flex-shrink-0 mr-4 cursor-pointer">
                            {msg.user?.avatar ?
                                <img src={msg.user.avatar} className="w-full h-full rounded-full object-cover" /> :
                                <div className="w-full h-full flex items-center justify-center text-white">{msg.user?.username?.[0]}</div>
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline">
                                <span className="font-bold text-gray-900 dark:text-white mr-2 hover:underline cursor-pointer">{msg.user?.username}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                                {msg.pending && (
                                    <span className="ml-2 text-xs text-gray-400 flex items-center">
                                        <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sending...
                                    </span>
                                )}
                            </div>
                            <p className="text-gray-800 dark:text-gray-300 whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Typing Indicator */}
            {typingUser && (
                <div className="px-4 py-1 text-xs font-bold text-gray-500 dark:text-gray-400 animate-pulse">
                    {typingUser} is typing...
                </div>
            )}

            {/* Typing Indicator */}
            {typingUser && (
                <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-2">
                    <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span>{typingUser} is typing...</span>
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-black">
                <form onSubmit={handleSendMessage} className="bg-gray-100 dark:bg-[#1e1e1e] rounded-lg p-2 flex items-center">
                    <button type="button" className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 ml-1 mr-3 flex items-center justify-center hover:text-gray-700 dark:hover:text-gray-200">
                        +
                    </button>
                    <input
                        type="text"
                        className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-500"
                        placeholder={`Message #${channelName || 'channel'}`}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            handleTyping();
                        }}
                    />
                </form>
            </div>
        </div>
    );
};

export default ChatArea;
