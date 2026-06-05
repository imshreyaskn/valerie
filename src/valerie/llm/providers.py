SUPPORTED_PROVIDERS = {
    "openai":    ["gpt-4o", "gpt-4o-mini", "o4-mini", "o3"],
    "anthropic": ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307", "claude-opus-4-5"],
    "groq":      ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "deepseek-r1-distill-llama-70b"],
    "gemini":    ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-3.5-flash"],
    "mistral":   ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
    "bedrock":   ["anthropic.claude-3-5-sonnet-20241022-v2:0", "amazon.nova-pro-v1:0"],
    "custom":    [],   # user provides model name + api_base
}
