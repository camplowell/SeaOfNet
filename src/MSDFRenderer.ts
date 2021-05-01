import * as WebGLUtils from "./WebGLUtils";
import { mat4, vec3, vec4 } from "gl-matrix";

export class MSDFRenderer {
    private gl: WebGLRenderingContext;
    private shader: WebGLShader;
    private numVertices: number;
    private ready: boolean;

    private proj: mat4;

    private fontAtlas: WebGLTexture;
    private charProps: Map<String, CharProperties>;
    private dfSlope: number;

    private locations: Locations;


    constructor(gl: WebGLRenderingContext) {
        this.gl = gl;
        this.ready = false;
        this.charProps = new Map();

        this.shader = WebGLUtils.createShaderProgram(this.gl, this.getVShader(), this.getFShader())

        //create the data for our quad. The data is simply the (x,y) coordinates of each vertex of the quad in counter-clockwise order.
        let vertexData: Float32Array = new Float32Array([
            0,  0,  0,  0,
            0, -1,  0,  1,
            1, -1,  1,  1,
            1, -1,  1,  1,
            1,  0,  1,  0,
            0,  0,  0,  0
        ]);

        //since there are two numbers per vertex, the number of vertices is half the length of the above array
        this.numVertices = vertexData.length / 4;

        //enable the current program
        this.gl.useProgram(this.shader);


        //A vertex buffer object used to store the vertex data for rendering
        let vbo: WebGLBuffer;
        //create a vertex buffer object
        vbo = this.gl.createBuffer();
        //bind the buffer to GL_ARRAY_BUFFER
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
        //copy over the vertex data
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexData, this.gl.STATIC_DRAW);

        //get the location of the vPosition attribute in the shader program
        let positionLocation: number = this.gl.getAttribLocation(this.shader, "vPosition");
        let uvLocation: number = this.gl.getAttribLocation(this.shader, "vTexCoord");
        let bytesPerFloat: number = 4;

        //tell webgl that the position attribute can be found as 2-floats-per-vertex with a gap of 20 bytes 
        //(2 floats per position, 2 floats per uv coordinate = 4 floats = 16 bytes
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 4 * bytesPerFloat, 0);
        //tell webgl to enable this vertex attribute array, so that when it draws it will use this
        this.gl.enableVertexAttribArray(positionLocation);


        //tell webgl that the uv attribute can be found as 2-floats-per-vertex with a gap of 20 bytes 
        //(2 floats per position, 2 floats per uv coordinate = 4 floats = 16 bytes
        this.gl.vertexAttribPointer(uvLocation, 2, this.gl.FLOAT, false, 4 * bytesPerFloat, 2 * bytesPerFloat);
        //tell webgl to enable this vertex attribute array, so that when it draws it will use this
        this.gl.enableVertexAttribArray(uvLocation);

        this.locations = <Locations>{};
        this.locations.color = this.gl.getUniformLocation(this.shader, "color");
        this.locations.size = this.gl.getUniformLocation(this.shader, "size");
        this.locations.weight = this.gl.getUniformLocation(this.shader, "weight");
        this.locations.proj = this.gl.getUniformLocation(this.shader, "proj");
        this.locations.modelView = this.gl.getUniformLocation(this.shader, "modelView");
        this.locations.uvTransform = this.gl.getUniformLocation(this.shader, "vUv");
        this.locations.slope = this.gl.getUniformLocation(this.shader, "slope");
    }

    public init(fontPrefix: string): Promise<void> {
        this.fontAtlas = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.fontAtlas);

        // Because images have to be download over the internet
        // they might take a moment until they are ready.
        // Until then put a single pixel in the texture so we can
        // use it immediately. When the image has finished downloading
        // we'll update the texture with the contents of the image.
        const level = 0;
        const internalFormat = this.gl.RGBA;
        const width = 1;
        const height = 1;
        const border = 0;
        const srcFormat = this.gl.RGBA;
        const srcType = this.gl.UNSIGNED_BYTE;
        const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
        this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat,
            width, height, border, srcFormat, srcType,
            pixel);

        const image = new Image();
        image.src = fontPrefix+".png";

        // Retrieve the font atlas
        let atlasPromise: Promise<void> = new Promise((resolve) => {
            image.addEventListener("load", () => {
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.fontAtlas);
                this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat,
                    srcFormat, srcType, image);
                this.gl.generateMipmap(this.gl.TEXTURE_2D);
    
                //capture raw data
                let canvas: HTMLCanvasElement = document.createElement("canvas");
                let context: CanvasRenderingContext2D = canvas.getContext("2d");
                canvas.width = image.width;
                canvas.height = image.height;
                context.drawImage(image, 0, 0);
                console.log("Finished loading atlas");
                resolve();
            });
        });

        // Retrieve the corresponding parameter json
        let paramsPromise: Promise<void> = fetch(fontPrefix+"-msdf.json").then((response) => {
            response.text().then((text) => {
                let json = JSON.parse(text);
                let lineHeight: number = json["common"]["lineHeight"];
                console.log("Line height: ", lineHeight);
                let scale: number = 1.0 / json["common"]["scaleW"];
                console.log("Scale: ", scale);
                let padding: number[] = [0, 8];
                console.log("Padding: ", padding);
                this.dfSlope = 2.0 * json["distanceField"]["distanceRange"];
                console.log("Distance field slope: ", this.dfSlope);

                let viewBase = mat4.create();
                mat4.scale(viewBase, viewBase, vec3.fromValues(1.0 / lineHeight, 1.0 / lineHeight, 1))
                
                
                for(let props of json["chars"]) {
                    let mats: CharProperties = <CharProperties>{};
                    
                    mats.tView = mat4.clone(viewBase);
                    mat4.translate(mats.tView, mats.tView, vec3.fromValues(props["xoffset"], -props["yoffset"], 0));
                    let width = props["width"];
                    let height = props["height"];
                    mat4.translate(mats.tView, mats.tView, vec3.fromValues(-props["xadvance"] / 2, lineHeight / 2, 0));
                    mat4.scale(mats.tView, mats.tView, vec3.fromValues(width, height, 1));
                    

                    mats.tUV = mat4.scale(mat4.create(), mat4.create(), vec3.fromValues(scale, scale, scale));
                    mat4.translate(mats.tUV, mats.tUV, vec3.fromValues(props["x"], props["y"], 0));
                    //mat4.translate(mats.uv, mats.uv, vec3.fromValues(-2, 2, 0));
                    mat4.scale(mats.tUV, mats.tUV, vec3.fromValues(props["width"], props["height"], 1));
                    
                    this.charProps.set(props["char"], mats);
                }
                console.log("Finished loading xml", this.charProps);
              });
        });

        return Promise.all([atlasPromise, paramsPromise]).then(() => {
            this.ready = true;
            console.log("Ready to draw");
        });
    }

    public onResize(width: number, height: number) {
        this.proj = mat4.ortho(mat4.create(), 0, width, 0, height, -1, 1);
    }


    public drawChar(char: string, position: number[], size: number, color: number[], weight: number = 0.5): void {
        if(!this.ready) {
            console.log("Waiting for fonts...");
            return;
        }
        // Unrecognized character
        if(!this.charProps.get(char)) {
            console.log("Unrecognized character: ", char);
            return;
        }

        this.gl.useProgram(this.shader);

        this.gl.uniform4fv(this.locations.color, this.toColor(color));
        this.gl.uniform1f(this.locations.size, size);
        this.gl.uniform1f(this.locations.weight, weight);
        this.gl.uniform1f(this.locations.slope, this.dfSlope / size);

        // Send texture matrix, model view and projection matrix
        this.gl.uniformMatrix4fv(this.locations.uvTransform, false, this.charProps.get(char).tUV);
        let modelView: mat4 = mat4.create();
        
        mat4.translate(modelView, modelView, vec3.fromValues(position[0], position[1], 0));
        mat4.scale(modelView, modelView, vec3.fromValues(size, size, 1));
        
        
        mat4.mul(modelView, modelView, this.charProps.get(char).tView);
        //console.log("Character view: ", this.charProps.get(char).view);

        this.gl.uniformMatrix4fv(this.locations.modelView, false,  //mat4.scale(mat4.create(), mat4.create(), vec3.fromValues(20, 20, 20)));
            modelView);
        this.gl.uniformMatrix4fv(this.locations.proj, false, this.proj);

        // this.gl.enable(this.gl.TEXTURE_2D);
        //deal with texture 0
        this.gl.activeTexture(this.gl.TEXTURE0);
        //that is what we pass to the shader
        this.gl.uniform1i(this.gl.getUniformLocation(this.shader, "font"), 0);

        //bind the appropriate texture
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.fontAtlas);

        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

        //the command below draws the quad. Specifically, it will use vertex data from whichever VBO is currently bound (in this program there is only one, enabled in init).

        //this.gl.TRIANGLES => read the vertices 3 at a time, and create a triangle out of them. In this way we will draw the quad using 2 triangles.
        //this.numVertices => read these many vertices. Usually they must match the vertices specified in the VBO, but we can use a lesser number to draw only a part of the model. However since we are using this.gl.TRIANGLES, we should ensure that the number of specified vertices is a multiple of 3. If it is not, the "incomplete" triangle will simply be ignored.
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.numVertices);
    }


    private toColor(raw: number[]): vec4 {
        switch(raw.length) {
            case 1:
                return vec4.fromValues(raw[0], raw[0], raw[0], 1);
            case 2:
                return vec4.fromValues(raw[0], raw[0], raw[0], raw[1]);
            case 3:
                return vec4.fromValues(raw[0], raw[1], raw[2], 1);
            case 4:
                return vec4.fromValues(raw[0], raw[1], raw[2], raw[3]);
        }
    }


    private getVShader(): string {
        return `
        attribute vec4 vPosition;
        attribute vec2 vTexCoord;

        // Font variation
        //uniform vec4 color;
        //uniform float size;
        //uniform float weight;

        // View properties
        uniform mat4 proj;
        uniform mat4 modelView;
        uniform mat4 vUv;
        //uniform float slope;

        // Fragment properties
        varying vec2 fTexCoord;
        
        void main()
        {
            gl_Position = proj * modelView * vPosition;
            fTexCoord = (vUv * vec4(vTexCoord.xy, 0, 1)).xy;
        }
        `;
    }

    private getFShader(): string {
        return `
        precision mediump float;
        uniform vec4 color;
        uniform float weight;
        uniform sampler2D font;
        uniform float slope;

        varying vec2 fTexCoord;

        float median(float a, float b, float c) {
            return max(min(a,b), min(max(a,b),c));
        }
    
        void main()
        {
            vec4 texColor = texture2D(font, fTexCoord);
            float sigDist = median(texColor.r, texColor.g, texColor.b);
            float alpha = smoothstep(weight - slope, weight + slope, sigDist);
            if (alpha < 0.001) discard;
            gl_FragColor = vec4(color.rgb * alpha, 1);
            //gl_FragColor = vec4(1, 0, 1, 1);
        }
        `;
    }
}

interface CharProperties {
    tUV: mat4,
    tView: mat4
}

interface Locations {
    color: WebGLUniformLocation,
    size: WebGLUniformLocation,
    weight: WebGLUniformLocation,
    proj: WebGLUniformLocation,
    modelView: WebGLUniformLocation,
    uvTransform: WebGLUniformLocation,
    slope: WebGLUniformLocation
}