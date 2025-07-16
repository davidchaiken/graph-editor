# Top-level Makefile for graph-editor

# Default rule: build the project
all: build

# Check for TypeScript errors and linting issues
check:
	npx tsc --pretty --noEmit | grep ^Found || echo No Errors
	npx tsc | grep ^graph-editor | cut -d ' ' -f 3 | sort | uniq -c | sort -nr

# Run linter
lint:
	npm run lint

# Run linter with auto-fix
lint-fix:
	npm run lint:fix

# Format code with Prettier
format:
	npm run format

# Check formatting without changes
format-check:
	npm run format:check

# Build rule: use npm to build (esbuild)
build:
	npm run build

# First clean; then check, format, and lint; then build
status: clean check format-check lint build

# Can also use http-server with nodejs, but this is even easier...
server:
	python3 -m http.server

# Clean rule: remove build artifacts
clean:
	rm -rf dist/graph-editor-script.js dist/graph-editor-script.js.map
