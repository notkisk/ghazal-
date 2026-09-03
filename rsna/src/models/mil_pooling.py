"""
Gated Attention MIL Pooling (Ilse et al. style).
Per-label or shared attention weights.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class GatedAttentionMIL(nn.Module):
    """
    Gated attention mechanism for Multiple Instance Learning.

    Each slice embedding gets a scalar attention weight via a small MLP.
    View embedding = weighted sum of slice embeddings.

    Supports per-label attention (different weights per label) for
    better slice selection when labels look at different regions.
    """

    def __init__(
        self,
        input_dim: int = 768,
        hidden_dim: int = 256,
        num_labels: int = 12,
        per_label: bool = True,
    ):
        super().__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.num_labels = num_labels
        self.per_label = per_label

        if per_label:
            # Per-label attention: each label gets its own attention weights
            self.attention_V = nn.ModuleList([
                nn.Sequential(
                    nn.Linear(input_dim, hidden_dim),
                    nn.Tanh(),
                )
                for _ in range(num_labels)
            ])
            self.attention_U = nn.ModuleList([
                nn.Sequential(
                    nn.Linear(input_dim, hidden_dim),
                    nn.Sigmoid(),
                )
                for _ in range(num_labels)
            ])
            self.attention_w = nn.ModuleList([
                nn.Linear(hidden_dim, 1)
                for _ in range(num_labels)
            ])
        else:
            # Shared attention: one set of weights for all labels
            self.attention_V = nn.Sequential(
                nn.Linear(input_dim, hidden_dim),
                nn.Tanh(),
            )
            self.attention_U = nn.Sequential(
                nn.Linear(input_dim, hidden_dim),
                nn.Sigmoid(),
            )
            self.attention_w = nn.Linear(hidden_dim, 1)

    def forward(
        self, slice_feats: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            slice_feats: [B, N_slices, D]
        Returns:
            view_emb: [B, D] or [B, num_labels, D] if per_label
            attention_weights: [B, N_slices] or [B, num_labels, N_slices]
        """
        B, N, D = slice_feats.shape

        if self.per_label:
            view_embs = []
            attn_weights_list = []

            for label_idx in range(self.num_labels):
                V = self.attention_V[label_idx](slice_feats)  # [B, N, H]
                U = self.attention_U[label_idx](slice_feats)  # [B, N, H]
                A = self.attention_w[label_idx](V * U)        # [B, N, 1]
                A = A.squeeze(-1)                             # [B, N]
                A = F.softmax(A, dim=-1)                      # [B, N]

                # Weighted sum
                view_emb = torch.bmm(A.unsqueeze(1), slice_feats).squeeze(1)  # [B, D]
                view_embs.append(view_emb)
                attn_weights_list.append(A)

            view_emb = torch.stack(view_embs, dim=1)  # [B, num_labels, D]
            attn_weights = torch.stack(attn_weights_list, dim=1)  # [B, num_labels, N]
        else:
            V = self.attention_V(slice_feats)  # [B, N, H]
            U = self.attention_U(slice_feats)  # [B, N, H]
            A = self.attention_w(V * U)        # [B, N, 1]
            A = A.squeeze(-1)                 # [B, N]
            A = F.softmax(A, dim=-1)          # [B, N]

            view_emb = torch.bmm(A.unsqueeze(1), slice_feats).squeeze(1)  # [B, D]
            attn_weights = A  # [B, N]

        return view_emb, attn_weights
