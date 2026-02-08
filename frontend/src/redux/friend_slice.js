import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios_Client from "../utils/axios";

// ============== ASYNC THUNKS ==============

// Fetch friends list
export const fetchFriends = createAsyncThunk(
    "friend/fetchFriends",
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios_Client.get("/api/friends");
            return response.data.friends || [];
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

// Fetch pending friend requests
export const fetchPendingRequests = createAsyncThunk(
    "friend/fetchPendingRequests",
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios_Client.get("/api/friends/requests");
            return {
                incoming: response.data.incoming || [],
                outgoing: response.data.outgoing || []
            };
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

// Send friend request
export const sendFriendRequestThunk = createAsyncThunk(
    "friend/sendRequest",
    async (userId, { rejectWithValue }) => {
        try {
            const response = await axios_Client.post("/api/friends/request", { addresseeId: userId });
            return response.data;
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

// Accept friend request
export const acceptFriendRequestThunk = createAsyncThunk(
    "friend/acceptRequest",
    async (requestId, { rejectWithValue }) => {
        try {
            const response = await axios_Client.post(`/api/friends/${requestId}/accept`);
            return { requestId, friend: response.data.friend };
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

// Reject or remove friend
export const rejectOrRemoveFriendThunk = createAsyncThunk(
    "friend/rejectOrRemove",
    async (friendId, { rejectWithValue }) => {
        try {
            await axios_Client.delete(`/api/friends/${friendId}`);
            return { friendId };
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

// ============== SLICE ==============

const friend_slice = createSlice({
    name: "friend",
    initialState: {
        // Friends list
        friends: [],
        friendsLoading: false,
        friendsError: null,
        friendsLastFetched: null,

        // Pending requests
        pendingRequests: {
            incoming: [],
            outgoing: []
        },
        pendingLoading: false,
        pendingError: null,
        pendingLastFetched: null,

        // Request sending state
        sendingRequest: false,
        sendRequestError: null,
    },
    reducers: {
        // Update friend presence (real-time)
        updateFriendPresence: (state, action) => {
            const { userId, online, lastSeen } = action.payload;
            const friend = state.friends.find(f => f.id === userId);
            if (friend) {
                friend.online = online;
                friend.lastSeen = lastSeen;
            }
        },

        // Add a new friend (real-time: request accepted)
        addFriend: (state, action) => {
            const exists = state.friends.find(f => f.id === action.payload.id);
            if (!exists) {
                state.friends.push(action.payload);
            }
            // Remove from pending if exists
            state.pendingRequests.incoming = state.pendingRequests.incoming.filter(
                r => r.requester?.id !== action.payload.id
            );
            state.pendingRequests.outgoing = state.pendingRequests.outgoing.filter(
                r => r.addressee?.id !== action.payload.id
            );
        },

        // Remove a friend (real-time: unfriended)
        removeFriend: (state, action) => {
            const userId = action.payload;
            state.friends = state.friends.filter(f => f.id !== userId && f.friendshipId !== userId);
        },

        // Add pending request (real-time: received new request)
        addPendingRequest: (state, action) => {
            const { request, isIncoming } = action.payload;
            if (isIncoming) {
                const exists = state.pendingRequests.incoming.find(r => r.id === request.id);
                if (!exists) {
                    state.pendingRequests.incoming.push(request);
                }
            } else {
                const exists = state.pendingRequests.outgoing.find(r => r.id === request.id);
                if (!exists) {
                    state.pendingRequests.outgoing.push(request);
                }
            }
        },

        // Remove pending request
        removePendingRequest: (state, action) => {
            const requestId = action.payload;
            state.pendingRequests.incoming = state.pendingRequests.incoming.filter(r => r.id !== requestId);
            state.pendingRequests.outgoing = state.pendingRequests.outgoing.filter(r => r.id !== requestId);
        },

        // Invalidate cache (force refetch)
        invalidateFriendsCache: (state) => {
            state.friendsLastFetched = null;
        },

        invalidatePendingCache: (state) => {
            state.pendingLastFetched = null;
        },

        // Clear errors
        clearFriendErrors: (state) => {
            state.friendsError = null;
            state.pendingError = null;
            state.sendRequestError = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // fetchFriends
            .addCase(fetchFriends.pending, (state) => {
                state.friendsLoading = true;
                state.friendsError = null;
            })
            .addCase(fetchFriends.fulfilled, (state, action) => {
                state.friendsLoading = false;
                state.friends = action.payload;
                state.friendsLastFetched = Date.now();
            })
            .addCase(fetchFriends.rejected, (state, action) => {
                state.friendsLoading = false;
                state.friendsError = action.payload?.message || "Failed to fetch friends";
            })

            // fetchPendingRequests
            .addCase(fetchPendingRequests.pending, (state) => {
                state.pendingLoading = true;
                state.pendingError = null;
            })
            .addCase(fetchPendingRequests.fulfilled, (state, action) => {
                state.pendingLoading = false;
                state.pendingRequests = action.payload;
                state.pendingLastFetched = Date.now();
            })
            .addCase(fetchPendingRequests.rejected, (state, action) => {
                state.pendingLoading = false;
                state.pendingError = action.payload?.message || "Failed to fetch requests";
            })

            // sendFriendRequestThunk
            .addCase(sendFriendRequestThunk.pending, (state) => {
                state.sendingRequest = true;
                state.sendRequestError = null;
            })
            .addCase(sendFriendRequestThunk.fulfilled, (state, action) => {
                state.sendingRequest = false;
                // Optionally add to outgoing if API returns the request
                if (action.payload.request) {
                    state.pendingRequests.outgoing.push(action.payload.request);
                }
            })
            .addCase(sendFriendRequestThunk.rejected, (state, action) => {
                state.sendingRequest = false;
                state.sendRequestError = action.payload?.message || "Failed to send request";
            })

            // acceptFriendRequestThunk
            .addCase(acceptFriendRequestThunk.fulfilled, (state, action) => {
                const { requestId, friend } = action.payload;
                // Remove from incoming
                state.pendingRequests.incoming = state.pendingRequests.incoming.filter(
                    r => r.id !== requestId
                );
                // Add to friends if friend data provided
                if (friend) {
                    const exists = state.friends.find(f => f.id === friend.id);
                    if (!exists) {
                        state.friends.push(friend);
                    }
                }
            })

            // rejectOrRemoveFriendThunk
            .addCase(rejectOrRemoveFriendThunk.fulfilled, (state, action) => {
                const { friendId } = action.payload;
                // Remove from friends
                state.friends = state.friends.filter(
                    f => f.id !== friendId && f.friendshipId !== friendId
                );
                // Remove from pending
                state.pendingRequests.incoming = state.pendingRequests.incoming.filter(
                    r => r.id !== friendId
                );
                state.pendingRequests.outgoing = state.pendingRequests.outgoing.filter(
                    r => r.id !== friendId
                );
            });
    }
});

export const {
    updateFriendPresence,
    addFriend,
    removeFriend,
    addPendingRequest,
    removePendingRequest,
    invalidateFriendsCache,
    invalidatePendingCache,
    clearFriendErrors,
} = friend_slice.actions;

export default friend_slice.reducer;
