"""Iranian plate grammar, normalization and plate-type rules.

Canonical forms (shared with the NestJS backend and the PWA):
  * standard plate: ``DDLDDDDD`` e.g. ``12ب34567`` (series, letter, 3 digits, region)
  * free-zone plate: ``FZ-<ZONE>-DDDDD`` e.g. ``FZ-KISH-12345``
"""

from __future__ import annotations

import re
from dataclasses import dataclass

PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"

LETTER_TYPES: dict[str, str] = {
    "ب": "PRIVATE", "ج": "PRIVATE", "د": "PRIVATE", "س": "PRIVATE", "ص": "PRIVATE",
    "ط": "PRIVATE", "ق": "PRIVATE", "ل": "PRIVATE", "م": "PRIVATE", "ن": "PRIVATE",
    "و": "PRIVATE", "ه": "PRIVATE", "ی": "PRIVATE",
    "ت": "TAXI",
    "ع": "PUBLIC",
    "ا": "GOVERNMENT",
    "پ": "POLICE",
    "ث": "MILITARY", "ش": "MILITARY", "ز": "MILITARY", "ف": "MILITARY",
    "ژ": "DISABLED",
    "ک": "AGRICULTURAL",
    "ح": "OTHER", "گ": "OTHER",
}
PLATE_LETTERS = "".join(LETTER_TYPES.keys())

LETTER_ALIASES = {
    "آ": "ا", "أ": "ا", "إ": "ا", "ٱ": "ا",
    "ي": "ی", "ى": "ی", "ئ": "ی",
    "ك": "ک",
    "ۀ": "ه", "ة": "ه",
}

FREE_ZONES: dict[str, str] = {
    "KISH": "کیش",
    "QESHM": "قشم",
    "ARVAND": "اروند",
    "ANZALI": "انزلی",
    "CHABAHAR": "چابهار",
    "ARAS": "ارس",
    "MAKU": "ماکو",
}
_FREE_ZONE_BY_NAME = {v: k for k, v in FREE_ZONES.items()}

UNALLOCATED_REGIONS = {"39", "70", "80", "90"}

_STANDARD_RE = re.compile(rf"^(\d{{2}})([{PLATE_LETTERS}])(\d{{3}})(\d{{2}})$")
_FREE_ZONE_CANONICAL_RE = re.compile(r"^FZ-([A-Z]+)-(\d{5})$")


def to_ascii_digits(value: str) -> str:
    out = []
    for ch in value:
        if ch in PERSIAN_DIGITS:
            out.append(str(PERSIAN_DIGITS.index(ch)))
        elif ch in ARABIC_DIGITS:
            out.append(str(ARABIC_DIGITS.index(ch)))
        else:
            out.append(ch)
    return "".join(out)


def plate_type_for_letter(letter: str) -> str | None:
    return LETTER_TYPES.get(letter)


def is_known_region(code: str) -> bool:
    return bool(re.fullmatch(r"[1-9]\d", code)) and code not in UNALLOCATED_REGIONS


@dataclass(frozen=True)
class NormalizedPlate:
    plate: str
    valid: bool
    plate_type: str | None
    parts: dict[str, str] | None

    def as_dict(self) -> dict:
        return {"plate": self.plate, "valid": self.valid, "plateType": self.plate_type, "parts": self.parts}


INVALID = NormalizedPlate("", False, None, None)


def normalize_plate(raw: str | None) -> NormalizedPlate:
    if not raw:
        return INVALID
    text = to_ascii_digits(str(raw)).strip()

    upper = text.upper()
    fz = _FREE_ZONE_CANONICAL_RE.match(upper)
    if fz and fz.group(1) in FREE_ZONES:
        return NormalizedPlate(upper, True, "FREE_ZONE", {"zone": fz.group(1), "number": fz.group(2)})

    for name, code in _FREE_ZONE_BY_NAME.items():
        if name in text:
            digits = re.sub(r"\D", "", text.replace(name, ""))
            if len(digits) == 5:
                return NormalizedPlate(f"FZ-{code}-{digits}", True, "FREE_ZONE", {"zone": code, "number": digits})
            return INVALID

    text = text.replace("ایران", "").replace("IRAN", "").replace("iran", "")
    text = text.replace("الف", "ا")
    text = "".join(LETTER_ALIASES.get(ch, ch) for ch in text)
    text = re.sub(r"[\s\-_|./\\,:;]+", "", text)

    match = _STANDARD_RE.match(text)
    if not match:
        return INVALID
    series, letter, middle, region = match.groups()
    return NormalizedPlate(
        f"{series}{letter}{middle}{region}",
        True,
        plate_type_for_letter(letter),
        {"series": series, "letter": letter, "middle": middle, "region": region},
    )


# Position classes for the standard layout: D D L D D D D D
STANDARD_LAYOUT = ("digit", "digit", "letter", "digit", "digit", "digit", "digit", "digit")


def position_prior(position: int, char: str) -> float:
    """Soft prior on a character at a grammar position (multiplicative).

    Leading digits of the series / middle / region groups are practically never 0 and a
    few region codes are unallocated; we penalise rather than forbid so genuinely odd
    plates can still be read and corrected by the guard.
    """
    if position in (0, 3, 6) and char == "0":
        return 0.05
    return 1.0


def region_prior(region: str) -> float:
    return 1.0 if is_known_region(region) else 0.2
