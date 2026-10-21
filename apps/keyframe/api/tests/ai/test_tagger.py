import numpy as np
import pytest
from PIL import Image

from app.ai.tagger import TagLabels, TagThresholds, format_tag, load_labels, preprocess_image, select_tags


@pytest.fixture
def labels(tmp_path) -> TagLabels:
    csv_path = tmp_path / "selected_tags.csv"
    csv_path.write_text(
        "tag_id,name,category,count\n"
        "1,general,9,10\n"          # 0 rating (제외)
        "2,blue_sky,0,10\n"         # 1 general
        "3,1girl,0,10\n"            # 2 general
        "4,^_^,0,10\n"              # 3 general (kaomoji)
        "5,hatsune_miku,4,10\n"     # 4 character
        "6,cloud,0,10\n",           # 5 general
        encoding="utf-8",
    )
    return load_labels(csv_path)


def test_load_labels_splits_categories(labels):
    assert labels.names[1] == "blue_sky"
    assert labels.general.tolist() == [1, 2, 3, 5]
    assert labels.character.tolist() == [4]


def test_select_tags_orders_characters_first_and_applies_thresholds(labels):
    probs = np.array([0.99, 0.40, 0.90, 0.60, 0.95, 0.34], dtype=np.float32)
    result = select_tags(probs, labels, TagThresholds(general=0.35, character=0.85, max_tags=64))
    assert result.keywords == ["hatsune miku", "1girl", "^_^", "blue sky"]
    assert result.prompt == "hatsune miku, 1girl, ^_^, blue sky"


def test_select_tags_respects_character_threshold_max_tags_and_ties(labels):
    probs = np.array([0.0, 0.5, 0.5, 0.0, 0.80, 0.5], dtype=np.float32)
    result = select_tags(probs, labels, TagThresholds(general=0.35, character=0.85, max_tags=2))
    # 동점이면 이름순, character는 기준 미달로 제외
    assert result.keywords == ["1girl", "blue sky"]


def test_select_tags_rejects_mismatched_output(labels):
    with pytest.raises(ValueError, match="모델 출력 크기"):
        select_tags(np.zeros(3), labels, TagThresholds())


def test_format_tag_keeps_kaomoji_underscores():
    assert format_tag("long_hair") == "long hair"
    assert format_tag("^_^") == "^_^"


def test_preprocess_pads_to_white_square_and_converts_to_bgr():
    red = Image.new("RGB", (40, 20), (255, 0, 0))
    batch = preprocess_image(red, size=8)

    assert batch.shape == (1, 3, 8, 8) and batch.dtype == np.float32
    blue_channel, green_channel, red_channel = batch[0]
    center = (4, 4)
    assert red_channel[center] == pytest.approx(1.0)  # (1.0 - 0.5) / 0.5
    assert blue_channel[center] == pytest.approx(-1.0)
    assert green_channel[center] == pytest.approx(-1.0)
    # 위쪽 패딩은 흰색 → 모든 채널 1.0
    assert batch[0, :, 0, 4] == pytest.approx([1.0, 1.0, 1.0])


def test_preprocess_flattens_transparency_onto_white():
    transparent = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
    batch = preprocess_image(transparent, size=4)
    assert np.allclose(batch, 1.0)
