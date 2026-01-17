"""
Selene Agent module for processing queries with structured outputs.
Handles LLM initialization, prompt formatting, and async query processing.
"""
import logging
import asyncio
from typing import Optional
from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import (
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
    ChatPromptTemplate
)
from .models import RootSchema
from . import prompts
from valerie.core.settings import settings

logger = logging.getLogger(__name__)


class AgentError(Exception):
    """Base exception for agent-related errors."""
    pass


class QueryProcessingError(AgentError):
    """Raised when query processing fails."""
    pass


class SeleneAgent:
    """
    Agent for processing queries using Mistral AI with structured outputs.
    
    Attributes:
        llm: Initialized ChatMistralAI instance
        chat_prompt: Formatted chat prompt template
        structured_llm: LLM configured for structured output
    """
    
    def __init__(
        self, 
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_retries: Optional[int] = None,
        timeout: Optional[int] = None
    ):
        """
        Initialize the Selene Agent.
        
        Args:
            api_key: Mistral API key (uses Config default if None)
            model: Model identifier (uses Config default if None)
            temperature: Sampling temperature (uses Config default if None)
            top_p: Top-p sampling parameter (uses Config default if None)
            max_retries: Maximum retry attempts (uses Config default if None)
            timeout: Request timeout in seconds (uses Config default if None)
        """
        # Use provided values or fall back to settings
        self.api_key = api_key or settings.mistral.api_key
        self.model = model or settings.mistral.default_model
        self.temperature = temperature if temperature is not None else settings.mistral.temperature
        self.top_p = top_p if top_p is not None else settings.mistral.top_p
        self.max_retries = max_retries if max_retries is not None else settings.mistral.max_retries
        self.timeout = timeout if timeout is not None else settings.mistral.timeout
        
        # Initialize components
        self.llm = self._initialize_llm()
        self.chat_prompt = self._create_prompt_template()
        self.structured_llm = self.llm.with_structured_output(RootSchema)
        
        logger.info(f"Initialized SeleneAgent with model: {self.model}")
    
    def _initialize_llm(self) -> ChatMistralAI:
        """
        Initialize the ChatMistralAI instance with configuration.
        
        Returns:
            Configured ChatMistralAI instance
        """
        return ChatMistralAI(
            mistral_api_key=self.api_key,
            model=self.model,
            temperature=self.temperature,
            top_p=self.top_p,
            max_retries=self.max_retries,
            timeout=self.timeout
        )
    
    def _create_prompt_template(self) -> ChatPromptTemplate:
        """
        Create the chat prompt template from system and human prompts.
        
        Returns:
            Configured ChatPromptTemplate
        """
        system_prompt = SystemMessagePromptTemplate.from_template(
            prompts.SYSTEM_PROMPT
        )
        human_prompt = HumanMessagePromptTemplate.from_template(
            prompts.HUMAN_PROMPT
        )
        return ChatPromptTemplate.from_messages([system_prompt, human_prompt])
    
    async def process_query(
        self, 
        user_query: str,
        timeout_override: Optional[int] = None
    ) -> Optional[RootSchema]:
        """
        Process a user query asynchronously and return structured response.
        
        Args:
            user_query: The user's input query string
            timeout_override: Optional timeout override in seconds
            
        Returns:
            Structured RootSchema response or None if processing fails
            
        Raises:
            QueryProcessingError: If query processing fails critically
        """
        try:
            # Validate input
            if not user_query or not user_query.strip():
                logger.error("Empty or whitespace-only query provided")
                return None
            
            # Format messages
            cleaned_query = user_query.strip()
            messages = self.chat_prompt.format_messages(user_query=cleaned_query)
            
            logger.info(f"Processing query (length: {len(cleaned_query)} chars)")
            
            # Use override timeout or extended default
            timeout = timeout_override or settings.mistral.extended_timeout
            
            # Invoke model with timeout
            response = await asyncio.wait_for(
                self.structured_llm.ainvoke(messages),
                timeout=timeout
            )
            
            logger.info("Successfully processed query")
            return response
            
        except asyncio.TimeoutError:
            logger.error(f"Timeout after {timeout} seconds waiting for model response")
            return None
            
        except Exception as e:
            logger.error(f"Error processing query: {type(e).__name__}: {e}")
            return None
    
    def print_response_summary(self, response: Optional[RootSchema]) -> None:
        """
        Print a formatted summary of the response.
        
        Args:
            response: The structured response to summarize
        """
        if not response:
            print("❌ No response received")
            return
        
        print("\n" + "=" * 70)
        print("RESPONSE SUMMARY".center(70))
        print("=" * 70)
        
        try:
            # Extract godmode response
            if response.response.godmode_response:
                print("\n🔓 GODMODE RESPONSE:")
                print("-" * 70)
                godmode_text = response.response.godmode_response.prompt
                print(godmode_text)
            
            # Extract ethical disclaimer
            if response.response.ethical_disclaimer:
                print("\n⚖️  ETHICAL DISCLAIMER:")
                print("-" * 70)
                disclaimer_text = response.response.ethical_disclaimer.message
                print(disclaimer_text)
            
            print("\n" + "=" * 70)
            
        except AttributeError as e:
            logger.error(f"Error accessing response attributes: {e}")
            print("⚠️  Error: Malformed response structure")


async def main():
    """Example usage of SeleneAgent."""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Initialize agent
    agent = SeleneAgent()
    
    # Example query
    user_query = "Give me a safe explanation of how vaccines work."
    
    # Process query
    response = await agent.process_query(user_query)
    
    # Print summary
    agent.print_response_summary(response)


if __name__ == "__main__":
    asyncio.run(main())