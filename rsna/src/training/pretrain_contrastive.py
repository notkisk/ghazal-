"""
Contrastive pretraining: stage 4.2 of the project plan.
CLIP-style training with paired (image, report) data.
"""

import os
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torch.cuda.amp import autocast, GradScaler

from src.data.dataset import KneeMRIStudyDataset, collate_fn
from src.models.full_model import KneeMRIModel


def infonce_loss(
    image_embeds: torch.Tensor,
    text_embeds: torch.Tensor,
    temperature: float = 0.07,
) -> torch.Tensor:
    """
    Symmetric InfoNCE / CLIP loss.

    Args:
        image_embeds: [B, D]
        text_embeds: [B, D]
        temperature: temperature scaling
    Returns:
        scalar loss
    """
    # Normalize embeddings
    image_embeds = F.normalize(image_embeds, dim=-1)
    text_embeds = F.normalize(text_embeds, dim=-1)

    # Cosine similarity
    logits = torch.mm(image_embeds, text_embeds.t()) / temperature
    targets = torch.arange(logits.shape[0], device=logits.device)

    loss_i2t = F.cross_entropy(logits, targets)
    loss_t2i = F.cross_entropy(logits.t(), targets)

    return (loss_i2t + loss_t2i) / 2


def train_contrastive_epoch(
    model: KneeMRIModel,
    dataloader: DataLoader,
    optimizer: torch.optim.Optimizer,
    scheduler,
    temperature: float,
    device: torch.device,
    use_amp: bool = True,
) -> dict:
    """Train for one epoch with contrastive loss."""
    model.train()
    total_loss = 0.0
    num_batches = 0

    scaler = GradScaler(enabled=use_amp)

    for batch in dataloader:
        studies = batch["studies"]
        reports = batch["reports"]

        # Filter out empty reports
        valid_reports = [r for r in reports if r.strip()]
        if len(valid_reports) < 2:
            continue

        valid_studies = [s for s, r in zip(studies, reports) if r.strip()]
        valid_indices = [i for i, r in enumerate(reports) if r.strip()]

        optimizer.zero_grad()

        with autocast(enabled=use_amp):
            output = model(valid_studies, reports=valid_reports)
            text_emb = output["text_emb"]
            image_emb = output["fused"]

            loss = infonce_loss(image_emb, text_emb, temperature)

        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        if scheduler is not None:
            scheduler.step()

        total_loss += loss.item()
        num_batches += 1

    return {"contrastive_loss": total_loss / max(num_batches, 1)}


def run_contrastive_pretraining(
    train_df: pd.DataFrame,
    series_df: pd.DataFrame,
    config: dict,
    device: torch.device,
    output_dir: str = "outputs/pretrain",
) -> dict:
    """
    Run contrastive pretraining on all training studies with reports.
    """
    os.makedirs(output_dir, exist_ok=True)

    batch_size = config["contrastive"]["batch_size"]
    epochs = config["contrastive"]["epochs"]
    lr = config["contrastive"]["learning_rate"]
    temperature = config["contrastive"]["temperature"]

    # Filter to studies with reports
    train_with_reports = train_df[train_df["Report"].notna()].reset_index(drop=True)
    print(f"Training on {len(train_with_reports)} studies with reports")

    # Create dataset
    dataset = KneeMRIStudyDataset(
        train_with_reports,
        series_df,
        labels=config["labels"],
        dicom_dir=config["data"]["train_dicom_dir"],
        target_size=tuple(config["data_pipeline"]["target_size"]),
        slice_max=config["data_pipeline"]["slice_max"],
        num_slices_25d=config["input_25d"]["num_slices"],
        use_25d=config["input_25d"]["enabled"],
        is_train=True,
    )

    dataloader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=config["data_pipeline"]["num_workers"],
        pin_memory=config["data_pipeline"]["pin_memory"],
        collate_fn=collate_fn,
        drop_last=True,
    )

    # Create model with text branch
    model = KneeMRIModel(
        backbone_name=config["backbone"]["name"],
        out_dim=config["backbone"]["out_dim"],
        pretrained_backbone=config["backbone"]["pretrained"],
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
        use_text_branch=True,
        text_encoder_name=config["contrastive"]["text_encoder"],
    ).to(device)

    # Optimizer
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=lr,
        weight_decay=config["contrastive"]["weight_decay"],
    )

    total_steps = epochs * len(dataloader)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=total_steps)

    use_amp = config["training"]["mixed_precision"]

    # Training loop
    for epoch in range(epochs):
        metrics = train_contrastive_epoch(
            model, dataloader, optimizer, scheduler, temperature, device, use_amp
        )

        print(f"Epoch {epoch+1}/{epochs} | Contrastive Loss: {metrics['contrastive_loss']:.4f}")

        # Save checkpoint
        torch.save(
            {
                "model_state_dict": model.state_dict(),
                "epoch": epoch,
                "loss": metrics["contrastive_loss"],
            },
            os.path.join(output_dir, f"pretrain_epoch{epoch+1}.pt"),
        )

    # Save final model (backbone + pooling + fusion, discard text encoder)
    torch.save(
        {
            "model_state_dict": {
                k: v for k, v in model.state_dict().items()
                if not k.startswith("text_encoder")
            },
            "epoch": epochs - 1,
        },
        os.path.join(output_dir, "pretrain_final.pt"),
    )

    return {"final_loss": metrics["contrastive_loss"]}
