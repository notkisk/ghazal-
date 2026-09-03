> **IMPORTANT — PHASE 5 ONLY**
>
> This file is intentionally gated. It must NOT be opened, read, analyzed, or used during Phases 1–4 defined in `AGENT_INSTRUCTIONS.md`.
>
> It may only be accessed after the project's independent implementation and baseline have been established and Phase 5 has begun.
>
> The solutions listed here are research sources, not implementation instructions.

---

# External Kaggle Solutions — Research Index

## Selection Summary

8 external solutions selected. Diverse across: architecture design, weak labeling strategy, multimodal knowledge distillation, ensemble methodology, and critical evaluation analysis.

---

## 1. UnifiedTheory Code — DINO + Physical ALiBi

- **Author**: tomdifiore
- **URL**: https://www.kaggle.com/datasets/tomdifiore/rsna-knee-unifiedtheory-code
- **Public LB**: Not explicitly stated; described as a "serious leaderboard pipeline"
- **Approach**: Hierarchical pipeline — frozen DINOv2 feature extraction, physical-distance ALiBi aggregation, target-specific spatial patch queries, scanner-grouped folds, cached feature training, nested OOF ensemble blending. Escalation from frozen DINOv2-base through adapter fine-tuning to DINOv2-large and DINOv3.
- **Key techniques**: (1) Physical-distance ALiBi for slice aggregation (biasing attention by real DICOM slice spacing, not ordinal index), (2) target-specific 4x4 spatial patch queries so each label attends to different anatomy, (3) zero-initialized residual adapter in cached DINO token space for cheap fine-tuning, (4) scanner-grouped fold assignment that never splits a scanner group, (5) report-to-image distillation (predict frozen multilingual report embedding during training, inference is image-only).
- **Why investigate**: Most architecturally complete public solution. The physical ALiBi aggregation and target-specific patch queries are directly relevant to our MIL pooling design. The escalation strategy (frozen features → adapter → end-to-end) is a practical blueprint for our own training stages.

---

## 2. Label-Aware Multi-Series Attention (ConvNeXtV2)

- **Author**: leminhhung0101
- **URL**: https://huggingface.co/leminhhung0101/knee-model
- **Public LB**: Not stated (inference-focused, standalone `infer_folder.py`)
- **Approach**: ConvNeXtV2-Tiny backbone with 2.5D clips, label-aware multi-series attention (12 learned queries, one per label, attending over all clips with metadata-aware key/value projections), label token transformer (2-layer, 8-head encoder letting labels exchange information), vectorized parallel label heads. Domain-knowledge soft priors (PLANE_PRIOR, FLUID_PRIOR, FAT_PRIOR) as additive attention bias. Robust Asymmetric Loss with per-label negative focusing and pairwise ranking loss.
- **Key techniques**: (1) Per-label attention queries with metadata embedding (plane/fluid/fat) on keys, (2) fixed domain-knowledge priors as soft attention bias (not hard filter), (3) label token transformer for inter-label information exchange (effusion+synovitis co-occurrence, ACL+contusion), (4) vectorized label heads via einsum instead of ModuleList, (5) DICOM mmap cache with uint8 quantization for memory efficiency.
- **Why investigate**: Clean, well-documented architecture that closely mirrors our project plan's label-attention decoder concept. The domain-knowledge priors and label token transformer are directly applicable. The vectorized implementation is worth noting for efficiency.

---

## 3. Text-Guided Knowledge Distillation Pipeline

- **Author**: hoangtung386
- **URL**: https://github.com/hoangtung386/RSNA-Knee-Challenge
- **Public LB**: Not stated
- **Approach**: Three-stage pipeline — (S1) SAM ROI masking + VLM-based weak label extraction + 3DINO-ViT teacher feature extraction + VLM guidance generation, (S2) knowledge distillation from DINO-3D teacher and Gemma VLM into a 3D ViT student, (S3) CAM-based explainability. Only 58/4407 studies have gold labels; all 4407 have reports. Inference uses only image (no text).
- **Key techniques**: (1) VLM (Gemma) for weak label extraction from multilingual reports, (2) 3D DINO-ViT as teacher for feature-level knowledge distillation, (3) SAM for ROI masking to focus attention on anatomically relevant regions, (4) text-guided visual guidance during training only, (5) end-to-end pipeline with 220 tests and CI.
- **Why investigate**: Most ambitious multimodal approach. The VLM-based weak labeling (handling multilingual reports) is directly relevant to our §4.1b plan. The knowledge distillation from a frozen teacher into an image-only student mirrors our contrastive pretraining concept (train with text, inference without). The SAM ROI masking is an interesting preprocessing idea.

---

## 4. Multilingual NLI Weak Labels

- **Author**: nekkon
- **URL**: https://www.kaggle.com/code/nekkon/weak-labels-for-all-12-knee-mri-findings
- **Public LB**: N/A (dataset/notebook, not a model)
- **Approach**: Uses `MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7` to extract per-finding entailment scores from multilingual reports. Each report is split into sentences, each sentence is paired with an English hypothesis per finding (e.g. "The medial meniscus is torn."), scored on entail-vs-contradict axis, max-pooled across sentences per study. Reports are in 7 languages; hypotheses are always English.
- **Key techniques**: (1) Cross-lingual NLI model for multilingual report labeling without translation, (2) sentence-level hypothesis testing with max pooling, (3) per-finding accuracy measurement against 58 gold studies (mean AUC 0.727 vs 0.672 for keyword matcher), (4) careful analysis of which findings are recoverable (named objects like Baker's cyst: 0.82 balanced accuracy; graded severities like effusion: fail; unstated inferences like fracture: 0.44 sensitivity).
- **Why investigate**: Directly addresses our §4.2 challenge of multilingual report encoding. The NLI approach is an alternative to CheXbert-style labelers for multilingual data. The per-finding recoverability analysis is essential for understanding silver label quality limits. This dataset is also used as a third opinion in other solutions' label fusion.

---

## 5. 18th Place Walkthrough — DICOM Pipeline + LLM Labels + MIL

- **Author**: bishnoiyash (HuggingFace blog)
- **URL**: https://huggingface.co/blog/bishnoiyash/rsna-competetion
- **Public LB**: 0.903 (rank 18 of 792, top 2.3%)
- **Approach**: End-to-end pipeline — DICOM preprocessing with left/right orientation safety, LLM-based report label extractor with multi-source fusion (primary extractor + cross-check model + third-party dataset), multi-instance learning image model with per-finding attention pooling. Labels from 4,349 unlabeled studies are derived from reports. The 58 gold studies are used only for validation, not training.
- **Key techniques**: (1) Label fusion from multiple independently trained extractors with per-class reliability weighting, (2) careful handling of the validation bug (int() truncation in label fusion, leaked gold58 metric), (3) honest cross-fitted gold58 AUC reporting, (4) the insight that "the label extractor's accuracy ceiling (~0.83 mean per-class agreement) is probably close to the real limiting factor — pushing further on image-model architecture alone will run into that ceiling."
- **Why investigate**: The honest discussion of label quality as the bottleneck is the most important meta-insight in the public solutions. The multi-source label fusion approach (primary + cross-check + third-party) is a practical pattern for our §4.1b silver labeling. The validation bug story is a cautionary tale about metric leakage.

---

## 6. Raptor Series — High-Score DINOv2 Notebooks

- **Author**: hdhsjdjd
- **URL**: https://www.kaggle.com/code/hdhsjdjd/rsna-knee-raptor-v45-w065
- **Public LB**: 0.935 (v45-w065, quad-w065), 0.934 (v45, v5), 0.933 (coatnet)
- **Approach**: Series of iterative notebooks using DINOv2 as the primary backbone with attention-based MIL pooling. Multiple variants explore backbone choices (DINOv2, CoAtNet), corpus sampling strategies ("Max-Span Dense Corpus", "Fine Spacing Corpus"), and training configurations. Uses external datasets for pretraining assets.
- **Key techniques**: (1) DINOv2 as primary backbone with public model hosting on Kaggle, (2) attention-based slice pooling with per-finding heads, (3) diverse corpus sampling strategies (max-span dense vs fine-spacing), (4) iterative refinement across many notebook versions, (5) efficient submission workflow for the 9-hour code competition constraint.
- **Why investigate**: Highest public scores in the competition. The corpus sampling strategy evolution (worth 0.006–0.011 per the raptor-knee-arms analysis) is more impactful than backbone choice. Demonstrates that data pipeline quality matters more than model architecture for this task. The iterative versioning is a practical reference for our own experiment tracking.

---

## 7. Triple-Backbone Ensemble Analysis

- **Author**: dreaddevelopment
- **URL**: https://www.kaggle.com/datasets/dreaddevelopment/raptor-knee-arms
- **Public LB**: 0.915 (ensemble), 0.914 (CoAtNet alone)
- **Approach**: Three separately trained backbones (ConvNeXtV2-Base at 336, CoAtNet at 384, EfficientNetV2-L at 480) with identical 2.5D window scheme and per-finding attention pooling. Blended by rank-mean. Key finding: three diverse backbones at 3x inference cost bought only ~0.001 improvement, while changing corpus sampling strategy was worth 0.006–0.011.
- **Key techniques**: (1) Rank-mean ensemble blending for macro AUC, (2) controlled comparison showing data pipeline > model architecture, (3) identical pooling/head design across diverse backbones for fair comparison.
- **Why investigate**: The empirical demonstration that "data is roughly three times the lever the model is, and it is free at inference" is the most important practical finding for our project. Directly validates investing in preprocessing, corpus sampling, and weak labeling over architectural complexity. The rank-mean ensemble approach is simple and effective for the macro AUC metric.

---

## 8. Gold-Label Limitations Analysis

- **Author**: (Kaggle discussion, author not extracted)
- **URL**: https://www.kaggle.com/competitions/rsna-knee-abnormality-detection/discussion/733876
- **Public LB**: N/A (analysis, not a model)
- **Approach**: Rigorous statistical analysis of what the 58 gold-labeled studies can and cannot tell you. Key findings: paired sigma of macro-AUC comparison on 58 studies is 0.0125; a model truly 0.01 better wins CV only 78% of the time; only past 0.02 does comparison become reliable (94%). The 58 studies are enriched ~1.53x for findings vs the full 4,407. The three rarest findings contribute 25% of weight but 37.6% of noise.
- **Key techniques**: (1) Bootstrap simulation of head-to-head model comparisons on 58 studies, (2) measurement of per-finding enrichment in gold set vs full corpus, (3) recommendation to rank models on weak labels over all 4,407 reports and keep 58 for calibration only, (4) analysis of how correlation between models affects comparison power.
- **Why investigate**: Essential meta-analysis for understanding our own validation. Directly impacts how we should interpret CV results, when to trust local validation vs public LB, and how to design experiments that are actually distinguishable on 58 gold studies. Should be read before any model comparison is declared meaningful.

---

## Gaps in Public Solutions

1. **Contrastive pretraining (CLIP-style)**: No public solution uses the exact image-report contrastive pretraining approach described in our project plan. The UnifiedTheory code has report distillation, and the knowledge distillation pipeline uses VLM guidance, but neither is a pure CLIP-style contrastive stage. This remains an unexplored direction in the public ecosystem.

2. **Ensembling beyond 2–3 models**: Most solutions use 1–3 backbone variants. Larger ensembles with architectural diversity (e.g. CNN + ViT + hybrid) are underexplored, likely due to the 9-hour inference constraint.

3. **Test-time augmentation (TTA)**: Minimal public discussion of TTA strategies for this competition. Given the 3D nature of MRI data and the code competition runtime constraint, TTA is a potentially underexploited area.

4. **Multi-label loss function comparison**: No systematic comparison of focal loss vs ASL vs BCE vs combinations for this specific label distribution. Most solutions pick one loss without ablation.
