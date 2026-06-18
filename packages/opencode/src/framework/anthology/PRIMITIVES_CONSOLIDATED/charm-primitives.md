# Charm Primitives Analysis

## Overview
**Charm** is a backend-as-a-service framework for terminal applications, providing embedded cloud primitives for Go-based CLIs. It abstracts user accounts, data storage, encryption, and synchronization, allowing developers to focus on application logic. The project was sunset on **November 29, 2024**, but remains open-source for self-hosting.

**Purpose**: Backend infrastructure for TUI/CLI applications (authentication, storage, encryption, sync).
**Language**: Go.
**Maturity**: Production (sunset, but stable).
**Dependencies**: BadgerDB (embedded KV store), SSH for authentication.

---

## Core Primitives

### 1. **Charm KV** (Key-Value Store)
**Purpose**: Embeddable, encrypted, cloud-synced key-value store built on [BadgerDB](https://github.com/dgraph-io/badger).

**Primitives**:
- **`kv.OpenWithDefaults(name)`**: Initialize or open a named database.
- **`db.Set(key, value)`**: Store binary data (supports arbitrary byte slices).
- **`db.Get(key)`**: Retrieve binary data.
- **`db.Delete(key)`**: Remove a key-value pair.
- **`db.Sync()`**: Synchronize local changes with the cloud.
- **Transactions**: Supports BadgerDB transactions for atomic operations.

**Key Features**:
- **End-to-End Encryption**: All data encrypted client-side before transmission.
- **Multi-Machine Sync**: Automatic synchronization across linked devices.
- **Offline-First**: Local BadgerDB instance with cloud sync.
- **Binary Data Support**: Stores raw bytes (text, files, blobs).

**Example Usage**:
```go
import "github.com/charmbracelet/charm/kv"

db, err := kv.OpenWithDefaults("my-db")
if err != nil { log.Fatal(err) }
defer db.Close()

// Store data
db.Set([]byte("fave-food"), []byte("gherkin"))

// Sync with cloud
db.Sync()

// Retrieve data
val, err := db.Get([]byte("fave-food"))
```

**Performance Considerations**:
- BadgerDB is optimized for high write throughput.
- Local operations are fast (embedded DB).
- Sync operations depend on network latency.

---

### 2. **Charm FS** (Cloud Filesystem)
**Purpose**: Virtual user filesystem with Go `fs.FS` compatibility, enabling cloud-based file storage for CLI tools.

**Primitives**:
- **`charmfs.NewFS()`**: Initialize a user’s cloud filesystem.
- **`fs.WriteFile(path, data, mode, size)`**: Write a file to the cloud.
- **`fs.ReadFile(path)`**: Read a file from the cloud.
- **`fs.Open(path)`**: Open a file handle for streaming.
- **`fs.Remove(path)`**: Delete a file.

**Key Features**:
- **`fs.FS` Compatibility**: Integrates with Go’s standard filesystem interface.
- **Automatic Sync**: Files are synchronized across devices.
- **No Local Copy Required**: Unlike KV, FS can operate without local caching (but sync is still supported).
- **1GB Free Tier**: Default storage limit for free Charm accounts (unlimited for self-hosted).

**Example Usage**:
```go
import charmfs "github.com/charmbracelet/charm/fs"

cfs, err := charmfs.NewFS()
if err != nil { log.Fatal(err) }

// Write a file
data := []byte("some data")
cfs.WriteFile("./path/to/file", data, fs.FileMode(0644), int64(len(data)))

// Read a file
content, err := cfs.ReadFile("./path/to/file")
```

**Limitations**:
- No built-in directory listings (must track paths manually).
- File size limits depend on server configuration.

---

### 3. **Charm Crypt** (Encryption)
**Purpose**: End-to-end encryption for data stored via Charm KV/FS or arbitrary data.

**Primitives**:
- **`crypt.Encrypt(data)`**: Encrypt arbitrary byte slices.
- **`crypt.Decrypt(data)`**: Decrypt data.
- **Key Management**: Automatic SSH-based key handling (no manual key distribution).

**Key Features**:
- **Transparent Encryption**: All data sent to Charm servers is encrypted client-side.
- **User-Specific Keys**: Each user has unique encryption keys tied to their SSH identity.
- **No Key Management Overhead**: Charm handles key generation, rotation, and linking.

**Example Usage**:
```go
import "github.com/charmbracelet/charm/crypt"

// Encrypt sensitive data
encrypted, err := crypt.Encrypt([]byte("secret"))
if err != nil { log.Fatal(err) }

// Decrypt later
decrypted, err := crypt.Decrypt(encrypted)
```

**Security Notes**:
- Uses modern cryptographic primitives (AES-GCM, Ed25519).
- Keys are derived from SSH identities (no passwords).

---

### 4. **Charm Accounts** (Authentication)
**Purpose**: Invisible user account creation and authentication via SSH keys.

**Primitives**:
- **`account.LinkMachine()`**: Associate a machine with a user account.
- **`account.UnlinkMachine()`**: Revoke access for a machine.
- **`account.BackupKeys()`**: Export account keys for backup.
- **`account.ImportKeys(backup)`**: Restore account from backup.

**Key Features**:
- **SSH-Based Auth**: No passwords; uses existing SSH keys or generates new ones.
- **Frictionless**: Account creation is automatic on first use.
- **Multi-Machine Support**: Link multiple devices to one account.
- **Key Backup/Recovery**: Prevents lockout via `charm backup-keys` and `charm import-keys`.

**Example Usage (CLI)**:
```bash
# Link current machine to account
charm link

# Backup keys
charm backup-keys > charm-keys-backup.tar

# Restore keys
charm import-keys charm-keys-backup.tar
```

---

### 5. **Charm Client** (CLI Tool)
**Purpose**: Standalone CLI for interacting with Charm services (useful for scripting/testing).

**Primitives**:
- **`charm kv set <key> <value>`**: Set a key-value pair.
- **`charm kv get <key>`**: Retrieve a value.
- **`charm fs tree <path>`**: List filesystem hierarchy.
- **`charm crypt encrypt < input > output`**: Encrypt a file.
- **`charm crypt decrypt < input > output`**: Decrypt a file.
- **`charm link`**: Link machine to account.

**Environment Variables**:
| Variable | Default | Description |
|----------|---------|-------------|
| `CHARM_HOST` | `cloud.charm.sh` | Server public URL |
| `CHARM_SSH_PORT` | `35353` | SSH port |
| `CHARM_HTTP_PORT` | `35354` | HTTP port |
| `CHARM_DEBUG` | `false` | Enable debug logs |
| `CHARM_LOGFILE` | `""` | Debug log file path |
| `CHARM_KEY_TYPE` | `ed25519` | Key type for new users |
| `CHARM_DATA_DIR` | `""` | User data directory |
| `CHARM_IDENTITY_KEY` | `""` | Path to identity key |

---

## Self-Hosting Primitives

### **Charm Server**
**Purpose**: Run a private Charm Cloud instance.

**Primitives**:
- **`charm serve`**: Start a Charm server (single binary).

**Server Environment Variables**:
| Variable | Default | Description |
|----------|---------|-------------|
| `CHARM_SERVER_BIND_ADDRESS` | `0.0.0.0` | Network interface |
| `CHARM_SERVER_HOST` | `localhost` | Advertised hostname |
| `CHARM_SERVER_SSH_PORT` | `35353` | SSH server port |
| `CHARM_SERVER_HTTP_PORT` | `35354` | HTTP server port |
| `CHARM_SERVER_STATS_PORT` | `35355` | Stats/metrics port |
| `CHARM_SERVER_HEALTH_PORT` | `35356` | Health check port |
| `CHARM_SERVER_DATA_DIR` | `./data` | Server data directory |
| `CHARM_SERVER_USE_TLS` | `false` | Enable TLS |
| `CHARM_SERVER_TLS_KEY_FILE` | `""` | TLS key file |
| `CHARM_SERVER_TLS_CERT_FILE` | `""` | TLS certificate file |
| `CHARM_SERVER_PUBLIC_URL` | `""` | Public URL (for reverse proxies) |
| `CHARM_SERVER_ENABLE_METRICS` | `false` | Enable Prometheus metrics |
| `CHARM_SERVER_USER_MAX_STORAGE` | `0` | Max FS storage per user (0 = unlimited) |

**Deployment Options**:
- **Binary**: Single statically-linked executable.
- **Docker**: Official Docker image available.
- **Systemd**: Service file templates provided.

---

## Integration Patterns

### **1. Embedding Charm in Applications**
Charm is designed to be embedded as a library. Example integration:

```go
package main

import (
    "log"
    "github.com/charmbracelet/charm/kv"
)

func main() {
    // Initialize KV store
    db, err := kv.OpenWithDefaults("my-app-data")
    if err != nil { log.Fatal(err) }
    defer db.Close()

    // Use it like any other KV store
    db.Set([]byte("config"), []byte("{'theme': 'dark'}"))
}
```

### **2. Using Charm FS for File Storage**
```go
import (
    "bytes"
    charmfs "github.com/charmbracelet/charm/fs"
)

func saveConfig(config []byte) error {
    cfs, err := charmfs.NewFS()
    if err != nil { return err }
    return cfs.WriteFile("./config.json", config, 0644, int64(len(config)))
}
```

### **3. Combining Primitives**
```go
import (
    "github.com/charmbracelet/charm/kv"
    "github.com/charmbracelet/charm/crypt"
)

func secureStore(key, value []byte) error {
    db, err := kv.OpenWithDefaults("secure-db")
    if err != nil { return err }
    defer db.Close()

    // Encrypt before storing
    encrypted, err := crypt.Encrypt(value)
    if err != nil { return err }

    return db.Set(key, encrypted)
}
```

---

## Technical Insights

### **Architecture**
- **Client-Server Model**: Clients (CLI apps) connect to a Charm server (self-hosted or cloud).
- **SSH for Auth**: Uses SSH keys for authentication (no passwords).
- **BadgerDB**: Embedded KV store for local caching.
- **Golang**: Written in Go for cross-platform compatibility.

### **Performance**
- **Local Operations**: Fast (BadgerDB is optimized for writes).
- **Sync Operations**: Network-dependent; can be batched.
- **Encryption Overhead**: Minimal (AES-GCM is hardware-accelerated on modern CPUs).

### **Limitations**
- **1GB Free Tier**: Cloud storage limited to 1GB per account (unlimited for self-hosted).
- **No Directory Listings**: Charm FS lacks built-in `Readdir` (must track paths manually).
- **Sunset Status**: Official cloud shut down; self-hosting required for new deployments.

### **Comparison to Alternatives**
| Feature | Charm | Firebase | AWS DynamoDB |
|---------|-------|----------|---------------|
| **Embeddable** | ✅ Yes | ❌ No | ❌ No |
| **Offline-First** | ✅ Yes | ✅ Yes | ❌ No |
| **End-to-End Encryption** | ✅ Yes | ❌ No | ❌ No (unless client-side) |
| **SSH Auth** | ✅ Yes | ❌ No | ❌ No |
| **Self-Hostable** | ✅ Yes | ❌ No | ❌ No |
| **Binary Data Support** | ✅ Yes | ✅ Yes | ✅ Yes |

---

## Key Files and Directories
| Path | Purpose |
|------|---------|
| `/kv` | Key-Value store implementation (BadgerDB wrapper) |
| `/fs` | Cloud filesystem (`fs.FS` implementation) |
| `/crypt` | Encryption/decryption utilities |
| `/client` | CLI client and configuration |
| `/server` | Charm server implementation |
| `/docs` | Self-hosting documentation |

---

## Use Cases
1. **CLI Tools with Cloud Sync**: Store user preferences/configs (e.g., `glow`, `skate`).
2. **Secure Data Storage**: Encrypted backups for sensitive data.
3. **Multi-Machine Apps**: Sync data across devices (e.g., dotfiles, notes).
4. **Collaborative Tools**: Shared data via cloud filesystem.

---

## Projects Using Charm
- **[Glow](https://github.com/charmbracelet/glow)**: Markdown renderer with cloud sync for documents.
- **[Skate](https://github.com/charmbracelet/skate)**: Personal key-value store (now local-only in v1.0.0+).

---

## Summary
Charm provides a **unified backend layer** for terminal applications, abstracting:
- **Authentication** (SSH-based, invisible to users).
- **Storage** (KV and filesystem with sync).
- **Encryption** (end-to-end, automatic).
- **Self-Hosting** (single binary deployment).

**Best For**: Go-based CLI/TUI apps needing cloud sync, auth, or storage without reinventing the wheel.
**Avoid If**: You need a non-Go solution or cannot self-host.
