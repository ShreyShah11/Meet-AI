import os
import sys
import requests
from flask import Blueprint, request, jsonify

bot_bp = Blueprint('bot_routes', __name__)

API_KEY = os.environ.get("ATTENDEE_API_KEY")
API_BASE_URL = os.environ.get("ATTENDEE_API_BASE_URL", "https://app.attendee.dev/api/v1")


def _auth_headers():
    if not API_KEY:
        return None
    return {
        "Authorization": f"Token {API_KEY}",
        "Content-Type": "application/json",
    }


def _missing_key_response():
    return jsonify({"error": "ATTENDEE_API_KEY is not configured"}), 500


@bot_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "Bot Service Online", "routes": "active"}), 200


@bot_bp.route('/join-meeting', methods=['POST'])
def join_meeting():
    payload_json = request.get_json(silent=True) or {}
    meeting_url = payload_json.get('url')

    if not meeting_url:
        return jsonify({"error": "Meeting URL is required"}), 400

    headers = _auth_headers()
    if not headers:
        return _missing_key_response()

    print(f"Dispatching bot to: {meeting_url}...")

    payload = {
        "meeting_url": meeting_url,
        "bot_name": "Notetaker (Localhost)",
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


@bot_bp.route('/bot-status/<bot_id>', methods=['GET'])
def get_bot_status(bot_id):
    headers = _auth_headers()
    if not headers:
        return _missing_key_response()

    try:
        response = requests.get(f"{API_BASE_URL}/bots/{bot_id}", headers=headers)
        response.raise_for_status()
        data = response.json()
        print(f"Status Response: {data}")
        sys.stdout.flush()
        return jsonify(data), 200
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            return jsonify({"status": "completed", "bot_id": bot_id}), 200
        return jsonify({"error": f"API Request Error: {str(e)}"}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"API Request Error: {str(e)}"}), 500
    except ValueError:
        return jsonify({"error": "Invalid JSON response from external API"}), 502


@bot_bp.route('/get-transcript/<bot_id>', methods=['GET'])
def get_transcript(bot_id):
    headers = _auth_headers()
    if not headers:
        return _missing_key_response()

    try:
        url = f"{API_BASE_URL}/bots/{bot_id}/transcript"
        response = requests.get(url, headers=headers)

        if response.status_code == 404:
            return jsonify({"error": "Transcript not ready."}), 404

        response.raise_for_status()
        transcript_data = response.json()
        return jsonify(transcript_data), 200
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"API Request Error: {str(e)}"}), 500
    except ValueError:
        return jsonify({"error": "Invalid JSON response from external API"}), 502


@bot_bp.route('/process-transcript', methods=['POST'])
def process_transcript():
    try:
        from utils.models import NormalizedTranscript, TranscriptSegment
        from pipelines.chunker import chunk_transcript
        from pipelines.embedder import embed_and_upsert
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Pipelines not available: {str(e)}"}), 501

    payload = request.get_json(silent=True) or {}
    meet_id = payload.get('meet_id')
    org_id = payload.get('org_id', 'default_org')
    meet_title = payload.get('meet_title', 'Untitled')
    meet_date = payload.get('meet_date', '2025-01-01')
    segments_raw = payload.get('segments', [])

    if not meet_id:
        return jsonify({"error": "meet_id is required"}), 400

    segments = []
    duration = 0.0
    for s in segments_raw:
        start = float(s.get('start', s.get('timestamp_start', 0.0)))
        end = float(s.get('end', s.get('timestamp_end', 0.0)))
        segments.append(TranscriptSegment(
            speaker=s.get('speaker', 'Unknown'),
            text=s.get('text', ''),
            timestamp_start=start,
            timestamp_end=end
        ))
        if end > duration:
            duration = end

    normalized = NormalizedTranscript(
        meet_id=meet_id,
        org_id=org_id,
        meet_title=meet_title,
        meet_date=meet_date,
        duration_seconds=duration,
        segments=segments
    )

    try:
        chunks = chunk_transcript(normalized)
        index_name = embed_and_upsert(chunks, meet_id=meet_id)
        return jsonify({
            "message": "Transcript processed and upserted successfully",
            "index_name": index_name,
            "chunk_count": len(chunks)
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@bot_bp.route('/retrieve', methods=['POST'])
def retrieve_chunks():
    try:
        from pipelines.retriever import retrieve
        from dataclasses import asdict
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Pipelines not available: {str(e)}"}), 501

    payload = request.get_json(silent=True) or {}
    query = payload.get('query')
    meet_id = payload.get('meet_id')
    index_name = payload.get('index_name')
    top_k = payload.get('top_k', 8)

    if not query or not meet_id:
        return jsonify({"error": "query and meet_id are required"}), 400

    try:
        chunks = retrieve(query=query, meet_id=meet_id, top_k=top_k, index_name=index_name)

        result = []
        for chunk in chunks:
            item = asdict(chunk)

            def format_time(seconds):
                if seconds is None:
                    return None
                s = int(seconds)
                return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"

            item["metadata"] = {
                "chunk_id": chunk.chunk_id,
                "chunk_type": chunk.chunk_type,
                "speaker": chunk.speaker,
                "timestamp_start": chunk.timestamp_start,
                "timestamp_end": chunk.timestamp_end,
                "startTime": format_time(chunk.timestamp_start),
                "endTime": format_time(chunk.timestamp_end),
                "topic_label": chunk.topic_label,
                "action_flag": chunk.action_flag,
                "vector_score": chunk.vector_score,
            }
            item["text"] = chunk.text
            item["score"] = chunk.vector_score

            result.append(item)

        return jsonify(result), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
