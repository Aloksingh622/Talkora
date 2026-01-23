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

export const send_otp = createAsyncThunk(
    "auth/sendOtp",
    async (email, { rejectWithValue }) => {
        try {
            const response = await axios_Client.post("/api/auth/emailVerification", { email });
            return response.data;
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

export const social_login_only_thunk = createAsyncThunk(
    "auth/socialLoginOnly",
    async (idToken, { rejectWithValue }) => {
        try {
            const response = await axios_Client.post("/api/auth/socialLoginOnly", { idToken });
            return response.data.user;
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const check_username_availability = createAsyncThunk(
    "auth/checkUsername",
    async (username, { rejectWithValue }) => {
        try {
            const response = await axios_Client.post("/api/auth/check-username", { username });
            return response.data;
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

export const update_profile = createAsyncThunk(
    "auth/updateProfile",
    async (formData, { rejectWithValue }) => {
        try {
            // Need multipart/form-data support
            const response = await axios_Client.put("/api/auth/update-profile", formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                }
            });
            return response.data;
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
        otpSent: false,
        otpLoading: false,
        otpError: null,
        // Username check state
        usernameAvailability: {
            available: null, // null, true, false
            checking: false,
            suggestions: [],
            message: ''
        }
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

            // social_login_only (for login page)
            .addCase(social_login_only_thunk.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(social_login_only_thunk.fulfilled, (state, action) => {
                state.loading = false;
                state.is_authenticated = !!action.payload;
                state.user = action.payload;
            })
            .addCase(social_login_only_thunk.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message || 'Social login failed';
                state.is_authenticated = false;
            })

            // send OTP
            .addCase(send_otp.pending, (state) => {
                state.otpLoading = true;
                state.otpError = null;
                state.otpSent = false;
            })
            .addCase(send_otp.fulfilled, (state) => {
                state.otpLoading = false;
                state.otpSent = true;
                state.otpError = null;
            })
            .addCase(send_otp.rejected, (state, action) => {
                state.otpLoading = false;
                state.otpSent = false;
                state.otpError = action.payload?.message || 'Failed to send OTP';
            })

            // check username
            .addCase(check_username_availability.pending, (state) => {
                state.usernameAvailability.checking = true;
                state.usernameAvailability.available = null;
                state.usernameAvailability.message = '';
                state.usernameAvailability.suggestions = [];
            })
            .addCase(check_username_availability.fulfilled, (state, action) => {
                state.usernameAvailability.checking = false;
                state.usernameAvailability.available = action.payload.available;
                state.usernameAvailability.suggestions = action.payload.suggestions || [];
                state.usernameAvailability.message = action.payload.message || '';
            })
            .addCase(check_username_availability.rejected, (state, action) => {
                state.usernameAvailability.checking = false;
                state.usernameAvailability.available = null;
                state.usernameAvailability.message = action.payload?.message || "Error checking username";
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
            })

            // update profile
            .addCase(update_profile.pending, (state) => {
                state.loading = true;
            })
            .addCase(update_profile.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload.user; // Update user with new data
            })
            .addCase(update_profile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message || 'Update profile failed';
            });
    }
});

export default auth_slice.reducer;

