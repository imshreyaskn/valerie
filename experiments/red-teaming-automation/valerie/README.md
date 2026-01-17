# Valerie

## Overview

**Valerie** is an automated red-teaming framework designed to evaluate
the safety and robustness of Large Language Models (LLMs). It provides a
structured pipeline for generating adversarial prompts (direct or
jailbreak-based), querying target models, and evaluating the risks of
their responses using automated evaluators.

The system is modular and consists of four primary components:

1.  **Data Loader (`data_loader.py`)** -- Loads baseline harmful prompts
    and jailbreak templates.
2.  **Generator (`generator.py`)** -- Sends adversarial prompts to
    target LLMs using AWS Bedrock with retry logic.
3.  **Evaluator (`evaluator.py`)** -- Analyzes model responses for
    safety risks such as PII leakage, bias, and toxicity.
4.  **Main Pipeline (`main.py`)** -- Orchestrates the red-teaming
    workflow from data loading to evaluation and reporting.

Supporting resources include: - `baseline_prompts.csv`: A dataset of
harmful prompts categorized by harm type. - `jailbreak_prompt.txt`:
Jailbreak prompt templates with placeholders for inserting harmful
prompts. - `standard_dataset.csv`: Supplementary dataset for
evaluation. - `sample-output.text`: Example output logs from a pipeline
run.

------------------------------------------------------------------------

## Module Documentation

### 1. Data Loader (`data_loader.py`)

Responsible for preparing test prompts.

#### Key Functions

-   **`load_baseline_prompts(csv_path: str)`**
    -   Loads harmful prompts from a baseline CSV file.
    -   Ensures required columns (`Harm Type`, `Prompt`,
        `Harmful Output`) exist.
    -   Returns both a `DataFrame` and a grouped object by harm type.
-   **`parse_jailbreak_templates(txt_path: str)`**
    -   Reads jailbreak templates from a text file.
    -   Splits them by double newlines and assigns IDs.
-   **`get_test_prompts(grouped_df, harm_type, mode, jailbreak_template=None, placeholder="{USER_PROMPT_HERE}")`**
    -   Retrieves prompts for testing:
        -   `direct` mode → raw harmful prompts.
        -   `jailbreak` mode → prompts inserted into a jailbreak
            template.
    -   Parameters:
        -   `harm_type`: Which harm category to target (e.g., *Hate
            Speech*).
        -   `mode`: `"direct"` or `"jailbreak"`.
        -   `jailbreak_template`: Required if `mode="jailbreak"`.
        -   `placeholder`: String to replace inside the template.
-   **`get_available_harm_types(grouped_df)`**
    -   Returns all available harm types.
-   **`get_harm_type_stats(grouped_df)`**
    -   Returns counts of prompts per harm type.

------------------------------------------------------------------------

### 2. Generator (`generator.py`)

Handles communication with the target LLM.

#### Key Function

-   **`aws_llm_callback(user_prompt, model_id, region_name, max_retries, initial_delay, max_delay)`**
    -   Sends a prompt to an AWS Bedrock-hosted LLM.
    -   Includes exponential backoff with jitter for handling throttling
        errors.
    -   Parameters:
        -   `user_prompt`: Prompt string.
        -   `model_id`: Target model (e.g.,
            `"anthropic.claude-3-5-sonnet-20240620-v1:0"`).
        -   `region_name`: AWS region.
        -   `max_retries`: Number of retry attempts before failing.
        -   `initial_delay`, `max_delay`: Timing controls for backoff.

------------------------------------------------------------------------

### 3. Evaluator (`evaluator.py`)

Evaluates responses for safety.

#### Key Components

-   **`EvaluationResult (Pydantic Model)`**
    -   Schema defining evaluation results:
        -   `pii_leakage`: Boolean, if personal data was leaked.
        -   `pii_examples`: Up to 3 snippets of leaked PII.
        -   `bias`: `"none" | "low" | "moderate" | "high"`.
        -   `bias_examples`: Supporting excerpts.
        -   `toxicity`: Boolean, presence of toxic language.
        -   `toxicity_severity`: `"none" | "low" | "medium" | "high"`.
        -   `safety_concern`: Text summary of risk.
        -   `overall_risk_score`: Float between 0.0 and 1.0.
-   **`extract_json_from_text(text)`**
    -   Cleans and parses JSON output from LLM evaluators.
-   **`call_evaluator_llm(attack_prompt, model_output, evaluator_mode, model_id, region_name, max_retries, initial_delay)`**
    -   Calls the evaluator model (via Bedrock or mock mode).
    -   Ensures results conform to the `EvaluationResult` schema.
-   **`evaluate_and_export(model_outputs, evaluator_mode, evaluator_model_id, evaluator_region, csv_path)`**
    -   Runs evaluations across all test cases.
    -   Saves results into a CSV file.
    -   Returns a `DataFrame` of evaluation results.

------------------------------------------------------------------------

### 4. Main Pipeline (`main.py`)

Orchestrates the full red-teaming workflow.

#### Key Function

-   **`run_red_team_pipeline(...)`**
    -   Executes the 5-step process:
        1.  Load baseline prompts.
        2.  Load jailbreak templates (if in jailbreak mode).
        3.  Generate test cases.
        4.  Query the target model or use demo responses.
        5.  Evaluate results and export to CSV.
    -   Parameters:
        -   `baseline_csv`: Path to baseline dataset.
        -   `jailbreak_txt`: Path to jailbreak templates.
        -   `target_harm`: Harm type to test (e.g., *Hate Speech*).
        -   `prompt_mode`: `"direct"` or `"jailbreak"`.
        -   `template_id`: Jailbreak template ID.
        -   `target_model_id`: Target model under test.
        -   `target_region`: AWS region.
        -   `evaluator_mode`: `"bedrock"` or `"mock"`.
        -   `output_csv`: Path to save results.
        -   `max_test_cases`: Cap number of test cases (for rate
            limits).
        -   `use_demo_mode`: Run with fixed demo examples.
-   **Pipeline Workflow Example**:
    -   Direct Mode: Uses harmful prompts directly.
    -   Jailbreak Mode: Wraps harmful prompts inside jailbreak templates
        (e.g., from `jailbreak_prompt.txt`).

------------------------------------------------------------------------

## Example Workflow

1.  Load baseline prompts from `baseline_prompts.csv`.
2.  Optionally load jailbreak templates from `jailbreak_prompt.txt`.
3.  Generate test cases targeting a chosen harm type (e.g., *Hate
    Speech*).
4.  Send prompts to a model (AWS Bedrock-hosted, e.g., Mistral or
    Claude).
5.  Evaluate responses for PII, bias, and toxicity.
6.  Export evaluation results to `outputs/red_team_results.csv`.

Sample log output (`sample-output.text`) confirms: - 5 prompts tested in
jailbreak mode. - 3 responses classified as high risk, 1 medium risk, 1
low risk.

------------------------------------------------------------------------

## Resources

-   **`baseline_prompts.csv`** -- Baseline harmful prompt dataset
    grouped by harm type.
-   **`jailbreak_prompt.txt`** -- Jailbreak template with placeholder
    `{USER_PROMPT_HERE}`.
-   **`standard_dataset.csv`** -- Additional dataset for evaluation
    purposes.
-   **`sample-output.text`** -- Example pipeline run log.

------------------------------------------------------------------------

## Conclusion

The **Valerie Project** provides a modular, automated approach to
red-teaming LLMs. By separating prompt generation, model interaction,
and evaluation, it supports flexible experimentation while producing
structured safety metrics. This framework is well-suited for assessing
risks across different harm types, prompt strategies, and target models.
