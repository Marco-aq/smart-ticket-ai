
from pathlib import Path
import json

import joblib
import pandas as pd
from huggingface_hub import hf_hub_download
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


BASE_DIR = Path(__file__).resolve().parents[1]
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

DATASET_REPO = "vasu1111/customer-support-tickets"
DATASET_FILE = "aa_dataset-tickets-multi-lang-5-2-50-version.csv"


def load_data():
    path = hf_hub_download(
        repo_id=DATASET_REPO,
        filename=DATASET_FILE,
        repo_type="dataset",
    )

    df = pd.read_csv(path, low_memory=False)

    print("Dataset original:", df.shape)
    print("Columnas:", df.columns.tolist())

    # Seleccionar idioma inglés.
    df = df[
        df["language"].astype(str).str.lower() == "en"
    ].copy()

    df = df.dropna(subset=["queue", "priority"])

    df["subject"] = df["subject"].fillna("")
    df["body"] = df["body"].fillna("")

    df["text"] = (
        df["subject"].astype(str)
        + " "
        + df["body"].astype(str)
    ).str.strip()

    df = df[df["text"].str.len() >= 15]

    df["queue"] = df["queue"].astype(str).str.strip()
    df["priority"] = df["priority"].astype(str).str.strip()

    # Evitar registros exactamente duplicados.
    df = df.drop_duplicates(subset=["text"])

    # Primera versión: las ocho categorías más frecuentes.
    categories = df["queue"].value_counts().head(8).index
    df = df[df["queue"].isin(categories)].copy()

    print("Registros utilizables:", len(df))
    print("Categorías:", df["queue"].value_counts())
    print("Prioridades:", df["priority"].value_counts())

    return df


def create_model():
    return Pipeline([
        (
            "tfidf",
            TfidfVectorizer(
                max_features=50000,
                ngram_range=(1, 2),
                min_df=2,
                sublinear_tf=True,
            ),
        ),
        (
            "classifier",
            LogisticRegression(
                max_iter=1000,
                class_weight="balanced",
                random_state=42,
            ),
        ),
    ])


def train():
    df = load_data()

    train_df, test_df = train_test_split(
        df,
        test_size=0.20,
        random_state=42,
        stratify=df["queue"],
    )

    results = {}

    for target, filename in [
        ("queue", "category_model.joblib"),
        ("priority", "priority_model.joblib"),
    ]:
        print(f"\nEntrenando modelo: {target}")

        model = create_model()

        model.fit(
            train_df["text"],
            train_df[target],
        )

        predictions = model.predict(test_df["text"])

        print(
            classification_report(
                test_df[target],
                predictions,
                zero_division=0,
            )
        )

        results[target] = {
            "accuracy": float(
                accuracy_score(
                    test_df[target],
                    predictions,
                )
            ),
            "macro_f1": float(
                f1_score(
                    test_df[target],
                    predictions,
                    average="macro",
                    zero_division=0,
                )
            ),
        }

        joblib.dump(model, MODELS_DIR / filename)
        print("Modelo guardado:", filename)

    with open(
        MODELS_DIR / "metrics.json",
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(results, file, indent=2)

    print("\nMétricas finales:")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    train()
