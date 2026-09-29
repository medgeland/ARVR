//PA 1 - 3D Shapes in WebGL - 240137
//Variant: Octahedron
//offset (-0.15; -0.15) visible sides: bottom & left
const STUDENT_ID = "240137";
const OFFSET_X = -0.15;
const OFFSET_Y = -0.15;

function main() {
 /*========== Create a WebGL Context ==========*/
    const canvas = document.querySelector("#c");
    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.log("WebGL not supported");
        return;
    }
    /*========== Define and Store the Geometry ==========*/
    const cube=buildCube();
    const solid=buildOctahedron();
    const positions=cube.positions.concat(solid.positions);
    const colors=cube.colors.concat(solid.colors);
    const cubeCount=cube.positions.length/3; //36
    const solidCount=solid.positions.length/3; //24
    const totalCount=cubeCount+solidCount; //60

    console.assert(colors.length===totalCount*4, "Colour array must have exactly 4 values per vertex", colors.length, totalCount);
    const buffers = initBuffers(gl, positions, colors);

    /*========== Shaders ==========*/
    const vsSource = `
        attribute vec4 aPosition;;
        attribute vec4 aVertexColor;
        varying lowp vec4 vColor;
        void main() {
            gl_Position = aPosition;
            gl_PointSize = 6.0;
            vColor = aVertexColor;
        }`
    ;
    const fsSource =`
        varying lowp vec4 vColor;
        void main() {
            gl_FragColor = vColor;
        }`
    ;
    const vertexShader = createshader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createshader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return;
    const program = createprogram(gl, vertexShader, fragmentShader);
    if (!program) return;
    
    /*====== Connect the attributes with the vertex shader ======*/
    // Bind the position buffer BEFORE the position pointer
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    const positionAttributeLocation = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionAttributeLocation);
    // Bind the color buffer BEFORE the color pointer
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    const colorAttributeLocation = gl.getAttribLocation(program, "aVertexColor");
    gl.vertexAttribPointer(colorAttributeLocation, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(colorAttributeLocation);

    /*========== Drawing ==========*/
    const MODE_NAMES = {
        [gl.TRIANGLES]: "Triangles",
        [gl.LINE_LOOP]: "Line Loop",
        [gl.LINES]: "Lines",
        [gl.LINE_STRIP]: "Line Strip",
        [gl.POINTS]: "Points",
        [gl.TRIANGLE_STRIP]: "Triangle Strip",
    };
    const KEY_TO_MODE = {
        "1": gl.TRIANGLES,
        "2": gl.LINE_LOOP,
        "3": gl.LINES,
        "4": gl.LINE_STRIP,
        "5": gl.POINTS,
        "6": gl.TRIANGLE_STRIP,
    };

    const state = { mode: gl.TRIANGLES, depth: true, cubeFirst: true };
    const status = document.querySelector("#status");

    function drawCube() {
        gl.drawArrays(state.mode, 0, cubeCount);
    }
    function drawSolid() {
        gl.drawArrays(state.mode, cubeCount, solidCount);
    }
    function render() {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        if (state.depth) {
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (state.cubeFirst) {
            drawCube();
            drawSolid();
        } else {
            drawSolid();
            drawCube();
        }
        status.textContent = 
         `${STUDENT_ID} | Mode: ${MODE_NAMES[state.mode]}` +
      ` | Depth: ${state.depth ? "ON" : "OFF"}` +
      ` | Order: ${state.cubeFirst ? "Cube First" : "Octahedron First"}`;
    }
    document.addEventListener("keydown", (event) => {
        const key = event.key;
        if (key in KEY_TO_MODE) {
            state.mode = KEY_TO_MODE[key];
        } else if (key === "D") {
            state.depth = !state.depth;
        } else if (key === "S") {
            state.cubeFirst = !state.cubeFirst;
        }
        render();
    });
    render();
}    
/*========== Geometry helpers ==========*/
// Depth illusion rule: x_draw = x + o_x * (z + 0.5), y_draw = y + o_y * (z + 0.5)
function applyOffset(p) {
    const k=p[2]+0.5;
    return [p[0]+offset_X*k, p[1]+offset_Y*k, p[2]];
}
// Flat colour repeated for n vertices
function repeatColor(rgba, n) {
    let out =[];
    for (let i=0; i<n; i++) out=out.concat(rgba);
    return out;
}
function buildCube() {
    const L = -0.8, R = -0.3, B = -0.25, T = 0.25, F = -0.5, K = 0.5;
    const c = {
        fbl: [L, B, F], fbr: [R, B, F], ftr: [R, T, F], ftl: [L, T, F],
        kbl: [L, B, K], kbr: [R, B, K], ktr: [R, T, K], ktl: [L, T, K],
    };
    const faces = [
        { name: "front",  q: [c.fbl, c.fbr, c.ftr, c.ftl] },
        { name: "back",   q: [c.kbl, c.kbr, c.ktr, c.ktl] },
        { name: "top",    q: [c.ftl, c.ftr, c.ktr, c.ktl] },
        { name: "bottom", q: [c.fbl, c.fbr, c.kbr, c.kbl] },
        { name: "left",   q: [c.fbl, c.ftl, c.ktl, c.kbl] },
        { name: "right",  q: [c.fbr, c.ftr, c.ktr, c.kbr] },
    ];
    const flat = {
        back:   [0.5, 0.5, 0.5, 1.0],
        top:    [0.0, 0.8, 0.8, 1.0],
        bottom: [1.0, 0.5, 0.0, 1.0],
        left:   [0.7, 0.0, 0.9, 1.0],
        right:  [0.2, 0.6, 0.2, 1.0],
    };
    const frontCorners = [
        [1.0, 0.0, 0.0, 1.0], 
        [1.0, 1.0, 0.0, 1.0], 
        [0.0, 0.3, 1.0, 1.0], 
        [1.0, 1.0, 1.0, 1.0],
    ];
    let positions = [], colors = [];
    for (const face of faces) {
        const [a,b,cc,d]= face.q;
        for (const p of [a, b, cc, a, cc, d]) 
            positions = positions.concat(applyOffset(p));
if (face.name === "front") {
    const [ca, cb, cc2, cd] = frontCorners;
    colors = colors.concat(ca, cb, cc2, ca, cc2, cd);
} 
else {
    colors = colors.concat(repeatColor(flat[face.name], 6));
}
}
return { positions, colors };
}

function buildOctahedron() {
    const cx=0.5, cy=0.0, r=0.3;
    const px=[cx+r, cy, 0.0];
    const nx=[cx-r, cy, 0.0];
    const py=[cx, cy+r, 0.0];
    const ny=[cx, cy-r, 0.0];
    const pz=[cx, cy, 0.5];
    const nz=[cx, cy, -0.5];
    const faces = [
        [nz, px, py], [nz, py, nx], [nz, nx, ny], [nz, ny, px],
        [pz, px, py], [pz, py, nx], [pz, nx, ny], [pz, ny, px]
    ];
    const faceColors = [
        null,
        [0.9, 0.1, 0.1, 1.0],
        [0.1, 0.4, 1.0, 1.0],
        [0.1, 0.8, 0.2, 1.0],
        [1.0, 0.6, 0.8, 1.0],
        [0.6, 0.4, 0.2, 1.0],
        [0.0, 0.7, 0.7, 1.0],
        [0.8, 0.8, 0.8, 1.0],
    ];
    const gradient = [
        [1.0, 1.0, 0.0, 1.0],
        [1.0, 0.0, 1.0, 1.0],
        [0.0, 1.0, 1.0, 1.0],
    ];

    let positions = [];
    let colors=[];
    faces.forEach((tri, i)=>{
        for (const p of tri) positions=positions.concat(applyOffset(p));
        colors=colors.concat(faceColors[i] ? repeatColor (faceColors[i], 3) : gradient.flat());
    });
    return { positions, colors };
}
/*========== WebGL helpers ==========*/
function createshader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log("Error compiling shader:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createprogram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.log("Error linking program:", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    gl.useProgram(program);
    return program;
}
function initBuffers(gl, positions, colors) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    console.log("Position buffer size (bytes):", positions.length * 4);
    gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE);

    const color=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, color);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    console.log("Colour buffer size (bytes):",
        gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE));
    return { position: positionBuffer, color };
}
    window.addEventListener("load", main);