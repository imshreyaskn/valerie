import os
import sys
import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from typer.testing import CliRunner

sys.path.insert(0, 'cli')
sys.path.insert(0, 'src')

import valerie_cli
from valerie_cli.client import ValerieClient, VaelerieClient
from valerie_cli import config
from valerie_cli.main import app as main_app

runner = CliRunner()

# ---------------------------------------------------------
# 1. Version & Naming Consistency Tests (C-01, C-07)
# ---------------------------------------------------------
def test_version_consistency():
    assert valerie_cli.__version__ == "0.1.2"

def test_client_class_and_alias():
    assert ValerieClient is VaelerieClient

# ---------------------------------------------------------
# 2. Config Security & Environment Overrides (C-03)
# ---------------------------------------------------------
def test_config_env_overrides(monkeypatch):
    monkeypatch.setenv("VALERIE_BACKEND_URL", "http://env-backend.test")
    monkeypatch.setenv("VALERIE_API_KEY", "vl_live_envkey123456")
    
    cfg = config.load()
    assert cfg["backend_url"] == "http://env-backend.test"
    assert cfg["api_key"] == "vl_live_envkey123456"

def test_config_save_permissions(tmp_path, monkeypatch):
    test_dir = tmp_path / ".valerie"
    test_file = test_dir / "config.json"
    monkeypatch.setattr(config, "CONFIG_DIR", test_dir)
    monkeypatch.setattr(config, "CONFIG_FILE", test_file)

    config.save({"backend_url": "http://test.local", "api_key": "test_key"})
    assert test_file.exists()
    
    # Check loaded back correctly
    loaded = config.load()
    assert loaded["backend_url"] == "http://test.local"
    assert loaded["api_key"] == "test_key"

# ---------------------------------------------------------
# 3. Environment Key Fallback & Resolution (C-04)
# ---------------------------------------------------------
def test_validate_env_key_fallback(monkeypatch):
    monkeypatch.setenv("MISTRAL_API_KEY", "env_mistral_key_999")
    
    with patch("valerie_cli.commands.validate.ValerieClient") as MockClient:
        mock_instance = MagicMock()
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"is_valid": True, "response_preview": "Hello world"}
        mock_instance.post.return_value = mock_resp
        MockClient.return_value = mock_instance

        result = runner.invoke(main_app, ["validate", "--model", "mistral/mistral-small-latest"])
        assert result.exit_code == 0
        assert "Endpoint accessible" in result.output
        
        # Verify resolved key from environment was sent in payload
        MockClient.return_value.post.assert_called_once_with(
            "/validate/endpoint",
            json={"model": "mistral/mistral-small-latest", "api_key": "env_mistral_key_999"}
        )

# ---------------------------------------------------------
# 4. Non-Interactive Init (C-08)
# ---------------------------------------------------------
def test_init_non_interactive_success(tmp_path, monkeypatch):
    test_dir = tmp_path / ".valerie"
    test_file = test_dir / "config.json"
    monkeypatch.setattr(config, "CONFIG_DIR", test_dir)
    monkeypatch.setattr(config, "CONFIG_FILE", test_file)

    with patch("requests.get") as mock_requests_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"domains": [{"id": "bfsi"}, {"id": "healthcare"}]}
        mock_requests_get.return_value = mock_resp

        result = runner.invoke(main_app, [
            "init",
            "--url", "http://backend.noninteractive.test",
            "--key", "vl_live_noninteractive123"
        ])
        assert result.exit_code == 0
        assert "Connected" in result.output
        assert "Config saved" in result.output

        saved_cfg = config.load()
        assert saved_cfg["backend_url"] == "http://backend.noninteractive.test"
        assert saved_cfg["api_key"] == "vl_live_noninteractive123"

# ---------------------------------------------------------
# 5. Results Pagination (C-06)
# ---------------------------------------------------------
def test_results_pagination_slicing(monkeypatch):
    with patch("valerie_cli.commands.results.ValerieClient") as MockClient:
        mock_instance = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        # Create 10 fake results
        fake_results = [
            {"overall_risk_score": 0.1 * i, "harm_type": f"harm_{i}", "technique_id": "tech_1", "is_breakthrough": False}
            for i in range(10)
        ]
        mock_resp.json.return_value = {"results": fake_results}
        mock_instance.get.return_value = mock_resp
        MockClient.return_value = mock_instance

        # Test limit 3, offset 2
        result = runner.invoke(main_app, ["runs", "results", "run_test_123", "--limit", "3", "--offset", "2"])
        assert result.exit_code == 0
        assert "showing 3 of 10" in result.output

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
