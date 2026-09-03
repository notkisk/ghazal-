"""
StudyDataset: Returns {view: tensor[N_slices, C, H, W]}, labels (gold or silver), report (train-only).
"""

import os
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset

from src.data.dicom_utils import load_dicom_series


VIEWS = ["Sagittal", "Coronal", "Axial"]


class KneeMRIStudyDataset(Dataset):
    """
    Dataset for knee MRI studies.

    Each study is a dict of {view: tensor[N_slices, C, H, W]} plus
    (for the labeled subset) the label vector, plus the report text.
    """

    def __init__(
        self,
        train_df: pd.DataFrame,
        series_df: pd.DataFrame,
        labels: list[str],
        dicom_dir: str,
        target_size: tuple = (384, 384),
        slice_max: int = 40,
        num_slices_25d: int = 3,
        use_25d: bool = True,
        is_train: bool = True,
    ):
        """
        Args:
            train_df: DataFrame with StudyInstanceUID + labels + Report
            series_df: DataFrame with StudyInstanceUID, SeriesInstanceUID,
                       Anatomical_Plane, Fluid_Sensitive, Fat_Suppression
            labels: list of 12 label column names
            dicom_dir: path to DICOM series directory
            target_size: (H, W) for resampling
            slice_max: max slices per series
            num_slices_25d: number of adjacent slices for 2.5D input
            use_25d: whether to use 2.5D stacking
            is_train: whether this is training data (affects report inclusion)
        """
        self.train_df = train_df.reset_index(drop=True)
        self.series_df = series_df
        self.labels = labels
        self.dicom_dir = dicom_dir
        self.target_size = target_size
        self.slice_max = slice_max
        self.num_slices_25d = num_slices_25d
        self.use_25d = use_25d
        self.is_train = is_train

        # Pre-compute study -> series mapping
        self.study_series = self._build_study_series_map()

    def _build_study_series_map(self) -> dict:
        """Map StudyInstanceUID -> list of (SeriesInstanceUID, plane, fluid, fat_sup)."""
        study_map = {}
        for _, row in self.series_df.iterrows():
            study_uid = row["StudyInstanceUID"]
            series_uid = row["SeriesInstanceUID"]
            plane = row.get("Anatomical_Plane", "Unknown")
            fluid = bool(row.get("Fluid_Sensitive", False))
            fat_sup = bool(row.get("Fat_Suppression", False))

            if study_uid not in study_map:
                study_map[study_uid] = []
            study_map[study_uid].append({
                "series_uid": series_uid,
                "plane": plane,
                "fluid_sensitive": fluid,
                "fat_suppression": fat_sup,
            })
        return study_map

    def __len__(self) -> int:
        return len(self.train_df)

    def _load_series_for_view(
        self, study_uid: str, view: str
    ) -> Optional[torch.Tensor]:
        """Load all series for a given view and stack them."""
        if study_uid not in self.study_series:
            return None

        series_list = self.study_series[study_uid]
        view_series = [s for s in series_list if s["plane"] == view]

        if not view_series:
            return None

        all_slices = []
        for series_info in view_series:
            series_dir = os.path.join(
                self.dicom_dir, study_uid, series_info["series_uid"]
            )
            if not os.path.isdir(series_dir):
                continue

            slices = load_dicom_series(
                series_dir,
                target_size=self.target_size,
                slice_max=self.slice_max,
                fluid_sensitive=series_info["fluid_sensitive"],
                fat_suppression=series_info["fat_suppression"],
            )
            if slices is not None:
                all_slices.append(slices)

        if not all_slices:
            return None

        # Concatenate all series for this view
        combined = np.concatenate(all_slices, axis=0)  # [N_total_slices, H, W]

        # Truncate to slice_max overall
        combined = combined[: self.slice_max]

        # Convert to tensor [N_slices, 1, H, W] (grayscale)
        tensor = torch.from_numpy(combined).unsqueeze(1).float()

        # 2.5D stacking
        if self.use_25d and self.num_slices_25d > 1:
            tensor = self._stack_2d(tensor, self.num_slices_25d)

        return tensor

    def _stack_2d(self, slices: torch.Tensor, num_slices: int) -> torch.Tensor:
        """
        Stack adjacent slices for 2.5D input.
        Input: [N, 1, H, W]
        Output: [N', num_slices, H, W] where N' = N - num_slices + 1
        """
        n_slices = slices.shape[0]
        if n_slices < num_slices:
            # Pad if too few slices
            pad = num_slices - n_slices
            slices = torch.cat([slices, slices[-1:].repeat(pad, 1, 1, 1)], dim=0)
            n_slices = slices.shape[0]

        # Create overlapping windows
        stacked = []
        for i in range(n_slices - num_slices + 1):
            window = slices[i : i + num_slices]  # [num_slices, 1, H, W]
            stacked.append(window)

        return torch.stack(stacked, dim=0)  # [N', num_slices, 1, H, W]

    def __getitem__(self, idx: int) -> dict:
        row = self.train_df.iloc[idx]
        study_uid = row["StudyInstanceUID"]

        # Load views
        study = {}
        for view in VIEWS:
            view_tensor = self._load_series_for_view(study_uid, view)
            if view_tensor is not None:
                study[view] = view_tensor

        # Labels (may be NaN for unlabeled studies)
        labels = torch.zeros(len(self.labels), dtype=torch.float32)
        has_labels = False
        for i, label in enumerate(self.labels):
            if label in row and pd.notna(row[label]):
                labels[i] = float(row[label])
                has_labels = True

        # Report text (training only)
        report = ""
        if self.is_train and "Report" in row and pd.notna(row["Report"]):
            report = str(row["Report"])

        return {
            "study": study,
            "labels": labels,
            "has_labels": has_labels,
            "report": report,
            "study_uid": study_uid,
        }


def collate_fn(batch: list[dict]) -> dict:
    """
    Custom collate function for variable-view studies.
    Pads missing views with zeros.
    """
    batch_size = len(batch)
    max_slices_per_view = {view: 0 for view in VIEWS}

    # Find max slices per view
    for item in batch:
        for view in VIEWS:
            if view in item["study"]:
                n_slices = item["study"][view].shape[0]
                max_slices_per_view[view] = max(max_slices_per_view[view], n_slices)

    # Pad and stack
    padded_studies = []
    for item in batch:
        padded = {}
        for view in VIEWS:
            if view in item["study"]:
                tensor = item["study"][view]
                n_slices = tensor.shape[0]
                max_n = max_slices_per_view[view]
                if n_slices < max_n:
                    pad_size = max_n - n_slices
                    pad_shape = list(tensor.shape)
                    pad_shape[0] = pad_size
                    padding = torch.zeros(pad_shape)
                    tensor = torch.cat([tensor, padding], dim=0)
                padded[view] = tensor
            else:
                # Missing view: zeros with correct spatial dims
                if max_slices_per_view[view] > 0:
                    # Find spatial dimensions from any available tensor in the batch
                    spatial_shape = None
                    for b_item in batch:
                        for b_view in VIEWS:
                            if b_view in b_item["study"]:
                                spatial_shape = list(b_item["study"][b_view].shape[1:])
                                break
                        if spatial_shape is not None:
                            break
                    if spatial_shape is None:
                        spatial_shape = [1, 128, 128]  # ultimate fallback
                    padded[view] = torch.zeros([max_slices_per_view[view]] + spatial_shape)
        padded_studies.append(padded)

    # Stack labels
    labels = torch.stack([item["labels"] for item in batch])
    has_labels = torch.tensor([item["has_labels"] for item in batch])
    reports = [item["report"] for item in batch]
    study_uids = [item["study_uid"] for item in batch]

    return {
        "studies": padded_studies,
        "labels": labels,
        "has_labels": has_labels,
        "reports": reports,
        "study_uids": study_uids,
    }
