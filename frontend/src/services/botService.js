import { getToken } from './api';

// In production, use the deployed backend URL. In dev, the Vite proxy handles '/api' → localhost:3001.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const API_BASE_URL = `${BASE}/bot`;

/**
 * Build auth headers (JWT token + content type)
 */
const authHeaders = () => {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

/**
 * Join a meeting
 * @param {string} url - The meeting URL
 * @returns {Promise<Object>} - The response data (bot_id)
 */
export const joinMeeting = async (url) => {
    const response = await fetch(`${API_BASE_URL}/join-meeting`, {
        method: 'POST',
        headers: authHeaders(),
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
        if (e.message.includes('Request failed')) throw e;
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
    const response = await fetch(`${API_BASE_URL}/bot-status/${botId}`, {
        headers: authHeaders(),
    });

    const text = await response.text();
    try {
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) {
            throw new Error(data.error || `Request failed with status ${response.status}`);
        }
        return data;
    } catch (e) {
        if (e.message.includes('Request failed')) throw e;
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
    const response = await fetch(`${API_BASE_URL}/get-transcript/${botId}`, {
        headers: authHeaders(),
    });

    const text = await response.text();
    try {
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) {
            throw new Error(data.error || `Request failed with status ${response.status}`);
        }
        return data;
    } catch (e) {
        if (e.message.includes('Request failed') || e.message.includes('Server Error')) throw e;
        console.error("Transcript JSON Parse Error:", e, "Raw Text:", text);
        throw new Error(`Server Error (${response.status}): ${text.substring(0, 100)}`);
    }
};
