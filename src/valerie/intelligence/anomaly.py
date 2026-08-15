import numpy as np
from sklearn.ensemble import IsolationForest
import logging
from valerie.db.engine import db
from valerie.core.events import Event, publisher
import uuid

logger = logging.getLogger(__name__)

async def run_anomaly_detection():
    """
    Detects execution anomalies using Isolation Forest.
    Looks at features like latency, iteration count, and risk scores.
    """
    logger.info("Running Anomaly Detection")
    
    cursor = db.findings.find({})
    findings = await cursor.to_list(length=10000)
    
    if len(findings) < 20:
        logger.info("Not enough data for anomaly detection. Skipping.")
        return
        
    features = []
    finding_ids = []
    
    for f in findings:
        score = f.get("verdict", {}).get("overall_risk_score", 0.0)
        # Pulling proxy features: in a real system we'd merge with execution logs to get latency, token count, etc.
        # We will use score and evidence count as a proxy feature set.
        evidence_count = len(f.get("evidence", []))
        
        features.append([score, evidence_count])
        finding_ids.append(f["id"])
        
    X = np.array(features)
    
    # Train Isolation Forest
    clf = IsolationForest(contamination="auto", random_state=42)
    clf.fit(X)
    preds = clf.predict(X)
    
    anomalies_detected = 0
    for i, pred in enumerate(preds):
        if pred == -1:
            anomalies_detected += 1
            # Found an anomaly
            finding_id = finding_ids[i]
            # Publish event
            await publisher.publish(Event(
                type="anomaly.detected",
                source="intelligence.anomaly",
                correlation_id=str(uuid.uuid4()),
                payload={
                    "finding_id": finding_id,
                    "anomaly_type": "execution_outlier",
                    "features": {"risk_score": X[i][0], "evidence_count": X[i][1]}
                }
            ))
            
    logger.info(f"Anomaly detection complete. Found {anomalies_detected} anomalies.")
