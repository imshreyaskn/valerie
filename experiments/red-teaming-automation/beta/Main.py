"""
_author_ = "Shreyas"
_copyright_ = "Copyright 2007, The Valerie Project"
_credits_ = ["Shreyas"]
_license_ = "GPL"
_version_ = "0.1"
_maintainer_ = "Shreyas"
_email_ = "imshreyaskn@gmail.com"
_status_ = "Production"
"""


from langchain_core.prompts import ChatPromptTemplate
from langchain_aws.chat_models import ChatBedrock


def aws_llm_callback(user_prompt: str, model_id: str = "anthropic.claude-3-5-sonnet-20240620-v1:0") -> str:
    """
    Call AWS Bedrock LLM with a user prompt and return the response content.
    """

    # Initialize Bedrock LLM
    llm = ChatBedrock(model_id=model_id, region_name="us-east-1")

    # Define a simple chat template
    prompt_template = ChatPromptTemplate.from_messages([
        ("human", "{input}")
    ])

    # Create a chain
    chain = prompt_template | llm

    # Invoke with the user input
    response = chain.invoke({"input": user_prompt})

    return response.content
