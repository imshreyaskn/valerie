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

import pandas as pd

# Placeholder string used in jailbreak templates, to be replaced with baseline prompts
PLACEHOLDER = "{USER_PROMPT_HERE}"


def load_baseline_prompts(csv_path: str) -> pd.DataFrame:
    """
    Load the baseline harmful prompts dataset from a CSV file.
    
    Args:
        csv_path (str): Path to the baseline CSV file.

    Returns:
        df (pd.DataFrame): DataFrame containing all baseline prompts.
        grouped (pd.core.groupby.DataFrameGroupBy): DataFrame grouped by 'Harm Type'.
    """
    
    # Read CSV using ';' as delimiter (since baseline CSV may not be comma-separated)
    df = pd.read_csv(csv_path, sep=";")
    
    # Validate that all required columns are present
    expected_cols = {"Harm Type", "Prompt", "Harmful Output"}
    if not expected_cols.issubset(df.columns):
        raise ValueError(f"CSV missing required columns. Found: {df.columns}")
    
    # Group baseline prompts by harm category for easier querying later
    grouped = df.groupby("Harm Type")
    return df, grouped


def parse_jailbreak_templates(txt_path: str) -> pd.DataFrame:
    """
    Parse jailbreak prompt templates from a text file.

    Args:
        txt_path (str): Path to the jailbreak templates text file.

    Returns:
        df (pd.DataFrame): DataFrame containing template IDs and their text.
    """
    
    # Read the entire jailbreak text file into memory
    with open(txt_path, "r", encoding="utf-8") as f:
        text = f.read()
    
    # Each template is separated by a double newline
    templates = [t.strip() for t in text.split("\n\n") if t.strip()]
    
    # Convert templates into a DataFrame with IDs
    df = pd.DataFrame({
        "Template_ID": range(1, len(templates) + 1),
        "Template_Text": templates
    })
    return df


def generate_jailbreak_test_cases(grouped_df, template: str, harm_type: str) -> list[str]:
    """
    Generate jailbreak test cases for a specific harm type using a given template.
    
    Args:
        grouped_df (pd.core.groupby.DataFrameGroupBy): Grouped baseline DataFrame.
        template (str): Jailbreak template containing the placeholder.
        harm_type (str): Target harm type (e.g., 'Hate Speech').
    
    Returns:
        list[str]: List of generated jailbreak prompts.
    """
    
    # Extract only the prompts belonging to the chosen harm type
    harm_type_df = grouped.get_group(harm_type)
    baseline_prompts = harm_type_df['Prompt']
    
    jailbreak_prompts_list = []

    # Replace placeholder with each baseline prompt to form a jailbreak version
    for prompt in baseline_prompts:
        formated_prompt = template.replace(PLACEHOLDER, prompt)
        jailbreak_prompts_list.append(formated_prompt)
    
    return jailbreak_prompts_list


if __name__ == "__main__":
    # File paths for baseline prompts and jailbreak templates
    baseline_csv = "./resources/baseline_prompts.csv" 
    jailbreak_txt = "./resources/jailbreak_prompt.txt"
    
    # Load baseline prompts and jailbreak templates
    baseline_df, grouped = load_baseline_prompts(baseline_csv)
    jailbreak_df = parse_jailbreak_templates(jailbreak_txt)

    # Select the first jailbreak template
    jailbreak_template_text = jailbreak_df.iloc[0]['Template_Text']
    
    # Define harm type to generate test cases for
    target_harm = 'Hate Speech'
    
    # Generate jailbreak test cases
    final_test_cases = generate_jailbreak_test_cases(
        grouped, 
        jailbreak_template_text, 
        target_harm
    )
    
    # Print sample outputs
    print(f"\n=== Generated Test Cases for '{target_harm}' (Showing First 2) ===")
    for i, test_case in enumerate(final_test_cases[:2]):
        print(f"\n--- Test Case {i+1} ---")
        print(test_case[:5000] + "...")  # truncate long output for readability
        
    print(f"\nTotal generated for '{target_harm}': {len(final_test_cases)}")
