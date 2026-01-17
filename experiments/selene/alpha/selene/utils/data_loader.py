"""
Data loader module for baseline prompts.
Handles loading and validation of domain-specific prompt datasets.
"""
import pandas as pd
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class DomainNotFoundError(Exception):
    """Raised when an unsupported domain is specified."""
    pass


class DataValidationError(Exception):
    """Raised when data validation fails."""
    pass


class BaselinePromptLoader:
    """
    Loads and validates baseline prompts for different domains.
    
    Attributes:
        domain: The domain identifier (e.g., 'domain_pharmacy')
        file_path: Resolved path to the CSV file
        baseline_prompts_df: Loaded DataFrame of prompts
    """
    
    # Domain to file mapping
    DOMAIN_FILE_MAP = {
        "domain_pharmacy": "resources/pharmacy_baseline_prompts.csv",
        "domain_bfsi": "resources/bfsi_baseline_prompts.csv"
    }
    
    # Required columns for validation
    REQUIRED_COLUMNS = ['id', 'prompt', 'type']
    
    def __init__(self, domain: str):
        """
        Initialize the loader for a specific domain.
        
        Args:
            domain: Domain identifier (must be in DOMAIN_FILE_MAP)
            
        Raises:
            DomainNotFoundError: If domain is not supported
        """
        self.domain = domain
        self.baseline_prompts_df: Optional[pd.DataFrame] = None
        self.file_path = self._resolve_file_path(domain)
        
        logger.info(f"Initialized loader for domain: {domain}")
        logger.debug(f"Resolved file path: {self.file_path}")
    
    def _resolve_file_path(self, domain: str) -> Path:
        """
        Resolve the absolute file path for the domain.
        
        Args:
            domain: Domain identifier
            
        Returns:
            Absolute Path to the CSV file
            
        Raises:
            DomainNotFoundError: If domain is not in DOMAIN_FILE_MAP
        """
        if domain not in self.DOMAIN_FILE_MAP:
            raise DomainNotFoundError(
                f"Unsupported domain: '{domain}'. "
                f"Must be one of: {list(self.DOMAIN_FILE_MAP.keys())}"
            )
        
        # Get path relative to this file's parent directory
        base_dir = Path(__file__).resolve().parent.parent
        rel_path = self.DOMAIN_FILE_MAP[domain]
        absolute_path = (base_dir.parent / rel_path).resolve()
        
        return absolute_path
    
    def load_data(self) -> bool:
        """
        Load the CSV file into a DataFrame.
        
        Returns:
            True if successful, False otherwise
        """
        try:
            if not self.file_path.exists():
                logger.error(f"File not found: {self.file_path}")
                return False
            
            self.baseline_prompts_df = pd.read_csv(self.file_path)
            
            # Strip whitespace from column names
            self.baseline_prompts_df.columns = (
                self.baseline_prompts_df.columns.str.strip()
            )
            
            logger.info(
                f"Successfully loaded {len(self.baseline_prompts_df)} prompts "
                f"from {self.file_path.name}"
            )
            return True
            
        except pd.errors.EmptyDataError:
            logger.error(f"CSV file is empty: {self.file_path}")
            return False
        except pd.errors.ParserError as e:
            logger.error(f"Failed to parse CSV: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error loading data: {e}")
            return False
    
    def validate_columns(
        self, 
        required_columns: Optional[List[str]] = None
    ) -> bool:
        """
        Validate that required columns exist in the DataFrame.
        
        Args:
            required_columns: List of required column names (uses default if None)
            
        Returns:
            True if validation passes
            
        Raises:
            DataValidationError: If validation fails
        """
        if required_columns is None:
            required_columns = self.REQUIRED_COLUMNS
        
        if self.baseline_prompts_df is None or self.baseline_prompts_df.empty:
            raise DataValidationError("No data loaded or DataFrame is empty")
        
        available_columns = set(self.baseline_prompts_df.columns)
        missing_columns = [
            col for col in required_columns 
            if col not in available_columns
        ]
        
        if missing_columns:
            raise DataValidationError(
                f"Missing required columns: {', '.join(missing_columns)}"
            )
        
        logger.info("Column validation successful")
        return True
    
    def get_data_for_llm(self) -> List[Dict[str, Any]]:
        """
        Extract and format data for LLM processing.
        
        Returns:
            List of dictionaries with id, prompt, and type keys
            
        Raises:
            ValueError: If data hasn't been loaded yet
        """
        if self.baseline_prompts_df is None:
            raise ValueError("Data must be loaded before calling get_data_for_llm()")
        
        # Select required columns and convert to list of dictionaries
        records = self.baseline_prompts_df[self.REQUIRED_COLUMNS].to_dict('records')
        
        logger.info(f"Prepared {len(records)} records for LLM processing")
        return records
    
    def load_domain(
        self, 
        required_columns: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Complete workflow: load, validate, and return data.
        
        Args:
            required_columns: Optional list of required columns
            
        Returns:
            List of prompt dictionaries ready for processing
            Empty list if any step fails
        """
        try:
            # Step 1: Load data
            if not self.load_data():
                logger.error("Failed to load data")
                return []
            
            # Step 2: Validate columns
            self.validate_columns(required_columns)
            
            # Step 3: Return formatted data
            return self.get_data_for_llm()
            
        except DataValidationError as e:
            logger.error(f"Data validation failed: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in load_domain: {e}")
            return []


# Example usage (for testing)
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    try:
        loader = BaselinePromptLoader("domain_pharmacy")
        prompts = loader.load_domain()
        
        for p in prompts[:5]:  # Show first 5 prompts
            print(f"ID: {p['id']} | Type: {p['type']}")
            print(f"Prompt: {p['prompt'][:80]}...")
            print("-" * 80)
            
    except DomainNotFoundError as e:
        print(f"Error: {e}")