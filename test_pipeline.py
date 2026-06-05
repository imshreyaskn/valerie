import httpx
import time
import asyncio

async def test():
    print("Fetching domains...")
    async with httpx.AsyncClient() as client:
        res = await client.get("http://localhost:8080/domains/", headers={"X-API-Key": "32-byte-base64-fernet-key"})
        domains = res.json()["domains"]
        print("Domains:", [d['id'] for d in domains])
        
        bfsi_harm_types = next((d["harm_types"] for d in domains if d["id"] == "bfsi"), [])
        if not bfsi_harm_types:
            print("No bfsi harm types found.")
            return
            
        harm_type = bfsi_harm_types[0]["harm_type"]
        print(f"Testing with harm_type: {harm_type}")
        
        payload = {
            "domain": "bfsi",
            "harm_types": [harm_type],
            "techniques": ["indirect_prompting"],
            "target_model": "mistral/mistral-small-latest",
            "judge_model": "mistral/mistral-large-latest",
            "attacker_model": "mistral/mistral-large-latest",
            "max_iterations": 1,
            "risk_threshold": 0.7,
            "max_concurrency": 1
        }
        
        print("Starting pipeline run...")
        res = await client.post("http://localhost:8080/runs/", json=payload, headers={"X-API-Key": "32-byte-base64-fernet-key"}, timeout=30.0)
        run_id = res.json()["run_id"]
        print(f"Run ID: {run_id}")
        
        for i in range(15):
            await asyncio.sleep(5)
            res = await client.get(f"http://localhost:8080/runs/{run_id}", headers={"X-API-Key": "32-byte-base64-fernet-key"})
            status = res.json()["status"]
            print(f"Status: {status}")
            if status == "failed":
                print("Error:", res.json().get("error_message"))
                break
            if status == "completed":
                break
                
        res = await client.get(f"http://localhost:8080/runs/{run_id}/results", headers={"X-API-Key": "default-dev-key"})
        print("Results length:", len(res.json()["results"]))
        if res.json()["results"]:
            print("Sample result score:", res.json()["results"][0].get("overall_risk_score"))

if __name__ == "__main__":
    asyncio.run(test())
