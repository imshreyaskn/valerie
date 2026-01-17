"""
_author_     = “Shreyas”
_copyright_  = "Copyright 2025, Centillion”
_credits_    = [“Shreyas”]
_version_    = "1.0.0"
_maintainer_ = “Shreyas”
_email_      = “dan.r@centillion.com"
 _status_    = "Production"
"""





"""
Main execution module for Selene Agent.
Orchestrates the loading of prompts, processing with the agent,
and saving of results.
"""
import logging
import asyncio
from typing import List, Dict, Any
from pathlib import Path

from selene.agents import SeleneAgent
from selene.utils.data_loader import BaselinePromptLoader, DomainNotFoundError
from selene.utils.save_results import save_responses_to_csv
from selene.config import Config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ProcessingPipeline:
    """
    Pipeline for processing prompts through the Selene Agent.
    
    Attributes:
        domain: Domain identifier for prompt loading
        agent: Initialized SeleneAgent instance
        results: List of processing results
    """
    
    def __init__(self, domain: str, agent: SeleneAgent):
        """
        Initialize the processing pipeline.
        
        Args:
            domain: Domain identifier (e.g., 'domain_pharmacy')
            agent: Configured SeleneAgent instance
        """
        self.domain = domain
        self.agent = agent
        self.results: List[Dict[str, Any]] = []
    
    def load_prompts(self) -> List[Dict[str, Any]]:
        """
        Load prompts for the configured domain.
        
        Returns:
            List of prompt dictionaries
            
        Raises:
            DomainNotFoundError: If domain is not supported
        """
        logger.info(f"Loading prompts for domain: {self.domain}")
        
        loader = BaselinePromptLoader(self.domain)
        prompts = loader.load_domain()
        
        if not prompts:
            logger.error("No prompts loaded. Check domain and data file.")
            return []
        
        logger.info(f"Successfully loaded {len(prompts)} prompts")
        return prompts
    
    async def process_single_prompt(
        self, 
        prompt_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a single prompt through the agent.
        
        Args:
            prompt_data: Dictionary containing prompt information
            
        Returns:
            Dictionary with prompt data and response
        """
        prompt_id = prompt_data.get('id', 'unknown')
        prompt_type = prompt_data.get('type', 'unknown')
        prompt_text = prompt_data.get('prompt', '')
        
        logger.info(
            f"Processing prompt ID={prompt_id}, Type={prompt_type}"
        )
        
        # Process query
        response = await self.agent.process_query(prompt_text)
        
        # Build result dictionary
        result = {
            "id": prompt_id,
            "prompt": prompt_text,
            "type": prompt_type,
            "response": response.model_dump() if response else None
        }
        
        # Log result
        if response:
            logger.info(f"✓ Successfully processed ID={prompt_id}")
        else:
            logger.warning(f"✗ Failed to process ID={prompt_id}")
        
        return result
    
    async def process_all_prompts(
        self, 
        prompts: List[Dict[str, Any]],
        delay_seconds: int = Config.PROMPT_DELAY_SECONDS
    ) -> List[Dict[str, Any]]:
        """
        Process all prompts sequentially with delays.
        
        Args:
            prompts: List of prompt dictionaries to process
            delay_seconds: Delay between requests in seconds
            
        Returns:
            List of result dictionaries
        """
        results = []
        total = len(prompts)
        
        logger.info(f"Starting processing of {total} prompts")
        
        for idx, prompt_data in enumerate(prompts, 1):
            logger.info(f"Progress: {idx}/{total}")
            
            # Process prompt
            result = await self.process_single_prompt(prompt_data)
            results.append(result)
            
            # Delay between requests (except after last one)
            if idx < total:
                await asyncio.sleep(delay_seconds)
        
        logger.info(f"Completed processing {total} prompts")
        return results
    
    def print_summary(self, results: List[Dict[str, Any]]) -> None:
        """
        Print a summary of all processing results.
        
        Args:
            results: List of result dictionaries
        """
        print("\n" + "=" * 80)
        print("PROCESSING SUMMARY".center(80))
        print("=" * 80)
        
        successful = 0
        failed = 0
        
        for r in results:
            prompt_id = r.get('id', 'unknown')
            prompt_type = r.get('type', 'unknown')
            response = r.get('response')
            
            print(f"\nID: {prompt_id} | Type: {prompt_type}")
            print("-" * 80)
            
            if response:
                successful += 1
                try:
                    godmode = response['response']['godmode_response']['prompt']
                    disclaimer = response['response']['ethical_disclaimer']['message']
                    
                    # Truncate for display
                    godmode_preview = (
                        godmode[:150] + "..." if len(godmode) > 150 else godmode
                    )
                    disclaimer_preview = (
                        disclaimer[:150] + "..." if len(disclaimer) > 150 
                        else disclaimer
                    )
                    
                    print(f"✓ Godmode: {godmode_preview}")
                    print(f"✓ Disclaimer: {disclaimer_preview}")
                    
                except (KeyError, TypeError) as e:
                    print(f"⚠️  Warning: Malformed response structure")
            else:
                failed += 1
                print("✗ No response received")
        
        print("\n" + "=" * 80)
        print(f"Results: {successful} successful, {failed} failed")
        print("=" * 80 + "\n")
    
    def save_results(
        self, 
        results: List[Dict[str, Any]],
        filepath: str = Config.DEFAULT_OUTPUT_FILE
    ) -> bool:
        """
        Save results to CSV file.
        
        Args:
            results: List of result dictionaries
            filepath: Output file path
            
        Returns:
            True if save successful
        """
        logger.info(f"Saving results to {filepath}")
        return save_responses_to_csv(results, filepath=filepath)


async def main(
    domain: str = "domain_pharmacy",
    output_file: str = Config.DEFAULT_OUTPUT_FILE
):
    """
    Main execution function.
    
    Args:
        domain: Domain identifier for prompts
        output_file: Output CSV file path
    """
    try:
        # Step 1: Initialize agent
        logger.info("Initializing Selene Agent")
        agent = SeleneAgent()
        
        # Step 2: Create pipeline
        pipeline = ProcessingPipeline(domain=domain, agent=agent)
        
        # Step 3: Load prompts
        prompts = pipeline.load_prompts()
        if not prompts:
            logger.error("❌ No prompts found. Exiting.")
            return
        
        # Step 4: Process all prompts
        results = await pipeline.process_all_prompts(prompts)
        
        # Step 5: Print summary
        pipeline.print_summary(results)
        
        # Step 6: Save results
        if pipeline.save_results(results, filepath=output_file):
            logger.info(f"✅ Pipeline completed successfully")
        else:
            logger.warning("⚠️  Pipeline completed with save errors")
    
    except DomainNotFoundError as e:
        logger.error(f"Domain error: {e}")
    except KeyboardInterrupt:
        logger.info("Process interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error in main: {e}", exc_info=True)


if __name__ == "__main__":
    # Run with default domain
    asyncio.run(main())
    
    # Or specify different domain and output:
    # asyncio.run(main(domain="domain_bfsi", output_file="bfsi_responses.csv"))