# Top-level Makefile for graph-editor

# Default rule: build the project
all: build

# Build rule: use npm to build (esbuild)
build:
	npm run build

# Clean rule: remove build artifacts
clean:
	rm -rf dist/graph-editor-script.js dist/graph-editor-script.js.map

# Proxy to libs/Makefile for downloads and cleaning libraries
downloads:
	$(MAKE) -C libs downloads

libs-clean:
	$(MAKE) -C libs clean
