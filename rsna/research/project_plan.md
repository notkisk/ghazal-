# Multimodal Knee MRI Abnormality Detection — Architecture Draft

## 1. What this competition is

This is an RSNA-hosted Kaggle challenge (the first "RSNA AI Challenge" of its kind) focused on knee MRI. The task: given a knee MRI study, predict confidence scores for **12 clinically important abnormalities**:

`ACL, MCL, Medial Meniscus, Lateral Meniscus, Medial OA, Lateral OA, PF OA, Effusion, Synovitis, Baker's, Contusion, Fracture`

Key facts that shape every design decision below:

- **Metric**: macro-averaged AUC-ROC across the 12 labels. Every label counts equally regardless of prevalence — rare labels (e.g. fracture) matter as much as common ones (e.g. effusion), so per-label performance, not just overall accuracy, is what wins.
- **Dataset differentiator**: every imaging study is paired with its original radiology report. This is new for this kind of competition and is almost certainly the intended "unlock" — a pure-vision model is leaving information on the table.
- **This is a code competition**: submissions run as Notebooks, CPU/GPU runtime capped at 9 hours, no internet access during scoring, output must be `submission.csv`. This constrains model size/ensemble size more than a typical "just submit a CSV" competition.
- **Two tracks**: Main Leaderboard (top 10 paid, we're targeting this) and an **Efficiency Track** (score combines predictive performance *and* inference runtime). A design that's accurate but slow is a worse overall outcome than a design that's slightly less accurate but fast — so efficiency is a first-class constraint, not an afterthought.
- **Timeline**: entry/team deadline Oct 15 2026, final submission Oct 22 2026. That's roughly 8 weeks from the point of writing this. Winners must open-source code, weights, and a video walkthrough — so the solution needs to be defensible and reproducible, not just a lucky seed.
- **Data leakage risk specific to this dataset**: the radiology report essentially *contains the diagnosis*. The competition's own data description confirms the `Report` field is withheld at test time, so using it naively at inference is not just risky, it's literally impossible. This is the reason the architecture below treats text as a **training-time-only signal**, never a runtime input.
- **Labels are sparse, reports are not**: per the data description, "only a small subset of training studies carry per-condition labels" — every study has a `Report`, but most rows likely have missing/absent values in the 12 label columns. This is a **semi-supervised** problem, not a fully-supervised one, and changes the training plan (see §4.1b).
- **Reports are multilingual**: "may be in any of several languages, depending on the reporting institution." A monolingual clinical English encoder (e.g. plain BioClinicalBERT) is the wrong default here.
- **Series-level plane/sequence metadata is provided, not something to infer**: `train_series.csv`/`test_series.csv` ship `Fluid_Sensitive`, `Fat_Suppression`, and `Anatomical_Plane` per series for both train *and* test. The "classify plane from messy `SeriesDescription`" problem the architecture originally treated as an open engineering task is largely solved by the organizers.

## 2. Core design decision (recap, why it drives everything)

We cannot feed the report to the model at inference. So the report's value has to be extracted *before* inference and baked into the image encoder's weights. Concretely: use the paired (image, report) data to run a **contrastive pretraining stage** (CLIP-style) that pulls image embeddings toward their matching report embeddings and pushes them away from mismatched ones. This teaches the image backbone to represent the clinically relevant structure a radiologist would write about — tear morphology, effusion size, cartilage signal — even though at test time only the image is available.

Everything downstream (per-view pooling, fusion, label heads) operates on image-only features. This keeps the inference-time compute path lean, which also helps directly with the Efficiency Track.

## 3. Architecture overview

```
[Reports] --text encoder--\
                            >-- contrastive loss --> shapes -->  [Shared per-slice backbone]
[Images]  --image encoder--/        (train-time only)                     |
                                                                            v
                                                        [Per-view attention MIL pooling]
                                                        (sagittal / coronal / axial, shared weights)
                                                                            |
                                                                            v
                                                        [Cross-view fusion transformer]
                                                                            |
                                                                            v
                                                        [Label-attention decoder]
                                                                            |
                                                                            v
                                                        [12 per-label confidence scores]
```

Design rationale per block (condensed from earlier discussion — see below for implementation):

| Block                          | Why this, not the alternative                                |
| ------------------------------ | ------------------------------------------------------------ |
| Contrastive pretraining        | Extracts value from the report without needing it at inference. Alternative (feeding report text as a model input) is not deployable and risks leakage. |
| Shared per-slice backbone      | One set of weights across sagittal/coronal/axial instead of 3 separate backbones. More training signal per parameter given a moderate-sized dataset; cheaper at inference (helps Efficiency Track). |
| Attention MIL pooling per view | A study can have 20–40 slices; an abnormality (e.g. a small meniscal tear) may only show on 2–3. Naive average/max pooling dilutes or overreacts. Attention pooling learns which slices matter and gives a usable "where did the model look" signal for debugging. Alternative (full 3D CNN) wastes compute on the anisotropic, low-information through-plane axis. |
| Cross-view fusion transformer  | Different labels are best seen on different planes/sequences (ACL on sagittal, cartilage/OA grading on coronal/axial fat-sat, Baker's cyst on axial/sagittal T2). Self-attention lets the model learn this instead of hand-coding it, and degrades gracefully if a sequence is missing or motion-corrupted. Alternative (concatenation) breaks when a view is missing and can't reweight per label. |
| Label-attention decoder        | 12 labels are clinically correlated (effusion + synovitis, contusion + fracture). A shared decoder with one query per label lets rare/hard labels borrow statistical strength from correlated common ones — this is where marginal macro-AUC gains tend to hide. Alternative (12 independent heads) treats labels as unrelated and wastes signal. |

## 4. Implementation details, step by step

### 4.1 Data pipeline

- **Source format**: confirmed — DICOM series under `train_series/<StudyInstanceUID>/<SeriesInstanceUID>/<SOPInstanceUID>.dcm`, one file per slice, multiple series per study (one per plane/sequence combination).
- **Series classification is a lookup, not a modeling task**: `train_series.csv` / `test_series.csv` already provide `Fluid_Sensitive`, `Fat_Suppression`, and `Anatomical_Plane` (Sagittal/Coronal/Axial) per series, for train *and* test. Use these directly to bucket series into views instead of building a plane classifier or parsing `SeriesDescription`. Note the two flags are "often correlated... but not necessarily equivalent" per the data description, so treat them as two independent bits (e.g. a fat-sat-but-not-fluid-sensitive sequence is still informative) rather than collapsing them into one "STIR-like" category. Keep a fallback plane-from-`ImageOrientationPatient` check as a sanity/QA tool only, in case a handful of series have inconsistent or missing metadata — it's no longer core-path work.
- **DICOM decoding**: series arrive in a mix of transfer syntaxes (uncompressed Explicit VR LE, Implicit VR LE, JPEG Lossless, JPEG 2000). Confirm the decode stack (`pydicom` + a compressed-syntax handler such as `gdcm` or `pylibjpeg`) handles all four before assuming a plain `pydicom.dcmread` will work on every file — this is worth pressure-testing on a sample of series up front, since a silent decode failure would masquerade as a missing series rather than an error.
- **Slice preprocessing**: windowing/normalization per sequence type (T1 vs T2 vs PD vs fat-sat have different intensity distributions — do not apply one global normalization). Resample in-plane resolution to a fixed size (e.g. 384×384) per view; keep slice count variable (that's what MIL pooling is for). Per the data description, series typically run 20–45 slices (median ~30) but with a long tail out to a few hundred — size any padding/truncation and memory budgeting around that tail, not just the median, or a handful of studies will silently OOM or get truncated hard.
- **Study-level bundle**: each training example is a `dict` of `{view_name: tensor[num_slices, H, W]}` plus (for the labeled subset) the label vector, plus the report text (present for effectively all training studies, not just the labeled ones — see §4.1b).
- **Grouping key for CV**: the provided files only expose `StudyInstanceUID` — there is no `PatientID` column in `train.csv` or `train_series.csv`. This isn't something to "confirm before building folds" anymore; it's confirmed absent. Group folds by `StudyInstanceUID` (the only key available), but treat the possibility of one patient contributing multiple studies as an acknowledged, unverifiable residual leakage risk rather than a checkable one — there's no field to check it against.

### 4.1b Label availability: this is semi-supervised, not fully supervised

- Only a small subset of training studies carry the 12 ground-truth labels; the rest have a `Report` but no (or partial) label vector. Two consequences that weren't in the original plan:
  - **Contrastive pretraining (§4.2) needs no labels at all** — it only needs (image, report) pairs, which is effectively the *entire* training set. This is actually a stronger argument for the pretraining stage than before: it's the one component that fully exploits the unlabeled-but-reported majority, while every other component downstream is bottlenecked by the small labeled subset.
  - **Supervised fine-tuning (§4.3–4.6) needs an explicit decision** on what to do with the unlabeled majority. Two non-exclusive options:
    1. **Weak/silver labeling**: run a report-to-label extraction step (rule-based negation-aware phrase matching, or an LLM-based labeler in the style of CheXpert/CheXbert) on the reports of the unlabeled studies to derive noisy pseudo-labels, then train on gold + silver labels with either a sample weight down-weighting silver examples or a two-stage fine-tune (pretrain heads on silver, finish on gold-only).
    2. **Gold-only fine-tuning**: fine-tune only on the small labeled subset, accepting a much smaller effective training set for the supervised stage but avoiding label noise entirely.
  - Given multi-label macro-AUC with several rare labels (fracture, contusion), option 1 is worth prioritizing as the default hypothesis — a rare label with a handful of gold positives is unlikely to generalize — but it must be validated: hold out a portion of the *gold*-labeled studies as a clean validation set and check whether adding silver-labeled data actually improves per-label AUC there, rather than assuming it does.
  - The report labeler must handle the multilingual reports (see §4.2) — a labeler tuned only on English phrasing will silently fail on non-English institutions' reports, producing systematically biased silver labels by site.

### 4.2 Contrastive pretraining stage (train-time only)

- **Text encoder**: a plain BioClinicalBERT-family checkpoint is English-only and the data description confirms reports "may be in any of several languages, depending on the reporting institution" — so this needs revisiting. Reasonable options: (a) a multilingual clinical/biomedical checkpoint if one exists with adequate coverage of the languages actually present in the data, (b) a strong general-purpose multilingual sentence encoder as a fallback if no multilingual clinical model is good enough, or (c) a machine-translation-to-English pre-step feeding the English clinical encoder — simplest to implement but adds a failure mode (translation errors distorting the embedding target) and a runtime cost that's irrelevant at inference but still relevant to pretraining-stage compute budget. Whichever is chosen, check the actual language distribution in the training reports (a quick language-ID pass) before picking a checkpoint, rather than assuming English dominates.
- **Image side**: pool per-study slices into a single embedding using the *same* attention-MIL + fusion stack described below (so the pretraining stage trains the exact modules you'll use downstream, not a throwaway proxy network).
- **Loss**: symmetric InfoNCE / CLIP loss between the pooled image embedding and the report embedding, with in-batch negatives. Batch size matters a lot for contrastive quality — if GPU memory forces small batches, consider a memory bank or gradient-cached contrastive loss (e.g. GradCache) rather than shrinking the effective negative pool.
- **Report leakage caveat for THIS stage**: it's fine and expected that report text closely mirrors the labels — that's the whole point during pretraining. The leakage concern only applies to *inference*. Just make sure the report text used in contrastive pretraining comes only from the training split's reports, never validation/test.
- **After pretraining**: discard the text encoder entirely. Keep the image backbone + pooling weights as initialization for supervised fine-tuning (stage 4.3–4.5).

### 4.3 Shared per-slice backbone

- Candidate backbones: a ConvNeXt-family CNN and a DINOv2-initialized ViT — plan to train both, since they'll be your ensemble pair later (see 4.6).
- Input: single slice or small 2.5D stack (e.g. 3 adjacent slices as channels) — 2.5D usually gives a small but consistent bump over pure 2D by giving the model a little through-plane context, at negligible extra cost.
- Weight sharing: identical backbone weights process all views. Don't add per-view-specific backbone layers unless later ablation shows a real gain — it multiplies your parameter count and training data requirement for a small dataset.

### 4.4 Attention MIL pooling (per view)

- Standard gated attention MIL (Ilse et al. style): each slice embedding gets a scalar attention weight via a small MLP; view embedding = weighted sum of slice embeddings.
- Implement attention weights as **per-label**, not a single shared attention vector, if compute allows — different labels genuinely need to look at different slices within the same series (e.g. a Baker's cyst is posterior, a patellar cartilage lesion is anterior, both in the same sagittal series). If per-label attention is too expensive for the 9-hour inference budget, a shared attention vector is an acceptable fallback — just note it as a known simplification.
- Keep the raw attention weights around (even if not used downstream) — they're your main debugging tool when a validation fold behaves unexpectedly.

### 4.5 Cross-view fusion + label-attention decoder

- Fusion: a small transformer encoder (2–4 layers is plenty; this is not a stage that needs depth) over the 3 (or more, if you keep sequences separate rather than views) per-view embeddings, with a learned "missing view" token substituted when a study lacks a given plane.
- Label-attention decoder: one learned query embedding per label, cross-attending into the fused view embeddings, output through a per-label linear classifier. This is the ML-Decoder pattern — cheap, and empirically strong on structured multi-label problems.

### 4.6 Loss functions

- Per-label binary cross-entropy, summed or averaged across the 12 heads.
- Consider **focal loss** for labels with low prevalence (fracture, contusion likely) to stop the easy majority class from dominating gradient — but validate this per label on your CV folds rather than applying it uniformly; focal loss can also slightly hurt calibration, which matters since AUC doesn't care about calibration but a downstream ensemble blending step does.
- No need for the contrastive loss after stage 4.2 finishes — it's a pretraining objective, not part of the fine-tuning loss.

### 4.7 Cross-validation strategy

- GroupKFold (5-fold is a reasonable default) grouped by patient/study to prevent leakage.
- Because this is multi-label with 12 heads of differing prevalence, plain GroupKFold can produce folds with very few positives for a rare label. Use **iterative stratification for multi-label data** (e.g. scikit-multilearn's `IterativeStratification`) combined with the grouping constraint, or at minimum check per-fold positive counts for every label before trusting the split.
- Track per-label AUC on every fold, not just the macro average — a model can look fine on average while being near-random on one or two rare labels, and that's invisible unless you look.

### 4.8 Ensembling and calibration

- Train the ConvNeXt-family and DINOv2-family backbones independently through the full pipeline (pretraining → fine-tuning), then average or rank-average their out-of-fold predictions per label.
- Per-label calibration (Platt scaling or isotonic regression) fit on out-of-fold predictions before blending — AUC is rank-based so calibration doesn't change your own AUC, but it does change how well a simple average of two differently-calibrated models behaves, so calibrate before you blend, not after.
- Keep a lean single-backbone submission ready as a separate artifact for the Efficiency Track, since it explicitly rewards a good performance-to-runtime ratio, which an averaged 2-model ensemble will not win outright.

## 5. Code design

Suggested repo layout:

```
knee_mri/
  config/
    default.yaml          # all hyperparameters, paths, fold seed
  data/
    dicom_utils.py         # windowing, normalization, transfer-syntax decoding; plane comes from train/test_series.csv, not inferred
    report_labeler.py       # rule-based or LLM-based weak-label extraction from Report text (multilingual), for the unlabeled majority
    dataset.py              # StudyDataset: returns {view: tensor[N,H,W]}, labels (gold or silver), report(train-only)
    splits.py                 # GroupKFold (by StudyInstanceUID; no PatientID available) + iterative multilabel stratification
  models/
    backbone.py               # shared per-slice encoder wrapper (ConvNeXt / DINOv2)
    mil_pooling.py              # gated attention MIL, per-label or shared
    fusion.py                     # cross-view transformer fusion block
    label_decoder.py               # ML-Decoder-style label-attention head
    text_encoder.py                  # clinical BERT wrapper, train-time only
    full_model.py                     # composes backbone + pooling + fusion + decoder
  train/
    pretrain_contrastive.py            # stage 4.2
    finetune_supervised.py              # stage 4.3-4.6
    losses.py                             # BCE, focal loss, InfoNCE
  eval/
    cv_report.py                          # per-fold, per-label AUC breakdown
    calibration.py                          # Platt/isotonic fit on OOF preds
  inference/
    predict.py                                # image-only path, loads finetuned weights only
    ensemble.py                                 # blend + calibrate multiple model outputs
  submission_notebook.ipynb                       # the actual Kaggle Code Competition entry point
```

Key interface sketch (`full_model.py`):

```python
class KneeMRIModel(nn.Module):
    def __init__(self, backbone, use_text_branch=False):
        super().__init__()
        self.backbone = backbone                     # shared across views
        self.pooling = {v: AttentionMIL(...) for v in VIEWS}
        self.fusion = CrossViewTransformer(...)
        self.decoder = LabelAttentionDecoder(num_labels=12)
        self.text_encoder = ClinicalTextEncoder(...) if use_text_branch else None

    def encode_image(self, study):
        # study: dict[view] -> tensor[N_slices, C, H, W]
        view_embeddings = {}
        for view, slices in study.items():
            slice_feats = self.backbone(slices)          # [N_slices, D]
            view_embeddings[view] = self.pooling[view](slice_feats)  # [D]
        fused = self.fusion(view_embeddings)              # [D]
        return fused

    def forward(self, study, report=None):
        fused = self.encode_image(study)
        logits = self.decoder(fused)                       # [12]
        if self.text_encoder is not None and report is not None:
            text_emb = self.text_encoder(report)
            return logits, fused, text_emb                    # for contrastive loss
        return logits
```

The important discipline here for whoever (human or agent) implements this: **`predict.py` must only ever import the image path.** Don't let `text_encoder` leak into the inference module even as an unused import — it's an easy way to accidentally ship a checkpoint that expects text, or to blow the runtime/memory budget loading a language model you don't need at inference.

## 6. Potential problems and mitigations

| Problem                                                      | Mitigation                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| Missing/nonstandard series per study (not every study has all 3 planes, or has extra sequences) | Learned "missing view" token in fusion; never assume a fixed view count at data-loading time. |
| Only a small subset of studies have gold labels              | Weak-label the unlabeled majority from reports (§4.1b); validate on a gold-only holdout that silver labels actually help per-label AUC before trusting them. |
| Small positive counts for rare labels (fracture, contusion) blowing up fold-to-fold variance | Iterative multilabel stratification; report per-label AUC per fold, not just macro; consider focal loss but validate its effect per label. |
| Report-derived weak labeler mis-fires on non-English reports | Check language distribution up front; use a multilingual labeler/encoder rather than one tuned on English phrasing only; spot-check silver labels per language against a few manually reviewed reports. |
| Contrastive pretraining underperforms with small batch size (limited GPU) | GradCache / memory-bank contrastive loss instead of shrinking negatives. |
| 9-hour inference runtime cap with per-label attention MIL + 2-model ensemble, ~1,300 private-test studies | Profile per-study inference time on the example test set early and extrapolate to ~1,300 studies; keep a single-backbone fallback config; per-label attention is the first thing to simplify to shared attention if runtime is tight. |
| Public/private leaderboard shakeup, and label prevalence explicitly not guaranteed to match across train/public/private splits | Trust grouped CV over public LB; avoid tuning against public LB score once local CV is stable; don't over-index on train-set prevalence when setting decision thresholds or loss weighting. |
| Report text distribution shift between institutions (multi-site, multilingual data) | Keep contrastive pretraining strictly on train split; don't let institution-specific phrasing or language leak into validation assumptions. |
| Mixed DICOM transfer syntaxes (JPEG Lossless, JPEG2000, Implicit/Explicit VR LE) causing silent decode failures | Pressure-test the decode stack against a sample from each transfer syntax before trusting bulk loading; a decode failure can look like a missing series rather than an error. |
| Patient-level leakage across folds                           | No `PatientID` field is provided, so this can't be checked directly — group by `StudyInstanceUID` (the only available key) and treat cross-study patient overlap as an accepted, unverifiable residual risk rather than something to "confirm." |

## 7. Tricks, hacks, and things to sanity-check before trusting them

- **Contrastive pretraining is more valuable than originally framed, not less**: since only a small subset of studies have gold labels but essentially all of them have a report, the contrastive stage is the one part of the pipeline that trains on the full dataset. Don't shrink its priority relative to supervised fine-tuning just because it's "just pretraining" — for this dataset it's arguably the highest-leverage use of the majority of the data you have.
- **Per-label attention over shared attention**, per-label decoder over independent heads: legitimate architectural choices, not hacks — worth doing if runtime allows.
- **Targeted mild overfitting to the label set** (contributor's idea, flagged by them as unverified — treating it as a hypothesis to test on CV, not a default): since the task is to detect these 12 *specific* named abnormalities rather than "any anomaly," it may be worth letting the model specialize somewhat tightly to the visual signatures of exactly these 12 conditions — e.g. shaping augmentation, hard-negative mining, and even some architectural priors (like which slices/regions the attention mechanism is nudged toward) around what's diagnostically distinctive for *these* labels specifically, rather than optimizing for a more general-purpose "abnormality detector." The logic: a narrower target might tolerate a bit more specialization than a fully general OOD-robust model would. This is speculative — the obvious risk is that it trades general robustness for leaderboard-specific performance, which could backfire on the private test split if it has a different label mix or presentation of the same conditions than what you tuned against. Test it explicitly as an ablation against a more general baseline on your own CV before trusting it, and don't let it replace the "check per-label AUC on held-out folds" discipline above.
- **Efficiency score is `(metric_gap) × (runtime)`-shaped** (per the competition's own formula) — a small AUC sacrifice for a large runtime win can be a net positive on that track. Explicitly compute the tradeoff rather than assuming "more accurate is always better" once the Efficiency Track is in scope.
- **Freely available pretrained weights are allowed** per the rules — use them aggressively for both the image backbone and the clinical text encoder rather than training either from scratch; the competition's own code requirements explicitly permit this and there's limited value in refusing free compute savings.
- **Winners' obligations** include open-sourcing code/weights and a video — write the code with that end-state in mind from day one (clean configs, no hardcoded local paths, a runnable `submission_notebook.ipynb`) rather than retrofitting it after a potential placement, since that retrofit under deadline pressure is a common way to lose a placement on a technicality.

## 8. Notes for whoever (or whatever agent) implements this next

- Build order matters more than architectural completeness under an 8-week clock: (1) data pipeline using the provided series metadata directly (no plane classifier needed) + a single-view 2.5D baseline with attention pooling on the gold-labeled subset, validated end-to-end on grouped CV; (2) add cross-view fusion; (3) add the label-attention decoder; (4) build and validate the report weak-labeler, and re-run the supervised stage on gold+silver labels to check it actually helps per-label AUC on a gold-only holdout; (5) only then invest in contrastive pretraining, since it's the most engineering-heavy piece and needs a stable downstream pipeline to evaluate against — note it can start training on the full dataset (including unlabeled studies) as soon as the pooling/fusion modules exist, independent of the weak-labeling work; (6) ensemble + calibrate last.
- Every new component should be checked against the CV harness *before* being wired into the full pipeline — don't add cross-view fusion and label-attention decoding in the same commit, or a regression in per-label AUC will be ambiguous to diagnose.
- The CV grouping key is now a known constraint, not an open question: `train.csv`/`train_series.csv` expose `StudyInstanceUID` only, no `PatientID`. Write `splits.py` to group by `StudyInstanceUID` directly and document the unverifiable patient-overlap risk in code comments, rather than building logic to "fall back" to a patient key that doesn't exist in the data.
- Treat the 9-hour Notebook runtime cap as a hard constraint from the first training run, not a thing to discover at submission time — profile per-study inference time early and extrapolate to the full private test set size.
- Keep the text encoder and contrastive-training code in a clearly separate module tree from the inference path (see repo layout above) so it's structurally impossible to accidentally ship a submission that depends on report text.
