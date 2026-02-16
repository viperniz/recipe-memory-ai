"""
Vercel Blob storage helper for thumbnail images.

Uses Vercel Blob REST API to store and retrieve thumbnail images,
replacing the ephemeral local filesystem on Render's free tier.
"""
import os
import httpx

BLOB_TOKEN = os.getenv("BLOB_READ_WRITE_TOKEN", "")
BLOB_API_URL = "https://blob.vercel-storage.com"


def upload_thumbnail(image_bytes: bytes, pathname: str) -> str:
      """Upload a thumbnail image to Vercel Blob.

          Args:
                  image_bytes: Raw JPEG bytes of the thumbnail image
                          pathname: Storage path, e.g. "thumbnails/content_20260211_132324/0.jpg"

      Returns:
              The public URL of the uploaded blob

                  Raises:
                          RuntimeError: If BLOB_READ_WRITE_TOKEN is not set or upload fails
                              """
      if not BLOB_TOKEN:
                raise RuntimeError("BLOB_READ_WRITE_TOKEN env var is not set")

      resp = httpx.put(
          f"{BLOB_API_URL}/{pathname}",
          content=image_bytes,
          headers={
              "Authorization": f"Bearer {BLOB_TOKEN}",
              "x-content-type": "image/jpeg",
              "x-cache-control-max-age": "31536000",
          },
          timeout=30,
      )
      resp.raise_for_status()
      data = resp.json()
      return data["url"]


def download_thumbnail(url: str) -> bytes:
      """Download a thumbnail from its Vercel Blob URL.

          Args:
                  url: The full Vercel Blob URL

                      Returns:
                              Raw image bytes
                                  """
      resp = httpx.get(url, timeout=15)
      resp.raise_for_status()
      return resp.content


def delete_thumbnail(url: str) -> None:
      """Delete a thumbnail from Vercel Blob.

      Args:
            url: The full Vercel Blob URL to delete
      """
      if not BLOB_TOKEN:
            return
      httpx.post(
            f"{BLOB_API_URL}/delete",
            json={"urls": [url]},
            headers={"Authorization": f"Bearer {BLOB_TOKEN}"},
            timeout=15,
      )


def is_blob_enabled() -> bool:
      """Check if Vercel Blob storage is configured."""
      return bool(BLOB_TOKEN)


def get_thumbnail_url(blob_path: str) -> str | None:
      """Look up the public URL for a thumbnail stored in Vercel Blob.

      Uses the Vercel Blob list API to find the blob by pathname prefix.

      Args:
            blob_path: Storage path, e.g. "thumbnails/content_20260211_132324/0.jpg"

      Returns:
            The public URL if found, None otherwise.
      """
      if not BLOB_TOKEN:
            return None

      try:
            resp = httpx.get(
                  f"{BLOB_API_URL}",
                  params={"prefix": blob_path, "limit": "1"},
                  headers={"Authorization": f"Bearer {BLOB_TOKEN}"},
                  timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            blobs = data.get("blobs", [])
            if blobs:
                  return blobs[0].get("url")
      except Exception:
            pass
      return None
