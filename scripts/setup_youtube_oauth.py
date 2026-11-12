#!/usr/bin/env python3
"""One-time YouTube login for the upload step.

Run it on your own computer, choosing the NEW channel when Google asks. It opens a browser, then
saves the login to .verticals/youtube_token.json inside this repo folder (git ignores that folder).
Step by step: docs/CHANNEL_SETUP.md

    python scripts/setup_youtube_oauth.py [path/to/client_secret.json]
"""
import os
import sys
from pathlib import Path

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",  # also lets us ask which channel the login is for
]
ROOT = Path(__file__).resolve().parents[1]
TOKEN_PATH = ROOT / ".verticals" / "youtube_token.json"


def main():
    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError:
        print("Missing packages. Run: pip install -r pipeline/requirements.txt")
        return 1
    secrets = sys.argv[1] if len(sys.argv) > 1 else input("Path to your client_secret.json: ").strip().strip('"')
    if not Path(secrets).expanduser().exists():
        print(f"File not found: {secrets}")
        return 1
    flow = InstalledAppFlow.from_client_secrets_file(str(Path(secrets).expanduser()), SCOPES)
    print("Opening your browser. Sign in and choose the NEW channel.")
    creds = flow.run_local_server(port=0)
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(TOKEN_PATH), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(creds.to_json())
    print(f"Login saved to {TOKEN_PATH}")
    # Show which channel this login is for, so you can copy the ID into settings.yaml.
    items = build("youtube", "v3", credentials=creds).channels().list(part="id,snippet", mine=True).execute().get("items", [])
    for i in items:
        print(f"Channel: {i['snippet']['title']}   ID: {i['id']}")
    if not items:
        print("This login has no YouTube channel. Create the channel first, then run this again.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
