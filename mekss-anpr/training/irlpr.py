"""IR-LPR (https://github.com/mut-deep/IR-LPR) plate-split helpers.

Each plate crop ``*.jpg`` has a VOC ``*.xml`` with one object per character; the plate text is the
characters sorted by x-centre, mapped onto the CRNN label set.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

LETTER_MAP = {"الف": "ا", "ه\u200d": "ه"}


def label_for(xml: Path) -> str | None:
    """Canonical ``12ب34567`` text for one annotation, or None for non-standard plates."""
    objs = []
    for o in ET.parse(xml).findall("object"):
        name = (o.findtext("name") or "").strip()
        if name.startswith("ژ"):  # the disabled-driver symbol is annotated with a suffix
            name = "ژ"
        name = LETTER_MAP.get(name, name).replace("\u200d", "")
        bb = o.find("bndbox")
        objs.append(((float(bb.findtext("xmin")) + float(bb.findtext("xmax"))) / 2, name))
    objs.sort()
    text = "".join(n for _, n in objs)
    if len(text) != 8 or not (text[:2].isdigit() and text[3:].isdigit() and not text[2].isdigit()):
        return None
    return text


def iter_split(root: Path):
    """Yield ``(jpg_path, label)`` for every usable annotation under ``root``."""
    for xml in sorted(Path(root).rglob("*.xml")):
        lab = label_for(xml)
        jpg = xml.with_suffix(".jpg")
        if lab and jpg.exists():
            yield jpg, lab
