const API_BASE_URL = '/api/bot';

/**
 * Join a meeting
 * @param {string} url - The meeting URL
 * @returns {Promise<Object>} - The response data (bot_id)
 */
export const joinMeeting = async (url) => {
    const response = await fetch(`${API_BASE_URL}/join-meeting`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
    });

    const text = await response.text();
    try {
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) {
            throw new Error(data.error || `Request failed with status ${response.status}`);
        }
        return data;
    } catch (e) {
        console.error("JSON Parse Error:", e, "Raw Text:", text);
        throw new Error(`Server Error (${response.status}): ${text.substring(0, 100)}...`);
    }
};

/**
 * Get bot status
 * @param {string} botId 
 * @returns {Promise<Object>}
 */
export const getBotStatus = async (botId) => {
    const response = await fetch(`${API_BASE_URL}/bot-status/${botId}`);

    const text = await response.text();
    try {
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) {
            throw new Error(data.error || `Request failed with status ${response.status}`);
        }
        return data;
    } catch (e) {
        console.error("JSON Parse Error:", e, "Raw Text:", text);
        throw new Error(`Server Error (${response.status}): ${text}`);
    }
};

/**
 * Get meeting transcript
 * @param {string} botId 
 * @returns {Promise<Object>}
 */
export const getTranscript = async (botId) => {
    const response = await fetch(`${API_BASE_URL}/get-transcript/${botId}`);

    const text = await response.text();
    try {
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) {
            throw new Error(data.error || `Request failed with status ${response.status}`);
        }
        return data; // Expecting { transcript: ... } or similar
    } catch (e) {
        console.error("Transcript JSON Parse Error:", e, "Raw Text:", text);
        // If the error was from the throw above, rethrow it
        if (e.message.includes('Request failed') || e.message.includes('Server Error')) throw e;
        throw new Error(`Server Error (${response.status}): ${text.substring(0, 100)}`);
    }
};
