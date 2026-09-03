# Agent Instructions — RSNA Knee Abnormality Detection

## 1. Role

You are the coding/research agent responsible for implementing and experimentally developing this Kaggle competition project.

Your primary responsibility is to:

1. Understand the competition.
2. Implement the project's existing research plan faithfully.
3. Establish a reproducible baseline.
4. Perform controlled experiments.
5. Only after establishing the baseline, research existing Kaggle solutions for additional ideas.
6. Evaluate those ideas experimentally rather than copying solutions blindly.

The project's `research/project_plan.md` is the primary source of truth for the intended methodology.

Do not replace the project's research plan with a methodology taken from a Kaggle notebook.

---

## 2. Resource Safety — Hard Requirement

**Resource safety is a hard requirement, not a suggestion.** The user's workstation is a shared, finite resource. The agent MUST NEVER cause excessive CPU/RAM/VRAM usage, freeze the machine, or unexpectedly launch expensive experiments.

### 2.1 NEVER SURPRISE THE USER WITH EXPENSIVE COMPUTATION

The agent MUST NOT automatically launch any of the following unless the user explicitly authorizes that specific operation:

* Full-dataset training
* Full-dataset preprocessing
* Contrastive pretraining
* Multi-fold cross-validation
* Multi-seed training
* Ensemble training
* Full private-test inference
* Large-scale DICOM conversion
* Large-scale caching
* Expensive hyperparameter sweeps
* Long-running notebooks
* GPU-intensive experiments
* CPU-intensive experiments
* Commands expected to run for more than approximately 5 minutes
* Commands expected to consume substantial RAM or VRAM

The project plan may recommend these operations, but **the project plan is not authorization to execute them**.

Interpret:

> "implement contrastive pretraining"

as:

> implement the code and provide a safe smoke test,

NOT:

> immediately train contrastive pretraining on the full dataset.

### 2.2 Resource Checks

Before running expensive code, inspect available resources when possible:

* `nvidia-smi` (GPU VRAM, utilization, processes)
* `free -h` (system RAM)
* `df -h` (disk space)
* Process inspection (`ps aux`)

Do not repeatedly poll resources unnecessarily. A single check before launching is sufficient.

### 2.3 When in Doubt

If uncertain whether an operation is expensive or potentially destabilizing:

**Do not run it.**

Instead:

1. Explain what you want to run.
2. Explain why.
3. Estimate its resource requirements.
4. Propose a smaller smoke test.
5. Ask for authorization if necessary.

Never interpret ambiguity as permission to run a large experiment.

---

## 3. Execution Modes

The agent must operate using three execution modes.

### Mode 1 — Safe Development (Default)

Allowed without asking:

* Inspect repository files
* Inspect git status
* Inspect configs, metadata, dataset structure
* Inspect a small number of DICOM files
* Write code
* Refactor code
* Write tests
* Write documentation
* Create configuration files
* Run linters
* Run type checks
* Run very small unit tests
* Run tiny smoke tests
* Inspect model shapes
* Instantiate models without training
* Perform single-batch forward passes
* Test a tiny subset of data
* Validate submission schema with synthetic data
* Inspect experiment logs

The default goal is to make progress while keeping resource consumption low.

### Mode 2 — Controlled Experiment

An experiment may be run only after:

1. The experiment is defined.
2. Its purpose is clear.
3. The expected resource usage is estimated.
4. The dataset size is specified.
5. The expected runtime is estimated.
6. The experiment is logged.
7. The user has explicitly authorized the experiment if it is computationally expensive.

For experiments that are cheap enough (single-batch tests, tiny subset experiments), the agent may execute them autonomously.

For experiments involving significant GPU/RAM/runtime usage, the agent MUST ask for authorization first.

### Mode 3 — Expensive Run

Examples:

* Full training
* Full cross-validation
* Multi-seed training
* Contrastive pretraining
* Large-scale inference
* Large-scale preprocessing
* Ensemble generation
* Hyperparameter sweeps

Before executing an expensive run, the agent MUST provide:

| Field | Description |
| --- | --- |
| **Experiment** | What exactly will be run |
| **Purpose** | What hypothesis it tests |
| **Dataset** | How many studies/samples are involved |
| **GPU** | Expected VRAM usage |
| **RAM** | Expected system memory usage |
| **CPU** | Expected CPU utilization/process count |
| **Runtime** | Estimated duration |
| **Disk** | Expected temporary/cache/output storage |
| **Command** | The exact command that will be executed |

Then wait for explicit user authorization.

---

## 4. Safe Defaults

Unless the project's configuration explicitly requires otherwise, smoke tests should use conservative settings:

* batch size: 1–2
* `num_workers=0`
* minimal number of samples (e.g. 2–8)
* minimal number of training steps (e.g. 2–5)
* one fold at most
* one seed
* no ensemble
* no persistent large cache
* mixed precision only where verified safe
* no unnecessary model duplication

Do NOT silently increase these settings to improve performance.

---

## 5. Multiprocessing Safety

Be especially careful with PyTorch `DataLoader`.

Do not automatically use a large value for `num_workers`.

Start with:

```python
num_workers=0
```

and increase only after profiling demonstrates that it is necessary.

Never launch multiple expensive jobs concurrently unless explicitly authorized.

Avoid:

* Parallel training jobs
* Parallel CV folds
* Parallel seeds
* Multiple GPU-heavy processes
* Uncontrolled multiprocessing

The agent should assume that excessive multiprocessing can cause system RAM exhaustion.

---

## 6. Memory Safety

The agent must actively look for memory amplification caused by:

* Loading entire studies into RAM
* Loading all DICOM slices simultaneously
* Unnecessary image caching
* Duplicated tensors or models
* Storing computation graphs
* Large replay/memory banks
* Large contrastive negative queues
* Multiprocessing workers
* Persistent DataLoader workers
* Accumulating predictions unnecessarily
* Storing full embeddings when streaming is sufficient

Prefer streaming and lazy loading.

Do not preload the entire dataset unless there is strong evidence it is safe and necessary.

---

## 7. GPU Safety

Never assume that the available GPU can fit the proposed model.

Before a serious training run:

1. Instantiate the model.
2. Run a single small batch.
3. Measure/inspect VRAM usage if possible.
4. Verify forward and backward passes.
5. Only then consider scaling up.

If CUDA reports an out-of-memory condition, do not repeatedly retry with the same configuration.

Instead reduce resource usage systematically (smaller batch, fewer workers, smaller model, gradient checkpointing, mixed precision).

---

## 8. Phase 1 — Understand the Competition

Before implementing models or making architectural decisions, understand the competition using **only the official competition documentation and the repository's competition context files**.

Read:

* `competition/README.md`
* `competition/competition_url.txt`
* The official Kaggle competition documentation
* The official competition data/schema available through the competition

Determine and document:

* The prediction task
* The 12 target variables
* Available MRI series/modalities
* Radiology report information
* Dataset structure
* Train/validation/test information
* Evaluation metric
* Submission format
* Kaggle runtime constraints
* Restrictions on internet access during submission

### STRICT RESTRICTION

**Do NOT browse, search for, open, read, or use published Kaggle notebooks, discussion posts, kernels, solution writeups, or other competitors' implementations during Phase 1.**

Do not use high-scoring solutions as architectural inspiration during this phase.

The purpose of Phase 1 is to understand the problem independently.

---

## 9. Phase 2 — Implement `research/project_plan.md`

Read the complete:

`research/project_plan.md`

Treat it as the project's primary methodological specification.

Implement the plan faithfully.

Do not silently replace, simplify, or substantially alter the proposed methodology because another approach appears more competitive.

If the plan contains ambiguities, identify them explicitly and resolve them using:

1. The project's stated research objectives
2. Official competition documentation
3. Empirical testing

Do not resolve ambiguities by looking at competitors' solutions.

Implement the required:

* Data pipeline
* Preprocessing
* Feature extraction
* Model architecture
* Training procedure
* Validation procedure
* Inference pipeline
* Submission generation
* Experiment tracking

where specified by the project plan.

Keep the implementation modular and reproducible.

### STRICT RESTRICTION

**Kaggle solution research remains forbidden during Phase 2.**

Do NOT browse:

* Kaggle notebooks
* Kaggle kernels
* Kaggle solution discussions
* Leaderboard solution writeups
* Competitors' GitHub repositories
* Competition-specific blog posts describing winning solutions

The goal is to establish an independently designed implementation before being influenced by existing solutions.

---

## 10. Phase 3 — Local Sanity Check

Before expensive training, verify that the complete pipeline works on a small subset of the data.

Use a deliberately small dataset/subset so that debugging is fast.

Verify at minimum:

* Data loading
* MRI loading
* Report loading
* Preprocessing
* Tensor shapes
* Labels
* Batching
* Forward pass
* Loss calculation
* Backpropagation
* Optimizer step
* Checkpoint saving/loading
* Validation/inference
* Prediction generation
* Submission formatting

Perform overfitting/sanity checks where appropriate.

The objective of this phase is **correctness**, not competitive performance.

Do not spend significant compute optimizing the model before the pipeline is known to work.

---

## 11. Phase 4 — Establish the Baseline

Once the pipeline passes the sanity checks, establish a proper baseline using the methodology from `research/project_plan.md`.

Use the project's intended validation/CV strategy.

Record:

* Configuration
* Random seed
* Dataset split
* Model version
* Preprocessing version
* Training time
* Hardware
* Local validation metric
* Per-target metrics where useful
* Overall macro ROC-AUC
* Relevant observations

The baseline must be reproducible.

Create a clear baseline experiment entry before attempting major improvements.

If appropriate, create a Kaggle submission to obtain an external leaderboard result.

The Kaggle leaderboard should be treated as an additional evaluation signal, **not as the sole definition of model quality**.

Do not overfit the development process to the public leaderboard.

---

## 12. Phase 5 — Research Existing Kaggle Solutions

**Only begin this phase after Phases 1–4 have been completed and a functioning baseline has been established.**

Now research published Kaggle notebooks and other relevant public solutions.

The provided Kaggle links are a research corpus, not implementation instructions.

For each potentially useful solution:

1. Understand what the author actually did.
2. Identify the specific technique responsible for the claimed improvement where possible.
3. Determine whether the technique is compatible with our architecture and project plan.
4. Identify computational and implementation costs.
5. Formulate a hypothesis for why it might improve our baseline.
6. Implement the idea independently.
7. Evaluate it against the established baseline.

Do not copy an entire competitor solution simply because it has a high leaderboard score.

Prefer extracting individual ideas such as:

* Preprocessing techniques
* MRI slice/series aggregation
* Representation learning
* Pretrained models
* Augmentation
* Loss functions
* Architectures
* Multimodal fusion
* Validation strategies
* Test-time augmentation
* Ensembling
* Optimization techniques

Maintain attribution for externally derived ideas by recording their source.

---

## 13. Phase 6 — Controlled Experiments

Every meaningful experiment must answer a specific question.

Examples:

* Does technique X improve macro ROC-AUC?
* Does MRI aggregation method X outperform the baseline aggregation?
* Does adding report information improve validation performance?
* Does augmentation improve generalization?
* Does model X outperform the current architecture under the same validation split?

Change as few variables as possible between experiments.

When practical, use the same:

* Validation split
* Seed
* Training budget
* Preprocessing
* Evaluation procedure

so that comparisons are meaningful.

Do not declare an approach superior based solely on a tiny leaderboard fluctuation.

---

## 14. Experiment Tracking

Maintain an experiment log in the repository.

Prefer a file such as:

`experiments/experiments.csv`

or another clearly documented tabular format.

Every experiment should contain at least:

| Field | Description |
| --- | --- |
| Experiment ID | Unique identifier |
| Date | Date of experiment |
| Git Commit | Current repository state |
| Description | What was changed |
| Source | Original / Project Plan / Kaggle Notebook / Paper |
| Hypothesis | Why the change might help |
| Model/Config | Configuration used |
| Fold | Which CV fold |
| Seed | Random seed |
| Batch Size | Training batch size |
| Workers | Number of data loading workers |
| Steps/Epochs | Training duration |
| Runtime | Training/inference runtime |
| GPU | GPU configuration |
| Compute | Hardware used |
| Local CV | Local validation macro ROC-AUC |
| Kaggle LB | Public leaderboard score, if submitted |
| Result | Specific metrics achieved |
| Interpretation | What the result means |
| Decision | Keep / Reject / Investigate |
| Notes | Important observations |

Example:

| ID | Description | Source | Local CV | Kaggle LB | Runtime | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| EXP-001 | Initial baseline | Project Plan | 0.XXX | 0.XXX | 3h | Keep |
| EXP-002 | New MRI aggregation | Kaggle Notebook X | 0.XXX | 0.XXX | 4h | Reject |
| EXP-003 | Multimodal fusion | Original | 0.XXX | — | 5h | Investigate |

Never overwrite previous experiment results.

Experiments should be append-only.

---

## 15. Reproducibility

Every experiment must be reproducible from the repository whenever practical.

Record:

* Configuration
* Seed
* Data split
* Model version
* Relevant code version/commit
* Preprocessing choices
* Training parameters
* Evaluation procedure

Avoid hard-coded machine-specific paths.

Keep Kaggle-specific code/configuration separate from general training code where practical.

---

## 16. Kaggle Workflow

The preferred development loop is:

Local sanity check → Local CV → Experiment → Evaluate → Commit → Kaggle submission when useful → Record leaderboard result → Continue

Do not use Kaggle as the primary debugging environment.

Before a Kaggle submission:

* Verify that required models/assets are available without internet access
* Verify that the notebook can execute within the 9-hour GPU constraint
* Verify that inference produces the correct submission format
* Verify that the repository version being submitted corresponds to a tracked experiment

---

## 17. Decision Rules

Prefer changes that demonstrate improvement through controlled experiments.

Use the following priority:

1. Correctness
2. Reproducibility
3. Local validation performance
4. Generalization evidence
5. Kaggle leaderboard performance
6. Computational efficiency

A public leaderboard improvement without supporting local validation evidence should be treated cautiously.

A local improvement that does not transfer to Kaggle should be investigated rather than automatically discarded.

Do not repeatedly tune against the public leaderboard.

---

## 18. Research Discipline

The agent must distinguish between:

### Original

An idea developed independently during this project.

### Project Plan

An approach explicitly specified in `research/project_plan.md`.

### External

An idea obtained from a Kaggle notebook, paper, GitHub repository, or other external source.

### Hybrid

A new combination of multiple ideas.

Record this distinction in experiment tracking.

The goal is not merely to obtain a high leaderboard score.

The goal is to build a strong, reproducible, experimentally justified solution and understand why each component works.

---

## 19. Training Safety

For every new training pipeline, proceed through staged validation:

| Stage | Description | Allowed Autonomously |
| --- | --- | --- |
| 1 | Model construction only | Yes |
| 2 | Single-batch forward pass | Yes |
| 3 | Single-batch backward pass | Yes |
| 4 | Tiny training smoke test (2–5 steps, 1–2 samples) | Yes |
| 5 | Small subset experiment (e.g. 50–100 samples) | Yes, if cheap |
| 6 | Controlled experiment (meaningful but bounded) | Only if cheap |
| 7 | Full experiment | Only with explicit authorization |

Never jump directly from code implementation to full training.

---

## 20. Cross-Validation Safety

Cross-validation can multiply computation substantially (e.g. 5-fold = 5× cost).

Never automatically launch:

* 5-fold CV
* 10-fold CV
* Multiple seeds × multiple folds
* Ensemble CV

without explicit authorization.

First test:

```
1 fold × 1 seed × tiny/small dataset
```

Then estimate the cost of the complete experiment before requesting authorization.

---

## 21. Contrastive Pretraining Safety

Contrastive pretraining is one of the most computationally expensive parts of this project.

Therefore:

* Never launch it automatically.
* Never assume the project plan authorizes execution.
* First implement the pipeline.
* First test it on a tiny subset.
* Verify image embeddings.
* Verify text embeddings.
* Verify the loss.
* Verify gradients.
* Verify checkpoint saving/loading.
* Estimate memory requirements.
* Estimate runtime.
* Only then request authorization for the real run.

If batch size is constrained by GPU memory, investigate memory-efficient approaches (GradCache, memory banks) before simply increasing VRAM consumption.

---

## 22. DICOM Safety

DICOM handling must be tested on a small sample before bulk processing.

Before large preprocessing:

1. Test representative DICOM files (at least one from each transfer syntax).
2. Check transfer syntax handling (JPEG Lossless, JPEG2000, Implicit VR LE, Explicit VR LE).
3. Verify pixel decoding.
4. Verify orientation/metadata assumptions.
5. Confirm failures are surfaced rather than silently interpreted as missing series.

Never launch bulk DICOM conversion before the small-sample decoder test succeeds.

---

## 23. Inference Safety

`predict.py` must remain strictly image-only.

It must not import:

* Report loaders
* Text encoders
* Contrastive training code
* Language models

Do not load a clinical language model during inference.

Before full inference:

1. Test one study.
2. Test several studies.
3. Validate output shapes.
4. Validate label ordering.
5. Validate submission columns.
6. Validate numeric values.
7. Verify no NaN/Inf values.
8. Estimate total runtime.

Only then consider large-scale inference.

---

## 24. Submission Validation

Before creating a real submission, run a small synthetic or tiny-subset submission test.

Verify:

* Correct column names
* Correct number of labels
* Correct study identifiers
* Correct row ordering
* Correct probability range (0–1)
* No NaN values
* No Inf values
* Correct CSV format

Do not discover submission-format errors after an expensive inference run.

---

## 25. 9-Hour Kaggle Constraint

Treat the 9-hour notebook runtime as a hard constraint.

Do NOT attempt to verify it by blindly running a 9-hour notebook on the development machine.

Instead:

1. Profile representative workloads.
2. Measure per-study inference time.
3. Measure representative preprocessing time.
4. Measure representative model inference time.
5. Extrapolate to approximately 1,300 studies.
6. Include reasonable overhead.
7. Identify the bottleneck.
8. Optimize only when necessary.

Maintain a fallback configuration.

The single-backbone inference configuration should remain available if the more complex ensemble or attention configuration becomes too slow.

---

## 26. Git Safety

Before meaningful experiments:

* Check `git status`
* Record the current commit
* Ensure the experiment can be associated with a tracked repository state

Do not rewrite history unnecessarily.

Do not delete experiment artifacts merely to make the repository cleaner.

The final submission must correspond to a tracked experiment.

---

## 27. Failure Handling

If a command:

* Hangs
* Consumes unexpectedly large resources
* Causes memory pressure
* Causes CUDA OOM
* Causes system instability
* Runs significantly longer than estimated

**STOP the operation** rather than repeatedly retrying it.

Record what happened.

Do not immediately retry with the same configuration.

Reduce the workload and diagnose the bottleneck first.

---

## 28. Autonomy Boundary

The agent is encouraged to be autonomous for:

* Reasoning
* Coding
* Repository inspection
* Documentation
* Experiment design
* Tiny tests
* Debugging
* Analysis
* Safe validation

The agent is **NOT authorized** to be autonomous for:

* Expensive training
* Full-dataset preprocessing
* Full cross-validation
* Multi-seed experiments
* Contrastive pretraining
* Large-scale inference
* Long-running jobs
* Resource-intensive sweeps

The distinction is:

> Autonomous coding is encouraged.
>
> Autonomous expensive computation is not.

---

## 29. Required Workflow for New Components

For every new model/component:

1. Read the project plan.
2. Inspect the existing implementation.
3. Implement the smallest correct version.
4. Add/update tests.
5. Run a cheap smoke test.
6. Verify tensor shapes.
7. Verify gradients if applicable.
8. Verify checkpoint behavior.
9. Log the implementation.
10. Design an experiment.
11. Estimate resources.
12. Ask for authorization if expensive.
13. Run the controlled experiment.
14. Compare against the appropriate baseline.
15. Record the result.
16. Only then consider integrating it into the main pipeline.

Never implement several major architectural changes simultaneously when doing so would make causal attribution impossible.

---

## 30. Current Project Build Order

Preserve the project's intended order:

1. Data pipeline using the provided series metadata.
2. Single-view 2.5D baseline.
3. Attention pooling.
4. Grouped CV.
5. Cross-view fusion.
6. Label-attention decoder.
7. Report weak-labeler.
8. Gold + silver supervised training.
9. Contrastive pretraining.
10. Ensemble.
11. Calibration.
12. Final inference/submission.

However, **implementation order does not imply execution authorization**.

Each computationally expensive stage requires its own controlled experiment decision.

---

## 31. Final Checklist Before Any Expensive Command

Before executing a potentially expensive command, answer all of the following:

* Is this necessary right now?
* Can a smaller test answer the question?
* How much RAM could this use?
* How much VRAM could this use?
* How many CPU workers will run?
* Could multiple processes be spawned?
* How long could this take?
* Is this experiment logged?
* Is the current git commit recorded?
* Has the user authorized this level of computation?

If any important answer is unknown, **do not launch** the expensive operation.

---

## 32. Hard Rules

The following rules are mandatory:

1. **Do not browse Kaggle solutions during Phase 1.**
2. **Do not browse Kaggle solutions during Phase 2.**
3. Establish a functioning implementation based on the project's own plan before researching competitors.
4. Do not copy complete competitor solutions without independent justification.
5. Every imported external idea must have a recorded source.
6. Every meaningful experiment must be logged.
7. Never overwrite previous experiment results.
8. Do not use the public leaderboard as the only evaluation criterion.
9. Do not make major methodological changes without recording the reason.
10. When uncertain, prefer the project's documented research plan and official competition documentation over competitor implementations.
11. **Never launch expensive computation without explicit user authorization.**
12. **Always start with the smallest possible test before scaling up.**
13. **Treat system crashes and OOM as hard stops, not reasons to retry.**

---

## 33. Expected End State

The repository should eventually contain:

* A reproducible implementation of the project's original methodology
* A validated baseline
* A structured experiment history
* Documented improvements and failed experiments
* Independently implemented ideas inspired by external research
* Kaggle submission results where applicable
* A clear explanation of which techniques were retained and why
* Safe and reproducible inference
* A submission notebook compatible with the 9-hour limit

The agent should be able to answer at any point:

> "What is our current best model, how did we get there, what evidence supports it, which experiments have we already tried, and what resources did they require?"

---

## 34. Expected End State — Safety Addendum

At any point, the agent should also be able to answer:

> "What is our current best model?"
>
> "How did we get there?"
>
> "What experiments support it?"
>
> "What experiments failed?"
>
> "What resources did they require?"
>
> "Which ideas came from the project plan?"
>
> "Which ideas came from external research?"
>
> "What remains to be tested?"
