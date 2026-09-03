"""
Report labeler: Extract weak/silver labels from radiology reports.
Handles multilingual reports with negation-aware phrase matching.
"""

import re
from typing import Optional


# Label patterns for each condition (English + common patterns)
# Each pattern list is checked case-insensitively
LABEL_PATTERNS = {
    "ACL": {
        "positive": [
            r"acl\s*(tear|rupture|injury|defect|disruption|complete|partial)",
            r"anterior\s*cruciate\s*ligament\s*(tear|rupture|injury)",
            r"acl\s+(is\s+)?(torn|rupted|injured)",
        ],
        "negation": [
            r"(no|without|denies|negative for|unremarkable)\s*(evidence\s+of\s+)?acl",
            r"acl\s+(is\s+)?(intact|normal|unremarkable|preserved)",
        ],
    },
    "MCL": {
        "positive": [
            r"mcl\s*(tear|rupture|injury|defect|sprain|strain)",
            r"medial\s*collateral\s*ligament\s*(tear|rupture|injury)",
        ],
        "negation": [
            r"(no|without|denies|negative for)\s*(evidence\s+of\s+)?mcl",
            r"mcl\s+(is\s+)?(intact|normal|unremarkable)",
        ],
    },
    "Medial_Meniscus": {
        "positive": [
            r"medial\s*menisc\w*\s*(tear|rupture|defect|flap|root|horizontal|complex|degenerative)",
            r"(tear|rupture)\s+of\s+the\s+medial\s*menisc\w*",
        ],
        "negation": [
            r"(no|without|negative for)\s*(evidence\s+of\s+)?medial\s*menisc\w*\s*(tear|rupture)",
            r"medial\s*menisc\w*\s+(is\s+)?(intact|normal|unremarkable|preserved)",
        ],
    },
    "Lateral_Meniscus": {
        "positive": [
            r"lateral\s*menisc\w*\s*(tear|rupture|defect|flap|root|horizontal|complex|degenerative)",
            r"(tear|rupture)\s+of\s+the\s+lateral\s*menisc\w*",
        ],
        "negation": [
            r"(no|without|negative for)\s*(evidence\s+of\s+)?lateral\s*menisc\w*\s*(tear|rupture)",
            r"lateral\s*menisc\w*\s+(is\s+)?(intact|normal|unremarkable|preserved)",
        ],
    },
    "Medial_OA": {
        "positive": [
            r"medial\s*(compartment\s+)?osteoarthritis",
            r"medial\s*(compartment\s+)?(joint\s+)?space\s*(narrowing|loss|reduction)",
            r"medial\s*(tibiofemoral\s+)?osteoarthrit",
        ],
        "negation": [
            r"(no|without)\s*(evidence\s+of\s+)?medial\s*(compartment\s+)?osteoarthritis",
            r"medial\s*(compartment\s+)?(joint\s+)?space\s+(is\s+)?(maintained|preserved|normal)",
        ],
    },
    "Lateral_OA": {
        "positive": [
            r"lateral\s*(compartment\s+)?osteoarthritis",
            r"lateral\s*(compartment\s+)?(joint\s+)?space\s*(narrowing|loss|reduction)",
            r"lateral\s*(tibiofemoral\s+)?osteoarthrit",
        ],
        "negation": [
            r"(no|without)\s*(evidence\s+of\s+)?lateral\s*(compartment\s+)?osteoarthritis",
            r"lateral\s*(compartment\s+)?(joint\s+)?space\s+(is\s+)?(maintained|preserved|normal)",
        ],
    },
    "PF_OA": {
        "positive": [
            r"patellofemoral\s*osteoarthritis",
            r"patellofemoral\s*(joint\s+)?space\s*(narrowing|loss)",
            r"patellofemoral\s*(compartment\s+)?arthrit",
        ],
        "negation": [
            r"(no|without)\s*(evidence\s+of\s+)?patellofemoral\s*osteoarthritis",
            r"patellofemoral\s*(joint\s+)?space\s+(is\s+)?(maintained|preserved|normal)",
        ],
    },
    "Effusion": {
        "positive": [
            r"(knee\s+)?effusion",
            r"(joint\s+)?(fluid|effusion|hydarthrosis)",
            r"moderate\s+to\s+large\s+effusion",
            r"small\s+effusion",
        ],
        "negation": [
            r"(no|without|absence\s+of)\s*(knee\s+)?effusion",
            r"no\s+(significant\s+)?joint\s+effusion",
            r"effusion\s+(is\s+)?(absent|resolved|improved)",
        ],
    },
    "Synovitis": {
        "positive": [
            r"synovitis",
            r"synovial\s*(thickening|enhancement|inflammation|proliferation)",
            r"synovial\s*(fluid|effusion)",
        ],
        "negation": [
            r"(no|without|absence\s+of)\s*synovitis",
            r"no\s*(evidence\s+of\s+)?synovial\s*(thickening|enhancement|inflammation)",
        ],
    },
    "Bakers": {
        "positive": [
            r"baker'?s?\s*(cyst|cystic|ganglion)",
            r"popliteal\s*cyst",
        ],
        "negation": [
            r"(no|without)\s*(evidence\s+of\s+)?baker'?s?\s*cyst",
            r"(no|without)\s*popliteal\s*cyst",
        ],
    },
    "Contusion": {
        "positive": [
            r"(bone\s+)?contusion",
            r"(bone\s+)?bruise",
            r"microtrabecular\s*(injury|edema|fracture)",
            r"bone\s*marrow\s*edema\s*(pattern|contusional)",
        ],
        "negation": [
            r"(no|without)\s*(evidence\s+of\s+)?(bone\s+)?contusion",
            r"no\s*(bone\s+)?bruise",
        ],
    },
    "Fracture": {
        "positive": [
            r"(fracture|fractured|fracturing)",
            r"(occult|stress|insufficiency|avulsion)\s*fracture",
            r"broken\s*(bone|tibia|femur|fibula|patella)",
        ],
        "negation": [
            r"(no|without|negative for|free\s+of)\s*(evidence\s+of\s+)?fracture",
            r"(no|without)\s*(acute\s+)?fracture",
            r"fracture\s+(is\s+)?(ruled\s+out|excluded|not\s+seen)",
        ],
    },
}


def extract_labels_from_report(report_text: str) -> dict[str, int]:
    """
    Extract 12 binary labels from a radiology report using negation-aware
    phrase matching.

    Returns dict mapping label name to 0/1.
    """
    if not isinstance(report_text, str) or not report_text.strip():
        return {label: 0 for label in LABEL_PATTERNS}

    report_lower = report_text.lower()
    labels = {}

    for label_name, patterns in LABEL_PATTERNS.items():
        positive_match = False
        negative_match = False

        # Check negation first
        for neg_pattern in patterns.get("negation", []):
            if re.search(neg_pattern, report_lower, re.IGNORECASE):
                negative_match = True
                break

        # Check positive patterns
        if not negative_match:
            for pos_pattern in patterns["positive"]:
                if re.search(pos_pattern, report_lower, re.IGNORECASE):
                    positive_match = True
                    break

        labels[label_name] = 1 if positive_match else 0

    return labels


def label_reports_batch(
    df,
    report_col: str = "Report",
    label_col_prefix: str = None,
) -> pd.DataFrame:
    """
    Apply report labeling to a batch of studies.
    Adds 12 label columns to the dataframe.
    """
    import pandas as pd

    label_names = list(LABEL_PATTERNS.keys())
    label_data = []

    for idx, row in df.iterrows():
        report = row.get(report_col, "")
        labels = extract_labels_from_report(report)
        label_data.append(labels)

    label_df = pd.DataFrame(label_data, index=df.index)

    # Rename columns with prefix if specified
    if label_col_prefix:
        label_df.columns = [f"{label_col_prefix}_{col}" for col in label_df.columns]

    return pd.concat([df, label_df], axis=1)
