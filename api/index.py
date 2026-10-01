import os
import json
import joblib
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, render_template

# Configure directories
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(CURRENT_DIR)
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# If running directly inside api directory or on serverless
if not os.path.exists(TEMPLATES_DIR):
    TEMPLATES_DIR = os.path.join(CURRENT_DIR, "templates")
if not os.path.exists(STATIC_DIR):
    STATIC_DIR = os.path.join(CURRENT_DIR, "static")

app = Flask(
    __name__,
    template_folder=TEMPLATES_DIR,
    static_folder=STATIC_DIR,
    static_url_path="/static"
)

# Load Model Pipeline with robust multi-path fallbacks
model = None
model_meta = {}

def find_file(filename):
    search_paths = [
        os.path.join(CURRENT_DIR, filename),
        os.path.join(BASE_DIR, "model", filename),
        os.path.join(BASE_DIR, "api", filename),
        os.path.join(BASE_DIR, filename),
        os.path.join(CURRENT_DIR, "..", "model", filename)
    ]
    for path in search_paths:
        if os.path.exists(path):
            return path
    return None

model_path = find_file("model.pkl")
if model_path:
    try:
        model = joblib.load(model_path)
        print(f"Loaded model from: {model_path}")
    except Exception as e:
        print(f"Error loading model: {e}")

meta_path = find_file("model_meta.json")
if meta_path:
    try:
        with open(meta_path, "r") as f:
            model_meta = json.load(f)
        print(f"Loaded metadata from: {meta_path}")
    except Exception as e:
        print(f"Error loading metadata: {e}")

FEATURE_NAMES = [
    "age", "sex", "cp", "trestbps", "chol", "fbs",
    "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"
]

@app.route("/")
def index():
    return render_template("index.html", meta=model_meta)

@app.route("/health")
@app.route("/api/health")
def health():
    return jsonify({
        "status": "healthy",
        "model_loaded": model is not None,
        "features_count": len(FEATURE_NAMES)
    })

@app.route("/api/info")
def info():
    return jsonify(model_meta)

@app.route("/api/sample", methods=["GET"])
def sample():
    preset_key = request.args.get("preset")
    presets = model_meta.get("presets", {})
    if preset_key and preset_key in presets:
        return jsonify(presets[preset_key])
    
    # Try reading from dataset for a random sample
    data_path = find_file(os.path.join("data", "heart.csv")) or find_file("heart.csv")
    if data_path and os.path.exists(data_path):
        try:
            df = pd.read_csv(data_path)
            rand_row = df.sample(n=1).iloc[0].to_dict()
            # In heart.csv: target 0 is diseased, target 1 is healthy
            raw_target = int(rand_row.pop("target", 0))
            is_disease = (raw_target == 0)
            return jsonify({
                "label": "Verified Dataset Record",
                "description": f"Verified Clinical Outcome: {'Cardiovascular Disease Present' if is_disease else 'Normal / Low Risk'}",
                "actual_disease": is_disease,
                "data": {k: float(v) if k == "oldpeak" else int(v) for k, v in rand_row.items()}
            })
        except Exception as e:
            print(f"Sample error: {e}")
            
    # Default to healthy preset
    return jsonify(presets.get("healthy", {}))

def analyze_risk_factors(data):
    """Generate clinically relevant factor contributions for patient assessment."""
    risk_factors = []
    protective_factors = []
    
    # Age
    age = data.get("age", 50)
    if age >= 60:
        risk_factors.append(f"Patient age ({age} yrs) increases baseline cardiovascular vulnerability.")
    elif age <= 45:
        protective_factors.append(f"Age ({age} yrs) is in the lower epidemiological risk category.")
        
    # Blood Pressure (trestbps)
    trestbps = data.get("trestbps", 120)
    if trestbps >= 140:
        risk_factors.append(f"Resting BP is elevated at {trestbps} mm Hg (Stage 2 Hypertension range).")
    elif trestbps >= 130:
        risk_factors.append(f"Resting BP is slightly elevated at {trestbps} mm Hg (Stage 1 Hypertension).")
    elif trestbps < 120:
        protective_factors.append(f"Resting blood pressure is optimal ({trestbps} mm Hg).")

    # Cholesterol (chol)
    chol = data.get("chol", 200)
    if chol >= 240:
        risk_factors.append(f"High serum cholesterol level at {chol} mg/dl (&ge; 240 mg/dl).")
    elif chol < 200:
        protective_factors.append(f"Desirable serum cholesterol at {chol} mg/dl (&lt; 200 mg/dl).")

    # Fasting Blood Sugar (fbs)
    fbs = data.get("fbs", 0)
    if fbs == 1:
        risk_factors.append("Fasting blood sugar &gt; 120 mg/dl suggests diabetic/metabolic strain.")
    else:
        protective_factors.append("Fasting blood glucose is within normal limits (&le; 120 mg/dl).")

    # Chest Pain (cp)
    cp = data.get("cp", 0)
    if cp == 0:
        risk_factors.append("Typical Angina present (classic retrosternal exertional pain).")
    elif cp in [1, 2]:
        protective_factors.append("Chest discomfort is atypical or non-anginal in character.")

    # Maximum Heart Rate (thalach)
    thalach = data.get("thalach", 150)
    if thalach < 125:
        risk_factors.append(f"Depressed peak exercise heart rate ({thalach} bpm) indicates chronotropic impairment.")
    elif thalach >= 165:
        protective_factors.append(f"Robust peak exercise heart rate ({thalach} bpm) reflects good myocardial reserve.")

    # Exercise-Induced Angina (exang)
    exang = data.get("exang", 0)
    if exang == 1:
        risk_factors.append("Exercise-induced angina is present (provoked myocardial ischemia).")
    else:
        protective_factors.append("No exercise-induced angina during exertion.")

    # ST Depression (oldpeak)
    oldpeak = data.get("oldpeak", 0.0)
    if oldpeak >= 2.0:
        risk_factors.append(f"Significant ST depression ({oldpeak} mm) indicates exertional ischemia.")
    elif oldpeak >= 1.0:
        risk_factors.append(f"Moderate ST depression ({oldpeak} mm) observed post-stress.")
    else:
        protective_factors.append(f"Minimal or absent ST depression ({oldpeak} mm).")

    # Fluoroscopy Vessels (ca)
    ca = data.get("ca", 0)
    if ca > 0:
        risk_factors.append(f"Fluoroscopy demonstrates {int(ca)} major vessel(s) with calcification/blockage.")
    else:
        protective_factors.append("Zero major coronary vessels occluded under fluoroscopy.")

    # Thalassemia (thal)
    thal = data.get("thal", 2)
    if thal == 3:
        risk_factors.append("Reversible myocardial perfusion defect identified on Thallium scintigraphy.")
    elif thal == 2:
        protective_factors.append("Normal blood flow observed on Thallium perfusion scan.")

    return risk_factors, protective_factors

@app.route("/predict", methods=["POST"])
@app.route("/api/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({
            "error": "Machine learning model is not initialized or model.pkl was not found."
        }), 500

    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400

        # Extract features with strict casting
        row = []
        parsed_data = {}
        for feat in FEATURE_NAMES:
            if feat not in data:
                return jsonify({"error": f"Missing required clinical parameter: '{feat}'"}), 400
            val = float(data[feat]) if feat == "oldpeak" else int(float(data[feat]))
            row.append(val)
            parsed_data[feat] = val

        # DataFrame with feature names
        input_df = pd.DataFrame([row], columns=FEATURE_NAMES)

        # In heart.csv dataset:
        # Class 0 represents the heart disease group (blocked vessels, ST depression, exercise angina)
        # Class 1 represents the healthy group (clear vessels, no ST depression, high HR reserve)
        probabilities = model.predict_proba(input_df)[0]
        prob_disease = float(probabilities[0])
        prob_healthy = float(probabilities[1])
        prob_percentage = round(prob_disease * 100, 2)
        prediction = 1 if prob_disease >= 0.50 else 0

        # Categorize risk tier
        if prob_percentage >= 65:
            risk_tier = "High Risk"
            risk_badge = "CRITICAL / HIGH RISK"
            theme_color = "#f43f5e" # Rose
            headline = "Heart Disease Indicated (High Risk)"
            summary = "The predictive model evaluated the patient's clinical markers and identified strong indicators consistent with coronary artery disease."
        elif prob_percentage >= 35:
            risk_tier = "Moderate Risk"
            risk_badge = "MODERATE / ELEVATED"
            theme_color = "#f59e0b" # Amber
            headline = "Borderline Cardiovascular Risk"
            summary = "The assessment reveals borderline or mixed cardiovascular markers warranting clinical review and lifestyle modification."
        else:
            risk_tier = "Low Risk"
            risk_badge = "LOW RISK / NORMAL"
            theme_color = "#10b981" # Emerald
            headline = "Normal Cardiac Health Profile"
            summary = "Patient clinical markers are predominantly within normal reference intervals with minimal indicators of ischemic heart disease."

        # Risk factor breakdown
        risk_factors, protective_factors = analyze_risk_factors(parsed_data)

        # Recommendations
        if prediction == 1 or prob_percentage >= 50:
            recommendations = [
                "Schedule a formal diagnostic consultation with a board-certified cardiologist.",
                "Recommend diagnostic 12-lead stress ECG, echocardiogram, or coronary CT angiography.",
                "Conduct comprehensive fasting lipid panel (LDL, HDL, triglycerides) and HbA1c screening.",
                "Initiate cardiovascular risk reduction protocols and medical therapy as indicated.",
                "Avoid unmonitored strenuous physical exertion until clinical clearance is obtained."
            ]
        elif prob_percentage >= 30:
            recommendations = [
                "Schedule routine cardiovascular evaluation within the next 3 to 6 months.",
                "Monitor home resting blood pressure twice weekly to establish baseline control.",
                "Adopt Mediterranean dietary pattern rich in leafy greens, nuts, and omega-3 fatty acids.",
                "Aim for 150 minutes of moderate aerobic exercise weekly under clinical guidance."
            ]
        else:
            recommendations = [
                "Maintain regular physical exercise (e.g., 30 minutes daily of moderate activity).",
                "Continue balanced, nutrient-dense diet low in ultra-processed foods and saturated fats.",
                "Undergo routine annual wellness checkups and baseline blood pressure screening.",
                "Maintain optimal sleep hygiene (7–8 hours) and restorative stress management habits."
            ]

        response_payload = {
            "prediction": prediction,
            "probability": prob_percentage,
            "prob_healthy": round(prob_healthy * 100, 2),
            "risk_tier": risk_tier,
            "risk_badge": risk_badge,
            "theme_color": theme_color,
            "headline": headline,
            "summary": summary,
            "risk_factors": risk_factors,
            "protective_factors": protective_factors,
            "recommendations": recommendations,
            "model_metrics": model_meta.get("metrics", {}),
            "timestamp": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S UTC")
        }

        return jsonify(response_payload)

    except Exception as e:
        return jsonify({
            "error": "Error during prediction execution",
            "details": str(e)
        }), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)