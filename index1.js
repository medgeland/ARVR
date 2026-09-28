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
}