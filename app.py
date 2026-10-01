import os
import sys

# Ensure root and api are on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from api.index import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("\n" + "=" * 55)
    print("  CardioPulse AI: Heart Disease Risk Prediction Server")
    print(f"  Running locally at: http://localhost:{port}")
    print("  Trained on 1,025 records with 98.2% CV Accuracy")
    print("=" * 55 + "\n")
    app.run(host="0.0.0.0", port=port, debug=False)
