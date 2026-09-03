"""
DICOM loading, windowing, and normalization utilities.
Plane/sequence metadata comes from train_series.csv, not inferred from SeriesDescription.
"""

import os
from pathlib import Path
from typing import Optional

import numpy as np
import pydicom
from pydicom.pixel_data_handlers.util import apply_voi_lut


def load_dicom_slice(dcm_path: str) -> Optional[np.ndarray]:
    """Load a single DICOM file and return pixel data as float32 numpy array."""
    try:
        ds = pydicom.dcmread(dcm_path, force=True)
        if hasattr(ds, "pixel_array"):
            pixel_data = ds.pixel_array.astype(np.float32)
            # Apply VOI LUT if available (windowing)
            pixel_data = apply_voi_lut(pixel_data, ds, index=0)
            return pixel_data
        return None
    except Exception as e:
        print(f"Warning: Failed to load {dcm_path}: {e}")
        return None


def normalize_by_sequence_type(
    pixel_data: np.ndarray,
    fluid_sensitive: bool,
    fat_suppression: bool,
) -> np.ndarray:
    """
    Per-sequence-type windowing/normalization.
    T1 vs T2/PD vs fat-sat have different intensity distributions.
    """
    # Clip to valid range
    p_min, p_max = np.percentile(pixel_data[pixel_data > 0], [1, 99]) if np.any(pixel_data > 0) else (0, 1)
    if p_max <= p_min:
        p_max = p_min + 1.0

    normalized = np.clip(pixel_data, p_min, p_max)
    normalized = (normalized - p_min) / (p_max - p_min)

    # Additional scaling based on sequence characteristics
    if fluid_sensitive and fat_suppression:
        # STIR-like: suppress fat, enhance fluid/edema
        normalized = np.power(normalized, 0.8)
    elif fluid_sensitive:
        # T2-like: fluid bright
        normalized = np.power(normalized, 0.9)
    elif fat_suppression:
        # Fat-sat: suppress fat signal
        normalized = np.power(normalized, 0.85)
    else:
        # T1-like or PD: standard normalization
        normalized = np.power(normalized, 1.0)

    return normalized


def load_dicom_series(
    series_dir: str,
    target_size: tuple = (384, 384),
    slice_max: int = 40,
    fluid_sensitive: bool = False,
    fat_suppression: bool = False,
) -> Optional[np.ndarray]:
    """
    Load all DICOM slices in a series directory.
    Returns: numpy array of shape [num_slices, H, W]
    """
    dcm_files = sorted([
        f for f in os.listdir(series_dir)
        if f.lower().endswith(".dcm")
    ])

    if not dcm_files:
        return None

    # Truncate to max slices
    dcm_files = dcm_files[:slice_max]

    slices = []
    for dcm_file in dcm_files:
        dcm_path = os.path.join(series_dir, dcm_file)
        pixel_data = load_dicom_slice(dcm_path)
        if pixel_data is None:
            continue

        # Resize to target size
        from PIL import Image
        img = Image.fromarray(pixel_data)
        img = img.resize(target_size, Image.BILINEAR)
        pixel_data = np.array(img, dtype=np.float32)

        # Normalize by sequence type
        pixel_data = normalize_by_sequence_type(
            pixel_data, fluid_sensitive, fat_suppression
        )
        slices.append(pixel_data)

    if not slices:
        return None

    return np.stack(slices, axis=0)  # [N_slices, H, W]


def get_dicom_transfer_syntax(dcm_path: str) -> str:
    """Check transfer syntax of a DICOM file for debugging."""
    try:
        ds = pydicom.dcmread(dcm_path, stop_before_pixels=True)
        return ds.file_meta.TransferSyntaxUID.name
    except Exception:
        return "unknown"
