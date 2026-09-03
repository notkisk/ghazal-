"""
Cross-view fusion transformer block.
Combines sagittal/coronal/axial features with learned missing view token.
"""

import torch
import torch.nn as nn
import math


class CrossViewTransformer(nn.Module):
    """
    Small transformer encoder over per-view embeddings.
    Handles missing views with a learned "missing view" token.
    """

    def __init__(
        self,
        dim: int = 768,
        num_heads: int = 8,
        num_layers: int = 2,
        dropout: float = 0.1,
        max_views: int = 3,
    ):
        super().__init__()
        self.dim = dim
        self.max_views = max_views

        # Learned missing view token
        self.missing_view_token = nn.Parameter(torch.randn(1, 1, dim) * 0.02)

        # Positional encoding for views
        self.view_pos_embed = nn.Parameter(torch.randn(1, max_views, dim) * 0.02)

        # Transformer encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=dim,
            nhead=num_heads,
            dim_feedforward=dim * 4,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.transformer = nn.TransformerEncoder(
            encoder_layer,
            num_layers=num_layers,
        )

        self.norm = nn.LayerNorm(dim)

    def forward(
        self, view_embeddings: dict[str, torch.Tensor]
    ) -> torch.Tensor:
        """
        Args:
            view_embeddings: dict mapping view name -> [B, D] tensor
        Returns:
            fused: [B, D] tensor
        """
        B = next(iter(view_embeddings.values())).shape[0]
        device = next(iter(view_embeddings.values())).device

        # Build sequence: use provided views, substitute missing view token
        view_names = ["Sagittal", "Coronal", "Axial"]
        tokens = []

        for i, view_name in enumerate(view_names):
            if view_name in view_embeddings:
                tokens.append(view_embeddings[view_name])  # [B, D]
            else:
                # Use missing view token
                tokens.append(
                    self.missing_view_token.expand(B, -1, -1).squeeze(1)
                )

        # Stack: [B, 3, D]
        tokens = torch.stack(tokens, dim=1)

        # Add positional encoding
        tokens = tokens + self.view_pos_embed[:, :3, :]

        # Transformer fusion
        fused = self.transformer(tokens)  # [B, 3, D]
        fused = self.norm(fused)

        # Global average pooling over views
        fused = fused.mean(dim=1)  # [B, D]

        return fused
