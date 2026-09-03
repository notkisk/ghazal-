"""
Calibration: Platt scaling or isotonic regression on out-of-fold predictions.
"""

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.isotonic import IsotonicRegression


def platt_scale(
    probs: np.ndarray,
    labels: np.ndarray,
) -> tuple:
    """
    Fit Platt scaling (logistic regression) on out-of-fold predictions.

    Args:
        probs: [N, num_labels] probabilities
        labels: [N, num_labels] binary ground truth
    Returns:
        calibrated_probs: [N, num_labels]
        calibrators: list of fitted LogisticRegression models
    """
    num_labels = probs.shape[1]
    calibrated = np.zeros_like(probs)
    calibrators = []

    for i in range(num_labels):
        if labels[:, i].sum() == 0 or (1 - labels[:, i]).sum() == 0:
            calibrated[:, i] = probs[:, i]
            calibrators.append(None)
            continue

        lr = LogisticRegression(C=1.0, max_iter=1000)
        lr.fit(probs[:, i:i+1], labels[:, i])
        calibrated[:, i] = lr.predict_proba(probs[:, i:i+1])[:, 1]
        calibrators.append(lr)

    return calibrated, calibrators


def isotonic_calibrate(
    probs: np.ndarray,
    labels: np.ndarray,
) -> tuple:
    """
    Fit isotonic regression on out-of-fold predictions.

    Args:
        probs: [N, num_labels] probabilities
        labels: [N, num_labels] binary ground truth
    Returns:
        calibrated_probs: [N, num_labels]
        calibrators: list of fitted IsotonicRegression models
    """
    num_labels = probs.shape[1]
    calibrated = np.zeros_like(probs)
    calibrators = []

    for i in range(num_labels):
        if labels[:, i].sum() == 0 or (1 - labels[:, i]).sum() == 0:
            calibrated[:, i] = probs[:, i]
            calibrators.append(None)
            continue

        ir = IsotonicRegression(out_of_bounds="clip")
        ir.fit(probs[:, i], labels[:, i])
        calibrated[:, i] = ir.predict(probs[:, i])
        calibrators.append(ir)

    return calibrated, calibrators


def apply_calibration(
    probs: np.ndarray,
    calibrators: list,
    method: str = "platt",
) -> np.ndarray:
    """Apply fitted calibrators to new predictions."""
    num_labels = probs.shape[1]
    calibrated = np.zeros_like(probs)

    for i in range(num_labels):
        if calibrators[i] is None:
            calibrated[:, i] = probs[:, i]
            continue

        if method == "platt":
            calibrated[:, i] = calibrators[i].predict_proba(probs[:, i:i+1])[:, 1]
        elif method == "isotonic":
            calibrated[:, i] = calibrators[i].predict(probs[:, i])

    return calibrated
