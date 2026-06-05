import subprocess
import json
cmd = [
    'gcloud', 'logging', 'read',
    'resource.type="cloud_run_revision" AND resource.labels.service_name="valerie-api" AND timestamp>="2026-06-05T06:00:00Z"',
    '--limit=50', '--format=json'
]
p = subprocess.run(cmd, capture_output=True, text=True, shell=True)
if p.stdout:
    logs = json.loads(p.stdout)
    for log in logs:
        print(f"[{log.get('timestamp')}] {log.get('severity')}:")
        print(log.get('textPayload') or log.get('jsonPayload') or log.get('protoPayload', {}).get('status', {}).get('message'))
else:
    print(p.stderr)
