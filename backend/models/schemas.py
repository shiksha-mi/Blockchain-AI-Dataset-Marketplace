from typing import Optional

from pydantic import BaseModel


class DatasetResponse(BaseModel):

    success: bool

    message: str

    filename: Optional[str] = None

    quality_score: Optional[float] = None

    status: Optional[str] = None

    dataset_hash: Optional[str] = None

    ipfs_hash: Optional[str] = None

    ipfs_url: Optional[str] = None