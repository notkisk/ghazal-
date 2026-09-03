"""
Prediction: image-only path, loads finetuned weights only.
"""

import os
import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader

from src.data.dataset import KneeMRIStudyDataset, collate_fn
from src.models.full_model import KneeMRIModel


def load_model(
    checkpoint_path: str,
    config: dict,
    device: torch.device,
) -> KneeMRIModel:
    """Load a trained model from checkpoint."""
    model = KneeMRIModel(
        backbone_name=config["backbone"]["name"],
        out_dim=config["backbone"]["out_dim"],
        pretrained_backbone=False,  # Don't download weights again
        num_labels=len(config["labels"]),
        mil_hidden_dim=config["mil_pooling"]["hidden_dim"],
        mil_per_label=config["mil_pooling"]["per_label"],
        fusion_dim=config["fusion"]["dim"],
        fusion_heads=config["fusion"]["num_heads"],
        fusion_layers=config["fusion"]["num_layers"],
        fusion_dropout=config["fusion"]["dropout"],
        decoder_dim=config["decoder"]["dim"],
        decoder_heads=config["decoder"]["num_heads"],
        decoder_layers=config["decoder"]["num_layers"],
        decoder_dropout=config["decoder"]["dropout"],
        use_text_branch=False,  # Never at inference
    ).to(device)

    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    return model


@torch.no_grad()
def predict_study(
    model: KneeMRIModel,
    study: dict,
    device: torch.device,
) -> np.ndarray:
    """
    Predict probabilities for a single study.

    Args:
        model: trained model
        study: dict mapping view_name -> tensor
        device: torch device
    Returns:
        probs: [num_labels] numpy array
    """
    model.eval()

    # Add batch dimension
    batched_study = {}
    for view, tensor in study.items():
        batched_study[view] = tensor.unsqueeze(0).to(device)

    output = model([batched_study])
    probs = torch.sigmoid(output["logits"]).cpu().numpy()[0]

    return probs


def generate_submission(
    test_df: pd.DataFrame,
    series_df: pd.DataFrame,
    model_paths: list[str],
    config: dict,
    device: torch.device,
    output_path: str = "submission.csv",
) -> pd.DataFrame:
    """
    Generate submission file for the competition.

    Args:
        test_df: test DataFrame with StudyInstanceUID
        series_df: test series DataFrame
        model_paths: list of checkpoint paths (for ensemble)
        config: configuration dict
        device: torch device
        output_path: path to save submission.csv
    Returns:
        submission DataFrame
    """
    labels = config["labels"]

    # Load models
    models = []
    for path in model_paths:
        model = load_model(path, config, device)
        models.append(model)

    # Create test dataset
    test_dataset = KneeMRIStudyDataset(
        test_df,
        series_df,
        labels,
        dicom_dir=config["data"]["test_dicom_dir"],
        target_size=tuple(config["data_pipeline"]["target_size"]),
        slice_max=config["data_pipeline"]["slice_max"],
        num_slices_25d=config["input_25d"]["num_slices"],
        use_25d=config["input_25d"]["enabled"],
        is_train=False,
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=1,
        shuffle=False,
        num_workers=config["data_pipeline"]["num_workers"],
        collate_fn=collate_fn,
    )

    # Generate predictions
    all_preds = []
    study_uids = []

    for batch in test_loader:
        studies = batch["studies"]
        study_uid = batch["study_uids"][0]
        study_uids.append(study_uid)

        # Ensemble: average predictions from multiple models
        ensemble_preds = []
        for model in models:
            output = model(studies)
            probs = torch.sigmoid(output["logits"]).cpu().numpy()[0]
            ensemble_preds.append(probs)

        avg_pred = np.mean(ensemble_preds, axis=0)
        all_preds.append(avg_pred)

    # Create submission DataFrame
    all_preds = np.array(all_preds)
    submission_df = pd.DataFrame({
        "StudyInstanceUID": study_uids,
    })

    for i, label in enumerate(labels):
        submission_df[label] = all_preds[:, i]

    # Save
    submission_df.to_csv(output_path, index=False)
    print(f"Submission saved to {output_path}")
    print(f"Shape: {submission_df.shape}")
    print(f"Columns: {list(submission_df.columns)}")

    return submission_df
