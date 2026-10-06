# PA1 - 3D Shapes in WebGL
#AR/VR/XR Applications 
**Student ID:** 240137
**Student Name**: Margarita Serebrennikova
## Variant:
|ID Digit|Value|Result|
|---|---|---|
|Last Digit|7|Octahedron|
|Second-to-last|3 (Mod 4=3)| Offset (-0.15;-0.15) Faces: bottom and left|

Depth Illusion rule, Applied Offset:
x_draw=x+o_x*(z+0.5)
y_draw=y+o_y*(z+0.5)

## Scene:
- Cube: 6 faces, 12 triangles and 36 vertices, all x-coordinates <0 (left side of the canvas). Gradient on front face
- Octahedron: 8 faces, 8 triangles and 24 vertices, all x-coordinates >0 (right side of canvas). Gradient on front upper-right side
- Both solids share 1 position buffer and 1 color buffer (total vertices=60)
    - gl.drawArrays call:
    - cube: first=0, count=36
    - octahedron: first=36, count=24

## How to run:
- Same as during practical classes, open **VS Code** Live Server from 'index.html'

## Keys:
Modes:
|Key|Effect|
|---|---|
|1|gl.TRIANGLES (set up as default)|
|2|gl.LINE_LOOP|
|3|gl.LINES|
|4|gl.LINE_STRIP|
|5|gl.POINTS|
|6|gl.TRIANGLE_STRIP|
|D|Depth ON/OFF Testing|
|S|Draw order swapping: Cube first/Octahedron first|

- Status Label at top Left side of the screen shows my ID, Mode, Depth ON/OFF and Drawing Order parameters. It updates every time you press any of the keys specified above.
