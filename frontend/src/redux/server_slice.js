import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios_Client from "../utils/axios";

// ============== ASYNC THUNKS ==============

// Fetch user's servers
export const fetchMyServers = createAsyncThunk(
    "server/fetchMyServers",
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios_Client.get("/api/servers");
            return response.data.servers || [];
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

// Fetch channels for a server
export const fetchServerChannels = createAsyncThunk(
    "server/fetchServerChannels",
    async (serverId, { rejectWithValue }) => {
        try {
            const response = await axios_Client.get(`/api/servers/${serverId}/channels`);
            return { serverId, channels: response.data.channels || [] };
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

// Fetch members for a server
export const fetchServerMembers = createAsyncThunk(
    "server/fetchServerMembers",
    async (serverId, { rejectWithValue }) => {
        try {
            const response = await axios_Client.get(`/api/servers/${serverId}/members`);
            return { serverId, members: response.data.members || [] };
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

// Fetch banned members for a server
export const fetchBannedMembers = createAsyncThunk(
    "server/fetchBannedMembers",
    async (serverId, { rejectWithValue }) => {
        try {
            const response = await axios_Client.get(`/api/servers/${serverId}/bans`);
            return { serverId, bans: response.data.bans || [] };
        } catch (err) {
            // Not owner or error - this is expected for non-owners
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

// Fetch categories for a server
export const fetchServerCategories = createAsyncThunk(
    "server/fetchServerCategories",
    async (serverId, { rejectWithValue }) => {
        try {
            const response = await axios_Client.get(`/api/categories/${serverId}`);
            return { serverId, categories: response.data.categories || [] };
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

// ============== SLICE ==============

const server_slice = createSlice({
    name: "server",
    initialState: {
        // User's joined servers list
        servers: [],
        serversLoading: false,
        serversError: null,
        serversLastFetched: null,

        // Per-server details (keyed by serverId)
        // { [serverId]: { channels, members, bannedUsers, channelsLoading, membersLoading, lastFetched } }
        serverDetails: {},

        // Currently selected server/channel
        currentServerId: null,
        currentChannelId: null,
    },
    reducers: {
        // Set current server
        setCurrentServer: (state, action) => {
            state.currentServerId = action.payload;
        },

        // Set current channel
        setCurrentChannel: (state, action) => {
            state.currentChannelId = action.payload;
        },

        // Add a new server (real-time: server created/joined)
        addServer: (state, action) => {
            const exists = state.servers.find(s => s.id === action.payload.id);
            if (!exists) {
                state.servers.push(action.payload);
            }
        },

        // Remove a server (real-time: server left/deleted)
        removeServer: (state, action) => {
            const serverId = action.payload;
            state.servers = state.servers.filter(s => s.id !== serverId);
            delete state.serverDetails[serverId];
            if (state.currentServerId === serverId) {
                state.currentServerId = null;
                state.currentChannelId = null;
            }
        },

        // Update a server (real-time: server settings changed)
        updateServer: (state, action) => {
            const index = state.servers.findIndex(s => s.id === action.payload.id);
            if (index !== -1) {
                state.servers[index] = { ...state.servers[index], ...action.payload };
            }
        },

        // Add a channel to a server
        addChannel: (state, action) => {
            const { serverId, channel } = action.payload;
            if (state.serverDetails[serverId]?.channels) {
                const exists = state.serverDetails[serverId].channels.find(c => c.id === channel.id);
                if (!exists) {
                    state.serverDetails[serverId].channels.push(channel);
                }
            }
        },

        // Remove a channel from a server
        removeChannel: (state, action) => {
            const { serverId, channelId } = action.payload;
            if (state.serverDetails[serverId]?.channels) {
                state.serverDetails[serverId].channels = state.serverDetails[serverId].channels.filter(
                    c => c.id !== channelId
                );
            }
            if (state.currentChannelId === channelId) {
                state.currentChannelId = null;
            }
        },

        // Add a category to a server
        addCategory: (state, action) => {
            const { serverId, category } = action.payload;
            if (state.serverDetails[serverId]) {
                if (!state.serverDetails[serverId].categories) {
                    state.serverDetails[serverId].categories = [];
                }
                const exists = state.serverDetails[serverId].categories.find(c => c.id === category.id);
                if (!exists) {
                    state.serverDetails[serverId].categories.push(category);
                }
            }
        },

        // Remove a category from a server
        removeCategory: (state, action) => {
            const { serverId, categoryId } = action.payload;
            if (state.serverDetails[serverId]?.categories) {
                state.serverDetails[serverId].categories = state.serverDetails[serverId].categories.filter(
                    c => c.id !== categoryId
                );
            }
        },

        // Add a member to a server
        addMember: (state, action) => {
            const { serverId, member } = action.payload;
            if (state.serverDetails[serverId]?.members) {
                const exists = state.serverDetails[serverId].members.find(m => m.userId === member.userId);
                if (!exists) {
                    state.serverDetails[serverId].members.push(member);
                }
            }
        },

        // Remove a member from a server (kicked/left/banned)
        removeMember: (state, action) => {
            const { serverId, userId } = action.payload;
            if (state.serverDetails[serverId]?.members) {
                state.serverDetails[serverId].members = state.serverDetails[serverId].members.filter(
                    m => m.userId !== userId
                );
            }
        },

        // Update member presence
        updateMemberPresence: (state, action) => {
            const { serverId, userId, online, lastSeen } = action.payload;
            if (state.serverDetails[serverId]?.members) {
                const member = state.serverDetails[serverId].members.find(m => m.userId === userId);
                if (member) {
                    member.online = online;
                    member.lastSeen = lastSeen;
                }
            }
        },

        // Add to banned users
        addBannedUser: (state, action) => {
            const { serverId, ban } = action.payload;
            if (state.serverDetails[serverId]) {
                if (!state.serverDetails[serverId].bannedUsers) {
                    state.serverDetails[serverId].bannedUsers = [];
                }
                state.serverDetails[serverId].bannedUsers.push(ban);
            }
        },

        // Remove from banned users
        removeBannedUser: (state, action) => {
            const { serverId, userId } = action.payload;
            if (state.serverDetails[serverId]?.bannedUsers) {
                state.serverDetails[serverId].bannedUsers = state.serverDetails[serverId].bannedUsers.filter(
                    b => b.userId !== userId
                );
            }
        },

        // Clear all cached data for a server
        clearServerData: (state, action) => {
            const serverId = action.payload;
            delete state.serverDetails[serverId];
        },

        // Invalidate servers cache (force refetch on next access)
        invalidateServersCache: (state) => {
            state.serversLastFetched = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // fetchMyServers
            .addCase(fetchMyServers.pending, (state) => {
                state.serversLoading = true;
                state.serversError = null;
            })
            .addCase(fetchMyServers.fulfilled, (state, action) => {
                state.serversLoading = false;
                state.servers = action.payload;
                state.serversLastFetched = Date.now();
            })
            .addCase(fetchMyServers.rejected, (state, action) => {
                state.serversLoading = false;
                state.serversError = action.payload?.message || "Failed to fetch servers";
            })

            // fetchServerChannels
            .addCase(fetchServerChannels.pending, (state, action) => {
                const serverId = action.meta.arg;
                if (!state.serverDetails[serverId]) {
                    state.serverDetails[serverId] = {};
                }
                state.serverDetails[serverId].channelsLoading = true;
            })
            .addCase(fetchServerChannels.fulfilled, (state, action) => {
                const { serverId, channels } = action.payload;
                if (!state.serverDetails[serverId]) {
                    state.serverDetails[serverId] = {};
                }
                state.serverDetails[serverId].channels = channels;
                state.serverDetails[serverId].channelsLoading = false;
                state.serverDetails[serverId].channelsLastFetched = Date.now();
            })
            .addCase(fetchServerChannels.rejected, (state, action) => {
                const serverId = action.meta.arg;
                if (state.serverDetails[serverId]) {
                    state.serverDetails[serverId].channelsLoading = false;
                }
            })

            // fetchServerMembers
            .addCase(fetchServerMembers.pending, (state, action) => {
                const serverId = action.meta.arg;
                if (!state.serverDetails[serverId]) {
                    state.serverDetails[serverId] = {};
                }
                state.serverDetails[serverId].membersLoading = true;
            })
            .addCase(fetchServerMembers.fulfilled, (state, action) => {
                const { serverId, members } = action.payload;
                if (!state.serverDetails[serverId]) {
                    state.serverDetails[serverId] = {};
                }
                state.serverDetails[serverId].members = members;
                state.serverDetails[serverId].membersLoading = false;
                state.serverDetails[serverId].membersLastFetched = Date.now();
            })
            .addCase(fetchServerMembers.rejected, (state, action) => {
                const serverId = action.meta.arg;
                if (state.serverDetails[serverId]) {
                    state.serverDetails[serverId].membersLoading = false;
                }
            })

            // fetchBannedMembers
            .addCase(fetchBannedMembers.pending, (state, action) => {
                const serverId = action.meta.arg;
                if (!state.serverDetails[serverId]) {
                    state.serverDetails[serverId] = {};
                }
                state.serverDetails[serverId].bansLoading = true;
            })
            .addCase(fetchBannedMembers.fulfilled, (state, action) => {
                const { serverId, bans } = action.payload;
                if (!state.serverDetails[serverId]) {
                    state.serverDetails[serverId] = {};
                }
                state.serverDetails[serverId].bannedUsers = bans;
                state.serverDetails[serverId].bansLoading = false;
            })
            .addCase(fetchBannedMembers.rejected, (state, action) => {
                const serverId = action.meta.arg;
                if (state.serverDetails[serverId]) {
                    state.serverDetails[serverId].bansLoading = false;
                }
            })

            // fetchServerCategories
            .addCase(fetchServerCategories.pending, (state, action) => {
                const serverId = action.meta.arg;
                if (!state.serverDetails[serverId]) {
                    state.serverDetails[serverId] = {};
                }
                state.serverDetails[serverId].categoriesLoading = true;
            })
            .addCase(fetchServerCategories.fulfilled, (state, action) => {
                const { serverId, categories } = action.payload;
                if (!state.serverDetails[serverId]) {
                    state.serverDetails[serverId] = {};
                }
                state.serverDetails[serverId].categories = categories;
                state.serverDetails[serverId].categoriesLoading = false;
                state.serverDetails[serverId].categoriesLastFetched = Date.now();
            })
            .addCase(fetchServerCategories.rejected, (state, action) => {
                const serverId = action.meta.arg;
                if (state.serverDetails[serverId]) {
                    state.serverDetails[serverId].categoriesLoading = false;
                }
            });
    }
});

export const {
    setCurrentServer,
    setCurrentChannel,
    addServer,
    removeServer,
    updateServer,
    addChannel,
    removeChannel,
    addCategory,
    removeCategory,
    addMember,
    removeMember,
    updateMemberPresence,
    addBannedUser,
    removeBannedUser,
    clearServerData,
    invalidateServersCache,
} = server_slice.actions;

export default server_slice.reducer;
