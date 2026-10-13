import numpy as np

from app.pipeline.detector import Detection, YoloDetector, merge_detections, tile_windows


def test_tile_windows_cover_the_frame_with_overlap():
    tiles = tile_windows(1600, 1200)
    assert len(tiles) == 4
    assert {(x, y) for x, y, _, _ in tiles} == {(0, 0), (1600 - 992, 0), (0, 1200 - 744), (1600 - 992, 1200 - 744)}
    for x, y, w, h in tiles:
        assert x >= 0 and y >= 0 and x + w <= 1600 and y + h <= 1200
    # Neighbouring tiles overlap, so a plate on a seam is fully inside at least one tile.
    assert tiles[0][2] > 1600 - tiles[0][2]


def test_merge_detections_keeps_the_most_confident_of_overlapping_boxes():
    dets = [
        Detection(100, 100, 200, 50, 0.4, "yolo-tile"),
        Detection(104, 102, 198, 49, 0.8, "yolo-tile"),
        Detection(900, 600, 180, 45, 0.5, "yolo-tile"),
    ]
    merged = merge_detections(dets, 0.45)
    assert [d.conf for d in merged] == [0.8, 0.5]


def _detector(run):
    det = object.__new__(YoloDetector)
    det.session = object()
    det.input_name = "images"
    det.fixed_size = None
    det.fallback = None
    det.size = 416
    det.fallback_size = 640
    det.conf = 0.25
    det.photo_conf = 0.15
    det.iou = 0.45
    det._run = run
    return det


def test_photo_mode_tries_larger_scales_then_tiles_and_maps_boxes_back():
    calls = []
    image = np.zeros((1200, 1600, 3), dtype=np.uint8)

    def run(_session, _name, img, size, source, conf=None):
        calls.append((img.shape[:2], size, source, conf))
        # The small plate is only found once a tile enlarges it: bottom-right tile.
        if source == "yolo-tile" and img.shape[:2] == (744, 992) and len([c for c in calls if c[2] == "yolo-tile"]) == 4:
            return [Detection(50, 60, 120, 30, 0.6, "yolo-tile")]
        return []

    dets = _detector(run).detect(image, "photo")
    assert [c[1] for c in calls[:2]] == [640, 960]
    assert all(c[3] == 0.15 for c in calls)
    assert len(dets) == 1
    assert (dets[0].x, dets[0].y) == (1600 - 992 + 50, 1200 - 744 + 60)


def test_live_mode_is_a_fast_path_without_tiles():
    calls = []

    def run(_session, _name, img, size, source, conf=None):
        calls.append((size, source))
        return []

    assert _detector(run).detect(np.zeros((1200, 1600, 3), dtype=np.uint8), "live") == []
    assert calls == [(416, "yolo"), (640, "yolo")]


def test_fallback_detector_only_runs_for_photos():
    calls = []

    def run(_session, _name, img, size, source, conf=None):
        calls.append(source)
        return []

    det = _detector(run)
    det.fallback = object()
    det.fallback_input = "images"
    det.detect(np.zeros((480, 640, 3), dtype=np.uint8), "live")
    assert "yolo-fallback" not in calls
    calls.clear()
    det.detect(np.zeros((480, 640, 3), dtype=np.uint8), "photo")
    assert calls[-1] == "yolo-fallback"


def test_fixed_size_models_only_run_at_their_size():
    calls = []

    def run(_session, _name, img, size, source, conf=None):
        calls.append(size)
        return [Detection(0, 0, 10, 5, 0.9, source)]

    det = _detector(run)
    det.fixed_size = 640
    det.detect(np.zeros((480, 640, 3), dtype=np.uint8), "photo")
    assert calls == [640]
