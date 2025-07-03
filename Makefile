# Top-level Makefile for graph-editor

# Default rule: build the project
all: build

# Check for TypeScript errors and then rebuild
check:
	npx tsc --pretty --noEmit | grep ^Found || echo No Errors
	npx tsc | grep ^graph-editor | cut -d ' ' -f 3 | sort | uniq -c | sort -nr

# Build rule: use npm to build (esbuild)
build:
	npm run build

# First clean; then check; then build
status: clean check build

# Clean rule: remove build artifacts
clean:
	rm -rf dist/graph-editor-script.js dist/graph-editor-script.js.map

# Proxy to libs/Makefile for downloads and cleaning libraries
downloads:
	$(MAKE) -C libs downloads

libs-clean:
	$(MAKE) -C libs clean
