# DOX Framework

## Purpose

DOX is a highly performant AGENTS.md hierarchy installed here. Provides an MCP server for managing documentation contracts and training data.

## Ownership

This is the DOX framework implementation with SQLite backend for training data and model metrics.

## Local Contracts

- DOX MCP server provides `dox_query`, `dox_train`, `dox_update` tools
- SQLite database stores training data, model metrics, agent context, and hierarchy
- Database location: `/home/jewboy420/.config/opencode/dox_training.db`

## Work Guidance

### Querying DOX Hierarchy

```bash
python3 /home/jewboy420/dox-main/dox/main.py --query --sqlite /home/jewboy420/.config/opencode/dox_training.db
```

### Training Models

```bash
python3 /home/jewboy420/dox-main/dox/main.py --train --sqlite /home/jewboy420/.config/opencode/dox_training.db
```

### Initializing DOX Tree

```bash
python3 /home/jewboy420/dox-main/dox/main.py --init --sqlite /home/jewboy420/.config/opencode/dox_training.db
```

## Verification

- Verify database exists at configured path
- Verify MCP server starts without errors
- Verify AGENTS.md hierarchy is properly indexed

## Child DOX Index

- `main.py` — DOX framework main module (database, query, train, update operations)
