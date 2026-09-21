import os

files = [
    r'c:\Rnative\UpTrends\services\geminiService.ts',
    r'c:\Rnative\UpTrends\services\twinningService.ts'
]

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace strict gender equality
    content = content.replace("userProfile.gender === 'male'", "(userProfile?.gender || '').toLowerCase() === 'male'")
    content = content.replace("gender === 'male'", "(gender || '').toLowerCase() === 'male'")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print('Done fixing gender checks.')
