"""
Symmetric encryption helpers for secrets at rest (BYOK API keys).

Design:
- Envelope format: "enc:v1:<fernet_token>" so legacy plaintext values are
  detectable and can be migrated transparently on read.
- The Fernet key is derived from VALERIE_MASTER_KEY via SHA-256, so no extra
  secret must be provisioned. Rotating the master key invalidates stored
  ciphertexts (documented operational requirement).
"""

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from valerie.core.settings import settings

logger = logging.getLogger("core.crypto")

_PREFIX = "enc:v1:"
_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        digest = hashlib.sha256(settings.master_key.encode("utf-8")).digest()
        _fernet = Fernet(base64.urlsafe_b64encode(digest))
    return _fernet


def encrypt_secret(plaintext: str | None) -> str | None:
    """Encrypt a secret. Returns None for None/empty input."""
    if not plaintext:
        return plaintext
    if is_encrypted(plaintext):
        return plaintext  # already encrypted (idempotent)
    token = _get_fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")
    return f"{_PREFIX}{token}"


def decrypt_secret(value: str | None) -> str | None:
    """
    Decrypt a stored secret. Legacy plaintext values (without the enc:v1:
    prefix) are returned unchanged so existing rows keep working.
    Raises ValueError only when a value claims to be encrypted but cannot be
    decrypted (wrong key / tampering).
    """
    if not value:
        return value
    if not is_encrypted(value):
        return value
    token = value[len(_PREFIX):]
    try:
        return _get_fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken as e:
        raise ValueError("Stored secret could not be decrypted (wrong master key or corrupted data)") from e


def is_encrypted(value: str) -> bool:
    return isinstance(value, str) and value.startswith(_PREFIX)


def mask_secret(value: str | None) -> str | None:
    """Return a display-safe representation of a secret."""
    if not value:
        return value
    tail = value[-4:]
    return f"••••••••{tail}"
