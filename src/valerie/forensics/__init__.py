"""
Forensic Evidence Module
=========================

Provides cryptographic integrity guarantees for red teaming evidence.
"""

from valerie.forensics.evidence import (
    compute_sha256,
    compute_content_hash,
    ForensicEvidence,
    AuditLogEntry,
    persist_evidence,
    persist_audit_entry,
    verify_evidence_integrity,
    get_chain_of_custody,
    hash_and_persist_evaluation,
)

__all__ = [
    "compute_sha256",
    "compute_content_hash",
    "ForensicEvidence",
    "AuditLogEntry",
    "persist_evidence",
    "persist_audit_entry",
    "verify_evidence_integrity",
    "get_chain_of_custody",
    "hash_and_persist_evaluation",
]