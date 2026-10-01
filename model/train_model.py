import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

# Determine paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "heart.csv")
MODEL_DIR = os.path.join(BASE_DIR, "model")
API_DIR = os.path.join(BASE_DIR, "api")

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(API_DIR, exist_ok=True)

print(f"Loading dataset from: {DATA_PATH}")
df = pd.read_csv(DATA_PATH)
print(f"Dataset shape: {df.shape}")

# Features and target
X = df.drop("target", axis=1)
y = df["target"]

# Feature column order
feature_names = list(X.columns)

# Train/Test Split (stratified)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Pipeline with scaling and tuned Random Forest
pipeline = Pipeline([
    ("scaler", StandardScaler()),
    ("classifier", RandomForestClassifier(
        n_estimators=120,
        max_depth=8,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42
    ))
])

# Train model
print("Training Random Forest model pipeline...")
pipeline.fit(X_train, y_train)

# Evaluate on test set
y_pred = pipeline.predict(X_test)
y_proba = pipeline.predict_proba(X_test)[:, 1]

acc = accuracy_score(y_test, y_pred)
prec = precision_score(y_test, y_pred)
rec = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)
roc = roc_auc_score(y_test, y_proba)
cm = confusion_matrix(y_test, y_pred).tolist()

# Cross-validation
cv = cross_val_score(pipeline, X, y, cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42))

clf = pipeline.named_steps["classifier"]
feature_importances = {
    name: round(float(imp), 4)
    for name, imp in sorted(zip(feature_names, clf.feature_importances_), key=lambda x: x[1], reverse=True)
}

print(f"\n================ Model Performance ================")
print(f"Test Accuracy:       {acc * 100:.2f}%")
print(f"Precision:           {prec * 100:.2f}%")
print(f"Recall:              {rec * 100:.2f}%")
print(f"F1 Score:            {f1 * 100:.2f}%")
print(f"ROC AUC:             {roc * 100:.2f}%")
print(f"5-Fold CV Mean:      {cv.mean() * 100:.2f}% (+/- {cv.std() * 100:.2f}%)")
print(f"Confusion Matrix:    TN={cm[0][0]}, FP={cm[0][1]}, FN={cm[1][0]}, TP={cm[1][1]}")
print(f"Top 5 Features:      {list(feature_importances.items())[:5]}")
print("===================================================\n")

# Model metadata
meta = {
    "model_name": "Heart Disease Predictive Pipeline (StandardScaler + RandomForest)",
    "n_samples": int(len(df)),
    "features": feature_names,
    "metrics": {
        "accuracy": round(float(acc), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1_score": round(float(f1), 4),
        "roc_auc": round(float(roc), 4),
        "cv_mean": round(float(cv.mean()), 4),
        "cv_std": round(float(cv.std()), 4)
    },
    "feature_importances": feature_importances,
    "feature_ranges": {
        col: {
            "min": float(df[col].min()),
            "max": float(df[col].max()),
            "mean": round(float(df[col].mean()), 2),
            "median": round(float(df[col].median()), 2)
        }
        for col in feature_names
    },
    "presets": {
        "healthy": {
            "label": "Healthy Active Adult",
            "description": "38-year-old female with normal BP, healthy cholesterol, high exercise capacity, and no angina.",
            "data": {
                "age": 38,
                "sex": 0,
                "cp": 2,
                "trestbps": 115,
                "chol": 185,
                "fbs": 0,
                "restecg": 0,
                "thalach": 178,
                "exang": 0,
                "oldpeak": 0.2,
                "slope": 2,
                "ca": 0,
                "thal": 2
            }
        },
        "high_risk": {
            "label": "High Risk Cardiac Patient",
            "description": "62-year-old male with hypertension, chest pain, elevated ST depression, and arterial narrowing.",
            "data": {
                "age": 62,
                "sex": 1,
                "cp": 0,
                "trestbps": 155,
                "chol": 298,
                "fbs": 1,
                "restecg": 1,
                "thalach": 118,
                "exang": 1,
                "oldpeak": 3.4,
                "slope": 0,
                "ca": 2,
                "thal": 3
            }
        },
        "moderate_risk": {
            "label": "Borderline / Moderate Risk",
            "description": "54-year-old male with borderline BP, moderate cholesterol, and slight exercise ST depression.",
            "data": {
                "age": 54,
                "sex": 1,
                "cp": 1,
                "trestbps": 135,
                "chol": 245,
                "fbs": 0,
                "restecg": 0,
                "thalach": 145,
                "exang": 0,
                "oldpeak": 1.2,
                "slope": 1,
                "ca": 1,
                "thal": 2
            }
        }
    }
}

# Save in model/
model_save_path = os.path.join(MODEL_DIR, "model.pkl")
meta_save_path = os.path.join(MODEL_DIR, "model_meta.json")
joblib.dump(pipeline, model_save_path)
with open(meta_save_path, "w") as f:
    json.dump(meta, f, indent=2)
print(f"Saved model pipeline to: {model_save_path}")
print(f"Saved metadata to: {meta_save_path}")

# Also save copy in api/ for 100% guarantee on Vercel serverless packaging
api_model_path = os.path.join(API_DIR, "model.pkl")
api_meta_path = os.path.join(API_DIR, "model_meta.json")
joblib.dump(pipeline, api_model_path)
with open(api_meta_path, "w") as f:
    json.dump(meta, f, indent=2)
print(f"Synced model and metadata to: {API_DIR}")
print("Training and serialization completed successfully!")