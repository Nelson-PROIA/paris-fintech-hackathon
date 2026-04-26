import gzip
import json
import pickle

import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

FEATURES_CSV   = "/Users/hirecheariles/Documents/Cours/Master Finance/ML/firm_features.csv"
MODEL_PATH     = "/Users/hirecheariles/Documents/Cours/Master Finance/ML/best_model_accounting.pkl"
 
ACCOUNTING_FEATURES = [
    "feat_5", "feat_6",  "feat_12", "feat_13", "feat_16",
    "feat_21", "feat_22", "feat_25", "feat_26", "feat_27",
    "feat_34", "feat_35", "feat_38", "feat_39", "feat_46",
    "feat_58",
]


def prob_to_score(prob):
    """
    Converts P(bankrupt) → credit score 0–100.
    100 = very safe  |  50 = neutral  |  0 = near-certain bankruptcy
    """
    prob      = np.clip(prob, 1e-6, 1 - 1e-6)
    log_odds  = np.log((1 - prob) / prob)
    score     = (log_odds + 6) / 12 * 100
    return np.clip(score, 0, 100).astype(int)

def score_firm(features_csv=FEATURES_CSV, model_path=MODEL_PATH):
    # Load features
    X = pd.read_csv(features_csv)[ACCOUNTING_FEATURES]
 
    # Load model
    with open(model_path, "rb") as f:
        model = pickle.load(f)
 
    # Predict
    prob  = model.predict_proba(X)[:, 1][0]
    score = prob_to_score(np.array([prob]))[0]
 
    print(f"P(bankrupt) : {prob:.4f}")
    print(f"Credit score: {score} / 100  ({'✅ SAFE' if score >= 50 else '⚠️  AT RISK'})")
    return score
 
 
if __name__ == "__main__":
    score_firm()