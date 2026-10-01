import cv2
import numpy as np

from app.pipeline.color import classify_plate_color, color_conflicts
from app.pipeline.rectify import find_plate_quad, pad_box, rectify
from app.pipeline.recognizer import prep_crnn, shift_variants


def synthetic_plate(bg=(255, 255, 255), size=(460, 100)) -> np.ndarray:
    w, h = size
    img = np.full((h, w, 3), bg, dtype=np.uint8)
    img[:, : int(w * 0.1)] = (160, 60, 0)  # blue strip (BGR)
    cv2.putText(img, "12 B 345 67", (int(w * 0.14), int(h * 0.72)), cv2.FONT_HERSHEY_SIMPLEX, 1.8, (0, 0, 0), 5)
    return img


def light_text_plate(bg) -> np.ndarray:
    img = synthetic_plate(bg)
    img[(img == 0).all(axis=2)] = 255
    return img


def test_color_classification():
    assert classify_plate_color(synthetic_plate((255, 255, 255))) == "white"
    assert classify_plate_color(synthetic_plate((0, 210, 255))) == "yellow"
    assert classify_plate_color(synthetic_plate((30, 30, 220))) == "red"


def test_white_plate_under_colour_cast_is_white():
    # Blue-tinted white in shade (HSV saturation ~75, value 255).
    assert classify_plate_color(synthetic_plate((255, 215, 180))) == "white"


def test_coloured_plates_with_white_characters():
    assert classify_plate_color(light_text_plate((30, 30, 200))) == "red"
    assert classify_plate_color(light_text_plate((170, 40, 10))) == "blue"
    assert classify_plate_color(light_text_plate((40, 140, 20))) == "green"
    # Red straddles hue 0/180; a median of such hues lands in between.
    mixed = light_text_plate((30, 30, 200))
    mixed[:, ::2] = (60, 20, 200)
    assert classify_plate_color(mixed) == "red"


def test_color_conflict():
    assert color_conflicts("yellow", "PRIVATE")
    assert not color_conflicts("yellow", "TAXI")
    assert not color_conflicts("unknown", "PRIVATE")


def test_perspective_quad_found_on_tilted_plate():
    plate = synthetic_plate()
    cv2.rectangle(plate, (0, 0), (plate.shape[1] - 1, plate.shape[0] - 1), (0, 0, 0), 4)
    canvas = np.full((260, 640, 3), 90, dtype=np.uint8)
    src = np.float32([[0, 0], [459, 0], [459, 99], [0, 99]])
    dst = np.float32([[80, 70], [560, 40], [570, 150], [70, 170]])
    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(plate, M, (640, 260), dst=canvas, borderMode=cv2.BORDER_TRANSPARENT)
    quad = find_plate_quad(warped)
    assert quad is not None
    rectified, method = rectify(warped)
    assert method == "perspective"
    h, w = rectified.shape[:2]
    assert 4.0 < w / h < 5.0


def test_pad_box_is_clamped():
    assert pad_box(5, 5, 100, 20, (50, 110), 0.2) == (0, 1, 110, 28)


def test_prep_crnn_shape_and_variants():
    plate = synthetic_plate()
    out = prep_crnn(plate)
    assert out.shape == (32, 128)
    assert out.dtype == np.uint8
    assert len(shift_variants(plate)) == 2
