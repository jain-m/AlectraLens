# Copyright (c) 2026 jain-m (Manisha Jain)
# This software is released under the MIT License.
# https://opensource.org/licenses/MIT

from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
import re

app = Flask(__name__)
CORS(app)  # This allows your Chrome Extension to talk to the Python server

def extract_video_id(url):
    regex = r"(?:v=|\/)([0-9A-Za-z_-]{11}).*"
    match = re.search(regex, url)
    return match.group(1) if match else url

@app.route('/get-transcript', methods=['POST'])
def get_transcript():
    data = request.get_json()
    video_url = data.get('videoUrl')
    
    if not video_url:
        return jsonify({"error": "No URL provided"}), 400

    # print(f"Library Location: {YouTubeTranscriptApi.__module__}")
    # print(f"Available Methods: {dir(YouTubeTranscriptApi)}")

    try:
        video_id = extract_video_id(video_url)
        print(f"Extracted Video ID: {video_id}")
        api = YouTubeTranscriptApi()
        transcript_data = api.fetch(video_id)
        full_text = " ".join([part.text for part in transcript_data])
        print(f"#chars: {len(full_text)}, #segments: {len(transcript_data)}, sample: {full_text[:100]}")
        return jsonify({"text": full_text})
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=3000)