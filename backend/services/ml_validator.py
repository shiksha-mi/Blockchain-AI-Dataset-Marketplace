import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import (
    LabelEncoder,
    OneHotEncoder
)

from sklearn.compose import ColumnTransformer

from sklearn.pipeline import Pipeline

from sklearn.impute import SimpleImputer

from sklearn.ensemble import RandomForestClassifier

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score
)


def validate_model(
    file_path: str,
    target_column: str
):

    try:
        df = pd.read_csv(file_path)

    except Exception as e:

        return {
            "success": False,
            "error": f"Unable to read dataset: {str(e)}"
        }

    # ---------------------------------
    # Check target column
    # ---------------------------------

    if target_column not in df.columns:

        return {
            "success": False,
            "error": (
                f"Target column "
                f"'{target_column}' not found."
            )
        }

    # Remove rows where target is missing

    df = df.dropna(
        subset=[target_column]
    )

    if len(df) < 10:

        return {
            "success": False,
            "error": (
                "Dataset has too few "
                "usable rows for baseline validation."
            )
        }

    X = df.drop(
        columns=[target_column]
    )

    y = df[target_column]

    # ---------------------------------
    # Classification check
    # ---------------------------------

    if y.nunique() < 2:

        return {
            "success": False,
            "error": (
                "Target column must contain "
                "at least two classes."
            )
        }

    # ---------------------------------
    # Encode target
    # ---------------------------------

    label_encoder = LabelEncoder()

    y = label_encoder.fit_transform(
        y.astype(str)
    )

    # ---------------------------------
    # Identify feature types
    # ---------------------------------

    numeric_features = X.select_dtypes(
        include=["int64", "float64"]
    ).columns.tolist()

    categorical_features = X.select_dtypes(
        exclude=["int64", "float64"]
    ).columns.tolist()

    # ---------------------------------
    # Numeric preprocessing
    # ---------------------------------

    numeric_transformer = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="median"
                )
            )
        ]
    )

    # ---------------------------------
    # Categorical preprocessing
    # ---------------------------------

    categorical_transformer = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="most_frequent"
                )
            ),
            (
                "encoder",
                OneHotEncoder(
                    handle_unknown="ignore"
                )
            )
        ]
    )

    # ---------------------------------
    # Preprocessor
    # ---------------------------------

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                numeric_transformer,
                numeric_features
            ),
            (
                "categorical",
                categorical_transformer,
                categorical_features
            )
        ]
    )

    # ---------------------------------
    # Model
    # ---------------------------------

    model = RandomForestClassifier(
        n_estimators=100,
        random_state=42
    )

    pipeline = Pipeline(
        steps=[
            (
                "preprocessor",
                preprocessor
            ),
            (
                "model",
                model
            )
        ]
    )

    # ---------------------------------
    # Train/test split
    # ---------------------------------

    try:

        X_train, X_test, y_train, y_test = (
            train_test_split(
                X,
                y,
                test_size=0.2,
                random_state=42,
                stratify=y
            )
        )

    except ValueError as e:

        return {
            "success": False,
            "error": (
                "Unable to create a valid "
                f"stratified train/test split: {str(e)}"
            )
        }

    # ---------------------------------
    # Train
    # ---------------------------------

    pipeline.fit(
        X_train,
        y_train
    )

    # ---------------------------------
    # Predict
    # ---------------------------------

    predictions = pipeline.predict(
        X_test
    )

    # ---------------------------------
    # Metrics
    # ---------------------------------

    accuracy = accuracy_score(
        y_test,
        predictions
    )

    precision = precision_score(
        y_test,
        predictions,
        average="weighted",
        zero_division=0
    )

    recall = recall_score(
        y_test,
        predictions,
        average="weighted",
        zero_division=0
    )

    f1 = f1_score(
        y_test,
        predictions,
        average="weighted",
        zero_division=0
    )

    return {

        "success": True,

        "model": "Random Forest",

        "training_samples": len(
            X_train
        ),

        "testing_samples": len(
            X_test
        ),

        "classes": len(
            label_encoder.classes_
        ),

        "accuracy": round(
            accuracy * 100,
            2
        ),

        "precision": round(
            precision * 100,
            2
        ),

        "recall": round(
            recall * 100,
            2
        ),

        "f1_score": round(
            f1 * 100,
            2
        )
    }