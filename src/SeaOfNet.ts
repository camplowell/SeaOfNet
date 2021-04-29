import { View } from "./View"
import * as WebGLUtils from "./WebGLUtils"

var view: View;
var canvas: HTMLCanvasElement;

/**
 * This is the main function of our web application. This function is called at the end of this file. In the HTML file, this script is loaded in the head so that this function is run.
 */
function main(): void {
    console.log("Here I am");
    //retrieve <canvas> element
    canvas = <HTMLCanvasElement>document.querySelector("#glCanvas");
    if (!canvas) {
        console.log("Failed to retrieve the <canvas> element");
        return;
    }

    //get the rendering context for webgl
    let gl: WebGLRenderingContext = WebGLUtils.setupWebGL(canvas, { 'antialias': false, 'alpha': false, 'depth': false, 'stencil': false });

    // Only continue if WebGL is available and working
    if (gl == null) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
    }


    //create the View. The View will encapsulate all our meaningful webgl code
    view = new View(gl, canvas);


    //initialize the view, and pass the shader sources to the view
    view.init("fonts/FiraCode-VF", "http://en.wikipedia.org/w/api.php?&action=parse&prop=text&format=json&page=Internet&origin=*");

    //draw the view. You must call draw *each time* you would like to draw the screen (i.e. there is no auto refresh)
    window.requestAnimationFrame(animate);

}

function animate() {
    if (canvas.width != canvas.clientWidth || canvas.height != canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        view.onResize(canvas.clientWidth, canvas.clientHeight);
    }
    view.draw();
    window.requestAnimationFrame(animate);
}

function onMouseMove(event: MouseEvent) {
    view.onMouseMove(event);
}

window.onmousemove = onMouseMove;
main();