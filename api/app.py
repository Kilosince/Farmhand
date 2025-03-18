import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
from pymongo import MongoClient
import boto3
from botocore.exceptions import NoCredentialsError
from tempfile import TemporaryDirectory
import json
from dotenv import load_dotenv
import traceback
import logging
import time
import uuid
from datetime import datetime, timezone

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Logging configuration
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")

# Helper function to validate environment variables
def validate_env_vars(required_vars):
    for var in required_vars:
        if not os.getenv(var):
            logging.error(f"Error: Environment variable {var} not set.")
            sys.exit(1)

# Validate environment variables
required_env_vars = [
    'ATLAS_URI', 'DB_NAME', 'AWS_REGION',
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_BUCKET_NAME'
]
validate_env_vars(required_env_vars)

# MongoDB setup
MONGO_URI = os.getenv('ATLAS_URI')
DB_NAME = os.getenv('DB_NAME')
client = MongoClient(MONGO_URI)
db = client[DB_NAME]

# AWS S3 setup
AWS_REGION = os.getenv('AWS_REGION')
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
BUCKET_NAME = os.getenv('AWS_BUCKET_NAME')
s3 = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

def download_file_from_s3(bucket_name, s3_key, local_path):
    try:
        logging.info(f"Downloading {s3_key} to {local_path}")
        s3.download_file(bucket_name, s3_key, local_path)
        logging.info(f"Successfully downloaded {s3_key}")
    except Exception as e:
        logging.error(f"Failed to download {s3_key}: {str(e)}")
        raise

def upload_file_to_s3(bucket_name, local_file_path, s3_key):
    try:
        logging.info(f"Uploading {local_file_path} to S3 at {s3_key}")
        s3.upload_file(local_file_path, bucket_name, s3_key, ExtraArgs={"ContentType": "video/mp4"})
        logging.info(f"Successfully uploaded to S3: {s3_key}")
    except Exception as e:
        logging.error(f"Failed to upload {local_file_path} to S3: {str(e)}")
        raise

def extract_metadata(file_path):
    try:
        logging.info(f"Extracting metadata for file: {file_path}")
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', file_path],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        if result.returncode != 0:
            logging.error(f"FFprobe error:\n{result.stderr}")
            return None

        metadata = json.loads(result.stdout)  # Parse the JSON string
        logging.info(f"Metadata extracted: {metadata}")

        # Extract duration
        duration = metadata.get('format', {}).get('duration', None)

        # Extract width, height, and frame rate from the first video stream
        width, height, frame_rate = None, None, None
        for stream in metadata.get('streams', []):
            if 'width' in stream and 'height' in stream:
                width = stream.get('width')
                height = stream.get('height')
                frame_rate = stream.get('r_frame_rate')
                break

        return {
            "duration": duration,
            "width": width,
            "height": height,
            "frameRate": frame_rate
        }
    except Exception as e:
        logging.error(f"Error extracting metadata: {str(e)}")
        return None

@app.route('/api/render-playlist', methods=['POST'])
def render_playlist():
    try:
        logging.info("Request received at /api/render-playlist")
        data = request.json

        if not data or 'userId' not in data or 'playlistIds' not in data:
            logging.error("Invalid request payload")
            return jsonify({'success': False, 'message': 'Invalid request payload'}), 400

        user_id = data['userId']
        playlist_ids = data['playlistIds']
        logging.info(f"Processing userId: {user_id}, playlistIds: {playlist_ids}")

        # Fetch user data from MongoDB
        user_doc = db.files.find_one({'userId': user_id})
        if not user_doc or 'userMeta' not in user_doc:
            logging.error("User or playlists not found in database")
            return jsonify({'success': False, 'message': 'User or playlists not found'}), 404

        rendered_files_metadata = []  # To store metadata for all rendered files

        with TemporaryDirectory() as temp_dir:
            for playlist_id in playlist_ids:
                user_meta_project = next(
                    (meta for meta in user_doc['userMeta'] if meta['projectId'] == playlist_id), None
                )
                if not user_meta_project:
                    logging.error(f"No matching project found for playlistId: {playlist_id}")
                    continue

                project_title = user_meta_project['projectTitle']

                # Create concat_list.txt
                concat_list_path = os.path.join(temp_dir, 'concat_list.txt')
                with open(concat_list_path, 'w') as concat_list:
                    for file_meta in sorted(user_meta_project['playlistsFile'], key=lambda f: f['seqPos']):
                        local_path = os.path.join(temp_dir, file_meta['fileName'])
                        download_file_from_s3(BUCKET_NAME, file_meta['key'], local_path)
                        concat_list.write(f"file '{local_path}'\n")

                # Perform lossless concatenation using FFmpeg
                output_file = os.path.join(temp_dir, 'output.mp4')
                concat_command = [
                    'ffmpeg', '-nostdin', '-loglevel', 'error',
                    '-f', 'concat', '-safe', '0', '-i', concat_list_path,
                    '-c', 'copy', output_file
                ]
                logging.info(f"Running FFmpeg command for playlistId: {playlist_id}")
                result = subprocess.run(concat_command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if result.returncode != 0:
                    logging.error(f"FFmpeg error for playlistId {playlist_id}:\n{result.stderr.decode('utf-8')}")
                    continue

                # Extract metadata for the rendered file
                metadata = extract_metadata(output_file)
                if not metadata:
                    logging.error(f"Failed to extract metadata for playlistId: {playlist_id}")
                    continue

                # Upload the concatenated file to S3
                s3_key = f"users/{user_id}/rendered_videos/output-{int(time.time())}.mp4"
                upload_file_to_s3(BUCKET_NAME, output_file, s3_key)

                # Generate signed URL
                signed_url = s3.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': BUCKET_NAME, 'Key': s3_key},
                    ExpiresIn=3600
                )

                # Create readable timestamp for fileName
                readable_timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                file_name = f"{project_title} {readable_timestamp}"

                # Update metadata with duration, frame rate, and resolution
                file_metadata = {
                    "key": s3_key,
                    "fileName": file_name,
                    "url": signed_url,
                    "projectId": playlist_id,
                    "fileId": str(uuid.uuid4()),
                    "createdAt": datetime.utcnow().isoformat(),
                    "duration": metadata['duration'],
                    "frameRate": metadata['frameRate'],
                    "resolution": f"{metadata['width']}x{metadata['height']}"
                }
                rendered_files_metadata.append(file_metadata)

                # Update MongoDB to add rendered file to renderFile array
                db.files.update_one(
                    {"userId": user_id, "userMeta.projectId": playlist_id},
                    {"$push": {"userMeta.$.renderFile": file_metadata}}
                )
                logging.info(f"Rendered file added to MongoDB for projectId: {playlist_id}")

        return jsonify({'success': True, 'renderedFiles': rendered_files_metadata}), 200

    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500

if __name__ == '__main__':
    logging.info("Starting Flask server")
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 5001)), debug=True)