"""
Sanity check: create synthetic data and run pipeline end-to-end.
Verifies correctness without requiring actual competition data.
"""

import os
import sys
import time
import yaml
import numpy as np
import pandas as pd
import torch

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)


def create_synthetic_data(
    n_studies: int = 20,
    n_labeled: int = 10,
    output_dir: str = "synthetic_data",
) -> tuple:
    """Create synthetic DICOM-like data and CSV files for testing."""
    os.makedirs(output_dir, exist_ok=True)
    dicom_dir = os.path.join(output_dir, "train_series")
    os.makedirs(dicom_dir, exist_ok=True)

    labels = [
        "ACL", "MCL", "Medial_Meniscus", "Lateral_Meniscus",
        "Medial_OA", "Lateral_OA", "PF_OA", "Effusion",
        "Synovitis", "Bakers", "Contusion", "Fracture",
    ]

    views = ["Sagittal", "Coronal", "Axial"]
    planes_series = {
        "Sagittal": ["Sagittal_T1", "Sagittal_PD", "Sagittal_STIR"],
        "Coronal": ["Coronal_T1", "Coronal_T2"],
        "Axial": ["Axial_PD", "Axial_T2"],
    }

    studies = []
    series_rows = []

    for i in range(n_studies):
        study_uid = f"study_{i:04d}"
        studies.append({"StudyInstanceUID": study_uid, "Report": f"Synthetic report {i}"})

        # Add labels for first n_labeled studies
        if i < n_labeled:
            label_vals = np.random.choice([0, 1], size=len(labels), p=[0.7, 0.3])
            for j, label in enumerate(labels):
                studies[-1][label] = int(label_vals[j])

        # Create synthetic DICOM series for each view
        for view in views:
            for series_name in planes_series[view]:
                series_uid = f"{study_uid}_{series_name}"
                series_dir = os.path.join(dicom_dir, study_uid, series_uid)
                os.makedirs(series_dir, exist_ok=True)

                # Create synthetic DICOM-like files (just numpy arrays saved as .dcm)
                n_slices = np.random.randint(15, 25)
                for slice_idx in range(n_slices):
                    # Create a minimal pydicom file
                    import pydicom
                    from pydicom.dataset import Dataset, FileDataset
                    from pydicom.uid import ExplicitVRLittleEndian
                    from pydicom.sequence import Sequence as PydicomSequence

                    file_path = os.path.join(series_dir, f"slice_{slice_idx:03d}.dcm")

                    file_meta = pydicom.Dataset()
                    file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.2"
                    file_meta.MediaStorageSOPInstanceUID = f"{series_uid}_{slice_idx}"
                    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian

                    ds = FileDataset(file_path, {}, file_meta=file_meta, preamble=b"\x00" * 128)
                    ds.SOPClassUID = "1.2.840.10008.5.1.4.1.1.2"
                    ds.SOPInstanceUID = f"{series_uid}_{slice_idx}"
                    ds.StudyInstanceUID = study_uid
                    ds.SeriesInstanceUID = series_uid

                    # Create synthetic pixel data
                    pixel_data = np.random.randint(0, 256, (128, 128), dtype=np.uint16)
                    ds.Rows = 128
                    ds.Columns = 128
                    ds.BitsAllocated = 16
                    ds.BitsStored = 16
                    ds.HighBit = 15
                    ds.SamplesPerPixel = 1
                    ds.PhotometricInterpretation = "MONOCHROME2"
                    ds.PixelRepresentation = 0
                    ds.PixelData = pixel_data.tobytes()

                    ds.save_as(file_path)

                # Add to series metadata
                series_rows.append({
                    "StudyInstanceUID": study_uid,
                    "SeriesInstanceUID": series_uid,
                    "Anatomical_Plane": view,
                    "Fluid_Sensitive": "STIR" in series_name or "T2" in series_name,
                    "Fat_Suppression": "STIR" in series_name or "fat" in series_name.lower(),
                })

    # Save CSVs
    train_df = pd.DataFrame(studies)
    series_df = pd.DataFrame(series_rows)

    train_csv_path = os.path.join(output_dir, "train.csv")
    series_csv_path = os.path.join(output_dir, "train_series.csv")

    train_df.to_csv(train_csv_path, index=False)
    series_df.to_csv(series_csv_path, index=False)

    print(f"Created synthetic data:")
    print(f"  {n_studies} studies ({n_labeled} labeled)")
    print(f"  {len(series_rows)} series")
    print(f"  Train CSV: {train_csv_path}")
    print(f"  Series CSV: {series_csv_path}")
    print(f"  DICOM dir: {dicom_dir}")

    return train_df, series_df


def run_sanity_check():
    """Run end-to-end sanity check on synthetic data."""
    print("=" * 60)
    print("SANITY CHECK: Pipeline end-to-end test")
    print("=" * 60)

    # Load config
    config_path = os.path.join(project_root, "configs", "default.yaml")
    with open(config_path) as f:
        config = yaml.safe_load(f)

    # Use smaller settings for sanity check
    config["training"]["batch_size"] = 2
    config["training"]["epochs"] = 2
    config["data_pipeline"]["num_workers"] = 0
    config["data_pipeline"]["target_size"] = [128, 128]  # Smaller for speed
    config["backbone"]["pretrained"] = False  # Don't download weights
    config["input_25d"]["num_slices"] = 2

    # Use existing synthetic data if available, otherwise create it
    print("\n1. Loading synthetic data...")
    synthetic_csv = os.path.join(project_root, "synthetic_data", "train.csv")
    synthetic_series_csv = os.path.join(project_root, "synthetic_data", "train_series.csv")
    if os.path.exists(synthetic_csv) and os.path.exists(synthetic_series_csv):
        train_df = pd.read_csv(synthetic_csv)
        series_df = pd.read_csv(synthetic_series_csv)
        print(f"  Loaded existing synthetic data: {len(train_df)} studies, {len(series_df)} series")
    else:
        train_df, series_df = create_synthetic_data(n_studies=20, n_labeled=10)

    # Test data loading
    print("\n2. Testing data loading...")
    from src.data.dataset import KneeMRIStudyDataset, collate_fn

    dataset = KneeMRIStudyDataset(
        train_df,
        series_df,
        labels=config["labels"],
        dicom_dir=os.path.join("synthetic_data", "train_series"),
        target_size=tuple(config["data_pipeline"]["target_size"]),
        slice_max=config["data_pipeline"]["slice_max"],
        num_slices_25d=config["input_25d"]["num_slices"],
        use_25d=config["input_25d"]["enabled"],
        is_train=True,
    )

    print(f"  Dataset length: {len(dataset)}")

    # Test single item loading
    print("\n3. Testing single item loading...")
    item = dataset[0]
    print(f"  Study views: {list(item['study'].keys())}")
    for view, tensor in item["study"].items():
        print(f"    {view}: {tensor.shape}")
    print(f"  Labels: {item['labels']}")
    print(f"  Has labels: {item['has_labels']}")
    print(f"  Report: {item['report'][:50]}...")

    # Test DataLoader
    print("\n4. Testing DataLoader...")
    from torch.utils.data import DataLoader
    loader = DataLoader(
        dataset,
        batch_size=2,
        shuffle=False,
        collate_fn=collate_fn,
        num_workers=0,
    )
    batch = next(iter(loader))
    print(f"  Batch studies: {len(batch['studies'])}")
    print(f"  Batch labels: {batch['labels'].shape}")
    print(f"  Batch has_labels: {batch['has_labels']}")

    # Test model creation
    print("\n5. Testing model creation...")
    from src.models.full_model import KneeMRIModel

    model = KneeMRIModel(
        backbone_name="convnext_small",
        out_dim=768,
        pretrained_backbone=False,
        num_labels=12,
        mil_hidden_dim=256,
        mil_per_label=True,
        fusion_dim=768,
        fusion_heads=8,
        fusion_layers=2,
        fusion_dropout=0.1,
        decoder_dim=768,
        decoder_heads=8,
        decoder_layers=1,
        decoder_dropout=0.1,
        use_text_branch=False,
    )

    total_params = sum(p.numel() for p in model.parameters())
    print(f"  Model parameters: {total_params:,}")

    # Test forward pass
    print("\n6. Testing forward pass...")
    device = torch.device("cpu")
    model = model.to(device)

    studies = batch["studies"]
    labels = batch["labels"].to(device)

    output = model(studies, labels=labels)
    print(f"  Logits shape: {output['logits'].shape}")
    print(f"  Fused shape: {output['fused'].shape}")

    # Test loss computation
    print("\n7. Testing loss computation...")
    from src.training.losses import get_loss_fn

    loss_fn = get_loss_fn("bce")
    loss = loss_fn(output["logits"], labels)
    print(f"  Loss: {loss.item():.4f}")

    # Test backward pass
    print("\n8. Testing backward pass...")
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    print("  Backward pass successful!")

    # Test evaluation
    print("\n9. Testing evaluation...")
    from src.training.finetune_supervised import evaluate

    val_metrics = evaluate(model, loader, config["labels"], device)
    print(f"  Val loss: {val_metrics['val_loss']:.4f}")
    print(f"  Macro AUC: {val_metrics['macro_auc']:.4f}")

    # Test splits
    print("\n10. Testing CV splits...")
    from src.data.splits import create_cv_splits

    splits = create_cv_splits(
        train_df,
        config["labels"],
        n_folds=5,
        seed=42,
        use_iterative_strat=False,  # Skip for small synthetic data
    )
    print(f"  Created {len(splits)} folds")
    for fold_idx, (train_idx, val_idx) in enumerate(splits):
        print(f"  Fold {fold_idx+1}: train={len(train_idx)}, val={len(val_idx)}")

    print("\n" + "=" * 60)
    print("SANITY CHECK PASSED!")
    print("Pipeline runs end-to-end without errors.")
    print("=" * 60)

    return True


if __name__ == "__main__":
    success = run_sanity_check()
    sys.exit(0 if success else 1)
