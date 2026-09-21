import os
import re

file_path = r'c:\Rnative\UpTrends\services\twinningService.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace personAnalysis.(gender || '').toLowerCase() with (personAnalysis.gender || '').toLowerCase()
content = re.sub(r'(\w+)\.\(gender \|\| \'\'\)', r'(\1.gender || "")', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed twinningService.ts syntax errors.")
