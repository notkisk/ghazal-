"""
Clinical text encoder: train-time only for contrastive pretraining.
Discarded after pretraining stage.
"""

import torch
import torch.nn as nn
from transformers import AutoTokenizer, AutoModel


class ClinicalTextEncoder(nn.Module):
    """
    Wraps a pretrained clinical/biomedical BERT for encoding radiology reports.
    Train-time only — never used at inference.
    """

    def __init__(
        self,
        model_name: str = "microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext",
        out_dim: int = 768,
        max_length: int = 512,
        freeze_base: bool = False,
    ):
        super().__init__()
        self.max_length = max_length
        self.out_dim = out_dim

        try:
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.encoder = AutoModel.from_pretrained(model_name)
            encoder_dim = self.encoder.config.hidden_size

            if not freeze_base:
                # Fine-tune last 2 layers
                for param in self.encoder.parameters():
                    param.requires_grad = False
                for param in self.encoder.encoder.layer[-2:].parameters():
                    param.requires_grad = True

            self.proj = nn.Linear(encoder_dim, out_dim) if encoder_dim != out_dim else nn.Identity()
            self.available = True
        except Exception as e:
            print(f"Warning: Could not load text encoder {model_name}: {e}")
            print("Using random projection fallback")
            self.encoder = None
            self.tokenizer = None
            self.proj = nn.Linear(256, out_dim)
            self.available = False

    def forward(self, reports: list[str]) -> torch.Tensor:
        """
        Args:
            reports: list of report strings
        Returns:
            [B, out_dim] text embeddings
        """
        if not self.available:
            # Random fallback for testing
            B = len(reports)
            dummy = torch.randn(B, 256, device=next(self.proj.parameters()).device)
            return self.proj(dummy)

        device = next(self.parameters()).device

        encoded = self.tokenizer(
            reports,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        ).to(device)

        output = self.encoder(**encoded)
        # Use [CLS] token embedding
        cls_embedding = output.last_hidden_state[:, 0, :]  # [B, hidden_dim]

        return self.proj(cls_embedding)  # [B, out_dim]
