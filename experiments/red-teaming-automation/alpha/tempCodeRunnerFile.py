import pandas as pd


def load_baseline_prompts(csv_path: str) -> pd.DataFrame:

    df = pd.read_csv(csv_path,sep=";")
    
    expected_cols = {"Harm Type", "Prompt", "Harmful Output"}
    if not expected_cols.issubset(df.columns):
        raise ValueError(f"CSV missing required columns. Found: {df.columns}")
    
    grouped = df.groupby("Harm Type")
    return df, grouped

def parse_jailbreak_templates(txt_path: str) -> pd.DataFrame:

    with open(txt_path, "r", encoding="utf-8") as f:
        text = f.read()
    

    templates = [t.strip() for t in text.split("\n\n") if t.strip()]
    
    df = pd.DataFrame({
        "Template_ID": range(1, len(templates) + 1),
        "Template_Text": templates
    })
    return df

if __name__ == "__main__":
    baseline_csv = "./Resources/baseline_prompts.csv" 
    jailbreak_txt = "./Resources/jailbreak_prompt.txt"
    
    
    baseline_df, grouped = load_baseline_prompts(baseline_csv)
    jailbreak_df = parse_jailbreak_templates(jailbreak_txt)
    
    
    print("=== Baseline Prompts ===")
    print(baseline_df.head())
    print("\nGrouped by Harm Type:")
    for harm_type, group in grouped:
        print(f"{harm_type}: {len(group)} prompts")
    
    print("\n=== Jailbreak Templates ===")
    print(jailbreak_df.head())