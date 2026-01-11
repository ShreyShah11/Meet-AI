import os
import sys
from flask import Flask
from routes.bot_app import bot_bp
from flask_cors import CORS

# Add the src directory to the python path so imports work correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
CORS(app) # Enable CORS for all routes (internal usage)

# Register the blueprint
app.register_blueprint(bot_bp)

if __name__ == '__main__':
    port = int(os.environ.get('BOT_PORT', 5001))
    print(f"Python Bot Service starting on port {port}...")
    print("Registered Routes:")
    print(app.url_map)
    app.run(port=port, host='0.0.0.0', debug=False)
