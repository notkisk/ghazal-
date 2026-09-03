"""
Loss functions: BCE, focal loss, InfoNCE.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class FocalLoss(nn.Module):
    """
    Focal Loss for handling class imbalance in multi-label classification.
    FL(p_t) = -alpha_t * (1 - p_t)^gamma * log(p_t)
    """

    def __init__(self, alpha: float = 0.25, gamma: float = 2.0, reduction: str = "mean"):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        """
        Args:
            logits: [B, num_labels]
            targets: [B, num_labels] binary
        Returns:
            scalar loss
        """
        bce_loss = F.binary_cross_entropy_with_logits(logits, targets, reduction="none")
        probs = torch.sigmoid(logits)
        p_t = probs * targets + (1 - probs) * (1 - targets)
        alpha_t = self.alpha * targets + (1 - self.alpha) * (1 - targets)
        focal_weight = alpha_t * (1 - p_t) ** self.gamma

        loss = focal_weight * bce_loss

        if self.reduction == "mean":
            return loss.mean()
        elif self.reduction == "sum":
            return loss.sum()
        return loss


def get_loss_fn(
    loss_type: str = "bce",
    focal_alpha: float = 0.25,
    focal_gamma: float = 2.0,
) -> nn.Module:
    """Factory function for loss functions."""
    if loss_type == "bce":
        return nn.BCEWithLogitsLoss()
    elif loss_type == "focal":
        return FocalLoss(alpha=focal_alpha, gamma=focal_gamma)
    else:
        raise ValueError(f"Unknown loss type: {loss_type}")
