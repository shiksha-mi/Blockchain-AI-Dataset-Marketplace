
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer


from sklearn.ensemble import (
    RandomForestClassifier,
    RandomForestRegressor
)

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score
)


def validate_model(file_path: str, target_column: str):
    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        return {
            "success": False,
            "error": f"Unable to read dataset: {str(e)}"
        }

    if target_column not in df.columns:
        return {
            "success": False,
            "error": f"Target column '{target_column}' not found."
        }

    df = df.dropna(subset=[target_column])

    if len(df) < 10:
        return {
            "success": False,
            "error": "Dataset has too few usable rows. At least 10 are required."
        }

    X = df.drop(columns=[target_column])
    y = df[target_column]

    if X.shape[1] == 0:
        return {
            "success": False,
            "error": "Dataset must contain at least one feature column besides the target."
        }

    # Detect whether this is a classification or regression problem.
    numeric_target = pd.api.types.is_numeric_dtype(y)
    unique_count = y.nunique()

    if unique_count < 2:
        return {
            "success": False,
            "error": "Target column must contain at least two distinct values."
        }

    # Numeric targets with many distinct values use regression.
    is_regression = numeric_target and unique_count > 10

    if is_regression:
        y = pd.to_numeric(y, errors="coerce")
        valid_rows = y.notna()
        X = X.loc[valid_rows]
        y = y.loc[valid_rows]

        if len(y) < 10:
            return {
                "success": False,
                "error": "Too few valid numeric target values for regression."
            }

        model = RandomForestRegressor(
            n_estimators=100,
            random_state=42
        )
    else:
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(y.astype(str))
        model = RandomForestClassifier(
            n_estimators=100,
            random_state=42
        )

    numeric_features = X.select_dtypes(
        include=["number"]
    ).columns.tolist()

    categorical_features = X.select_dtypes(
        exclude=["number"]
    ).columns.tolist()

    numeric_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="median"))
    ])

    categorical_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore"))
    ])

    transformers = []

    if numeric_features:
        transformers.append(
            ("numeric", numeric_transformer, numeric_features)
        )

    if categorical_features:
        transformers.append(
            ("categorical", categorical_transformer, categorical_features)
        )

    preprocessor = ColumnTransformer(transformers=transformers)

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("model", model)
    ])

    # Stratification is suitable only when each class has enough examples.
    if not is_regression:
        class_counts = pd.Series(y).value_counts()
        can_stratify = class_counts.min() >= 2
    else:
        can_stratify = False

    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
            stratify=y if can_stratify else None
        )
    except ValueError as e:
        return {
            "success": False,
            "error": f"Unable to split dataset: {str(e)}"
        }

    try:
        pipeline.fit(X_train, y_train)
        predictions = pipeline.predict(X_test)
    except Exception as e:
        return {
            "success": False,
            "error": f"Model training failed: {str(e)}"
        }

    if is_regression:
        return {
            "success": True,
            "model": "Random Forest Regressor",
            "task": "regression",
            "training_samples": len(X_train),
            "testing_samples": len(X_test),
            "mean_absolute_error": round(
                float(mean_absolute_error(y_test, predictions)), 2
            ),
            "mean_squared_error": round(
                float(mean_squared_error(y_test, predictions)), 2
            ),
            "r2_score": round(
                float(r2_score(y_test, predictions)), 2
            )
        }

    return {
        "success": True,
        "model": "Random Forest Classifier",
        "task": "classification",
        "training_samples": len(X_train),
        "testing_samples": len(X_test),
        "classes": len(set(y)),
        "accuracy": round(
            float(accuracy_score(y_test, predictions) * 100), 2
        ),
        "precision": round(
            float(precision_score(
                y_test, predictions, average="weighted", zero_division=0
            ) * 100), 2
        ),
        "recall": round(
            float(recall_score(
                y_test, predictions, average="weighted", zero_division=0
            ) * 100), 2
        ),
        "f1_score": round(
            float(f1_score(
                y_test, predictions, average="weighted", zero_division=0
            ) * 100), 2
        )
    }
