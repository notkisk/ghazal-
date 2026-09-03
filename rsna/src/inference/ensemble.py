"""
Ensemble: blend + calibrate multiple model outputs.
"""

import numpy as np
from src.eval.calibration import platt_scale, isotonic_calibrate, apply_calibration


def blend_predictions(
    predictions: list[np.ndarray],
    method: str = "average",
    weights: list[float] = None,
) -> np.ndarray:
    """
    Blend predictions from multiple models.

    Args:
        predictions: list of [N, num_labels] arrays
        method: "average" or "rank_average"
        weights: optional weights for each model
    Returns:
        blended: [N, num_labels]
    """
    if weights is None:
        weights = [1.0 / len(predictions)] * len(predictions)

    if method == "average":
        blended = np.zeros_like(predictions[0])
        for pred, weight in zip(predictions, weights):
            blended += pred * weight
        return blended

    elif method == "rank_average":
        # Rank-based averaging (more robust to calibration differences)
        ranked = []
        for pred in predictions:
            ranks = np.zeros_like(pred)
            for j in range(pred.shape[1]):
                ranks[:, j] = _rankdata(pred[:, j])
            ranked.append(ranks)

        blended = np.zeros_like(ranked[0])
        for rank, weight in zip(ranked, weights):
            blended += rank * weight

        # Normalize to [0, 1]
        for j in range(blended.shape[1]):
            col = blended[:, j]
            col_min, col_max = col.min(), col.max()
            if col_max > col_min:
                blended[:, j] = (col - col_min) / (col_max - col_min)
            else:
                blended[:, j] = 0.5

        return blended

    else:
        raise ValueError(f"Unknown blend method: {method}")


def _rankdata(arr):
    """Rank data with average ties."""
    n = len(arr)
    rank = np.zeros(n)
    sorted_idx = np.argsort(arr)
    rank[sorted_idx] = np.arange(1, n + 1, dtype=float)
    return rank


def ensemble_with_calibration(
    predictions_list: list[np.ndarray],
    oof_labels: np.ndarray,
    method: str = "platt",
    blend_method: str = "average",
) -> tuple:
    """
    Calibrate each model's OOF predictions, then blend.

    Args:
        predictions_list: list of [N, num_labels] OOF predictions
        oof_labels: [N, num_labels] ground truth
        method: "platt" or "isotonic"
        blend_method: "average" or "rank_average"
    Returns:
        final_probs: [N, num_labels]
        calibrators_list: list of calibrator lists (one per model)
    """
    calibrated_list = []
    calibrators_list = []

    for preds in predictions_list:
        if method == "platt":
            cal_preds, calibrators = platt_scale(preds, oof_labels)
        elif method == "isotonic":
            cal_preds, calibrators = isotonic_calibrate(preds, oof_labels)
        else:
            cal_preds, calibrators = preds, [None] * preds.shape[1]

        calibrated_list.append(cal_preds)
        calibrators_list.append(calibrators)

    final_probs = blend_predictions(calibrated_list, method=blend_method)

    return final_probs, calibrators_list
