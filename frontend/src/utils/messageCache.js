// LocalStorage key
const CACHE_KEY = 'chat_cache';
const MAX_LOCALSTORAGE_SIZE = 4 * 1024 * 1024; // 4MB limit (leaving 1MB buffer from 5MB total)

/**
 * Save message cache to LocalStorage
 * Saves only top 5 most recently viewed channels with max 50 messages each
 */
export const saveMessagesToLocalStorage = (state) => {
    try {
        if (!state || !state.message) {
            return;
        }

        const { messages, channelMetadata, activeChannelId } = state.message;

        // Get top 5 channels by lastViewedAt
        const channelIds = Object.keys(messages);
        const sortedChannels = channelIds
            .map(id => ({
                id: parseInt(id),
                lastViewed: channelMetadata[id]?.lastViewedAt || 0,
                data: messages[id]
            }))
            .sort((a, b) => b.lastViewed - a.lastViewed)
            .slice(0, 5); // Keep only top 5

        // Build filtered state
        const filteredMessages = {};
        const filteredMetadata = {};

        sortedChannels.forEach(({ id, data }) => {
            // Limit to 50 messages per channel
            filteredMessages[id] = {
                ...data,
                messages: data.messages.slice(0, 50),
                loading: false, // Don't persist loading states
                error: null
            };

            if (channelMetadata[id]) {
                filteredMetadata[id] = channelMetadata[id];
            }
        });

        const cacheData = {
            messages: filteredMessages,
            channelMetadata: filteredMetadata,
            activeChannelId,
            cachedAt: Date.now(),
            version: 1 // For future migrations
        };

        const serialized = JSON.stringify(cacheData);

        // Check size
        if (serialized.length > MAX_LOCALSTORAGE_SIZE) {
            console.warn('Message cache too large, skipping save');
            return;
        }

        localStorage.setItem(CACHE_KEY, serialized);
        console.log('✅ Message cache saved to LocalStorage');
    } catch (error) {
        console.error('Failed to save message cache to LocalStorage:', error);
        // Clear potentially corrupted data
        try {
            localStorage.removeItem(CACHE_KEY);
        } catch (e) {
            // Ignore
        }
    }
};

/**
 * Load message cache from LocalStorage
 * Returns null if cache is invalid or corrupted
 */
export const loadMessagesFromLocalStorage = () => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);

        if (!cached) {
            return null;
        }

        const parsed = JSON.parse(cached);

        // Validate structure
        if (!parsed.messages || !parsed.channelMetadata || typeof parsed.version !== 'number') {
            console.warn('Invalid cache structure, clearing...');
            localStorage.removeItem(CACHE_KEY);
            return null;
        }

        // Check cache age (expire after 7 days)
        const age = Date.now() - (parsed.cachedAt || 0);
        const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (age > MAX_AGE) {
            console.log('Cache expired, clearing...');
            localStorage.removeItem(CACHE_KEY);
            return null;
        }

        console.log('✅ Message cache loaded from LocalStorage');
        return {
            messages: parsed.messages,
            channelMetadata: parsed.channelMetadata,
            activeChannelId: parsed.activeChannelId,
            cachedChannelIds: Object.keys(parsed.messages).map(id => parseInt(id))
        };
    } catch (error) {
        console.error('Failed to load message cache from LocalStorage:', error);
        // Clear corrupted data
        try {
            localStorage.removeItem(CACHE_KEY);
        } catch (e) {
            // Ignore
        }
        return null;
    }
};

/**
 * Clear message cache from LocalStorage
 */
export const clearMessagesFromLocalStorage = () => {
    try {
        localStorage.removeItem(CACHE_KEY);
        console.log('✅ Message cache cleared from LocalStorage');
    } catch (error) {
        console.error('Failed to clear message cache:', error);
    }
};
