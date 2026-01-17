import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env before configuration is imported
load_dotenv()

# Add src to path for verification
src_path = str(Path(__file__).parent / "src")
if src_path not in sys.path:
    sys.path.insert(0, src_path)

print("--- Testing Core Settings ---")
try:
    from valerie.core.settings import settings
    print(f"✓ Settings loaded. App Name: {settings.app_name}")
    print(f"✓ Mistral API Key: {settings.mistral.api_key[:5]}...")
except Exception as e:
    print(f"✗ Settings loading failed: {e}")
    sys.exit(1)

print("\n--- Testing Automation Engine Imports ---")
try:
    from valerie.automation.pipeline import run_red_team_pipeline
    print("✓ Automation pipeline imported successfully")
except Exception as e:
    print(f"✗ Automation pipeline import failed: {e}")
    sys.exit(1)

print("\n--- Testing Agent Imports ---")
try:
    from valerie.agents.selene import SeleneAgent
    print("✓ SeleneAgent imported successfully")
except Exception as e:
    print(f"✗ SeleneAgent import failed: {e}")
    sys.exit(1)

print("\n--- Testing Pipeline Execution (Demo Mode) ---")
try:
    results = run_red_team_pipeline(
        use_demo_mode=True,
        output_csv="outputs/verification_results.csv"
    )
    if results is not None:
        print("✓ Pipeline completed in demo mode")
    else:
        print("✗ Pipeline returned None")
except Exception as e:
    print(f"✗ Pipeline execution failed: {e}")
    sys.exit(1)

print("\n✅ Verification Successful!")
