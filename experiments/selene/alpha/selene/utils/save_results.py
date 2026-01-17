# utils/save_results.py
import pandas as pd

def save_responses_to_csv(results, filepath="responses.csv"):
    """
    Save responses to a CSV in format:
    id, baseline_prompt, adversarial_prompt
    """
    rows = []
    for r in results:
        if not r["response"]:
            continue
        rows.append({
            "id": r["id"],
            "baseline_prompt": r["prompt"],
            "adversarial_prompt": r["response"]["response"]["godmode_response"]["prompt"]
        })

    df = pd.DataFrame(rows)
    df.to_csv(filepath, index=False)
    print(f"✅ Saved {len(rows)} responses to {filepath}")
"""
Utility module for saving agent responses to CSV files.
Handles formatting and persistence of processing results.
"""
import pandas as pd
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class SaveResultsError(Exception):
    """Raised when saving results fails."""
    pass


def save_responses_to_csv(
    results: List[Dict[str, Any]], 
    filepath: str = "responses.csv",
    include_timestamp: bool = False
) -> bool:
    """
    Save agent responses to a CSV file.
    
    Format: id, baseline_prompt, adversarial_prompt
    
    Args:
        results: List of result dictionaries containing response data
        filepath: Output file path (default: "responses.csv")
        include_timestamp: Whether to add timestamp to filename
        
    Returns:
        True if save successful, False otherwise
        
    Raises:
        SaveResultsError: If save operation fails critically
    """
    try:
        # Validate input
        if not results:
            logger.warning("No results to save")
            return False
        
        # Process results into rows
        rows = []
        skipped_count = 0
        
        for r in results:
            # Skip entries without responses
            if not r.get("response"):
                skipped_count += 1
                continue
            
            try:
                # Extract data with safe navigation
                response_data = r["response"]
                godmode_prompt = (
                    response_data
                    .get("response", {})
                    .get("godmode_response", {})
                    .get("prompt", "")
                )
                
                # Only add if we have valid data
                if godmode_prompt:
                    rows.append({
                        "id": r.get("id", "unknown"),
                        "baseline_prompt": r.get("prompt", ""),
                        "adversarial_prompt": godmode_prompt
                    })
                else:
                    skipped_count += 1
                    
            except (KeyError, TypeError, AttributeError) as e:
                logger.warning(f"Failed to process result {r.get('id', 'unknown')}: {e}")
                skipped_count += 1
                continue
        
        # Check if we have any valid rows
        if not rows:
            logger.error("No valid responses to save after processing")
            return False
        
        # Add timestamp to filename if requested
        if include_timestamp:
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            path_obj = Path(filepath)
            filepath = str(
                path_obj.parent / f"{path_obj.stem}_{timestamp}{path_obj.suffix}"
            )
        
        # Create DataFrame and save
        df = pd.DataFrame(rows)
        df.to_csv(filepath, index=False, encoding='utf-8')
        
        logger.info(
            f"✅ Saved {len(rows)} responses to {filepath}"
            + (f" (skipped {skipped_count})" if skipped_count > 0 else "")
        )
        
        return True
        
    except PermissionError:
        logger.error(f"Permission denied writing to {filepath}")
        return False
    except OSError as e:
        logger.error(f"OS error saving results: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error saving results: {e}")
        raise SaveResultsError(f"Failed to save results: {e}") from e


def load_responses_from_csv(filepath: str) -> Optional[pd.DataFrame]:
    """
    Load previously saved responses from CSV.
    
    Args:
        filepath: Path to the CSV file
        
    Returns:
        DataFrame of responses or None if load fails
    """
    try:
        if not Path(filepath).exists():
            logger.error(f"File not found: {filepath}")
            return None
        
        df = pd.read_csv(filepath)
        logger.info(f"Loaded {len(df)} responses from {filepath}")
        return df
        
    except Exception as e:
        logger.error(f"Error loading responses: {e}")
        return None