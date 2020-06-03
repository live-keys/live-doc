# Livekeys documentation building scripts

## Requirements

To use this script, you will need doxygen installed and accessible from live-doc's script:

```
doxygen --version
```

## Usage

Simply clone the repo, install requirements, and run the script on livecv's source directory.
The generated html files should be available in the ```output``` directory:

```
git clone https://github.com/live-keys/live-doc.git
cd live-doc
npm install
node live-doc.js <path_to_livekeys_source>
cd <path_to_livekeys_source>
ls doc/output
```
