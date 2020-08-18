var child_process = require('child_process');

console.log("\nExecuting Doxygen in " + srcpath);
console.log("-----------------------------------------------------------\n");

child_process.execSync("doxygen Doxyfile", {
    cwd: srcpath//,
    //stdio: [0, 1, 2]
});

console.log("\nDoxygen done");
