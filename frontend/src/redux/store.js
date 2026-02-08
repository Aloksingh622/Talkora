import { configureStore } from "@reduxjs/toolkit";
import auth_reducer from "./auth_slice";
import server_reducer from "./server_slice";
import friend_reducer from "./friend_slice";
import dm_reducer from "./dm_slice";
import message_reducer from "./message_slice";
import { loadMessagesFromLocalStorage, saveMessagesToLocalStorage } from "../utils/messageCache";

// Load cached messages from LocalStorage
const cachedMessages = loadMessagesFromLocalStorage();

export const store = configureStore({
    reducer: {
        auth: auth_reducer,
        server: server_reducer,
        friend: friend_reducer,
        dm: dm_reducer,
        message: message_reducer
    },
    preloadedState: cachedMessages ? {
        message: cachedMessages
    } : undefined
});

// Save to LocalStorage on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        saveMessagesToLocalStorage(store.getState());
    });
}
