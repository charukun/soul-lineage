"""Losslessly crop the user-provided Golden Base turnaround for upstream intake.

The original sheet stays intact. Rectangles are observed pixel coordinates, and
the isolated side/front/back crops remain reference observations. The scale
annotation at the left of Front is removed as non-character sheet decoration;
this is recorded separately and never treated as observed model surface.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


VIEW_RECTS = {
    "front": (16, 173, 460, 853),
    "side": (452, 173, 723, 853),
    "back": (714, 173, 1150, 853),
}
EXPECTED_SHEET = (1536, 1152)
EXPECTED_SHA256 = "086a1f89616c7c631e23d12f68e305cd3e1a04d5b8ef3832fa3b59c5326d2a50"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare(sheet: Path, destination: Path) -> dict:
    source = Image.open(sheet)
    source.load()
    if source.size != EXPECTED_SHEET or source.mode != "RGB" or sha256(sheet) != EXPECTED_SHA256:
        raise ValueError("This measured Golden Base sheet layout requires the original 1536x1152 RGB input")
    destination.mkdir(parents=True, exist_ok=True)
    views = {}
    for name, rectangle in VIEW_RECTS.items():
        cropped = source.crop(rectangle)
        removed = []
        if name == "front":
            # Only erase the sheet's ruler/HEAD RATIO annotation, outside the
            # illustrated character. Keep the arm crossing its vertical axis.
            for box in ((28, 52, 89, 273), (28, 394, 73, 625),
                        (28, 0, 54, 25), (31, 273, 43, 309),
                        (31, 366, 43, 395)):
                cropped.paste((255, 255, 255), box)
                removed.append([rectangle[0]+box[0], rectangle[1]+box[1], rectangle[0]+box[2], rectangle[1]+box[3]])
        if name == "back":
            # Adjacent panel ornaments are outside the back silhouette.
            for box in ((388, 0, 436, 305), (0, 0, 14, 286)):
                cropped.paste((255, 255, 255), box)
                removed.append([rectangle[0]+box[0], rectangle[1]+box[1], rectangle[0]+box[2], rectangle[1]+box[3]])
        target = destination / (name + ".png")
        cropped.save(target, format="PNG")
        views[name] = {"path": target.name, "sha256": sha256(target), "sheetRect": list(rectangle),
                       "status": "observed pixels, with explicit non-character annotation removal",
                       "removedSheetAnnotationRects": removed}
    record = {"schema": "rinne.sheet-intake/v1", "source": sheet.name, "sourceSha256": sha256(sheet),
              "dimensions": list(EXPECTED_SHEET), "views": views,
              "limitations": ["Rendered turnaround with nonuniform three-view figure scales, not a geometric blueprint",
                              "Side/back occlusions and unseen geometry remain inferred, never observed"]}
    (destination / "crop-evidence.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
    return record


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--sheet", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    print(json.dumps(prepare(args.sheet.resolve(), args.out.resolve())))
