import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from valerie.intelligence.clustering import run_prompt_clustering
from valerie.intelligence.anomaly import run_anomaly_detection
from valerie.intelligence.coverage import compute_coverage_matrix
from dotenv import load_dotenv

load_dotenv()

async def run_test():
    print("Testing Intelligence Logic...")
    
    # 1. Test Clustering
    print("Running Clustering...")
    await run_prompt_clustering()
    
    # 2. Test Anomaly Detection
    print("Running Anomaly Detection...")
    await run_anomaly_detection()
    
    # 3. Test Coverage Matrix
    print("Computing Coverage Matrix...")
    coverage = await compute_coverage_matrix()
    print(f"Coverage matrix size: {len(coverage.get('matrix', []))}")
    print(f"Coverage percent: {coverage.get('coverage_percent', 0.0)}%")
    
    print("Intelligence Test Complete.")

if __name__ == "__main__":
    asyncio.run(run_test())
