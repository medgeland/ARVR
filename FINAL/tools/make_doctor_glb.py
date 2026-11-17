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
