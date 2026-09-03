"""
Supervised fine-tuning: stages 4.3-4.6 of the project plan.
"""

import os
import time
import json
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torch.cuda.amp import autocast, GradScaler
from sklearn.metrics import roc_auc_score

from src.data.dataset import KneeMRIStudyDataset, collate_fn
from src.data.splits import create_cv_splits, verify_fold_positives
from src.models.full_model import KneeMRIModel
from src.training.losses import get_loss_fn
from src.eval.cv_report import generate_cv_report


def train_one_epoch(
    model: KneeMRIModel,
    dataloader: DataLoader,
    optimizer: torch.optim.Optimizer,
    scheduler,
    loss_fn: nn.Module,
    device: torch.device,
    use_amp: bool = True,
    gradient_clip: float = 1.0,
) -> dict:
    """Train for one epoch."""
    model.train()
    total_loss = 0.0
    num_batches = 0

    scaler = GradScaler(enabled=use_amp)

    for batch_idx, batch in enumerate(dataloader):
        studies = batch["studies"]
        labels = batch["labels"].to(device)
        has_labels = batch["has_labels"]

        # Only use labeled samples for supervised training
        labeled_mask = has_labels.bool()
        if not labeled_mask.any():
            continue

        labeled_studies = [studies[i] for i in range(len(studies)) if labeled_mask[i]]
        labeled_labels = labels[labeled_mask]

        optimizer.zero_grad()

        with autocast(enabled=use_amp):
            output = model(labeled_studies, labels=labeled_labels)
            logits = output["logits"]
            loss = loss_fn(logits, labeled_labels)

        scaler.scale(loss).backward()
        if gradient_clip > 0:
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), gradient_clip)
        scaler.step(optimizer)
        scaler.update()

        if scheduler is not None:
            scheduler.step()

        total_loss += loss.item()
        num_batches += 1

    return {"train_loss": total_loss / max(num_batches, 1)}


@torch.no_grad()
def evaluate(
    model: KneeMRIModel,
    dataloader: DataLoader,
    labels: list[str],
    device: torch.device,
) -> dict:
    """Evaluate model on validation set."""
    model.eval()
    all_logits = []
    all_labels = []
    total_loss = 0.0
    num_batches = 0

    loss_fn = nn.BCEWithLogitsLoss()

    for batch in dataloader:
        studies = batch["studies"]
        batch_labels = batch["labels"].to(device)
        has_labels = batch["has_labels"]
        labeled_mask = has_labels.bool()

        if not labeled_mask.any():
            continue

        labeled_studies = [studies[i] for i in range(len(studies)) if labeled_mask[i]]
        labeled_labels = batch_labels[labeled_mask]

        output = model(labeled_studies, labels=labeled_labels)
        logits = output["logits"]

        loss = loss_fn(logits, labeled_labels)
        total_loss += loss.item()
        num_batches += 1

        all_logits.append(logits.cpu())
        all_labels.append(labeled_labels.cpu())

    if not all_logits:
        return {"val_loss": 0.0, "macro_auc": 0.0, "per_label_auc": {}}

    all_logits = torch.cat(all_logits, dim=0)
    all_labels = torch.cat(all_labels, dim=0)

    # Compute per-label AUC
    probs = torch.sigmoid(all_logits).numpy()
    labels_np = all_labels.numpy()

    per_label_auc = {}
    valid_aucs = []

    for i, label in enumerate(labels):
        try:
            if labels_np[:, i].sum() > 0 and (1 - labels_np[:, i]).sum() > 0:
                auc = roc_auc_score(labels_np[:, i], probs[:, i])
                per_label_auc[label] = auc
                valid_aucs.append(auc)
            else:
                per_label_auc[label] = float("nan")
        except Exception:
            per_label_auc[label] = float("nan")

    macro_auc = np.mean(valid_aucs) if valid_aucs else 0.0

    return {
        "val_loss": total_loss / max(num_batches, 1),
        "macro_auc": macro_auc,
        "per_label_auc": per_label_auc,
    }


def run_supervised_training(
    train_df: pd.DataFrame,
    series_df: pd.DataFrame,
    labels: list[str],
    config: dict,
    device: torch.device,
    output_dir: str = "outputs",
) -> dict:
    """
    Run full supervised training with cross-validation.
    """
    os.makedirs(output_dir, exist_ok=True)

    # Create CV splits
    splits = create_cv_splits(
        train_df,
        labels,
        n_folds=config["cv"]["n_folds"],
        seed=config["training"]["seed"],
        use_iterative_strat=config["cv"]["iterative_stratification"],
    )

    if config["cv"]["check_per_fold_positives"]:
        verify_fold_positives(train_df, splits, labels)

    # Training config
    batch_size = config["training"]["batch_size"]
    epochs = config["training"]["epochs"]
    lr = config["training"]["learning_rate"]
    weight_decay = config["training"]["weight_decay"]
    use_amp = config["training"]["mixed_precision"]
    seed = config["training"]["seed"]

    torch.manual_seed(seed)
    np.random.seed(seed)

    fold_results = []

    for fold_idx, (train_idx, val_idx) in enumerate(splits):
        print(f"\n{'='*60}")
        print(f"Fold {fold_idx + 1}/{len(splits)}")
        print(f"{'='*60}")

        # Create fold datasets
        train_subset = train_df.iloc[train_idx].reset_index(drop=True)
        val_subset = train_df.iloc[val_idx].reset_index(drop=True)

        train_dataset = KneeMRIStudyDataset(
            train_subset,
            series_df,
            labels,
            dicom_dir=config["data"]["train_dicom_dir"],
            target_size=tuple(config["data_pipeline"]["target_size"]),
            slice_max=config["data_pipeline"]["slice_max"],
            num_slices_25d=config["input_25d"]["num_slices"],
            use_25d=config["input_25d"]["enabled"],
            is_train=True,
        )

        val_dataset = KneeMRIStudyDataset(
            val_subset,
            series_df,
            labels,
            dicom_dir=config["data"]["train_dicom_dir"],
            target_size=tuple(config["data_pipeline"]["target_size"]),
            slice_max=config["data_pipeline"]["slice_max"],
            num_slices_25d=config["input_25d"]["num_slices"],
            use_25d=config["input_25d"]["enabled"],
            is_train=False,
        )

        train_loader = DataLoader(
            train_dataset,
            batch_size=batch_size,
            shuffle=True,
            num_workers=config["data_pipeline"]["num_workers"],
            pin_memory=config["data_pipeline"]["pin_memory"],
            collate_fn=collate_fn,
            drop_last=True,
        )

        val_loader = DataLoader(
            val_dataset,
            batch_size=batch_size,
            shuffle=False,
            num_workers=config["data_pipeline"]["num_workers"],
            pin_memory=config["data_pipeline"]["pin_memory"],
            collate_fn=collate_fn,
        )

        # Create model
        model = KneeMRIModel(
            backbone_name=config["backbone"]["name"],
            out_dim=config["backbone"]["out_dim"],
            pretrained_backbone=config["backbone"]["pretrained"],
            num_labels=len(labels),
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
        ).to(device)

        # Optimizer and scheduler
        optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=lr,
            weight_decay=weight_decay,
        )

        total_steps = epochs * len(train_loader)
        warmup_steps = config["training"]["warmup_epochs"] * len(train_loader)

        def lr_lambda(step):
            if step < warmup_steps:
                return step / max(warmup_steps, 1)
            progress = (step - warmup_steps) / max(total_steps - warmup_steps, 1)
            return 0.5 * (1 + np.cos(np.pi * progress))

        scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)

        # Loss function
        loss_fn = get_loss_fn(
            config["training"]["loss"],
            config["training"]["focal_alpha"],
            config["training"]["focal_gamma"],
        )

        # Training loop
        best_auc = 0.0
        patience_counter = 0
        patience = config["training"]["early_stopping_patience"]

        for epoch in range(epochs):
            train_metrics = train_one_epoch(
                model, train_loader, optimizer, scheduler, loss_fn, device,
                use_amp=use_amp,
                gradient_clip=config["training"]["gradient_clip"],
            )

            val_metrics = evaluate(model, val_loader, labels, device)

            print(
                f"Epoch {epoch+1}/{epochs} | "
                f"Train Loss: {train_metrics['train_loss']:.4f} | "
                f"Val Loss: {val_metrics['val_loss']:.4f} | "
                f"Macro AUC: {val_metrics['macro_auc']:.4f}"
            )

            # Save best model
            if val_metrics["macro_auc"] > best_auc:
                best_auc = val_metrics["macro_auc"]
                patience_counter = 0
                torch.save(
                    {
                        "model_state_dict": model.state_dict(),
                        "optimizer_state_dict": optimizer.state_dict(),
                        "epoch": epoch,
                        "best_auc": best_auc,
                        "val_metrics": val_metrics,
                    },
                    os.path.join(output_dir, f"fold{fold_idx}_best.pt"),
                )
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    print(f"Early stopping at epoch {epoch+1}")
                    break

        # Load best model and final evaluation
        checkpoint = torch.load(
            os.path.join(output_dir, f"fold{fold_idx}_best.pt"),
            weights_only=False,
        )
        model.load_state_dict(checkpoint["model_state_dict"])
        final_metrics = evaluate(model, val_loader, labels, device)

        fold_results.append({
            "fold": fold_idx,
            "best_epoch": checkpoint["epoch"],
            "macro_auc": final_metrics["macro_auc"],
            "per_label_auc": final_metrics["per_label_auc"],
        })

        print(f"\nFold {fold_idx+1} Result: Macro AUC = {final_metrics['macro_auc']:.4f}")
        for label, auc in final_metrics["per_label_auc"].items():
            print(f"  {label}: {auc:.4f}")

    # Generate CV report
    report = generate_cv_report(fold_results, labels)

    # Save results
    results_path = os.path.join(output_dir, "cv_results.json")
    with open(results_path, "w") as f:
        json.dump(fold_results, f, indent=2, default=str)

    return {
        "fold_results": fold_results,
        "report": report,
        "mean_macro_auc": np.mean([r["macro_auc"] for r in fold_results]),
    }
