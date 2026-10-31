# Workspace Exit Package envelope

Application-free definition of the encrypted Workspace Exit Package (spec 82, ADR-0023). Anyone can verify a package with any scrypt and AES-256-GCM implementation; Cantiara ships no restore for it.

## Layout

```text
"CXEP" (4 ASCII bytes) | version (u8, 1) | headerLength (u32 big-endian) | header (UTF-8 JSON) | ciphertext | tag (16 bytes)
```

Header JSON: `{ "cipher": "aes-256-gcm", "iv": "<base64, 12 bytes>", "kdf": { "name": "scrypt", "N": 32768, "r": 8, "p": 1, "salt": "<base64, 16 bytes>" } }`.

- Key: `scrypt(NFKC(password) as UTF-8, salt, 32 bytes, N, r, p)`.
- Cipher: AES-256-GCM over the plaintext container with the header IV. The additional authenticated data is every byte before the ciphertext (magic, version, headerLength and header). Readers refuse `N` above 2^20.
- The password is never stored, logged or recoverable. A wrong password, an altered header or an altered byte fails the tag check.

## Plaintext container

```text
manifestLength (u32 big-endian) | manifest (UTF-8 JSON) | file bytes, concatenated in manifest order
```

The manifest (`format: "cantiara-workspace-exit-package"`, `manifestVersion: 1`) lists every file as `{ family, kind, path, size, sha256 }`, the six content families (`content`, `attachment-versions`, `identities`, `relations`, `history`, `configuration`), the excluded classes (sessions, secrets, external access keys, operation logs, derived caches, Capture staging attachments), `producedAt`, and the nature and residency notes. Verify each file against its `size` and SHA-256. Files are Markdown, JSON or original binaries at relative, normalised paths.
