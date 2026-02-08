import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getMessages } from "../services/messageService";
import { getDMMessages } from "../services/dmService";

// Constants
const MAX_MESSAGES_PER_CHANNEL = 100;
const MAX_CACHED_CHANNELS = 5;
const CACHE_STALE_TIME = 300000; // 5 minutes (was 1 minute)

// ============== ASYNC THUNKS ==============

// Fetch messages for a channel (initial load or refresh)
export const fetchMessages = createAsyncThunk(
    "message/fetchMessages",
    async ({ channelId, isDM = false, cursor = null }, { rejectWithValue }) => {
        try {
            const data = isDM
                ? await getDMMessages(channelId, 50, cursor)
                : await getMessages(channelId, 50, cursor);

            return {
                channelId,
                messages: data.messages || [],
                nextCursor: data.nextCursor || null,
                hasMore: !!data.nextCursor
            };
        } catch (err) {
            return rejectWithValue({
                channelId,
                error: err.response?.data?.message || err.message
            });
        }
    }
);

// Fetch older messages (pagination - infinite scroll)
export const fetchOlderMessages = createAsyncThunk(
    "message/fetchOlderMessages",
    async ({ channelId, isDM = false }, { getState, rejectWithValue }) => {
        try {
            const state = getState();
            const channelData = state.message.messages[channelId];

            if (!channelData || !channelData.cursor) {
                return rejectWithValue({ channelId, error: "No cursor available" });
            }

            const data = isDM
                ? await getDMMessages(channelId, 50, channelData.cursor)
                : await getMessages(channelId, 50, channelData.cursor);

            return {
                channelId,
                messages: data.messages || [],
                nextCursor: data.nextCursor || null,
                hasMore: !!data.nextCursor
            };
        } catch (err) {
            return rejectWithValue({
                channelId,
                error: err.response?.data?.message || err.message
            });
        }
    }
);

// Mark channel as read
export const markChannelAsRead = createAsyncThunk(
    "message/markAsRead",
    async ({ channelId, messageId }, { rejectWithValue }) => {
        try {
            // TODO: Add backend API call when ready
            // await axios_Client.post(`/api/channels/${channelId}/read`, { lastReadMessageId: messageId });

            return { channelId, messageId };
        } catch (err) {
            return rejectWithValue({
                channelId,
                error: err.response?.data?.message || err.message
            });
        }
    }
);

// ============== HELPER FUNCTIONS ==============

// Prune messages to keep only MAX_MESSAGES_PER_CHANNEL
const pruneMessagesBySize = (messages) => {
    if (messages.length <= MAX_MESSAGES_PER_CHANNEL) {
        return messages;
    }
    // Keep the most recent messages (messages are sorted newest first)
    return messages.slice(0, MAX_MESSAGES_PER_CHANNEL);
};

// Get least recently used channel IDs to evict
const getLRUChannelIds = (state) => {
    const channelIds = Object.keys(state.messages);
    if (channelIds.length <= MAX_CACHED_CHANNELS) {
        return [];
    }

    // Sort by lastViewedAt, oldest first
    const sorted = channelIds
        .map(id => ({
            id: parseInt(id),
            lastViewed: state.channelMetadata[id]?.lastViewedAt || 0
        }))
        .sort((a, b) => a.lastViewed - b.lastViewed);

    // Return channel IDs to evict (keep only MAX_CACHED_CHANNELS)
    const toEvict = sorted.slice(0, channelIds.length - MAX_CACHED_CHANNELS);
    return toEvict.map(item => item.id);
};

// ============== SLICE ==============

const message_slice = createSlice({
    name: "message",
    initialState: {
        messages: {
            // [channelId]: {
            //   messages: Message[],
            //   hasMore: boolean,
            //   cursor: number | null,
            //   lastFetched: timestamp,
            //   loading: boolean,
            //   error: string | null
            // }
        },
        channelMetadata: {
            // [channelId]: {
            //   unreadCount: number,
            //   lastReadMessageId: number,
            //   lastViewedAt: timestamp
            // }
        },
        activeChannelId: null,
        cachedChannelIds: [] // For LRU tracking
    },
    reducers: {
        // Set active channel
        setActiveChannel: (state, action) => {
            const channelId = action.payload;
            state.activeChannelId = channelId;

            // Update lastViewedAt for LRU
            if (!state.channelMetadata[channelId]) {
                state.channelMetadata[channelId] = {
                    unreadCount: 0,
                    lastReadMessageId: null,
                    lastViewedAt: Date.now()
                };
            } else {
                state.channelMetadata[channelId].lastViewedAt = Date.now();
            }

            // Update LRU list
            state.cachedChannelIds = [
                channelId,
                ...state.cachedChannelIds.filter(id => id !== channelId)
            ];
        },

        // Add new message (WebSocket)
        addMessage: (state, action) => {
            const { channelId, message } = action.payload;

            if (!state.messages[channelId]) {
                state.messages[channelId] = {
                    messages: [],
                    hasMore: true,
                    cursor: null,
                    lastFetched: Date.now(),
                    loading: false,
                    error: null
                };
            }

            // Check if message already exists by ID
            const existsById = state.messages[channelId].messages.some(
                m => m.id === message.id
            );

            if (existsById) {
                // Message already exists, don't add duplicate
                return;
            }

            // Check for optimistic/pending message to replace
            // Look for messages with pending=true and matching content/user/time
            const optimisticIndex = state.messages[channelId].messages.findIndex(
                m =>
                    m.pending &&
                    m.user?.id === message.user?.id &&
                    (m.content || '') === (message.content || '') &&
                    (m.fileName || null) === (message.fileName || null) &&
                    Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) < 5000
            );

            if (optimisticIndex !== -1) {
                // Replace optimistic message with real one
                console.log('🔄 Redux: Replacing optimistic message at index', optimisticIndex);
                state.messages[channelId].messages[optimisticIndex] = message;
            } else {
                // No optimistic message found, add as new
                console.log('✨ Redux: Adding new message');
                state.messages[channelId].messages.unshift(message);

                // Prune if needed
                state.messages[channelId].messages = pruneMessagesBySize(
                    state.messages[channelId].messages
                );

                // Update unread count if not active channel
                if (state.activeChannelId !== channelId) {
                    if (!state.channelMetadata[channelId]) {
                        state.channelMetadata[channelId] = {
                            unreadCount: 1,
                            lastReadMessageId: null,
                            lastViewedAt: 0
                        };
                    } else {
                        state.channelMetadata[channelId].unreadCount += 1;
                    }
                }
            }

            // Run LRU eviction if needed
            const toEvict = getLRUChannelIds(state);
            toEvict.forEach(id => {
                delete state.messages[id];
                state.cachedChannelIds = state.cachedChannelIds.filter(cid => cid !== id);
            });
        },

        // Update message (WebSocket edit)
        updateMessage: (state, action) => {
            const { channelId, messageId, updates } = action.payload;

            if (state.messages[channelId]) {
                const index = state.messages[channelId].messages.findIndex(
                    m => m.id === messageId
                );

                if (index !== -1) {
                    state.messages[channelId].messages[index] = {
                        ...state.messages[channelId].messages[index],
                        ...updates
                    };
                }
            }
        },

        // Delete message (WebSocket delete)
        deleteMessage: (state, action) => {
            const { channelId, messageId } = action.payload;

            if (state.messages[channelId]) {
                state.messages[channelId].messages = state.messages[channelId].messages.filter(
                    m => m.id !== messageId
                );
            }
        },

        // Clear cache for a specific channel
        clearChannelCache: (state, action) => {
            const channelId = action.payload;
            delete state.messages[channelId];
            state.cachedChannelIds = state.cachedChannelIds.filter(id => id !== channelId);
        },

        // Clear all cache
        clearAllCache: (state) => {
            state.messages = {};
            state.channelMetadata = {};
            state.cachedChannelIds = [];
        }
    },
    extraReducers: (builder) => {
        builder
            // fetchMessages.pending
            .addCase(fetchMessages.pending, (state, action) => {
                const { channelId } = action.meta.arg;

                if (!state.messages[channelId]) {
                    state.messages[channelId] = {
                        messages: [],
                        hasMore: true,
                        cursor: null,
                        lastFetched: null,
                        loading: true,
                        error: null
                    };
                } else {
                    state.messages[channelId].loading = true;
                    state.messages[channelId].error = null;
                }
            })
            // fetchMessages.fulfilled
            .addCase(fetchMessages.fulfilled, (state, action) => {
                const { channelId, messages, nextCursor, hasMore } = action.payload;

                state.messages[channelId] = {
                    messages: messages,
                    hasMore: hasMore,
                    cursor: nextCursor,
                    lastFetched: Date.now(),
                    loading: false,
                    error: null
                };

                // Update cached channel list
                if (!state.cachedChannelIds.includes(channelId)) {
                    state.cachedChannelIds.push(channelId);
                }

                // Run LRU eviction if needed
                const toEvict = getLRUChannelIds(state);
                toEvict.forEach(id => {
                    delete state.messages[id];
                    state.cachedChannelIds = state.cachedChannelIds.filter(cid => cid !== id);
                });
            })
            // fetchMessages.rejected
            .addCase(fetchMessages.rejected, (state, action) => {
                const { channelId, error } = action.payload;

                if (state.messages[channelId]) {
                    state.messages[channelId].loading = false;
                    state.messages[channelId].error = error;
                }
            })
            // fetchOlderMessages.pending
            .addCase(fetchOlderMessages.pending, (state, action) => {
                const { channelId } = action.meta.arg;
                if (state.messages[channelId]) {
                    state.messages[channelId].loading = true;
                }
            })
            // fetchOlderMessages.fulfilled
            .addCase(fetchOlderMessages.fulfilled, (state, action) => {
                const { channelId, messages, nextCursor, hasMore } = action.payload;

                if (state.messages[channelId]) {
                    // Append older messages (they come sorted newest first from API)
                    state.messages[channelId].messages = [
                        ...state.messages[channelId].messages,
                        ...messages
                    ];

                    // Prune if needed
                    state.messages[channelId].messages = pruneMessagesBySize(
                        state.messages[channelId].messages
                    );

                    state.messages[channelId].cursor = nextCursor;
                    state.messages[channelId].hasMore = hasMore;
                    state.messages[channelId].loading = false;
                }
            })
            // fetchOlderMessages.rejected
            .addCase(fetchOlderMessages.rejected, (state, action) => {
                const { channelId, error } = action.payload || {};
                if (channelId && state.messages[channelId]) {
                    state.messages[channelId].loading = false;
                    state.messages[channelId].error = error;
                }
            })
            // markChannelAsRead.fulfilled
            .addCase(markChannelAsRead.fulfilled, (state, action) => {
                const { channelId, messageId } = action.payload;

                if (!state.channelMetadata[channelId]) {
                    state.channelMetadata[channelId] = {
                        unreadCount: 0,
                        lastReadMessageId: messageId,
                        lastViewedAt: Date.now()
                    };
                } else {
                    state.channelMetadata[channelId].lastReadMessageId = messageId;
                    state.channelMetadata[channelId].unreadCount = 0;
                }
            });
    }
});

export const {
    setActiveChannel,
    addMessage,
    updateMessage,
    deleteMessage,
    clearChannelCache,
    clearAllCache
} = message_slice.actions;

export default message_slice.reducer;
