# RSNA Knee Abnormality Detection

## Competition

This project participates in the Kaggle competition:

https://www.kaggle.com/competitions/rsna-knee-abnormality-detection

The goal is to predict the presence and severity of 12 knee abnormalities from knee MRI examinations.

**Two tracks:**
- **Main Leaderboard** — top 10 paid; purely predictive performance (macro-averaged ROC-AUC).
- **Efficiency Track** — score combines predictive performance *and* inference runtime. A design that's accurate but slow is a worse outcome than one that's slightly less accurate but fast.

**Timeline:** entry/team deadline Oct 15 2026, final submission Oct 22 2026. Winners must open-source code, weights, and a video walkthrough — the solution needs to be defensible and reproducible.

## Prediction Targets

The model predicts 12 targets:

1. ACL tear
2. MCL tear
3. Medial Meniscus tear
4. Lateral Meniscus tear
5. Medial Osteoarthritis
6. Lateral Osteoarthritis
7. Patellofemoral Osteoarthritis
8. Effusion
9. Synovitis
10. Baker's cyst
11. Contusion
12. Fracture

The exact target names and label definitions should be verified against the official competition data and documentation before implementation. The 12 label column names in the data are: `ACL`, `MCL`, `Medial_Meniscus`, `Lateral_Meniscus`, `Medial_OA`, `Lateral_OA`, `PF_OA`, `Effusion`, `Synovitis`, `Bakers`, `Contusion`, `Fracture`.

## Input Data

The competition provides multimodal information from knee examinations:

- **MRI series** — DICOM series under `train_series/<StudyInstanceUID>/<SeriesInstanceUID>/<SOPInstanceUID>.dcm`, one file per slice, multiple series per study (one per plane/sequence combination). Series typically run 20–45 slices (median ~30) but with a long tail out to a few hundred.
- **Radiology reports** — textual reports associated with the examinations. Reports may be in any of several languages depending on the reporting institution (multilingual).
- **Series metadata** — `train_series.csv` / `test_series.csv` provide `Fluid_Sensitive`, `Fat_Suppression`, and `Anatomical_Plane` (Sagittal/Coronal/Axial) per series for both train and test. These are provided, not inferred. The two flags are "often correlated but not necessarily equivalent" and should be treated as two independent bits.

### Critical: Report leakage and semi-supervised nature

- **Reports are NOT available at test time.** The competition's data description confirms the `Report` field is withheld at test time. Using report text as a model input at inference is not just risky — it's impossible. Reports can only be used during **training time** (e.g., contrastive pretraining to shape the image encoder).
- **Labels are sparse, reports are not.** Only a small subset of training studies carry per-condition labels; the rest have a `Report` but no (or partial) label vector. This is a **semi-supervised** problem. The contrastive pretraining stage trains on the full dataset (all studies have reports), while supervised fine-tuning is bottlenecked by the small labeled subset. Weak/silver labeling from reports is a key strategy for the unlabeled majority.

## Evaluation Metric

The primary evaluation metric is **macro-averaged ROC-AUC** across the 12 prediction targets. Every label counts equally regardless of prevalence — rare labels (e.g., fracture) matter as much as common ones (e.g., effusion).

The model should therefore produce a probability prediction for each of the 12 targets. Performance should be evaluated both overall and, where useful, separately for individual targets (per-label AUC per fold).

## Submission Format

A submission must contain predictions for the required test examinations in the format specified by the official Kaggle competition.

The submission should include:

- The required identifier for each test examination.
- One prediction probability for each of the 12 target variables.

The exact column names, ordering, and submission schema must be taken from the official competition files rather than assumed. The output must be `submission.csv`.

## Runtime and Submission Constraints

Kaggle submissions must respect the competition's execution constraints:

- **Maximum runtime:** 9 hours on GPU.
- **Internet access:** Disabled during submission execution.

Therefore, the final inference/training pipeline must be self-contained and must not depend on downloading models, datasets, packages, or other resources from the internet during the Kaggle submission.

Any pretrained models or external resources required by the final pipeline must be made available within the permitted Kaggle environment before execution. Freely available pretrained weights are allowed per the rules.

## Ground-Truth Instructions for the Agent

This file provides the basic competition context and constraints.

The competition documentation and data provided by Kaggle are the authoritative source for competition-specific details. Do not infer or invent dataset properties, target definitions, submission columns, or runtime rules when they can be verified from the official competition materials.

This README is context, not the project's research strategy.

The project's primary methodology and experimental direction should come from the project plan (`research/project_plan.md`). Published Kaggle notebooks and high-scoring solutions should be treated as later sources of ideas and hypotheses, not as the default implementation to reproduce.

Before implementing models, the agent should:

1. Understand the competition and dataset structure.
2. Read and follow the project's research plan.
3. Establish the project's own baseline.
4. Validate the pipeline locally before expensive Kaggle runs.
5. Only afterward investigate published solutions for potentially useful ideas.
6. Test imported ideas experimentally rather than assuming that a high Kaggle score means they will improve the project's results.
