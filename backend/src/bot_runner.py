import os
import sys
from flask import Flask
from flask_cors import CORS

# Add the src directory to the python path so imports work correctly
src_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, src_dir)

# Load the project root .env file so all API keys are available to pipelines
# The .env is 2 levels up from src/: backend/src/ -> backend/ -> project root
project_root = os.path.abspath(os.path.join(src_dir, '..', '..'))
env_path = os.path.join(project_root, '.env')
if os.path.exists(env_path):
    try:
        from dotenv import load_dotenv
        load_dotenv(env_path, override=False)  # override=False: don't replace vars already set by Node
        print(f"[BotRunner] Loaded .env from {env_path}")
    except ImportError:
        # python-dotenv not installed - manually parse the .env
        print(f"[BotRunner] python-dotenv not available, parsing .env manually from {env_path}")
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, val = line.partition('=')
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key not in os.environ:  # don't override vars set by Node
                        os.environ[key] = val
else:
    print(f"[BotRunner] .env not found at {env_path}, relying on environment variables")

from routes.bot_app import bot_bp

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes (internal usage)

# Register the blueprint
app.register_blueprint(bot_bp)

if __name__ == '__main__':
    port = int(os.environ.get('BOT_PORT', 5001))
    print(f"Python Bot Service starting on port {port}...")
    print("Registered Routes:")
    print(app.url_map)
    app.run(port=port, host='0.0.0.0', debug=False)
