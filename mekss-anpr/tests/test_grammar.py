from app.pipeline.grammar import is_known_region, normalize_plate


def test_shared_normalization_vectors(vectors):
    for case in vectors["normalize"]:
        result = normalize_plate(case["input"])
        assert result.plate == case["plate"], case
        assert result.valid == case["valid"], case
        assert result.plate_type == case["plateType"], case


def test_region_codes(vectors):
    for code in vectors["regions"]["known"]:
        assert is_known_region(code), code
    for code in vectors["regions"]["unknown"]:
        assert not is_known_region(code), code


def test_parts_are_exposed():
    parts = normalize_plate("۱۲ ب ۳۴۵ ۶۷").parts
    assert parts == {"series": "12", "letter": "ب", "middle": "345", "region": "67"}
