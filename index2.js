//PA2 - Matrix Transformations and Perspective - 240137
//Variant:
// Last ID digit 7 -> octahedron, orbit period 7+6=13 seconds
// Second-to last ID digit 3 -> 3mod 3 = 0-> cube spins around x-axis
// Third-to-last ID digit 1 -> 1mod 3 = 1-> vertical orbit (around x-axis)
//4th-to-last ID digit 0 -> 0mod 2= 0 -> camera eye (0, 2.5, 7), FOV 45 degrees

const STUDENT_ID = 240137;

//Motion parameters
const CUBE_SPIN_SPEED=1.2; //radians per sec
const CUBE_SPIN_AXIS=[1,0,0]; //x-axis
const ORBIT_RADIUS=2.5;
const ORBIT_PERIOD=13;
const ORBIT_AXIS=[1,0,0]; //x-axis
const SELF_SPIN_SPEED=2.0;

//Camera parameters
const EYE_START=[0, 2.5, 7];
const TARGET=[0,0,0];
const UP=[0,1,0];
const FOV_START=45;
const NEAR=1.0;
const FAR=20.0;

//Orthographic half-height =visible half-height of the perspective view at target distance
const ORTHO_HALF_HEIGHT=vec3.length(EYE_START)*Math.tan((FOV_START*Math.PI/180)/2);
function main() {
    /*========== Create a WebGL Context ==========*/
    const canvas=document.querySelector("#c");
    const gl=canvas.getContext("webgl");
    if(!gl){
        console.log("WebGL 2 not supported");
        return;
    }

    /*========== Define and Store the Geometry ==========*/
    const cube=buildCube();
    const solid=buildOctahedron();
    const positions=cube.positions.concat(solid.positions);
    const colors=cube.colors.concat(solid.colors);
    const cubeCount=cube.positions.length/3;
    const solidCount=solid.positions.length/3;
    const totalCount=cubecount+solidcount;

    console.assert(colors.length===totalcount*4, "Color array must have exactly 4 values per vertex", colors.length, totalcount);
    const buffers=initBuffers(gl, positions, colors);

    /*========== Shaders (once) ==========*/
    const vsSource= `
            attribute vec4 aPosition;
            attribute vec4 aVertexColor;
            uniform mat4 uModelMatrix;
            uniform mat4 uViewMatrix;
            uniform mat4 uProjectionMatrix;
            varying lowp vec4 vColor;
            void main() {
                gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aPosition;
                vColor = aVertexColor;
        }`;

    const fsSource= `
            varying lowp vec4 vColor;
            void main() {
                gl_FragColor = vColor;
        }`;
    const vertexShader=createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader=createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if(!vertexShader || !fragmentShader) return;
    const program=createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;

    /*====== Connect the attributes with the vertex shader ======*/
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    const positionAttributeLocation = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0,0);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    const colorAttributeLocation=gl.getAttribLocation(program, "aVertexColor");
    gl.vertexAttribPointer(colorAttributeLocation, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(colorAttributeLocation);

    /*====== Uniform locations (once) ======*/
    const modelMatrixLocation=gl.getUniformLocation(program, "uModelMatrix");
    const viewMatrixLocation=gl.getUniformLocation(program, "uViewMatrix");
    const projectionMatrixLocation=gl.getUniformLocation(program, "uProjectionMatrix");

    /*====== Fixed render state (once) ======*/
    gl.clearColor(0.0,0.0,0.0,1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    /*========== State ==========*/
    const state = { t: 0, paused: false, ortho: false, fovDeg: FOV_START, azimuth: 0 };
    const status = document.querySelector("#status");
    let aspect = 1;
    function resize() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
        aspect = canvas.width / canvas.height;
    }
    window.addEventListener("resize", resize);
    resize();

    document.addEventListener("keydown", (event) => {
        switch (event.key) {
            case "p": case "P":
                state.paused = !state.paused;
                break;
                case "o": case "O":
                state.ortho = !state.ortho;
                break;
            case "+": case "=":
                if (!state.ortho) state.fovDeg = Math.max(20, state.fovDeg - 5);
                break;
            case "-":
                if (!state.ortho) state.fovDeg = Math.min(100, state.fovDeg + 5);
                break;
            case "ArrowLeft":
                state.azimuth -= 5 * Math.PI / 180;
                break;
            case "ArrowRight":
                state.azimuth += 5 * Math.PI / 180;
                break;
            case "r": case "R":
                state.t = 0;
                state.fovDeg = FOV_START;
                state.azimuth = 0;
                break;
        }
    });

    /*========== Drawing (every frame) ==========*/
    let then = 0;
    let fpsFrames = 0;
    let fpsTime = 0;
    let fps = 0;
    function render(now) {
        now *= 0.001;
        const rawDt = now - then;
        const dt = Math.min(rawDt, 0.1);
        then = now;
        if (!state.paused) state.t += dt;

        // fps averaged over the last second
        fpsFrames++;
        fpsTime += rawDt;
        if (fpsTime >= 1.0) {
            fps = fpsFrames / fpsTime;
            fpsFrames = 0;
            fpsTime = 0;
        }

        //Projection
        const projectionMatrix = mat4.create();
        if (state.ortho) {
            const h = ORTHO_HALF_HEIGHT;
            mat4.ortho(projectionMatrix, -h * aspect, h * aspect, -h, h, NEAR, FAR);
        } else {
            mat4.perspective(projectionMatrix, state.fovDeg * Math.PI / 180, aspect, NEAR, FAR);
        }

        const eye = vec3.create();
        vec3.rotateY(eye, EYE_START, TARGET, state.azimuth);
        const viewMatrix = mat4.create();
        mat4.lookAt(viewMatrix, eye, TARGET, UP);
        gl.uniformMatrix4fv(projectionMatrixLocation, false, projectionMatrix);
        gl.uniformMatrix4fv(viewMatrixLocation, false, viewMatrix);
 
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
 
        gl.uniformMatrix4fv(modelMatrixLocation, false, cubeModelMatrix(state.t));
        gl.drawArrays(gl.TRIANGLES, 0, cubeCount);
 
        gl.uniformMatrix4fv(modelMatrixLocation, false, solidModelMatrix(state.t));
        gl.drawArrays(gl.TRIANGLES, cubeCount, solidCount);

        status.textContent =
            `${STUDENT_ID} | ${state.ortho ? "Orthographic" : "Perspective"}` +
            ` | FOV: ${state.fovDeg}°` +
            ` | t: ${state.t.toFixed(1)} s` +
            ` | ${fps.toFixed(0)} fps` +
            (state.paused ? " | PAUSED" : "");
 
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

/*========== Model matrices ==========*/
function cubeModelMatrix(t) {
    const m = mat4.create();
    mat4.rotate(m, m, CUBE_SPIN_SPEED * t, CUBE_SPIN_AXIS);   // spin in place around x
    return m;
}
function solidModelMatrix(t) {
    const orbitAngle = 2 * Math.PI * t / ORBIT_PERIOD;
    const s = 0.65 + 0.15 * Math.sin(2 * Math.PI * t / 3);
    const m = mat4.create();

    mat4.rotate(m, m, orbitAngle, ORBIT_AXIS);
    mat4.translate(m, m, [0, 0, ORBIT_RADIUS]);
    mat4.rotate(m, m, SELF_SPIN_SPEED * t, [0, 1, 0]);
    mat4.scale(m, m, [s, s, s]);
    return m;
}

/*========== Geometry helpers ==========*/
function repeatColor(rgba, n) {
    let out = [];
    for (let i = 0; i < n; i++) out = out.concat(rgba);
    return out;
}

function buildCube() {
    const L = -0.5, R = 0.5, B = -0.5, T = 0.5, F = 0.5, K = -0.5;
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
        back:   [0.3, 0.5, 0.5, 1.0],
        top:    [0.0, 0.8, 0.8, 1.0],
        bottom: [1.0, 0.5, 1.0, 1.0],
        left:   [0.7, 0.1, 0.9, 1.0],
        right:  [0.2, 0.6, 0.2, 1.0],
    };
    const frontCorners = [
        [0.7, 1.0, 0.0, 1.0],
        [0.5, 1.0, 0.7, 1.0],
        [0.2, 0.3, 1.0, 1.0],
        [1.0, 0.2, 0.2, 1.0],
    ];
    let positions = [], colors = [];
    for (const face of faces) {
        const [a, b, cc, d] = face.q;
        for (const p of [a, b, cc, a, cc, d]) positions = positions.concat(p);
        if (face.name === "front") {
            const [ca, cb, cc2, cd] = frontCorners;
            colors = colors.concat(ca, cb, cc2, ca, cc2, cd);
        } else {
            colors = colors.concat(repeatColor(flat[face.name], 6));
        }
    }
    return { positions, colors };
}

function buildOctahedron() {
    const r = 0.5;
    const px = [ r, 0, 0], nx = [-r, 0, 0];
    const py = [0,  r, 0], ny = [0, -r, 0];
    const pz = [0, 0,  r], nz = [0, 0, -r];
    const faces = [
        [nz, px, py], [nz, py, nx], [nz, nx, ny], [nz, ny, px],
        [pz, px, py], [pz, py, nx], [pz, nx, ny], [pz, ny, px],
    ];
    const faceColors = [
        null,
        [0.0, 0.3, 0.9, 1.0],
        [0.0, 0.7, 0.3, 1.0],
        [0.5, 0.0, 0.5, 1.0],
        [1.0, 0.3, 0.3, 1.0],
        [0.1, 0.9, 0.4, 1.0],
        [0.0, 0.7, 0.7, 1.0],
        [0.8, 0.4, 0.8, 1.0],
    ];
    const gradient = [
        [1.0, 1.0, 0.0, 1.0],
        [1.0, 0.0, 1.0, 1.0],
        [0.0, 1.0, 1.0, 1.0],
    ];
    let positions = [];
    let colors = [];
    faces.forEach((tri, i) => {
        for (const p of tri) positions = positions.concat(p);
        colors = colors.concat(faceColors[i] ? repeatColor(faceColors[i], 3) : gradient.flat());
    });
    return { positions, colors };
}

/*========== WebGL helpers (from PA1) ==========*/
function createShader(gl, type, source) {
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

function createProgram(gl, vertexShader, fragmentShader) {
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
    const color = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, color);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
 
    return { position: positionBuffer, color };
}
window.addEventListener("load", main);


