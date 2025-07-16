# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build and Development

- `npm run build` - Compiles TypeScript and bundles with esbuild
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier (fixes line length, whitespace)
- `npm run format:check` - Check formatting without making changes
- `npx tsc` - Type check only (no emit due to noEmit: true in tsconfig)
- `make build` - Same as npm run build
- `make check` - Run TypeScript type checking with error reporting
- `make lint` - Run ESLint linter
- `make lint-fix` - Run ESLint with auto-fix
- `make format` - Format code with Prettier
- `make format-check` - Check formatting without changes
- `make status` - Clean, check, format-check, lint, then build
- `make server` - Start Python HTTP server for local development
- `make clean` - Remove build artifacts from dist/

### Testing

No automated test suite is configured. Manual testing is done by opening index.html in a browser.

## Architecture

This is a single-page web application that implements a force-directed graph editor using D3.js and the force-graph library.

### Core Structure

- **Single TypeScript file**: `graph-editor-script.ts` contains all application logic
- **HTML interface**: `index.html` provides the UI with canvas and sidebar tools
- **CSS styling**: `graph-editor-style.css` handles visual presentation
- **Build output**: Bundled to `dist/graph-editor-script.js` via esbuild

### Key Components

- **Graph rendering**: Uses force-graph library with D3 force simulation for node positioning
- **Interactive tools**: Four sidebar tools (Node, Link, Color, Graph) for editing
- **State management**: In-memory graph data with local storage for save/load
- **Export functionality**: PDF export using jsPDF and html2canvas

### Data Model

- **Node interface**: Extends force-graph NodeObject with required id, label, color, size, x, y
- **Link interface**: Extends force-graph LinkObject with required source/target, plus thickness, color, optional label and dashPattern
- **GraphData interface**: Contains nodes and links arrays

### Key Features

- Force-directed layout with D3 physics simulation
- Interactive node/link creation, selection, and modification
- Color palette and custom color picker
- Graph persistence via JSON save/load to localStorage
- PDF export capability
- Keyboard shortcuts (N for new node, Delete/Backspace for deletion)
- Modifier keys for link creation patterns (Ctrl, Shift)

### Type System

- Uses strict TypeScript with noUncheckedIndexedAccess
- Custom DashPattern type with restricted string values
- Interfaces extend force-graph types with additional properties
- Type guards for runtime validation (e.g., isDashPattern)
