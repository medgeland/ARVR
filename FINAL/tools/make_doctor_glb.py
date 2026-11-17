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

# helpers
def srgb_to_linear(hex_colour):
    """glTF stores colors in linear space; the hex values above are sRGB"""
    out = []
    for i in (1, 3, 5):
        c = int(hex_colour[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out + [1.0]
def quat_z(deg):
    a = math.radians(deg) / 2
    return [0.0, 0.0, math.sin(a), math.cos(a)]
def quat_x(deg):
    a = math.radians(deg) / 2
    return [math.sin(a), 0.0, 0.0, math.cos(a)]
class Builder:
    def __init__(self):
        self.bin = bytearray()
        self.gltf = {
            "asset": {"version": "2.0", "generator": "make_doctor_glb.py (240137)"},
            "scene": 0, "scenes": [{"nodes": []}], "nodes": [], "meshes": [],
            "materials": [], "accessors": [], "bufferViews": [], "buffers": [], "animations": [],
        }
        self.mesh_for_colour = {}
    def add_data(self, fmt, values, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        offset = len(self.bin)
        self.bin += struct.pack("<" + fmt * len(values), *values)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(self.bin) - offset}
        if target:
            view["target"] = target
        self.gltf["bufferViews"].append(view)
        return len(self.gltf["bufferViews"]) - 1
    def accessor(self, view, ctype, count, atype, minv=None, maxv=None):
        acc = {"bufferView": view, "componentType": ctype, "count": count, "type": atype}
        if minv is not None:
            acc["min"], acc["max"] = minv, maxv
        self.gltf["accessors"].append(acc)
        return len(self.gltf["accessors"]) - 1
    def build_cube(self):
        """One unit cube (24 vertices so each face has flat normals), shared by every part"""
        pos, nor, idx = [], [], []
        faces = [((1, 0, 0), (0, 1, 0), (0, 0, 1)), ((-1, 0, 0), (0, 1, 0), (0, 0, -1)),
                 ((0, 1, 0), (0, 0, 1), (1, 0, 0)), ((0, -1, 0), (0, 0, -1), (1, 0, 0)),
                 ((0, 0, 1), (0, 1, 0), (-1, 0, 0)), ((0, 0, -1), (0, 1, 0), (1, 0, 0))]
        for n, u, v in faces:
            base = len(pos) // 3
            for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                p = [0.5 * n[k] + 0.5 * su * u[k] + 0.5 * sv * v[k] for k in range(3)]
                pos += p
                nor += list(n)
            # winding chosen so face is front-facing along its normal
            a, b, c, d = base, base + 1, base + 2, base + 3
            tri = [a, b, c, a, c, d]
            p0, p1, p2 = (pos[a * 3:a * 3 + 3], pos[b * 3:b * 3 + 3], pos[c * 3:c * 3 + 3])
            e1 = [p1[k] - p0[k] for k in range(3)]
            e2 = [p2[k] - p0[k] for k in range(3)]
            cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
            if sum(cross[k] * n[k] for k in range(3)) < 0:
                tri = [a, c, b, a, d, c]
            idx += tri
        self.pos = self.accessor(self.add_data("f", pos, 34962), 5126, 24, "VEC3", [-0.5] * 3, [0.5] * 3)
        self.nor = self.accessor(self.add_data("f", nor, 34962), 5126, 24, "VEC3")
        self.idx = self.accessor(self.add_data("H", idx, 34963), 5123, 36, "SCALAR")
    
    def mesh(self, colour, own_name=None):
        """One mesh per colour (a glTF primitive has one material), a named part can get its own"""
        key = own_name or colour
        if key not in self.mesh_for_colour:
            self.gltf["materials"].append({
                "name": own_name or ("Mat_" + colour[1:]),
                "pbrMetallicRoughness": {"baseColorFactor": srgb_to_linear(colour),
                                         "metallicFactor": 0.0, "roughnessFactor": 0.85}})
            self.gltf["meshes"].append({"primitives": [{
                "attributes": {"POSITION": self.pos, "NORMAL": self.nor},
                "indices": self.idx, "material": len(self.gltf["materials"]) - 1}]})
            self.mesh_for_colour[key] = len(self.gltf["meshes"]) - 1
        return self.mesh_for_colour[key]

    def node(self, name, children=None, translation=None, scale=None, mesh=None):
        n = {"name": name}
        if translation:
            n["translation"] = [float(t) for t in translation]
        if scale:
            n["scale"] = [float(s) for s in scale]
        if mesh is not None:
            n["mesh"] = mesh
        if children:
            n["children"] = children
        self.gltf["nodes"].append(n)
        return len(self.gltf["nodes"]) - 1
    
    def parts(self, parts, offset=(0, 0, 0)):
        ids = []
        for name, colour, size, centre in parts:
            own = name if name == "Patch" else None
            pos = [centre[k] - offset[k] for k in range(3)]
            ids.append(self.node(name, translation=pos, scale=size, mesh=self.mesh(colour, own)))
        return ids

    def clip(self, name, tracks):
        """tracks: list of (node id, path, times, values-per-key)"""
        anim = {"name": name, "samplers": [], "channels": []}
        for node, path, times, values in tracks:
            t = self.accessor(self.add_data("f", times), 5126, len(times), "SCALAR", [min(times)], [max(times)])
            flat = [x for v in values for x in v]
            atype = "VEC4" if path == "rotation" else "VEC3"
            v = self.accessor(self.add_data("f", flat), 5126, len(values), atype)
            anim["samplers"].append({"input": t, "output": v, "interpolation": "LINEAR"})
            anim["channels"].append({"sampler": len(anim["samplers"]) - 1, "target": {"node": node, "path": path}})
        self.gltf["animations"].append(anim)

    def write(self, path):
        while len(self.bin) % 4:
            self.bin.append(0)
        self.gltf["buffers"].append({"byteLength": len(self.bin)})
        js = json.dumps(self.gltf, separators=(",", ":")).encode()
        js += b" " * ((4 - len(js) % 4) % 4)
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        out = struct.pack("<III", 0x46546C67, 2, total)
        out += struct.pack("<II", len(js), 0x4E4F534A) + js
        out += struct.pack("<II", len(self.bin), 0x004E4942) + bytes(self.bin)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(out)
        return total
def sampled(duration, steps, fn):
    times = [duration * i / steps for i in range(steps + 1)]
    return times, [fn(t) for t in times]
    