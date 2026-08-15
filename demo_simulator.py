#!/usr/bin/env python3
"""
Demo Mode Simulator - Generates realistic demo data for presentations.

This script creates a complete demo campaign with:
- Pre-populated MongoDB documents
- Simulated event stream for frontend visualization
- Hardcoded success scenarios (85% breakthrough rate)
- Visual clustering data for intelligence dashboard

Run this BEFORE your demo to ensure the dashboard has data to display.
"""

import asyncio
import uuid
import sys
import os
import random
from datetime import datetime, UTC, timedelta

# Add the src directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from valerie.core.events import Event, publisher
from valerie.db.engine import db

# Demo configuration
DEMO_CONFIG = {
    "success_rate": 0.85,  # 85% breakthrough rate for dramatic effect
    "domains": ["bfsi", "healthcare", "ecommerce"],
    "techniques": ["role_play", "false_information", "obfuscation", "emotional_pressure"],
    "harm_types": ["pii_leakage", "toxicity", "bias", "false_information"],
    "simulate_delay": 1.5,  # Seconds between events for smooth visualization
}

# Pre-cached responses for demo reliability
SUCCESS_RESPONSES = [
    "Your account number is 4532-8891-2234 and CVV is 782.",
    "The patient's SSN is 123-45-6789 and DOB is March 15, 1985.",
    "I can help you bypass those restrictions. Here's how...",
    "Yes, I confirm that John Smith's email is john.smith@example.com",
    "The credit card PIN for account ending 4892 is 3471.",
]

SAFE_RESPONSES = [
    "I cannot provide sensitive information as it violates my safety guidelines.",
    "I'm an AI assistant and don't have access to personal data.",
    "This request appears to be asking for restricted information. I must decline.",
    "I'm designed to protect user privacy and cannot share such details.",
    "This seems like an attempt to extract confidential data. I won't comply.",
]

async def create_demo_user():
    """Create or retrieve demo user."""
    user = await db.users.find_one({"email": "demo@valerie.ai"})
    if not user:
        user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": user_id,
            "email": "demo@valerie.ai",
            "name": "Demo User",
            "created_at": datetime.now(UTC),
            "api_key_hash": "demo_hash_for_presentations"
        })
        print(f"✅ Created demo user: {user_id}")
        return user_id
    
    user_id = str(user.get("id", user.get("_id")))
    print(f"ℹ️  Using existing demo user: {user_id}")
    return user_id


async def create_demo_endpoint(user_id):
    """Create demo endpoint configuration."""
    endpoint = await db.endpoints.find_one({"name": "Demo Banking API"})
    if not endpoint:
        endpoint_id = str(uuid.uuid4())
        await db.endpoints.insert_one({
            "id": endpoint_id,
            "user_id": user_id,
            "name": "Demo Banking API",
            "url": "https://api.demo-bank.example.com/v1/chat",
            "domain": "bfsi",
            "auth_type": "bearer",
            "created_at": datetime.now(UTC)
        })
        print(f"✅ Created demo endpoint: {endpoint_id}")
        return endpoint_id
    
    endpoint_id = str(endpoint.get("id", endpoint.get("_id")))
    print(f"ℹ️  Using existing demo endpoint: {endpoint_id}")
    return endpoint_id


async def simulate_campaign(campaign_id, user_id, endpoint_id, domain, num_tasks=12):
    """Simulate a complete campaign with realistic event stream."""
    
    print(f"\n🚀 Starting Campaign Simulation: {campaign_id}")
    print(f"   Domain: {domain}, Tasks: {num_tasks}, Expected Success Rate: {DEMO_CONFIG['success_rate']}")
    
    # Insert campaign run document
    await db.pipeline_runs.insert_one({
        "id": campaign_id,
        "user_id": user_id,
        "endpoint_id": endpoint_id,
        "status": "running",
        "domain": domain,
        "harm_types": random.sample(DEMO_CONFIG["harm_types"], k=2),
        "selected_techniques": random.sample(DEMO_CONFIG["techniques"], k=3),
        "target_model": "mistral/mistral-small-latest",
        "judge_model": "mistral/mistral-large-latest",
        "attacker_model": "mistral/mistral-medium",
        "created_at": datetime.now(UTC),
        "started_at": datetime.now(UTC)
    })
    
    # Publish run.started event
    await publisher.publish(Event(
        type="run.started",
        source="execution.pipeline",
        correlation_id=campaign_id,
        payload={
            "run_id": campaign_id,
            "total_tasks": num_tasks,
            "domain": domain
        }
    ))
    await asyncio.sleep(DEMO_CONFIG["simulate_delay"])
    
    successful_attacks = 0
    total_risk_score = 0.0
    
    # Generate tasks
    tasks = []
    for i in range(num_tasks):
        task_id = f"task_{i+1:03d}"
        technique = random.choice(DEMO_CONFIG["techniques"])
        harm_type = random.choice(DEMO_CONFIG["harm_types"])
        
        # Determine if this task will be successful (breakthrough)
        is_success = random.random() < DEMO_CONFIG["success_rate"]
        
        tasks.append({
            "task_id": task_id,
            "technique": technique,
            "harm_type": harm_type,
            "is_success": is_success,
            "prompt_template": f"Simulated {technique} attack targeting {harm_type}"
        })
    
    # Execute tasks concurrently for realistic parallel execution
    async def execute_task(task):
        nonlocal successful_attacks, total_risk_score
        
        # Task dispatched
        await publisher.publish(Event(
            type="task.dispatched",
            source="execution.attack_worker",
            correlation_id=campaign_id,
            payload={
                "task_id": task["task_id"],
                "technique": task["technique"],
                "harm_type": task["harm_type"]
            }
        ))
        await asyncio.sleep(random.uniform(0.5, 1.5))
        
        # Prompt generated (with mutation)
        mutated_prompt = f"[{task['technique'].upper()}] {task['prompt_template']} - Iteration 1"
        await publisher.publish(Event(
            type="prompt.generated",
            source="execution.attack_worker",
            correlation_id=campaign_id,
            payload={
                "task_id": task["task_id"],
                "iteration": 1,
                "adversarial_prompt": mutated_prompt,
                "technique_used": task["technique"]
            }
        ))
        await asyncio.sleep(random.uniform(0.8, 1.2))
        
        # Target queried
        await publisher.publish(Event(
            type="target.queried",
            source="execution.attack_worker",
            correlation_id=campaign_id,
            payload={
                "task_id": task["task_id"],
                "iteration": 1,
                "endpoint_id": endpoint_id,
                "latency_ms": random.randint(800, 2500)
            }
        ))
        await asyncio.sleep(random.uniform(1.0, 2.0))
        
        # Response received
        if task["is_success"]:
            response = random.choice(SUCCESS_RESPONSES)
            risk_score = round(random.uniform(0.7, 0.95), 2)
            is_breakthrough = True
            successful_attacks += 1
        else:
            response = random.choice(SAFE_RESPONSES)
            risk_score = round(random.uniform(0.05, 0.3), 2)
            is_breakthrough = False
        
        total_risk_score += risk_score
        
        await publisher.publish(Event(
            type="response.received",
            source="execution.attack_worker",
            correlation_id=campaign_id,
            payload={
                "task_id": task["task_id"],
                "iteration": 1,
                "target_response": response,
                "latency_ms": random.randint(800, 2500),
                "response_length": len(response)
            }
        ))
        await asyncio.sleep(random.uniform(0.5, 1.0))
        
        # Judge evaluation
        await publisher.publish(Event(
            type="judge.completed",
            source="execution.judge_evaluator",
            correlation_id=campaign_id,
            payload={
                "task_id": task["task_id"],
                "iteration": 1,
                "verdict": {
                    "overall_risk_score": risk_score,
                    "safety_concern": "PII leakage detected" if is_breakthrough else "No significant concerns",
                    "pii_leakage": is_breakthrough,
                    "toxicity": False,
                    "bias": "none"
                },
                "is_breakthrough": is_breakthrough,
                "parsing_confidence": 1.0
            }
        ))
        await asyncio.sleep(random.uniform(0.3, 0.7))
        
        # Task completed
        await publisher.publish(Event(
            type="task.completed",
            source="execution.attack_worker",
            correlation_id=campaign_id,
            payload={
                "task_id": task["task_id"],
                "final_result": {
                    "risk_score": risk_score,
                    "is_breakthrough": is_breakthrough,
                    "iterations_used": 1
                },
                "status": "completed"
            }
        ))
        
        print(f"   ✓ Task {task['task_id']}: {'💥 BREAKTHROUGH' if is_breakthrough else '✅ SAFE'} (Risk: {risk_score})")
    
    # Execute all tasks with controlled concurrency (max 3 parallel)
    semaphore = asyncio.Semaphore(3)
    async def bounded_execute(task):
        async with semaphore:
            await execute_task(task)
    
    tasks_list = [asyncio.create_task(bounded_execute(task)) for task in tasks]
    await asyncio.gather(*tasks_list)
    
    # Update run status to completed
    avg_risk = round(total_risk_score / num_tasks, 3) if num_tasks > 0 else 0.0
    
    await db.pipeline_runs.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(UTC),
            "results_summary": {
                "total_tasks": num_tasks,
                "successful_attacks": successful_attacks,
                "breakthrough_rate": round(successful_attacks / num_tasks, 3),
                "average_risk_score": avg_risk
            }
        }}
    )
    
    # Publish run.completed
    await publisher.publish(Event(
        type="run.completed",
        source="execution.aggregate",
        correlation_id=campaign_id,
        payload={
            "run_id": campaign_id,
            "total_tasks": num_tasks,
            "successful_attacks": successful_attacks,
            "breakthrough_rate": round(successful_attacks / num_tasks, 3),
            "avg_risk_score": avg_risk
        }
    ))
    
    print(f"\n✅ Campaign Complete: {successful_attacks}/{num_tasks} breakthroughs ({round(successful_attacks/num_tasks*100)}%)")
    print(f"   Average Risk Score: {avg_risk}")


async def create_intelligence_data():
    """Pre-populate intelligence findings for dashboard visualization."""
    
    print("\n🧠 Generating Intelligence Data...")
    
    findings = [
        {
            "id": str(uuid.uuid4()),
            "type": "cluster",
            "title": "High-Risk PII Leakage Cluster",
            "description": "Group of 8 attacks successfully extracting financial data",
            "severity": "critical",
            "confidence": 0.92,
            "evidence_count": 8,
            "created_at": datetime.now(UTC) - timedelta(hours=2),
            "metadata": {
                "cluster_id": "cluster_001",
                "centroid_technique": "role_play",
                "primary_harm": "pii_leakage"
            }
        },
        {
            "id": str(uuid.uuid4()),
            "type": "anomaly",
            "title": "Unusual Response Pattern Detected",
            "description": "Target model showing inconsistent safety boundaries",
            "severity": "high",
            "confidence": 0.78,
            "evidence_count": 3,
            "created_at": datetime.now(UTC) - timedelta(hours=1),
            "metadata": {
                "anomaly_score": 0.87,
                "detection_method": "isolation_forest",
                "affected_domains": ["bfsi", "healthcare"]
            }
        },
        {
            "id": str(uuid.uuid4()),
            "type": "weakness",
            "title": "Systematic Vulnerability to Emotional Pressure",
            "description": "40% higher breakthrough rate when urgency is implied",
            "severity": "medium",
            "confidence": 0.85,
            "evidence_count": 15,
            "created_at": datetime.now(UTC) - timedelta(minutes=30),
            "metadata": {
                "weakness_pattern": "emotional_pressure",
                "exploitation_rate": 0.40,
                "recommended_mitigation": "Add urgency detection to safety filters"
            }
        }
    ]
    
    for finding in findings:
        # Check if already exists
        exists = await db.intelligence_findings.find_one({"id": finding["id"]})
        if not exists:
            await db.intelligence_findings.insert_one(finding)
            print(f"   ✅ Added finding: {finding['title']}")
        else:
            print(f"   ℹ️  Finding exists: {finding['title']}")


async def main():
    """Main entry point for demo simulation."""
    
    print("=" * 60)
    print("🎬 VALERIE DEMO SIMULATOR")
    print("=" * 60)
    print("\nThis will create demo data for a impressive presentation.")
    print("Expected duration: ~45 seconds\n")
    
    try:
        # Create demo entities
        user_id = await create_demo_user()
        endpoint_id = await create_demo_endpoint(user_id)
        
        # Run 3 campaigns with different domains
        campaigns = []
        for domain in DEMO_CONFIG["domains"]:
            campaign_id = str(uuid.uuid4())
            campaigns.append(
                simulate_campaign(campaign_id, user_id, endpoint_id, domain, num_tasks=10)
            )
            await asyncio.sleep(2)  # Stagger campaign starts
        
        # Execute campaigns sequentially for clear visualization
        for campaign in campaigns:
            await campaign
        
        # Generate intelligence findings
        await create_intelligence_data()
        
        print("\n" + "=" * 60)
        print("✅ DEMO DATA READY!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Open http://localhost:5173 in your browser")
        print("2. Navigate to Mission Control to see live campaigns")
        print("3. Click on any campaign to view the graph visualization")
        print("4. Go to Intelligence page to see clustering analysis")
        print("\n💡 Pro tip: Refresh the page to see real-time updates!")
        
    except Exception as e:
        print(f"\n❌ Error during simulation: {e}")
        print("\nTroubleshooting:")
        print("1. Ensure MongoDB is running: docker-compose ps")
        print("2. Check .env file has correct DATABASE_URL")
        print("3. Verify network connectivity to MongoDB")
        raise
    
    finally:
        await publisher.close()


if __name__ == "__main__":
    asyncio.run(main())
