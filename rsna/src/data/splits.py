"""
Splits: GroupKFold by StudyInstanceUID with iterative multi-label stratification.
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold
from iterstrat.ml_stratifiers import MultilabelStratifiedKFold


def create_cv_splits(
    df: pd.DataFrame,
    labels: list[str],
    n_folds: int = 5,
    seed: int = 42,
    use_iterative_strat: bool = True,
) -> list[tuple[np.ndarray, np.ndarray]]:
    """
    Create cross-validation splits.

    Groups by StudyInstanceUID (no PatientID available).
    Uses iterative multi-label stratification when possible.

    Returns list of (train_idx, val_idx) tuples.
    """
    study_col = "StudyInstanceUID"
    label_matrix = df[labels].values

    # Check for missing labels (NaN) — fill with 0 for stratification
    label_matrix = np.nan_to_num(label_matrix, nan=0.0).astype(int)

    if study_col not in df.columns:
        raise ValueError(f"Column '{study_col}' not found in dataframe")

    groups = df[study_col].values

    if use_iterative_strat:
        try:
            mskf = MultilabelStratifiedKFold(
                n_splits=n_folds, shuffle=True, random_state=seed
            )
            splits = list(mskf.split(df, label_matrix, groups=groups))
            print(f"Created {n_folds} folds with iterative multi-label stratification")
            return splits
        except Exception as e:
            print(f"Iterative stratification failed ({e}), falling back to GroupKFold")

    # Fallback: GroupKFold
    gkf = GroupKFold(n_splits=n_folds)
    splits = list(gkf.split(df, groups=groups))
    print(f"Created {n_folds} folds with GroupKFold")
    return splits


def verify_fold_positives(
    df: pd.DataFrame,
    splits: list[tuple[np.ndarray, np.ndarray]],
    labels: list[str],
) -> None:
    """Check per-fold positive counts for every label."""
    print("\nPer-fold positive counts:")
    print(f"{'Label':<20}", end="")
    for i in range(len(splits)):
        print(f"{'Fold ' + str(i):>10}", end="")
    print()
    print("-" * (20 + 10 * len(splits)))

    for label in labels:
        print(f"{label:<20}", end="")
        for train_idx, val_idx in splits:
            val_labels = df.iloc[val_idx][label].fillna(0).astype(int)
            n_pos = val_labels.sum()
            print(f"{n_pos:>10}", end="")
        print()
    print()
