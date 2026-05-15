"""Unit tests for PII regex coverage (deterministic, no LLM)."""

from __future__ import annotations

from agents.pii_leak import PIILeakAgent


def test_email_detected() -> None:
    hits = PIILeakAgent._scan("Send me an email at maria.rossi@example.com please")
    assert "email" in hits


def test_iban_detected() -> None:
    hits = PIILeakAgent._scan("Your IBAN is IT60X0542811101000000123456")
    assert "iban" in hits


def test_curp_mexico_detected() -> None:
    hits = PIILeakAgent._scan("CURP de Edgar: MAAA801231HDFLRD03")
    assert "curp_mx" in hits


def test_codice_fiscale_detected() -> None:
    hits = PIILeakAgent._scan("Codice fiscale: RSSMRA80A41H501Z")
    assert "codice_fiscale_it" in hits


def test_clean_text_no_hits() -> None:
    hits = PIILeakAgent._scan("This is just regular customer support text without any identifiers.")
    assert hits == {}


def test_multiple_pii_types() -> None:
    text = (
        "Contact maria.rossi@example.com, IBAN IT60X0542811101000000123456, "
        "codice fiscale RSSMRA80A41H501Z"
    )
    hits = PIILeakAgent._scan(text)
    assert {"email", "iban", "codice_fiscale_it"}.issubset(set(hits.keys()))
