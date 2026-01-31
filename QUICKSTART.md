# Quick Start Guide

Get started with Code Indexer in 5 minutes.

## Installation

```bash
# Navigate to your project
cd your-project

# Initialize npm (if needed)
npm init -y

# Install dependencies
npm install

# Build the project
npm run build

# (Optional) Link globally for CLI usage
npm link
```

## Basic Usage

### 1. Initialize the Index

```bash
codeindex init
```

This creates a `.syntheo/semantics/` directory in your project.

### 2. Index Your Code

```bash
# Index all files
codeindex index

# Watch for changes (recommended)
codeindex index --watch
```

The first index will take a few minutes depending on project size. Subsequent indexes are incremental and much faster.

### 3. Search Your Code

```bash
# Semantic search
codeindex search "user authentication"

# With filters
codeindex search "api endpoint" --language=typescript --type=function

# See file context
codeindex search "error handling" --limit=10
```

### 4. Check Status

```bash
codeindex status
```

Shows indexed files, blocks, languages, and search statistics.

## Examples

### Find a Function

```bash
codeindex search "getUserData"
```

### Find API Calls

```bash
codeindex search "fetch api request"
```

### Find Error Handling

```bash
codeindex search "try catch error"
```

### Find React Components

```bash
codeindex search "button component" --language=typescript
```

## Configuration

Adjust settings in `.syntheo/semantics/config.json`:

```bash
# View all config
codeindex config list

# Change model
codeindex config set embedder.model "Xenova/all-mpnet-base-v2"

# Increase results
codeindex config set search.maxResults 30

# Adjust hybrid search weights
codeindex config set search.hybridWeight.semantic 0.8
```

## Common Workflows

### Development Mode

```bash
# In one terminal: Watch for changes
codeindex index --watch

# In another: Search as you code
codeindex search "my function"
```

### One-Time Index

```bash
# Force re-index everything
codeindex index --force
```

### Clean Start

```bash
# Remove index and start fresh
codeindex clear --yes
codeindex index
```

## Tips

1. **Start with broad queries**: "authentication" → "login function"
2. **Use language filters**: `--language=python` for better results
3. **Leverage semantic meaning**: "fetch data" finds both `fetch()` and `getData()`
4. **Check status periodically**: `codeindex status` to see what's indexed
5. **Enable watch mode**: `codeindex index --watch` for real-time updates

## Performance

- **First index**: ~1000 files/minute
- **Incremental updates**: <1 second per file
- **Search latency**: <50ms
- **Memory usage**: ~200-500MB

## Troubleshooting

### "No results found"
- Try broader query terms
- Lower minScore: `codeindex config set search.minScore 0.1`
- Check status: `codeindex status`

### Indexing is slow
- Reduce concurrency: `codeindex config set indexing.concurrency 2`
- Increase batch size: `codeindex config set indexing.batchSize 100`

### Model download is slow
- First run downloads ~100MB model
- Subsequent runs use cached model
- Use VPN if connection is blocked

## Next Steps

- Read [ARCHITECTURE.md](ARCHITECTURE.md) for deep dive
- Explore configuration options
- Check [README.md](README.md) for full documentation

## Support

For issues and feature requests:
- Check existing issues
- Review documentation
- Create detailed bug reports

Happy searching! 🚀
