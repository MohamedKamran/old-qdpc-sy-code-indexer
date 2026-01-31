# Code Indexer

Production-grade semantic code search with local-first architecture.

## Features

- **🔍 Semantic Search**: Find code by meaning, not just keywords
- **⚡ Blazing Fast**: Sub-millisecond search with HNSW
- **🏠 Local-First**: Everything stored in `.syntheo/semantics/` directory
- **🔄 Incremental Indexing**: Hash-based change detection
- **🎯 Hybrid Search**: Combines semantic and keyword search
- **📦 Intelligent Chunking**: Respects code semantics
- **🌐 Language Support**: TypeScript, JavaScript, Python, and more

## Installation

### Prerequisites

1. **Node.js** (>=18.0.0)
2. **Ollama** (for local embeddings):
   ```bash
   # Install Ollama
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Pull the embedding model
   ollama pull nomic-embed-text
   ```

### Setup

```bash
npm install
npm run build
npm link
```

## Usage

### Initialize Index

```bash
codeindex init
```

### Index Workspace

```bash
# Index all files
codeindex index

# Watch for changes
codeindex index --watch

# Force re-index
codeindex index --force
```

### Search Code

```bash
# Basic search
codeindex search "user authentication"

# With filters
codeindex search "api endpoint" --language=typescript --type=function

# Semantic-only search
codeindex search "fetch data" --semantic-only
```

### Status

```bash
codeindex status
```

### Configuration

```bash
# List all config
codeindex config list

# Get specific value
codeindex config get embedder.model

# Set config value
codeindex config set search.maxResults 30
```

## Architecture

```
├── core/           # Core infrastructure
├── parsers/        # Code parsing with Tree-sitter
├── embedders/      # Text embeddings
├── storage/        # Vector store (HNSW + SQLite)
├── scanner/        # File scanning and watching
├── search/         # Search engines
├── cli/            # Command-line interface
└── utils/          # Utilities
```

## Configuration

Edit `.syntheo/semantics/config.json`:

```json
{
  "embedder": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "dimensions": 768,
    "baseUrl": "http://localhost:11434"
  },
  "indexing": {
    "batchSize": 50,
    "concurrency": 4,
    "chunkTokens": 512
  },
  "search": {
    "maxResults": 20,
    "minScore": 0.3,
    "hybridWeight": {
      "semantic": 0.7,
      "keyword": 0.3
    }
  }
}
```

## Technology Stack

- **Embeddings**: Ollama (local)
- **Vector Search**: hnswlib-node (HNSW)
- **Database**: better-sqlite3 with FTS5
- **Parsing**: tree-sitter
- **CLI**: commander, ora, chalk

## License

MIT
