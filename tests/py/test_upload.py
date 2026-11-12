import pytest

from pipeline import upload
from pipeline.upload import ChannelGuardError, upload_video


class FakeReq:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)

    def next_chunk(self):
        o = self.outcomes.pop(0)
        if isinstance(o, Exception):
            raise o
        return o


class FakeYoutube:
    def __init__(self, channels, outcomes=None):
        self._channels = channels
        self.outcomes = outcomes or [(None, {"id": "VID123"})]
        self.inserted = []

    def channels(self):
        yt = self

        class C:
            def list(self, **kw):
                assert kw.get("mine") is True

                class E:
                    def execute(_):
                        return {"items": yt._channels}
                return E()
        return C()

    def videos(self):
        yt = self

        class V:
            def insert(self, **kw):
                yt.inserted.append(kw)
                return FakeReq(yt.outcomes)
        return V()


CH = [{"id": "UCgood", "snippet": {"title": "What If 3D"}}]


@pytest.fixture
def mp4(tmp_path):
    p = tmp_path / "v.mp4"
    p.write_bytes(b"0" * 1000)
    return p


def go(yt, mp4, settings, **kw):
    return upload_video(mp4, "T", "D", ["a", "b"], settings, youtube=yt, sleep=lambda s: None, say=lambda m: None, **kw)


def test_match_uploads_private(mp4):
    yt = FakeYoutube(CH)
    assert go(yt, mp4, {"channel_id": "UCgood"}) == "VID123"
    body = yt.inserted[0]["body"]
    assert body["status"]["privacyStatus"] == "private"
    assert body["snippet"]["title"] == "T"


def test_mismatch_refuses_and_shows_both_ids(mp4):
    yt = FakeYoutube(CH)
    with pytest.raises(ChannelGuardError) as e:
        go(yt, mp4, {"channel_id": "UCother"})
    assert "UCother" in str(e.value) and "UCgood" in str(e.value) and "What If 3D" in str(e.value)
    assert yt.inserted == []


def test_empty_setting_refuses(mp4):
    yt = FakeYoutube(CH)
    with pytest.raises(ChannelGuardError):
        go(yt, mp4, {"channel_id": ""})
    assert yt.inserted == []


def test_two_channels_refuses(mp4):
    yt = FakeYoutube(CH + [{"id": "UCx", "snippet": {"title": "x"}}])
    with pytest.raises(ChannelGuardError):
        go(yt, mp4, {"channel_id": "UCgood"})


def test_synthetic_note_only_when_asked():
    s = {"synthetic_voice_note": False, "synthetic_voice_note_text": "NOTE"}
    assert "NOTE" not in upload.make_body("t", "desc", [], s)["snippet"]["description"]
    s["synthetic_voice_note"] = True
    assert upload.make_body("t", "desc", [], s)["snippet"]["description"].endswith("NOTE")


def test_privacy_cannot_be_overridden():
    body = upload.make_body("t", "d", [], {"privacy": "public", "privacyStatus": "public"})
    assert body["status"]["privacyStatus"] == "private"


def test_retries_transient_then_succeeds(mp4):
    yt = FakeYoutube(CH, [ConnectionError("blip"), (None, {"id": "V2"})])
    assert go(yt, mp4, {"channel_id": "UCgood"}) == "V2"


def test_non_transient_error_raises(mp4):
    yt = FakeYoutube(CH, [ValueError("bad")])
    with pytest.raises(ValueError):
        go(yt, mp4, {"channel_id": "UCgood"})


def test_missing_video_id(mp4):
    yt = FakeYoutube(CH, [(None, {})])
    with pytest.raises(upload.UploadResponseError):
        go(yt, mp4, {"channel_id": "UCgood"})
