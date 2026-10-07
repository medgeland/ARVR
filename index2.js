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
    const gl=canvas.getContext("webgl2");
    if(!gl){
        console.log("WebGL 2 not supported");
        return;
    }

    /*========== Define and Store the Geometry ==========*/
    const cube=buildCube();
    const solid=buildOctahedron();
    const positions=cube.positions.concat(solid.positions);
    const colors=cube.colors.concat(solid.colors);
    const cubecount=cube.positions.length/3;
    const solidcount=solid.positions.length/3;
    const totalcount=cubecount+solidcount;

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
            void main();
                gl_FragColor = vColor;
        }`;
    const vertexShader=createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader=createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if(!vertexShader || !fragmentShader) return;
    const program=createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;

    /*====== Connect the attributes with the vertex shader ======*/
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    const aPosition=gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.Float, false, 0,0);
    gl.enableVertexAttribArray(aPosition);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    const colorAttributeLocation=gl.getAttribLocation(program, "aVertexColor");
    gl.vertexAttribPointer(colorAttributeLocation, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(colorAttributeLocation);

    /*====== Uniform locations (once) ======*/
    const ModelMatrixLocation=gl.getUniformLocation(program, "uModelMatrix");
    const ViewMatrixLocation=gl.getUniformLocation(program, "uViewMatrix");
    const projectionMatrixLocation=gl.getUniformLocation(program, "uProjectionMatrix");

    /*====== Fixed render state (once) ======*/
    get.clearColor(0.0,0.0,0.0,1.0);
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
    }};
    



