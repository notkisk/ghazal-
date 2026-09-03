"""
CV Report: per-fold, per-label AUC breakdown.
"""

import numpy as np


def generate_cv_report(
    fold_results: list[dict],
    labels: list[str],
) -> str:
    """Generate a formatted cross-validation report."""
    report_lines = []
    report_lines.append("=" * 70)
    report_lines.append("CROSS-VALIDATION REPORT")
    report_lines.append("=" * 70)

    # Per-fold results
    report_lines.append("\nPer-fold results:")
    report_lines.append(f"{'Fold':<8}{'Best Epoch':<12}{'Macro AUC':<12}")
    report_lines.append("-" * 32)

    for result in fold_results:
        report_lines.append(
            f"{result['fold']+1:<8}"
            f"{result['best_epoch']+1:<12}"
            f"{result['macro_auc']:<12.4f}"
        )

    # Mean and std
    macro_aucs = [r["macro_auc"] for r in fold_results]
    report_lines.append("-" * 32)
    report_lines.append(
        f"{'Mean':<8}{'':<12}{np.mean(macro_aucs):<12.4f}"
    )
    report_lines.append(
        f"{'Std':<8}{'':<12}{np.std(macro_aucs):<12.4f}"
    )

    # Per-label breakdown
    report_lines.append("\nPer-label AUC breakdown:")
    header = f"{'Label':<20}"
    for i in range(len(fold_results)):
        header += f"{'Fold ' + str(i+1):<10}"
    header += f"{'Mean':<10}{'Std':<10}"
    report_lines.append(header)
    report_lines.append("-" * len(header))

    for label in labels:
        line = f"{label:<20}"
        label_aucs = []
        for result in fold_results:
            auc = result["per_label_auc"].get(label, float("nan"))
            label_aucs.append(auc)
            if np.isnan(auc):
                line += f"{'N/A':<10}"
            else:
                line += f"{auc:<10.4f}"

        valid_aucs = [a for a in label_aucs if not np.isnan(a)]
        if valid_aucs:
            line += f"{np.mean(valid_aucs):<10.4f}{np.std(valid_aucs):<10.4f}"
        else:
            line += f"{'N/A':<10}{'N/A':<10}"
        report_lines.append(line)

    report_lines.append("=" * 70)

    return "\n".join(report_lines)
