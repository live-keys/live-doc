var child_process = require('child_process');

// Decoding %20 as space
child_process.execSync('node live-doc-moxygen.js ' + outpath.replace(" ", "%20"), {
    stdio: [0, 1, 2]
});

console.log("\nMoxygen done")

console.log("\nStarting live-doc")
console.log("-----------------------------------------------------------\n")