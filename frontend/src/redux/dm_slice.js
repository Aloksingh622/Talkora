import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios_Client from "../utils/axios";

// ============== ASYNC THUNKS ==============

// Fetch DM conversations
export const fetchDMConversations = createAsyncThunk(
    "dm/fetchConversations",
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios_Client.get("/api/dm");
            return response.data.conversations || [];
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

// Create or get DM channel
export const createOrGetDMChannelThunk = createAsyncThunk(
    "dm/createOrGetChannel",
    async (userId, { rejectWithValue }) => {
        try {
            const response = await axios_Client.post("/api/dm/create", { recipientId: userId });
            return response.data.dmChannel || response.data.channel;
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

// ============== SLICE ==============

const dm_slice = createSlice({
    name: "dm",
    initialState: {
        conversations: [],
        conversationsLoading: false,
        conversationsError: null,
        conversationsLastFetched: null,

        // Active DM channel messages (optional, could be in a separate messages slice)
        activeChannelId: null,
    },
    reducers: {
        setActiveDMChannel: (state, action) => {
            state.activeChannelId = action.payload;
        },

        // Real-time: DM received or created
        addDMConversation: (state, action) => {
            const conversation = action.payload;
            const exists = state.conversations.find(c => c.channelId === conversation.channelId);
            if (!exists) {
                state.conversations.unshift(conversation); // Add to top
            } else {
                // Move to top if updated
                state.conversations = [
                    conversation,
                    ...state.conversations.filter(c => c.channelId !== conversation.channelId)
                ];
            }
        },

        // Invalidate cache
        invalidateDMCache: (state) => {
            state.conversationsLastFetched = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // fetchDMConversations
            .addCase(fetchDMConversations.pending, (state) => {
                state.conversationsLoading = true;
                state.conversationsError = null;
            })
            .addCase(fetchDMConversations.fulfilled, (state, action) => {
                state.conversationsLoading = false;
                state.conversations = action.payload;
                state.conversationsLastFetched = Date.now();
            })
            .addCase(fetchDMConversations.rejected, (state, action) => {
                state.conversationsLoading = false;
                state.conversationsError = action.payload?.message || "Failed to fetch DMs";
            });
    }
});

export const {
    setActiveDMChannel,
    addDMConversation,
    invalidateDMCache
} = dm_slice.actions;

export default dm_slice.reducer;
