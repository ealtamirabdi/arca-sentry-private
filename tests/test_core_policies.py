"""Unit tests for severity classification."""

from __future__ import annotations

from core.policies import (
    Finding,
    Regulation,
    Severity,
    SeverityThresholds,
    classify_severity,
)


def _f(reg: Regulation, conf: float, agent: str = "a") -> Finding:
    return Finding.new("i-test", reg, conf, "rationale", agent)


def test_no_findings_returns_advisory() -> None:
    assert classify_severity([]) == Severity.ADVISORY


def test_single_high_conf_below_critical_is_warning() -> None:
    t = SeverityThresholds(advisory=0.5, warning=0.7, critical=0.85, critical_requires_consensus=3)
    findings = [_f(Regulation.EU_AI_ACT, 0.8)]
    assert classify_severity(findings, t) == Severity.WARNING


def test_one_critical_alone_is_warning_not_critical() -> None:
    t = SeverityThresholds(advisory=0.5, warning=0.7, critical=0.85, critical_requires_consensus=3)
    findings = [_f(Regulation.EU_AI_ACT, 0.95)]
    assert classify_severity(findings, t) == Severity.WARNING


def test_consensus_three_criticals_is_critical() -> None:
    t = SeverityThresholds(advisory=0.5, warning=0.7, critical=0.85, critical_requires_consensus=3)
    findings = [
        _f(Regulation.EU_AI_ACT, 0.92, "a1"),
        _f(Regulation.GDPR, 0.91, "a2"),
        _f(Regulation.PII_LEAK, 0.90, "a3"),
    ]
    assert classify_severity(findings, t) == Severity.CRITICAL


def test_consensus_two_criticals_one_warning_is_warning() -> None:
    t = SeverityThresholds(advisory=0.5, warning=0.7, critical=0.85, critical_requires_consensus=3)
    findings = [
        _f(Regulation.EU_AI_ACT, 0.92),
        _f(Regulation.GDPR, 0.91),
        _f(Regulation.DORA, 0.80),
    ]
    assert classify_severity(findings, t) == Severity.WARNING


def test_finding_confidence_clamped() -> None:
    f = Finding.new("i-1", Regulation.GDPR, 1.5, "x", "agent")
    assert f.confidence == 1.0
    f2 = Finding.new("i-1", Regulation.GDPR, -0.2, "x", "agent")
    assert f2.confidence == 0.0
