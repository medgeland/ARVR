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
    const vsSource =
        attribute vec4 aVertexPosition;
        attribute vec4 aVertexColor;
        varying lowp vec4 vColor;
        void main() {
            gl_Position = aPosition;
            gl_PointSize = 6.0;
            vColor = aVertexColor;
        }
    ;
    const fsSource =
        varying lowp vec4 vColor;
        void main() {
            gl_FragColor = vColor;
        }
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
    
}
