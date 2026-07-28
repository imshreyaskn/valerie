import os

files_to_combine = [
    "src/valerie/agents/prompts.py",
    "src/valerie/agents/selene.py",
    "src/valerie/agents/models.py",
    "src/valerie/graph/nodes.py",
    "src/valerie/attacks/techniques.py",
    "src/valerie/learning/consumers.py"
]

output_filename = "selene_prompt_architecture_full.txt"

with open(output_filename, "w", encoding="utf-8") as outfile:
    for file_path in files_to_combine:
        outfile.write(f"\n{'=' * 80}\n")
        outfile.write(f"FILE: {file_path}\n")
        outfile.write(f"{'=' * 80}\n\n")
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as infile:
                outfile.write(infile.read())
        else:
            outfile.write(f"# File not found: {file_path}\n")
        outfile.write("\n\n")

print(f"Successfully combined {len(files_to_combine)} files into '{output_filename}' ({os.path.getsize(output_filename)} bytes).")
