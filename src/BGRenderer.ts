import * as WebGLUtils from "./WebGLUtils";
import { vec2 } from "gl-matrix"

const PHI = 1.618033988749895;
const bytesPerFloat = 4;
const bufferSize = 512;

export class BGRenderer {

    private gl: WebGLRenderingContext;
    private vBuffer: WebGLBuffer;
    private noiseBuffer: WebGLTexture;

    private shader: WebGLShader;
    private mousePos: vec2;
    private mouseRadius: number;

    private mouseLoc: WebGLUniformLocation;
    private timeLoc: WebGLUniformLocation;
    private radLoc: WebGLUniformLocation;
    private positionLocation: number;


    constructor(gl: WebGLRenderingContext, mouseRadius: number) {
        this.gl = gl;
        this.shader = WebGLUtils.createShaderProgram(this.gl, this.getVShader(), this.getFShader());
        this.mouseRadius = mouseRadius;

        this.gl.useProgram(this.shader);

        let vertexData: Float32Array = new Float32Array([
            -1,  1,
            -1, -1,
             1, -1,
             1, -1,
             1,  1,
            -1,  1
        ]);

        //create a vertex buffer object
        this.vBuffer = this.gl.createBuffer();
        //bind the buffer to GL_ARRAY_BUFFER
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vBuffer);
        //copy over the vertex data
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexData, this.gl.STATIC_DRAW);

        //get the location of the vPosition attribute in the shader program
        this.positionLocation = this.gl.getAttribLocation(this.shader, "vPosition");

        //tell webgl that the position attribute can be found as 2-floats-per-vertex with a gap of 20 bytes 
        //(2 floats per position, 2 floats per uv coordinate = 4 floats = 16 bytes
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 2 * bytesPerFloat, 0);
        //tell webgl to enable this vertex attribute array, so that when it draws it will use this
        this.gl.enableVertexAttribArray(this.positionLocation);

        this.mouseLoc = this.gl.getUniformLocation(this.shader, "mousePos");
        this.timeLoc = this.gl.getUniformLocation(this.shader, "time");
        this.radLoc = this.gl.getUniformLocation(this.shader, "mRad")

        this.mousePos = vec2.create();

        //this.createNoiseBuffer();
    }

    public draw(mouseX: number, mouseY: number, time: number) {

        this.gl.useProgram(this.shader);

        //bind the buffer to GL_ARRAY_BUFFER
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vBuffer);
        //tell webgl that the position attribute can be found as 2-floats-per-vertex with a gap of 20 bytes 
        //(2 floats per position, 2 floats per uv coordinate = 4 floats = 16 bytes
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 2 * bytesPerFloat, 0);
        //tell webgl to enable this vertex attribute array, so that when it draws it will use this
        this.gl.enableVertexAttribArray(this.positionLocation);

        vec2.set(this.mousePos, mouseX, mouseY);
        this.gl.uniform2fv(this.mouseLoc, this.mousePos);
        this.gl.uniform1f(this.timeLoc, time);
        this.gl.uniform1f(this.radLoc, this.mouseRadius * 1.2);

        // set the filtering so we don't need mips
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

        //the command below draws the quad. Specifically, it will use vertex data from whichever VBO is currently bound (in this program there is only one, enabled in init).

        //this.gl.TRIANGLES => read the vertices 3 at a time, and create a triangle out of them. In this way we will draw the quad using 2 triangles.
        //this.numVertices => read these many vertices. Usually they must match the vertices specified in the VBO, but we can use a lesser number to draw only a part of the model. However since we are using this.gl.TRIANGLES, we should ensure that the number of specified vertices is a multiple of 3. If it is not, the "incomplete" triangle will simply be ignored.
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    /*
    private createNoiseBuffer() {
        this.noiseBuffer = this.gl.createTexture();
        let noiseShader = WebGLUtils.createShaderProgram(this.gl, this.getVShader(), this.getNoiseFShader());

        this.gl.bindTexture(this.gl.TEXTURE_2D, this.noiseBuffer);

        // define size and format of level 0
        const level = 0;
        const internalFormat = this.gl.RGB;
        const border = 0;
        const format = this.gl.RGB;
        const type = this.gl.UNSIGNED_BYTE;
        const data = null;
        this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat,
                    bufferSize, bufferSize, border,
                    format, type, data);

        
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.noiseBuffer);

        this.gl.viewport(0, 0, bufferSize, bufferSize);

        this.gl.clearColor(0, 0, 0, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

        // Unbind the frame buffer
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
    */
    private getVShader() {
        return `
        attribute vec4 vPosition;

        void main() {
            gl_Position = vPosition;
        }
        `;
    }

    private getFShader() {
        return `
        precision mediump float;

        uniform float time;
        uniform float mRad;
        uniform vec2 mousePos;

        float hash2(vec2 p) {
            vec3 p3  = fract(vec3(p.xyx) * .1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
        }

        void main() {
            float v = 2.0 * .152;
            vec2 pos = (gl_FragCoord.xy * v + time * 30. + 50.0);
            float noise = hash2(pos);
            // Create a circle around the cursor
            float circle = distance(mousePos, gl_FragCoord.xy) / mRad;
            // Smooth the factor between 0 and 1
            circle = smoothstep(0.2, 1.0, circle);

            float wave = (gl_FragCoord.y + (40.0 * time))/ 300.0;
            wave = mix(1.0, 0.2, fract(wave));

            // Set interior and exterior strength
            float fac = mix(.8, 1.1, circle * wave);

            noise = floor(noise * fac + 0.5) * 0.4;
            gl_FragColor = vec4(noise, noise, noise, 1.0);
            //gl_FragColor = vec4(wave, wave, wave, 1.0);
        }
        `;
    }
    /*
    private getNoiseFShader(): string {
        return `
        precision mediump float;

        float hash2(vec2 p) {
            vec3 p3  = fract(vec3(p.xyx) * .1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
        }

        void main() {
            float noise = hash2(gl_FragCoord.xy);
            noise = pow(noise, 4.0);

            gl_FragColor = vec4(noire, noise, noise, 1.0);
        }


        `;

    }
    */
}