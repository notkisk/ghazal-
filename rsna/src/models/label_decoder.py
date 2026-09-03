"""
ML-Decoder-style label-attention decoder.
One learned query embedding per label, cross-attending into fused view embeddings.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import math


class LabelAttentionDecoder(nn.Module):
    """
    Label-attention decoder: one learned query per label,
    cross-attending into the fused view embeddings.
    """

    def __init__(
        self,
        num_labels: int = 12,
        dim: int = 768,
        num_heads: int = 8,
        num_layers: int = 1,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.num_labels = num_labels
        self.dim = dim

        # Learned label queries
        self.label_queries = nn.Parameter(torch.randn(1, num_labels, dim) * 0.02)

        # Cross-attention decoder layers
        decoder_layer = nn.TransformerDecoderLayer(
            d_model=dim,
            nhead=num_heads,
            dim_feedforward=dim * 4,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.decoder = nn.TransformerDecoder(
            decoder_layer,
            num_layers=num_layers,
        )

        self.norm = nn.LayerNorm(dim)

        # Per-label linear classifiers
        self.label_heads = nn.ModuleList([
            nn.Linear(dim, 1) for _ in range(num_labels)
        ])

    def forward(
        self, fused: torch.Tensor
    ) -> torch.Tensor:
        """
        Args:
            fused: [B, D] fused view embedding
        Returns:
            logits: [B, num_labels]
        """
        B = fused.shape[0]
        device = fused.device

        # Label queries: [B, num_labels, D]
        queries = self.label_queries.expand(B, -1, -1)

        # Memory for cross-attention: [B, 1, D] (single fused token)
        memory = fused.unsqueeze(1)

        # Decode
        decoded = self.decoder(queries, memory)  # [B, num_labels, D]
        decoded = self.norm(decoded)

        # Per-label classification
        logits = []
        for i in range(self.num_labels):
            logit = self.label_heads[i](decoded[:, i, :])  # [B, 1]
            logits.append(logit)

        logits = torch.cat(logits, dim=-1)  # [B, num_labels]

        return logits
