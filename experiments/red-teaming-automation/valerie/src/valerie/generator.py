"""
Generator Module - Simplified to work with new data_loader
"""
from typing import Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_aws.chat_models import ChatBedrock
import time
from botocore.exceptions import ClientError


def aws_llm_callback(
    user_prompt: str,
    model_id: str = "anthropic.claude-3-5-sonnet-20240620-v1:0",
    region_name: Optional[str] = "us-east-1",
    max_retries: int = 5,
    initial_delay: float = 2.0,
    max_delay: float = 60.0
) -> str:
    """
    Call AWS Bedrock LLM with exponential backoff retry logic.
    
    Args:
        user_prompt: The prompt to send to the LLM
        model_id: AWS Bedrock model identifier
        region_name: AWS region
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay between retries (seconds)
        max_delay: Maximum delay between retries (seconds)
    
    Returns:
        str: The LLM's response content
    
    Raises:
        Exception: If all retries fail
    """
    llm = ChatBedrock(model_id=model_id, region_name=region_name)
    prompt_template = ChatPromptTemplate.from_messages([("human", "{input}")])
    chain = prompt_template | llm
    
    delay = initial_delay
    
    for attempt in range(max_retries):
        try:
            response = chain.invoke({"input": user_prompt})
            
            # Add a small delay between successful requests to avoid rate limits
            time.sleep(1.0)
            
            return response.content
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            
            # Handle throttling specifically
            if error_code == 'ThrottlingException':
                if attempt < max_retries - 1:
                    # Exponential backoff with jitter
                    jitter = delay * 0.1  # 10% jitter
                    wait_time = min(delay + (jitter * (attempt + 1)), max_delay)
                    print(f"    ⏳ Rate limited. Waiting {wait_time:.1f}s before retry {attempt + 2}/{max_retries}...")
                    time.sleep(wait_time)
                    delay *= 2  # Exponential backoff
                else:
                    raise Exception(f"Rate limit exceeded after {max_retries} attempts. Please wait a few minutes and try again.")
            else:
                # For other errors, fail immediately
                raise Exception(f"AWS Bedrock error: {str(e)}")
                
        except Exception as e:
            # For non-AWS errors, retry with shorter delay
            if attempt < max_retries - 1:
                print(f"    ⚠ Error (attempt {attempt + 1}): {str(e)[:100]}. Retrying...")
                time.sleep(delay)
            else:
                raise Exception(f"Failed after {max_retries} attempts: {str(e)}")
    
    raise Exception(f"LLM call failed after {max_retries} attempts")