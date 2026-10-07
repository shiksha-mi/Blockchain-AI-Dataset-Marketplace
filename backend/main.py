import os
import shutil
import uuid

from typing import Optional

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form
)

from fastapi.middleware.cors import (
    CORSMiddleware
)


from services.dataset_analyzer import (
    analyze_dataset
)

from services.ml_validator import (
    validate_model
)

from services.hash_service import (
    calculate_file_hash
)

from services.ipfs_service import (
    upload_to_ipfs
)


# =====================================
# FastAPI application
# =====================================

app = FastAPI(
    title="AI Dataset Marketplace API",
    description=(
        "Dataset validation, "
        "ML analysis, hashing and IPFS service"
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

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)


# =====================================
# Health check
# =====================================

@app.get("/")
def home():

    return {
        "success": True,
        "message":
            "AI Dataset Marketplace Backend is running"
    }


# =====================================
# Analyze dataset
# =====================================

@app.post("/analyze")
async def analyze_dataset_api(
    file: UploadFile = File(...)
):

    # Check filename

    if not file.filename:

        return {
            "success": False,
            "error": "Filename is missing."
        }

    # Check CSV

    if not file.filename.lower().endswith(
        ".csv"
    ):

        return {
            "success": False,
            "error":
                "Only CSV files are supported."
        }

    # Generate unique filename

    file_id = str(
        uuid.uuid4()
    )

    safe_filename = (
        f"{file_id}_{file.filename}"
    )

    file_path = os.path.join(
        UPLOAD_FOLDER,
        safe_filename
    )

    # Save file

    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )

    # Analyze

    analysis = analyze_dataset(
        file_path
    )

    if not analysis["valid"]:

        return analysis

    # Hash

    dataset_hash = (
        calculate_file_hash(
            file_path
        )
    )

    return {

        "success": True,

        "filename":
            file.filename,

        "analysis":
            analysis,

        "dataset_hash":
            dataset_hash
    }


# =====================================
# ML validation
# =====================================

@app.post("/validate-model")
async def validate_model_api(

    file: UploadFile = File(...),

    target_column: str = Form(...)
):

    if not file.filename:

        return {
            "success": False,
            "error":
                "Filename is missing."
        }

    if not file.filename.lower().endswith(
        ".csv"
    ):

        return {
            "success": False,
            "error":
                "Only CSV files are supported."
        }

    file_id = str(
        uuid.uuid4()
    )

    safe_filename = (
        f"{file_id}_{file.filename}"
    )

    file_path = os.path.join(
        UPLOAD_FOLDER,
        safe_filename
    )

    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )

    result = validate_model(
        file_path,
        target_column
    )

    return result


# =====================================
# IPFS upload
# =====================================

@app.post("/upload-ipfs")
async def upload_ipfs_api(

    file: UploadFile = File(...)
):

    if not file.filename:

        return {
            "success": False,
            "error":
                "Filename is missing."
        }

    if not file.filename.lower().endswith(
        ".csv"
    ):

        return {
            "success": False,
            "error":
                "Only CSV files are supported."
        }

    file_id = str(
        uuid.uuid4()
    )

    safe_filename = (
        f"{file_id}_{file.filename}"
    )

    file_path = os.path.join(
        UPLOAD_FOLDER,
        safe_filename
    )

    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )

    # Calculate hash

    dataset_hash = (
        calculate_file_hash(
            file_path
        )
    )

    # Upload to IPFS

    ipfs_result = (
        upload_to_ipfs(
            file_path
        )
    )

    return {

        "success":
            ipfs_result["success"],

        "dataset_hash":
            dataset_hash,

        "ipfs":
            ipfs_result
    }


# =====================================
# COMPLETE VERIFICATION
# =====================================

@app.post("/verify-dataset")
async def verify_dataset(

    file: UploadFile = File(...),

    target_column: Optional[str] =
        Form(None)
):

    # ---------------------------------
    # Basic file validation
    # ---------------------------------

    if not file.filename:

        return {
            "success": False,
            "status": "REJECTED",
            "reason":
                "Filename is missing."
        }

    if not file.filename.lower().endswith(
        ".csv"
    ):

        return {
            "success": False,
            "status": "REJECTED",
            "reason":
                "Only CSV datasets are supported."
        }

    # ---------------------------------
    # Save dataset
    # ---------------------------------

    file_id = str(
        uuid.uuid4()
    )

    safe_filename = (
        f"{file_id}_{file.filename}"
    )

    file_path = os.path.join(
        UPLOAD_FOLDER,
        safe_filename
    )

    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )

    # ---------------------------------
    # STEP 1
    # Dataset analysis
    # ---------------------------------

    analysis = analyze_dataset(
        file_path
    )

    if not analysis["valid"]:

        return {
            "success": False,
            "status": "REJECTED",
            "reason":
                analysis["error"]
        }

    # ---------------------------------
    # STEP 2
    # Quality gate
    # ---------------------------------

    if analysis[
        "quality_score"
    ] < 50:

        return {

            "success": False,

            "status": "REJECTED",

            "quality_score":
                analysis["quality_score"],

            "reason":
                "Dataset failed the minimum "
                "automated quality threshold.",

            "analysis":
                analysis
        }

    # ---------------------------------
    # STEP 3
    # Hash
    # ---------------------------------

    dataset_hash = (
        calculate_file_hash(
            file_path
        )
    )

    # ---------------------------------
    # STEP 4
    # ML validation
    # ---------------------------------

    ml_result = None

    if target_column:

        ml_result = validate_model(
            file_path,
            target_column
        )

    # ---------------------------------
    # STEP 5
    # IPFS
    # ---------------------------------

    ipfs_result = upload_to_ipfs(
        file_path
    )

    # ---------------------------------
    # Final response
    # ---------------------------------

    return {

        "success": True,

        "status":
            "VERIFICATION_COMPLETED",

        "filename":
            file.filename,

        "quality":
            analysis,

        "machine_learning":
            ml_result,

        "security": {

            "algorithm":
                "SHA-256",

            "sha256":
                dataset_hash
        },

        "ipfs":
            ipfs_result
    }