/// <reference path="SeaOfNet.ts" />

import { MSDFRenderer } from "./MSDFRenderer";

// Grid parameters
const gridSize = 30;
const fontSize = 20;
const textSpacing = 1 * fontSize / gridSize;

// Mouse animation parameters
const mRadX = 10;
const mRadY = 7;
const fade = 2;

// Wave parameters
const waveAmp = .8;
const waveVel = .6 * (2 * Math.PI);
const xOffset = .3;
const yOffset = .3;
/**
 * This class encapsulates the "view", where all of our WebGL code resides. This class, for now, also stores all the relevant data that is used to draw. This can be replaced with a more formal Model-View-Controller architecture with a bigger application.
 */
export class View {

    //the webgl rendering context. All WebGL functions will be called on this object
    private gl: WebGLRenderingContext;
    private canvas: HTMLCanvasElement;
    private width: number;
    private height: number;
    private gridWidth: number;
    private gridHeight: number;

    // Animation variables
    private time: number;
    private mouseX: number;
    private mouseY: number;

    private fontRenderer: MSDFRenderer;
    private text: string;
    private indices: number[];

    constructor(gl: WebGLRenderingContext, canvas: HTMLCanvasElement) {
        this.gl = gl;
        this.canvas = canvas;
        this.fontRenderer = new MSDFRenderer(gl);
        this.onResize(canvas.clientWidth, canvas.clientHeight);
    }

    /**
     * This function sets up everything needed to draw. This includes creating the model, sending model data to shader memory and setting up the shaders.
     * @param vShaderSource the source of the vertex shader, as a string
     * @param fShaderSource the source of the fragment shader, as a string
     */
    public init(fontUrl: string, textUrl: string): Promise<void> {

        //set the clear color
        this.gl.clearColor(0, 0, 0, 1);

        return Promise.all([this.fontRenderer.init(fontUrl), fetch(textUrl).then((response) => {
            response.text().then((text) => {
                let html = JSON.parse(text)["parse"]["text"]["*"];
                const tempElement = document.createElement("div");
                // Remove non-displaying tags
                html = html.replace(/<style[^>]+>[^<]+<\/style>/g, '');
                html = html.replace(/<script[^>]+>[^<]+<\/style>/g, '');
                
                // Parse html to text
                tempElement.innerHTML = html;
                let body = tempElement.textContent;
                body = body.replace(/[·–]/g, "-");
                body = body.replace(/[^\x00-\x7F]/g, "");
                body = body.replace(/\s/g, " ").replace(/\s\s+/g, "  ");

                console.log("Retrieved text content: ", body);
                
                this.text = "";
                this.indices = [];
                for (let i = 0; i < body.length; i++) {
                    let char = body.charAt(i);
                    if (char.trim()) {
                        this.text = this.text + char;
                        this.indices.push(i);
                    }
                }
                
            });
        })]).then(() => {});
    }

    /**
     * The main drawing function in the view. This function must be called *every time* the screen * is to be refreshed.
     */
    public draw(): void {

        //We must also specify "where" the above part of the virtual world will be shown on the actual canvas on screen. This part of the screen where the above drawing gets pasted is called the "viewport", which we set here. The origin of the viewport is left,bottom. In this case we want it to span the entire canvas, so we start at (0,0) with a width and height of 400 each (matching the dimensions of the canvas specified in HTML)
        this.gl.viewport(0, 0, this.width, this.height);
        //clear the window
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        // Update the timer in seconds
        this.time = performance.now() / 1000.0;

        if (this.text) {
            this.drawString(this.text, this.indices);
        } else {
            this.drawString("Loading...");
        }
    }

    public onResize(width: number, height: number) {
        console.log("Set size to ", width, height);
        this.fontRenderer.onResize(width, height);
        this.width = width;
        this.height = height;
        this.gridWidth = Math.round(this.width / gridSize);
        this.gridHeight = Math.ceil(this.height / gridSize);
    }

    public onMouseMove(event: MouseEvent) {
        let obj_left = 0;
        let obj_top = 0;
        let xpos, ypos;
        let obj: HTMLElement = this.canvas;
        while(obj.offsetParent) {
            obj_left += obj.offsetLeft;
            obj_top += obj.offsetTop;
            obj = obj.offsetParent as HTMLElement;
        }
        if(event) {
            xpos = event.pageX;
            ypos = event.pageY;
        } else {
            throw new Error("No event found");
        }
        xpos -= obj_left;
        ypos -= obj_top;
        this.mouseX = xpos;
        this.mouseY = ypos;
    }

    private drawString(str: string, indices?: number[]) {
        let mgX = this.mouseX / gridSize;
        let mgY = this.mouseY / gridSize;

        let minX = Math.min(0, Math.floor(mgX - mRadX));
        let maxX = Math.max(this.gridWidth, Math.ceil(mgX + mRadX));
        for(let y = 0; y < this.gridHeight; y++) {
            let minI = this.gridWidth * y;
            let maxI = minI + this.gridWidth;
            if (indices) {
                minI = indices[minI];
                maxI = indices[maxI];
            }
            let mIX = ((mgX / this.gridWidth) * (maxI - minI)) + minI;
            let mdY = Math.abs(y - mgY);
            let rowWidth = mdY < mRadY ? maxX : this.gridWidth;

            // Draw a row of text
            for (let x = mdY < mRadY ? minX : 0; x <= rowWidth; x++) {
                let i = y * this.gridWidth + x;

                let amp = waveAmp / 2;
                let mdX = Math.abs(x - mgX);
                
                let clientX = x;
                if (mdX < mRadX && mdY < mRadY) {
                    let dist2 = Math.min(
                        ((mdX * mdX) / (mRadX * mRadX)) + 
                            ((mdY * mdY) / (mRadY * mRadY)),
                        1);
                    amp *= dist2;

                    let index = indices? indices[i] : i;
                    let targetX = mgX + textSpacing * (index - mIX);
                    clientX = this.smoothstep(targetX, x, dist2);
                }

                this.drawGrid(clientX, y, str.charAt(i), amp);
                if (i+1 >= str.length) {
                    return;
                }
            }
        }
    }

    private smoothstep(from: number, to: number, fac: number): number {
        fac = 1 / (1 + Math.pow(fac / (1 - fac), fade));
        return ((1 - fac) * to) + (fac * from);
    }

    private drawGrid(x: number, y: number, char: string, amp: number) {
        let viewX = x + .5;
        let viewY = y + .5;

        let time = this.time - (xOffset * x) - (yOffset * y);
        viewX += Math.sin(time * waveVel) * amp;
        viewY -= Math.cos(time * waveVel) * amp;

        viewX *= gridSize;
        viewY *= gridSize;
        viewY = this.height - viewY;

        this.fontRenderer.drawChar(char, [viewX, viewY], fontSize, [1, 1, 1]);
    }
}