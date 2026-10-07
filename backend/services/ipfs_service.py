import os

import requests

from dotenv import load_dotenv


load_dotenv()


PINATA_JWT = os.getenv(
    "PINATA_JWT"
)

PINATA_URL = (
    "https://api.pinata.cloud/"
    "pinning/pinFileToIPFS"
)


def upload_to_ipfs(
    file_path: str
):

    if not PINATA_JWT:

        return {
            "success": False,
            "error": (
                "PINATA_JWT is not configured."
            )
        }

    headers = {
        "Authorization":
            f"Bearer {PINATA_JWT}"
    }

    try:

        with open(
            file_path,
            "rb"
        ) as file:

            files = {
                "file": file
            }

            response = requests.post(
                PINATA_URL,
                headers=headers,
                files=files,
                timeout=120
            )

        response.raise_for_status()

        data = response.json()

        ipfs_hash = data.get(
            "IpfsHash"
        )

        return {

            "success": True,

            "ipfs_hash": ipfs_hash,

            "ipfs_url":
                f"https://gateway.pinata.cloud/ipfs/"
                f"{ipfs_hash}"
        }

    except Exception as e:

        return {

            "success": False,

            "error": str(e)
        }