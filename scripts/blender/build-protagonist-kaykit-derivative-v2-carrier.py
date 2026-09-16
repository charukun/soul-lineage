#!/usr/bin/env python3
"""Blender Carrier entrypoint for the KayKit-derived protagonist builder.

Blender 4.0 factory-empty files do not always create a World datablock.  Keep the
actual derivative builder unchanged and provide the carrier-specific scene bootstrap
here so the same builder remains easy to audit for source-part reuse.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

BUILDER = Path(__file__).with_name("build-protagonist-kaykit-derivative-v2.py")
spec = importlib.util.spec_from_file_location("rinne_protagonist_kaykit_builder", BUILDER)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Unable to load builder: {BUILDER}")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def reset_scene_with_world() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("RINNE Character Review World")
    scene.world.color = (0.035, 0.045, 0.05)


# Keep this shim in the carrier trigger set so exact-source DCC regeneration is explicit.
module.reset_scene = reset_scene_with_world
module.main()
