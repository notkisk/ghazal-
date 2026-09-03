"""
Shared per-slice backbone wrapper (ConvNeXt / DINOv2).
"""

import torch
import torch.nn as nn
import torchvision.models as models


class ConvNeXtBackbone(nn.Module):
    """ConvNeXt-Small backbone with pretrained weights."""

    def __init__(self, out_dim: int = 768, pretrained: bool = True):
        super().__init__()
        weights = "IMAGENET1K_V1" if pretrained else None
        base = models.convnext_small(weights=weights)
        # Remove classification head
        self.features = base.features
        self.avgpool = nn.AdaptiveAvgPool2d(1)
        # Project to output dimension
        self.proj = nn.Linear(768, out_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: [B, C, H, W] (C=1 for grayscale, C=3 after expansion)
        Returns:
            [B, out_dim]
        """
        # Expand grayscale to 3 channels if needed
        if x.shape[1] == 1:
            x = x.repeat(1, 3, 1, 1)

        feat = self.features(x)       # [B, 768, H', W']
        feat = self.avgpool(feat)     # [B, 768, 1, 1]
        feat = feat.flatten(1)        # [B, 768]
        feat = self.proj(feat)        # [B, out_dim]
        return feat


class DINOv2Backbone(nn.Module):
    """DINOv2 ViT-B/14 backbone with pretrained weights."""

    def __init__(self, out_dim: int = 768, pretrained: bool = True):
        super().__init__()
        try:
            import timm
            self.vit = timm.create_model(
                "vit_small_patch14_224",
                pretrained=pretrained,
                num_classes=0,  # remove head
            )
            feat_dim = self.vit.embed_dim
            self.proj = nn.Linear(feat_dim, out_dim) if feat_dim != out_dim else nn.Identity()
        except ImportError:
            # Fallback: simple ViT-like backbone
            print("Warning: timm not available, using ConvNeXt as DINOv2 fallback")
            base = models.convnext_small(weights="IMAGENET1K_V1")
            self.features = base.features
            self.avgpool = nn.AdaptiveAvgPool2d(1)
            self.proj = nn.Linear(768, out_dim)

        self.use_fallback = not hasattr(self, "vit")

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.shape[1] == 1:
            x = x.repeat(1, 3, 1, 1)

        if self.use_fallback:
            feat = self.features(x)
            feat = self.avgpool(feat)
            feat = feat.flatten(1)
        else:
            feat = self.vit(x)

        return self.proj(feat)


def get_backbone(name: str, out_dim: int = 768, pretrained: bool = True) -> nn.Module:
    """Factory function to create backbone."""
    if name == "convnext_small":
        return ConvNeXtBackbone(out_dim=out_dim, pretrained=pretrained)
    elif name == "dinov2_vitb14":
        return DINOv2Backbone(out_dim=out_dim, pretrained=pretrained)
    else:
        raise ValueError(f"Unknown backbone: {name}")
