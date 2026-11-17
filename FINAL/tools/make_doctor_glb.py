"""
Capstone – First Laser Visit – 240137
make_doctor_glb.py: builds the block doctor as models/doctor.glb (own work), with animation clips
that A-Frame plays through aframe-extras' animation-mixer:

    Idle  – slow breathing bob (loop)
    Talk  – small head nods + bob (loop, while the doctor speaks)
    Wave  – right arm up, wiggles, down (once)
    Jump  – two small happy jumps (once)

Named nodes the app uses at runtime: "Goggles" (shown during the demo), "Patch" (the light patch on
the right hand, recoloured in the time-lapse), "ArmR", "Head", "Body".

No libraries: it writes the glTF 2.0 binary format directly (JSON chunk + BIN chunk).
Spec: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
Run from the CAPSTONE folder:  python3 tools/make_doctor_glb.py
"""

import json
import math
import struct
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "models" / "doctor.glb"
# Every part is a box: (name, colour, size w h d, centre x y z). Positions are in the doctor's own
# space (feet at y = 0, facing +z), the same numbers the A-Frame version used.
SKIN, COAT, COAT2, HAIR, INK = "#e8b98f", "#f5f5f5", "#fafafa", "#4e342e", "#283593"
BODY_PARTS = [
    ("ShoeL", "#3e2723", (0.12, 0.07, 0.22), (-0.09, 0.035, 0.03)),
    ("ShoeR", "#3e2723", (0.12, 0.07, 0.22), (0.09, 0.035, 0.03)),
    ("LegL", "#37474f", (0.12, 0.62, 0.13), (-0.09, 0.38, 0)),
    ("LegR", "#37474f", (0.12, 0.62, 0.13), (0.09, 0.38, 0)),
    ("CoatLow", COAT, (0.44, 0.36, 0.27), (0, 0.72, 0)),
    ("Torso", COAT2, (0.46, 0.5, 0.27), (0, 1.12, 0)),
    ("Seam", "#cfd8dc", (0.006, 0.84, 0.005), (0, 0.88, 0.137)),
    ("Scrubs", "#26a69a", (0.13, 0.15, 0.01), (0, 1.29, 0.136)),
    ("Button1", "#b0bec5", (0.02, 0.02, 0.008), (0.025, 1.06, 0.138)),
    ("Button2", "#b0bec5", (0.02, 0.02, 0.008), (0.025, 0.9, 0.138)),
    ("Pocket", "#eceff1", (0.1, 0.08, 0.006), (0.13, 0.98, 0.137)),
    ("Pen", INK, (0.012, 0.06, 0.008), (0.11, 1.04, 0.14)),
    ("Badge", INK, (0.09, 0.05, 0.006), (-0.13, 1.22, 0.138)),
    ("BadgeLine", "#ffffff", (0.06, 0.01, 0.004), (-0.13, 1.225, 0.142)),
    ("StethL", "#263238", (0.025, 0.22, 0.02), (-0.075, 1.24, 0.14)),
    ("StethR", "#263238", (0.025, 0.18, 0.02), (0.075, 1.26, 0.14)),
    ("StethDisc", "#b0bec5", (0.05, 0.05, 0.012), (0.075, 1.15, 0.146)),
    ("Neck", SKIN, (0.1, 0.06, 0.1), (0, 1.4, 0)),
    ("SleeveL", COAT, (0.11, 0.46, 0.12), (-0.29, 1.11, 0)),
    ("HandL", SKIN, (0.09, 0.09, 0.1), (-0.29, 0.835, 0)),
]
HEAD_PIVOT = (0, 1.43, 0) # head nods around the neck
HEAD_PARTS = [
    ("HeadBlock", SKIN, (0.28, 0.3, 0.27), (0, 1.58, 0)),
    ("HairTop", HAIR, (0.3, 0.08, 0.29), (0, 1.75, 0)),
    ("HairBack", HAIR, (0.3, 0.24, 0.05), (0, 1.62, -0.125)),
    ("HairL", HAIR, (0.03, 0.13, 0.24), (-0.145, 1.66, -0.02)),
    ("HairR", HAIR, (0.03, 0.13, 0.24), (0.145, 1.66, -0.02)),
    ("EyeL", "#1a1a2e", (0.035, 0.035, 0.01), (-0.06, 1.6, 0.136)),
    ("EyeR", "#1a1a2e", (0.035, 0.035, 0.01), (0.06, 1.6, 0.136)),
    ("GlassTopL", INK, (0.09, 0.012, 0.008), (-0.06, 1.632, 0.141)),
    ("GlassTopR", INK, (0.09, 0.012, 0.008), (0.06, 1.632, 0.141)),
    ("GlassLowL", INK, (0.09, 0.008, 0.008), (-0.06, 1.568, 0.141)),
    ("GlassLowR", INK, (0.09, 0.008, 0.008), (0.06, 1.568, 0.141)),
    ("GlassBridge", INK, (0.03, 0.008, 0.008), (0, 1.625, 0.141)),
    ("Smile", "#a1665e", (0.09, 0.014, 0.01), (0, 1.5, 0.136)),
    ("SmileL", "#a1665e", (0.02, 0.014, 0.01), (-0.05, 1.51, 0.136)),
    ("SmileR", "#a1665e", (0.02, 0.014, 0.01), (0.05, 1.51, 0.136)),
]
GOGGLE_PARTS = [ # inside the head, hidden by the app until demo
    ("GoggleLens", "#ff9a3c", (0.25, 0.08, 0.03), (0, 1.6, 0.15)),
    ("GoggleStrap", "#37474f", (0.3, 0.025, 0.28), (0, 1.6, 0)),
]
ARM_PIVOT = (0.29, 1.34, 0) # right arm waves around the shoulder
ARM_PARTS = [
    ("SleeveR", COAT, (0.11, 0.46, 0.12), (0, -0.23, 0)),
    ("HandR", SKIN, (0.09, 0.09, 0.1), (0, -0.505, 0)),
    ("Patch", "#fbefe4", (0.092, 0.05, 0.06), (0, -0.49, 0.022)),   # own material: recoloured live
]
