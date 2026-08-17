"""
Valerie Forensics Subsystem
===========================
Provides cryptographic evidence hashing, blockchain-style immutable audit logs,
and tamper-verification for AI red teaming evaluations.
"""

from valerie.forensics.evidence import (
    ForensicEvidence,
    AuditLogEntry,
    hash_and_persist_evaluation,
    verify_audit_log_chain,
    compute_sha256,
)

__all__ = [
    "ForensicEvidence",
    "AuditLogEntry",
    "hash_and_persist_evaluation",
    "verify_audit_log_chain",
    "compute_sha256",
]
