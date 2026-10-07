import pandas as pd
import numpy as np


def analyze_dataset(file_path: str):
    """
    Analyze a CSV dataset and calculate a basic quality score.
    """

    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        return {
            "valid": False,
            "status": "REJECTED",
            "error": f"Unable to read CSV file: {str(e)}"
        }

    rows, columns = df.shape

    # -----------------------------
    # Basic validation
    # -----------------------------

    if rows == 0:
        return {
            "valid": False,
            "status": "REJECTED",
            "error": "Dataset contains no rows."
        }

    if columns == 0:
        return {
            "valid": False,
            "status": "REJECTED",
            "error": "Dataset contains no columns."
        }

    # -----------------------------
    # Missing values
    # -----------------------------

    total_cells = rows * columns

    missing_values = int(
        df.isnull().sum().sum()
    )

    missing_percentage = round(
        (missing_values / total_cells) * 100,
        2
    )

    # -----------------------------
    # Duplicate rows
    # -----------------------------

    duplicate_rows = int(
        df.duplicated().sum()
    )

    duplicate_percentage = round(
        (duplicate_rows / rows) * 100,
        2
    )

    # -----------------------------
    # Constant columns
    # -----------------------------

    constant_columns = [
        column
        for column in df.columns
        if df[column].nunique(dropna=False) <= 1
    ]

    # -----------------------------
    # Numeric columns
    # -----------------------------

    numeric_columns = list(
        df.select_dtypes(
            include=np.number
        ).columns
    )

    # -----------------------------
    # Categorical columns
    # -----------------------------

    categorical_columns = list(
        df.select_dtypes(
            exclude=np.number
        ).columns
    )

    # -----------------------------
    # Infinite values
    # -----------------------------

    infinite_values = 0

    numeric_df = df.select_dtypes(
        include=np.number
    )

    if not numeric_df.empty:
        infinite_values = int(
            np.isinf(numeric_df).sum().sum()
        )

    # -----------------------------
    # Quality score
    # -----------------------------

    score = 100

    # Missing-value penalty
    if missing_percentage > 30:
        score -= 30

    elif missing_percentage > 15:
        score -= 20

    elif missing_percentage > 5:
        score -= 10

    # Duplicate penalty
    if duplicate_percentage > 20:
        score -= 20

    elif duplicate_percentage > 10:
        score -= 10

    elif duplicate_percentage > 5:
        score -= 5

    # Constant columns penalty
    score -= min(
        len(constant_columns) * 5,
        20
    )

    # Infinite values penalty
    if infinite_values > 0:
        score -= 10

    score = max(0, score)

    # -----------------------------
    # Status
    # -----------------------------

    if score >= 70:
        status = "PASSED"

    elif score >= 50:
        status = "REVIEW_REQUIRED"

    else:
        status = "REJECTED"

    return {
        "valid": True,
        "status": status,

        "rows": rows,
        "columns": columns,

        "missing_values": missing_values,
        "missing_percentage": missing_percentage,

        "duplicate_rows": duplicate_rows,
        "duplicate_percentage": duplicate_percentage,

        "constant_columns": constant_columns,

        "infinite_values": infinite_values,

        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,

        "quality_score": score
    }