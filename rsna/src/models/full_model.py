"""
Full model: composes backbone + pooling + fusion + decoder.
"""

import torch
import torch.nn as nn

from src.models.backbone import get_backbone
from src.models.mil_pooling import GatedAttentionMIL
from src.models.fusion import CrossViewTransformer
from src.models.label_decoder import LabelAttentionDecoder
from src.models.text_encoder import ClinicalTextEncoder

VIEWS = ["Sagittal", "Coronal", "Axial"]


class KneeMRIModel(nn.Module):
    """
    Full knee MRI model:
    - Shared per-slice backbone
    - Attention MIL pooling per view
    - Cross-view fusion transformer
    - Label-attention decoder

    Optional text encoder for contrastive pretraining (train-time only).
    """

    def __init__(
        self,
        backbone_name: str = "convnext_small",
        out_dim: int = 768,
        pretrained_backbone: bool = True,
        num_labels: int = 12,
        mil_hidden_dim: int = 256,
        mil_per_label: bool = True,
        fusion_dim: int = 768,
        fusion_heads: int = 8,
        fusion_layers: int = 2,
        fusion_dropout: float = 0.1,
        decoder_dim: int = 768,
        decoder_heads: int = 8,
        decoder_layers: int = 1,
        decoder_dropout: float = 0.1,
        use_text_branch: bool = False,
        text_encoder_name: str = "microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext",
    ):
        super().__init__()

        self.use_text_branch = use_text_branch
        self.num_labels = num_labels

        # Shared backbone
        self.backbone = get_backbone(backbone_name, out_dim=out_dim, pretrained=pretrained_backbone)

        # Per-view attention MIL pooling (shared weights across views)
        self.pooling = GatedAttentionMIL(
            input_dim=out_dim,
            hidden_dim=mil_hidden_dim,
            num_labels=num_labels,
            per_label=mil_per_label,
        )

        # Cross-view fusion transformer
        self.fusion = CrossViewTransformer(
            dim=fusion_dim,
            num_heads=fusion_heads,
            num_layers=fusion_layers,
            dropout=fusion_dropout,
        )

        # Label-attention decoder
        self.decoder = LabelAttentionDecoder(
            num_labels=num_labels,
            dim=decoder_dim,
            num_heads=decoder_heads,
            num_layers=decoder_layers,
            dropout=decoder_dropout,
        )

        # Text encoder (train-time only for contrastive pretraining)
        self.text_encoder = None
        if use_text_branch:
            self.text_encoder = ClinicalTextEncoder(
                model_name=text_encoder_name,
                out_dim=out_dim,
            )

    def encode_image(self, study: dict) -> torch.Tensor:
        """
        Encode a single study (dict of views) into fused embedding.

        Args:
            study: dict mapping view_name -> [N_slices, C, H, W]
        Returns:
            fused: [B, D] (batch dim added internally)
        """
        device = next(self.parameters()).device
        view_embeddings = {}

        for view_name, slices in study.items():
            if slices is None or slices.numel() == 0:
                continue

            # Add batch dim if needed
            if slices.dim() == 4:
                slices = slices.unsqueeze(0)  # [1, N, C, H, W]

            B, N = slices.shape[0], slices.shape[1]

            # Flatten batch and slice dims
            slices_flat = slices.view(B * N, *slices.shape[2:])  # [B*N, C, H, W]

            # Backbone: [B*N, D]
            slice_feats = self.backbone(slices_flat)

            # Reshape: [B, N, D]
            slice_feats = slice_feats.view(B, N, -1)

            # Attention MIL pooling: [B, D] or [B, num_labels, D]
            view_emb, attn_weights = self.pooling(slice_feats)

            # If per_label, average over labels for fusion input
            if view_emb.dim() == 3:
                view_emb = view_emb.mean(dim=1)  # [B, D]

            view_embeddings[view_name] = view_emb

        if not view_embeddings:
            # No views available: return zeros
            return torch.zeros(1, self.fusion.dim, device=device)

        # Fusion: [B, D]
        fused = self.fusion(view_embeddings)

        return fused

    def forward(
        self,
        studies: list[dict],
        labels: torch.Tensor = None,
        reports: list[str] = None,
    ) -> dict:
        """
        Forward pass.

        Args:
            studies: list of dicts, each mapping view_name -> tensor
            labels: [B, num_labels] ground truth (optional)
            reports: list of report strings (optional, for contrastive loss)
        Returns:
            dict with logits, losses, etc.
        """
        device = next(self.parameters()).device
        B = len(studies)

        # Encode all studies
        fused_list = []
        for study in studies:
            fused = self.encode_image(study)
            fused_list.append(fused)

        fused = torch.cat(fused_list, dim=0)  # [B, D]

        # Decode labels
        logits = self.decoder(fused)  # [B, num_labels]

        output = {
            "logits": logits,
            "fused": fused,
        }

        # Contrastive loss (training only)
        if self.use_text_branch and self.text_encoder is not None and reports is not None:
            text_emb = self.text_encoder(reports)  # [B, D]
            output["text_emb"] = text_emb

            # InfoNCE contrastive loss
            if labels is not None:
                logits_sim = torch.mm(fused, text_emb.t()) / 0.07  # [B, B]
                targets = torch.arange(B, device=device)
                loss_i2t = nn.functional.cross_entropy(logits_sim, targets)
                loss_t2i = nn.functional.cross_entropy(logits_sim.t(), targets)
                output["contrastive_loss"] = (loss_i2t + loss_t2i) / 2

        return output
