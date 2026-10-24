# Model card: Smart Ticket AI

## Intended use

Educational, noncommercial demonstration of English support-ticket classification. The outputs assist a reviewer; they are not a service-level agreement, incident severity policy, or calibrated risk estimate. The public form is for fictional examples, and authenticated storage is restricted by policy to synthetic content.

## Artifacts and implementation

| Artifact | Target | Classes |
| --- | --- | --- |
| `backend/models/category_model.joblib` | Support queue | Eight departments listed below |
| `backend/models/priority_model.joblib` | Priority | `high`, `low`, `medium` |
| `backend/models/metrics.json` | Saved held-out evaluation | Accuracy and macro-F1 for both targets |

Each joblib artifact contains a scikit-learn Pipeline with TF-IDF and Logistic Regression. The serialized scikit-learn version is **1.9.1**; deployment pins this version. Load only trusted artifacts: joblib deserialization can execute code.

Queue labels, inspected from the committed classifier:

- Billing and Payments
- Customer Service
- IT Support
- Product Support
- Returns and Exchanges
- Sales and Pre-Sales
- Service Outages and Maintenance
- Technical Support

## Inputs and preprocessing

Inputs are a subject and description in English, combined into one text string. The API strips leading/trailing whitespace and validates subject lengths of 3–200 characters and descriptions of 10–5,000 characters.

The training script fills missing subject/body text, removes rows without target labels, removes text shorter than 15 characters, deduplicates exact combined text, filters English, and retains the eight most frequent queues. Agent replies (`answer`) are not used as inputs.

TF-IDF uses up to 50,000 features, unigrams and bigrams, `min_df=2`, and sublinear term frequency. Logistic Regression uses balanced class weights, `max_iter=1000`, and `random_state=42`.

## Training data and provenance

Source: [vasu1111/customer-support-tickets](https://huggingface.co/datasets/vasu1111/customer-support-tickets).

File: `aa_dataset-tickets-multi-lang-5-2-50-version.csv`. The dataset card declares CC BY-NC 4.0 and links to Tobias Bueck's Open Ticket AI work. The source is described as synthetic. Training adapts it by filtering and text vectorization; the project does not claim that the data originated from a deployed business.

The downloader currently follows the repository default revision. The existing artifacts do not include a source commit, row count after filtering, dependency manifest, or training timestamp. Exact reconstruction of their original training run is therefore not established by the stored artifacts alone. Do not infer a training date or invent sample counts.

## Evaluation

The current script uses a shared 80/20 train/test split, stratified by queue, with seed 42. It fits text preprocessing on training data within each pipeline.

| Target | Saved accuracy | Saved macro-F1 |
| --- | ---: | ---: |
| Queue | 0.5518882894 | 0.5656164438 |
| Priority | 0.6521739130 | 0.6434276752 |

Source: the committed `metrics.json`. These numbers were not regenerated during deployment preparation. The script prints classification reports but only persists the two aggregate metrics per target. A majority-class comparison, per-class stored report, confusion matrix, calibration analysis, and uncertainty intervals have not been supplied.

## Inference and human review

The API chooses each classifier's highest-scoring class. `needs_review` is true when either selected score is below 0.60. This is a provisional rule, not a validated operating threshold. A higher score does not guarantee correctness, and a review recommendation does not indicate a particular business severity.

## Limitations

- Results on synthetic examples do not demonstrate performance on a real support queue.
- Queue accuracy is approximately 55%; incorrect routing is an expected limitation.
- Exact deduplication does not remove near-duplicate templates that may span the split.
- The priority split is stratified by queue, not jointly by queue and priority.
- Most-frequent-queue selection restricts scope to eight classes and happens before splitting.
- The model always picks a known label; it has no explicit unknown-category or language detector.
- Scores have not been calibrated. The model is not evaluated for Spanish or other unseen languages.
- Class weights, synthetic generation patterns, and changing language can influence scores and errors.

## Improvement path

Pin the dataset revision, record a training manifest, introduce a baseline, audit near duplicates, hold out a validation set for threshold selection, and persist class-level error analysis. Evaluate on appropriately obtained representative data before using the model outside the fictional demo.
