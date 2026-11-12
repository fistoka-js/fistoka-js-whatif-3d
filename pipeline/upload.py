"""Private YouTube upload with a channel guard.

Rules that cannot be changed by a setting:
  * privacyStatus is always "private".
  * Before uploading we ask YouTube which channel the saved login belongs to and compare it with
    channel_id in settings.yaml. Empty or different = no upload (ChannelGuardError).

Login comes only from the file <VERTICALS_SKILL_DIR or ./.verticals>/youtube_token.json (made by
scripts/setup_youtube_oauth.py; in GitHub it is restored from the YOUTUBE_TOKEN_B64 secret).
Its contents are never printed or logged.
"""
import os
import time
from pathlib import Path

from .settings import ROOT

TRANSIENT_STATUS = {500, 502, 503, 504}
MAX_TRIES = 5
BASE_DELAY = 2.0


class ChannelGuardError(Exception):
    """The saved login is not for the channel named in settings.yaml. Nothing was uploaded."""


class LoginError(RuntimeError):
    """No usable saved YouTube login."""


class UploadResponseError(Exception):
    """YouTube answered the upload without a video id. The video may exist: check Studio before retrying."""


def token_path():
    base = os.environ.get("VERTICALS_SKILL_DIR")
    return (Path(base) if base else ROOT / ".verticals") / "youtube_token.json"


def build_client():
    """Real YouTube client from the saved login (refreshing it if needed)."""
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    p = token_path()
    if not p.exists():
        raise LoginError(f"No YouTube login found at {p}. Run scripts/setup_youtube_oauth.py (docs/CHANNEL_SETUP.md).")
    creds = Credentials.from_authorized_user_file(str(p))
    if creds.expired:
        if not creds.refresh_token:
            raise LoginError("The YouTube login expired and cannot be refreshed. Run scripts/setup_youtube_oauth.py again.")
        creds.refresh(Request())
        p.write_text(creds.to_json(), encoding="utf-8")
    return build("youtube", "v3", credentials=creds)


def check_channel(youtube, expected_id):
    """Raise ChannelGuardError unless the login owns exactly the expected channel. Returns its title."""
    items = youtube.channels().list(part="id,snippet", mine=True).execute().get("items", [])
    found = [(i.get("id", ""), i.get("snippet", {}).get("title", "")) for i in items]
    shown = "; ".join(f"{cid} ({title})" for cid, title in found) or "(none)"
    if not expected_id:
        raise ChannelGuardError(
            f"channel_id in settings.yaml is empty, so nothing is uploaded. The saved login is for: {shown}. "
            "If that is the right channel, copy its ID into settings.yaml.")
    if len(found) != 1 or found[0][0] != expected_id:
        raise ChannelGuardError(
            f"Wrong channel. settings.yaml says {expected_id}; the saved login is for: {shown}. Nothing was uploaded.")
    return found[0][1]


def make_description(description, settings):
    text = (description or "").rstrip()
    if settings.get("synthetic_voice_note"):
        text += "\n\n" + str(settings.get("synthetic_voice_note_text", "")).strip()
    return text.strip()


def make_body(title, description, tags, settings):
    tag_list, total = [], 0
    for t in tags or []:
        t = str(t).strip().lstrip("#")
        if t and total + len(t) + 1 <= 450:      # YouTube allows about 500 characters of tags in total
            tag_list.append(t)
            total += len(t) + 1
    return {
        "snippet": {
            "title": (title or "Untitled").strip()[:100],
            "description": make_description(description, settings),
            "tags": tag_list,
            "categoryId": "27",                  # Education
        },
        "status": {"privacyStatus": "private", "selfDeclaredMadeForKids": False},
    }


def _transient(e):
    status = getattr(getattr(e, "resp", None), "status", None)
    return status in TRANSIENT_STATUS or isinstance(e, (ConnectionError, TimeoutError))


def upload_video(video_path, title, description, tags, settings, youtube=None, sleep=time.sleep, say=print):
    """Guard, then upload privately. Returns the video id."""
    youtube = youtube or build_client()
    channel_title = check_channel(youtube, settings.get("channel_id", ""))
    say(f"channel guard ok: {channel_title}")
    body = make_body(title, description, tags, settings)
    from googleapiclient.http import MediaFileUpload
    media = MediaFileUpload(str(video_path), mimetype="video/mp4", chunksize=8 * 1024 * 1024, resumable=True)
    req = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
    response, tries = None, 0
    while response is None:
        try:
            status, response = req.next_chunk()      # calling it again after an error resumes the upload
            if status:
                say(f"upload {int(status.progress() * 100)}%")
        except Exception as e:
            tries += 1
            if not _transient(e) or tries >= MAX_TRIES:
                raise
            delay = BASE_DELAY * 2 ** (tries - 1)
            say(f"upload hiccup ({type(e).__name__}), retrying in {delay:.0f}s")
            sleep(delay)
    vid = response.get("id") if isinstance(response, dict) else None
    if not isinstance(vid, str) or not vid:
        raise UploadResponseError("YouTube gave no video id. The video may already be in Studio (private). Check before retrying.")
    return vid
