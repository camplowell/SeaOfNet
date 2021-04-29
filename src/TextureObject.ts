export class TextureObject {
    private id: WebGLTexture;
    private name: string;

    public constructor(gl: WebGLRenderingContext, name: string, textureURL: string) {
        this.name = name;
        this.id = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.id);

        // Because images have to be download over the internet
        // they might take a moment until they are ready.
        // Until then put a single pixel in the texture so we can
        // use it immediately. When the image has finished downloading
        // we'll update the texture with the contents of the image.
        const level = 0;
        const internalFormat = gl.RGBA;
        const width = 1;
        const height = 1;
        const border = 0;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;
        const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
            width, height, border, srcFormat, srcType,
            pixel);

        const image = new Image();
        image.src = textureURL;
        image.addEventListener("load", () => {
            gl.bindTexture(gl.TEXTURE_2D, this.id);
            gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                srcFormat, srcType, image);
            gl.generateMipmap(gl.TEXTURE_2D);

            //capture raw data
            let canvas: HTMLCanvasElement = document.createElement("canvas");
            let context: CanvasRenderingContext2D = canvas.getContext("2d");
            canvas.width = image.width;
            canvas.height = image.height;
            context.drawImage(image, 0, 0);
        });
    }

    public getTextureID(): WebGLTexture {
        return this.id;
    }

    public getName(): string {
        return this.name;
    }
}