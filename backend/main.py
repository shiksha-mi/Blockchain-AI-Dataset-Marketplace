
import os
import re
import shutil
import uuid
import requests

from typing import Optional

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException
)

from fastapi.middleware.cors import CORSMiddleware

from services.dataset_analyzer import analyze_dataset
from services.ml_validator import validate_model
from services.hash_service import calculate_file_hash
from services.ipfs_service import upload_to_ipfs


# =====================================
# FastAPI application
# =====================================

app = FastAPI(
    title="AI Dataset Marketplace API",
    description=(
        "Dataset validation, ML analysis, "
        "hashing and IPFS service"
    ),
    version="1.0.0"
)


# =====================================
# CORS
# =====================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# =====================================
# Upload directory
# =====================================

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# =====================================
# Health check
# =====================================

@app.get("/")
def home():
    return {
        "success": True,
        "message": "AI Dataset Marketplace Backend is running"
    }


# =====================================
# Analyze uploaded CSV
# =====================================

@app.post("/analyze")
async def analyze_dataset_api(
    file: UploadFile = File(...)
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is missing."
        )

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported."
        )

    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}_{os.path.basename(file.filename)}"
    file_path = os.path.join(UPLOAD_FOLDER, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    analysis = analyze_dataset(file_path)

    if not analysis.get("valid"):
        return analysis

    dataset_hash = calculate_file_hash(file_path)

    return {
        "success": True,
        "filename": file.filename,
        "analysis": analysis,
        "dataset_hash": dataset_hash
    }


# =====================================
# Analyze CSV stored on IPFS
# =====================================

@app.get("/analyze-ipfs/{ipfs_cid}")
async def analyze_ipfs_dataset_api(
    ipfs_cid: str
):
    # Accept a CID only, not a URL or path.
    if not re.fullmatch(r"[A-Za-z0-9]+", ipfs_cid):
        raise HTTPException(
            status_code=400,
            detail="Invalid IPFS CID."
        )

    gateway_url = (
        f"https://gateway.pinata.cloud/ipfs/{ipfs_cid}"
    )

    try:
        response = requests.get(
            gateway_url,
            timeout=60
        )
        response.raise_for_status()

    except requests.RequestException:
        raise HTTPException(
            status_code=502,
            detail=(
                "Could not retrieve this dataset from IPFS. "
                "Check the CID and whether the file is accessible "
                "through the Pinata gateway."
            )
        )

    # Save the retrieved CSV temporarily.
    file_id = str(uuid.uuid4())
    file_path = os.path.join(
        UPLOAD_FOLDER,
        f"{file_id}_dataset.csv"
    )

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(response.content)

        analysis = analyze_dataset(file_path)

        if not analysis.get("valid"):
            return {
                "success": False,
                "ipfs_cid": ipfs_cid,
                "analysis": analysis
            }

        dataset_hash = calculate_file_hash(file_path)

        return {
            "success": True,
            "filename": "dataset.csv",
            "ipfs_cid": ipfs_cid,
            "dataset_hash": dataset_hash,
            "analysis": analysis
        }

    finally:
        # Remove the temporary downloaded copy.
        if os.path.exists(file_path):
            os.remove(file_path)


# =====================================
# ML validation
# =====================================

@app.post("/validate-model")
async def validate_model_api(
    file: UploadFile = File(...),
    target_column: str = Form(...)
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is missing."
        )

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported."
        )

    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}_{os.path.basename(file.filename)}"
    file_path = os.path.join(UPLOAD_FOLDER, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return validate_model(file_path, target_column)


# =====================================
# Upload CSV to IPFS
# =====================================

@app.post("/upload-ipfs")
async def upload_ipfs_api(
    file: UploadFile = File(...)
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is missing."
        )

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported."
        )

    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}_{os.path.basename(file.filename)}"
    file_path = os.path.join(UPLOAD_FOLDER, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    dataset_hash = calculate_file_hash(file_path)
    ipfs_result = upload_to_ipfs(file_path)

    return {
        "success": ipfs_result["success"],
        "dataset_hash": dataset_hash,
        "ipfs": ipfs_result
    }


# =====================================
# Complete verification
# =====================================

@app.post("/verify-dataset")
async def verify_dataset(
    file: UploadFile = File(...),
    target_column: Optional[str] = Form(None)
):
    if not file.filename:
        return {
            "success": False,
            "status": "REJECTED",
            "reason": "Filename is missing."
        }

    if not file.filename.lower().endswith(".csv"):
        return {
            "success": False,
            "status": "REJECTED",
            "reason": "Only CSV datasets are supported."
        }

    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}_{os.path.basename(file.filename)}"
    file_path = os.path.join(UPLOAD_FOLDER, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Step 1: Analyze dataset
    analysis = analyze_dataset(file_path)

    if not analysis.get("valid"):
        return {
            "success": False,
            "status": "REJECTED",
            "reason": analysis.get(
                "error",
                "Dataset analysis failed."
            )
        }

    # Step 2: Quality gate
    if analysis["quality_score"] < 50:
        return {
            "success": False,
            "status": "REJECTED",
            "quality_score": analysis["quality_score"],
            "reason": (
                "Dataset failed the minimum "
                "automated quality threshold."
            ),
            "analysis": analysis
        }

    # Step 3: Hash
    dataset_hash = calculate_file_hash(file_path)

    # Step 4: Optional ML validation
    ml_result = None

    if target_column:
        ml_result = validate_model(
            file_path,
            target_column
        )

    # Step 5: Upload to IPFS
    ipfs_result = upload_to_ipfs(file_path)

    return {
        "success": True,
        "status": "VERIFICATION_COMPLETED",
        "filename": file.filename,
        "quality": analysis,
        "machine_learning": ml_result,
        "security": {
            "algorithm": "SHA-256",
            "sha256": dataset_hash
        },
        "ipfs": ipfs_result
    }
