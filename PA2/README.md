# PA2 - Matrix Transformations and Perspective
## AR/VR/XR Applications
**Student ID:** 240137
**Student Name:** Margarita Serebrennikova

## Variant:
|ID Digit|Value|Rule|Result|
|---|---|---|---|
|Last|7|as in PA1; T = 6 + digit|Octahedron, orbit period T = 13 s|
|Second-to-last|3|3 mod 3 = 0|Cube spins around the x-axis|
|Third-to-last|1|1 mod 3 = 1|Vertical orbit (around the x-axis)|
|Fourth-to-last|0|0 mod 2 = 0|Camera eye (0, 2.5, 7), FOV 45°|

## How to run:
- Open **VS Code** and start Live Server from index.html
- glMatrix 2.8.1 is loaded from cdnjs before index.js

## Keys:
|Key|Effect|
|---|---|
|P|Pause / resume|
|O|Toggle perspective / orthographic|
|+ or =|FOV −5° (zoom in), limited to 20°–100°, perspective only|
|−|FOV +5° (zoom out), limited to 20°–100°, perspective only|
|<|Orbit the camera eye around the y-axis by −5°|
|>|Orbit the camera eye around the y-axis by +5°|
|R|Reset camera and time to their start values|

- Status label at the top left of the screen shows my ID, projection type, FOV in degrees, t to one decimal and fps averaged over the last second.

## Files:
|File|Content|
|---|---|
|index2.html|Canvas, status label, glMatrix script tag, then index2.js|
|index2.js|All JavaScript and GLSL|
|README.md|Student ID, variant parameters, how to run, key map|
|writeup.pdf|E1–E6 and the development log|
|demo.mp4|Screen recording: one full orbit, then P, O, + / −, < / >|
