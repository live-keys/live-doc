var child_process = require('child_process');


console.log("\nExecuting moxygen in " + outpath);
console.log("-----------------------------------------------------------\n");

// Decoding %20 as space
child_process.execSync('node ' + __dirname + '/live-doc-moxygen.js ' + outpath.replace(" ", "%20"), {
    stdio: [0, 1, 2]
});

console.log("\nMoxygen done")

console.log("\nStarting live-doc")
console.log("-----------------------------------------------------------\n")
