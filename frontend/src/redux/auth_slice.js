import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios_Client from "../utils/axios";

export const user_register = createAsyncThunk(
    "auth/register",
    async (user_data, { rejectWithValue }) => {
        try {
            const response = await axios_Client.post("/api/auth/register", user_data);
            return response.data.user;
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const social_login_thunk = createAsyncThunk(
    "auth/socialLogin",
    async (idToken, { rejectWithValue }) => {
        try {
            const response = await axios_Client.post("/api/auth/socialLogin", { idToken });
            return response.data.user;
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const user_login = createAsyncThunk(
    "auth/login",
    async (credentials, { rejectWithValue }) => {
        try {
            const response = await axios_Client.post("/api/auth/login", credentials);
            return response.data.user;
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const check_auth = createAsyncThunk(
    "auth/check",
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios_Client.get("/api/auth/check");
            return response.data.user;
        } catch (err) {
             // If 401/403, it means not logged in, which is expected state, not necessarily an "error" for the UI alert
             if (err.response?.status === 401 || err.response?.status === 403) {
                return rejectWithValue({ message: "Unauthorized", forceLogout: true });
            }
            return rejectWithValue(err.response?.data || { message: "Server error" });
        }
    }
);

export const user_logout = createAsyncThunk(
    "auth/logout",
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios_Client.post("/api/auth/logout");
            return response.data.message;
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const user_delete = createAsyncThunk(
    "auth/delete",
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios_Client.delete("/api/auth/deleteProfile");
            return response.data.message;
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

const auth_slice = createSlice({
    name: "auth",
    initialState: {
        user: null,
        is_authenticated: false,
        loading: false,
        error: null,
        isCheckingAuth: true, 
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            // register
            .addCase(user_register.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(user_register.fulfilled, (state, action) => {
                state.loading = false;
                state.is_authenticated = !!action.payload;
                state.user = action.payload;
            })
            .addCase(user_register.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message || 'Registration failed';
                state.is_authenticated = false;
            })

            // login
            .addCase(user_login.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(user_login.fulfilled, (state, action) => {
                state.loading = false;
                state.is_authenticated = !!action.payload;
                state.user = action.payload;
            })
            .addCase(user_login.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message || 'Login failed';
                state.is_authenticated = false;
            })

            // check auth
            .addCase(check_auth.pending, (state) => {
                state.isCheckingAuth = true;
                state.error = null;
            })
            .addCase(check_auth.fulfilled, (state, action) => {
                state.isCheckingAuth = false;
                state.is_authenticated = !!action.payload;
                state.user = action.payload;
            })
            .addCase(check_auth.rejected, (state, action) => {
                state.isCheckingAuth = false;
                state.is_authenticated = false;
                state.user = null;
                // Only set error if it's not a standard unauthorized check
                if (!action.payload?.forceLogout) {
                     state.error = action.payload?.message;
                }
            })

            // logout
            .addCase(user_logout.fulfilled, (state) => {
                state.user = null;
                state.is_authenticated = false;
            })
            .addCase(user_logout.rejected, (state, action) => {
                 state.error = action.payload?.message || 'Logout failed';
            })

            // social_login
            .addCase(social_login_thunk.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(social_login_thunk.fulfilled, (state, action) => {
                state.loading = false;
                state.is_authenticated = !!action.payload;
                state.user = action.payload;
            })
            .addCase(social_login_thunk.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message || 'Social login failed';
                state.is_authenticated = false;
            })

            // delete profile
            .addCase(user_delete.pending, (state) => {
                state.loading = true;
            })
            .addCase(user_delete.fulfilled, (state) => {
                state.loading = false;
                state.user = null;
                state.is_authenticated = false;
            })
            .addCase(user_delete.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message || 'Delete profile failed';
            });
    }
});

export default auth_slice.reducer;

