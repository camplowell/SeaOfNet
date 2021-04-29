const path = require('path');

module.exports = {
    entry: './src/SeaOfNet.ts', //entry point of application
    //  watch: true, //enable to debug (step through)
    module: { //details about grabbing modules to export
        rules: [
            {
                test: /\.tsx?$/, //use all files with this extension
                use: 'ts-loader', //pass to this program (Typescript transpiling + loading)
                exclude: /node_modules/ //exclude the folder with installed packages
            }
        ]
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"], //apply this rule to all files with these extensions
    },
    output: {
        filename: 'SeaOfNet.js', //name of the final bundled JS file
        devtoolModuleFilenameTemplate: 'file:///[absolute-resource-path]',
        path: path.resolve(__dirname, 'out') //put bundled file in this folder
    },
    devtool: 'source-map', //enable source-map for debugging (stepping through). generates HelloWebGL.js.map
};
