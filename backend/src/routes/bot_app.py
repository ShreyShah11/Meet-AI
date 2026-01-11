import os
import sys
import requests
import json
from flask import Blueprint, request, jsonify

# 1. Create a Blueprint instead of a full Flask app
bot_bp = Blueprint('bot_routes', __name__)

API_KEY = "bUCYUZG7yc4Wp1vxfsASAVc4nokJEHRg"  # ⚠️ Recommendation: Move this to an .env file!
API_BASE_URL = "https://app.attendee.dev/api/v1"

@bot_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "Bot Service Online", "routes": "active"}), 200

# --- 1. JOIN MEETING ---
@bot_bp.route('/join-meeting', methods=['POST'])
def join_meeting():
    meeting_url = request.json.get('url')

    if not meeting_url:
        return jsonify({"error": "Meeting URL is required"}), 400

    print(f"🚀 Dispatching bot to: {meeting_url}...")

    headers = {
        "Authorization": f"Token {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "meeting_url": meeting_url,
        "bot_name": "Notetaker (Localhost)"
    }

    try:
        response = requests.post(f"{API_BASE_URL}/bots", json=payload, headers=headers)
        response.raise_for_status()
        bot_data = response.json()
        bot_id = bot_data.get("id")
        return jsonify({"message": "Bot dispatched", "bot_id": bot_id}), 200

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"API Request Error: {str(e)}"}), 500
    except ValueError:
        return jsonify({"error": "Invalid JSON response from external API"}), 502


# --- 2. CHECK STATUS ---
@bot_bp.route('/bot-status/<bot_id>', methods=['GET'])
def get_bot_status(bot_id):
    headers = {"Authorization": f"Token {API_KEY}"}
    try:
        response = requests.get(f"{API_BASE_URL}/bots/{bot_id}", headers=headers)
        response.raise_for_status()
        data = response.json()
        print(f"🔍 Status Response: {data}")
        sys.stdout.flush()
        return jsonify(data), 200
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            # Bot not found implies it finished and was cleaned up. Return 'completed' status.
            return jsonify({"status": "completed", "bot_id": bot_id}), 200
        return jsonify({"error": f"API Request Error: {str(e)}"}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"API Request Error: {str(e)}"}), 500
    except ValueError:
        return jsonify({"error": "Invalid JSON response from external API"}), 502


# --- 3. GET TRANSCRIPT ---
@bot_bp.route('/get-transcript/<bot_id>', methods=['GET'])
def get_transcript(bot_id):
    headers = {"Authorization": f"Token {API_KEY}"}
    try:
        url = f"{API_BASE_URL}/bots/{bot_id}/transcript"
        response = requests.get(url, headers=headers)

        if response.status_code == 404:
            return jsonify({"error": "Transcript not ready."}), 404

        response.raise_for_status()
        transcript_data = response.json()

        # Optional: Save locally if you want, otherwise just return it
        # filename = f"transcript_{bot_id}.json"
        # with open(filename, "w", encoding="utf-8") as f:
        #     json.dump(transcript_data, f, indent=2)

        return jsonify(transcript_data), 200

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"API Request Error: {str(e)}"}), 500
    except ValueError:
        return jsonify({"error": "Invalid JSON response from external API"}), 502

# 3. CRITICAL: Remove the "if __name__ == '__main__':" block entirely.
# This prevents this file from trying to start its own server.