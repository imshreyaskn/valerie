import subprocess
import time
import os

env = os.environ.copy()
env["PYTHONPATH"] = "src"

print("Starting API on port 8080...")
api = subprocess.Popen(["uvicorn", "valerie.api.main:app", "--port", "8080"], env=env)
print("Starting Worker on port 8081...")
worker = subprocess.Popen(["uvicorn", "valerie.worker.executor:app", "--port", "8081"], env=env)

print("Waiting for servers to start...")
time.sleep(10)

print("Running test_pipeline.py...")
result = subprocess.run(["python", "test_pipeline.py"], capture_output=True, text=True)

print("=== TEST PIPELINE STDOUT ===")
print(result.stdout)
print("=== TEST PIPELINE STDERR ===")
print(result.stderr)

print("Shutting down servers...")
api.terminate()
worker.terminate()
