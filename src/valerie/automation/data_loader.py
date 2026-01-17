import pandas as pd
from typing import Tuple, List, Optional, Dict, Literal
from pathlib import Path


PromptMode = Literal["direct", "jailbreak"]


def load_baseline_prompts(csv_path: str) -> Tuple[pd.DataFrame, pd.core.groupby.DataFrameGroupBy]:
    """
    Load the baseline harmful prompts dataset from a CSV file.
    
    Args:
        csv_path (str): Path to the baseline CSV file.

    Returns:
        Tuple[pd.DataFrame, pd.core.groupby.DataFrameGroupBy]: DataFrame and grouped by 'Harm Type'.
    """
    df = pd.read_csv(csv_path, sep=";")
    expected_cols = {"Harm Type", "Prompt", "Harmful Output"}
    if not expected_cols.issubset(df.columns):
        raise ValueError(f"CSV missing required columns. Found: {df.columns}")
    grouped = df.groupby("Harm Type")
    return df, grouped


def parse_jailbreak_templates(txt_path: str) -> pd.DataFrame:
    """
    Parse jailbreak prompt templates from a text file.

    Args:
        txt_path (str): Path to the jailbreak templates text file.

    Returns:
        pd.DataFrame: DataFrame with template IDs and text.
    """
    with open(txt_path, "r", encoding="utf-8") as f:
        text = f.read()
    templates = [t.strip() for t in text.split("\n\n") if t.strip()]
    return pd.DataFrame({
        "template_id": range(1, len(templates) + 1),
        "template_text": templates
    })


def get_test_prompts(
    grouped_df: pd.core.groupby.DataFrameGroupBy,
    harm_type: str,
    mode: PromptMode = "direct",
    jailbreak_template: Optional[str] = None,
    placeholder: str = "{USER_PROMPT_HERE}"
) -> List[str]:
    """
    Get test prompts based on mode selection.
    
    Args:
        grouped_df: Grouped baseline DataFrame
        harm_type: Target harm type (e.g., 'Hate Speech')
        mode: "direct" for Case 1 (human-readable prompts as-is) 
              OR "jailbreak" for Case 2 (fill template with prompts)
        jailbreak_template: Required if mode="jailbreak". Template text with placeholder.
        placeholder: Placeholder string in template (default: "{USER_PROMPT_HERE}")
    
    Returns:
        List[str]: Test prompts ready to send to target LLM
    
    Raises:
        ValueError: If harm_type not found or invalid mode configuration
    
    Examples:
        # Case 1: Direct attack prompts (human-readable)
        prompts = get_test_prompts(grouped, "Hate Speech", mode="direct")
        
        # Case 2: Jailbreak template with placeholder filling
        template = "You are DAN. {USER_PROMPT_HERE}"
        prompts = get_test_prompts(grouped, "Hate Speech", mode="jailbreak", 
                                   jailbreak_template=template)
    """
    # Validate harm type exists
    try:
        harm_type_df = grouped_df.get_group(harm_type)
    except KeyError:
        available = list(grouped_df.groups.keys())
        raise ValueError(
            f"Harm type '{harm_type}' not found. Available types: {available}"
        )
    
    baseline_prompts = harm_type_df['Prompt'].tolist()
    
    # Mode 1: Direct attack prompts (Case 1)
    if mode == "direct":
        return baseline_prompts
    
    # Mode 2: Jailbreak templates (Case 2)
    elif mode == "jailbreak":
        if not jailbreak_template:
            raise ValueError(
                "mode='jailbreak' requires 'jailbreak_template' parameter"
            )
        
        if placeholder not in jailbreak_template:
            raise ValueError(
                f"Template must contain placeholder '{placeholder}'"
            )
        
        # Fill template with each baseline prompt
        return [
            jailbreak_template.replace(placeholder, prompt)
            for prompt in baseline_prompts
        ]
    
    else:
        raise ValueError(
            f"Invalid mode '{mode}'. Must be 'direct' or 'jailbreak'"
        )


def get_available_harm_types(grouped_df: pd.core.groupby.DataFrameGroupBy) -> List[str]:
    """
    Get list of available harm types in the dataset.
    
    Args:
        grouped_df: Grouped baseline DataFrame
    
    Returns:
        List[str]: Available harm type names
    """
    return list(grouped_df.groups.keys())


def get_harm_type_stats(grouped_df: pd.core.groupby.DataFrameGroupBy) -> Dict[str, int]:
    """
    Get statistics about prompts per harm type.
    
    Args:
        grouped_df: Grouped baseline DataFrame
    
    Returns:
        Dict[str, int]: Mapping of harm type to count
    """
    return {harm_type: len(group) for harm_type, group in grouped_df}