const fs = require('fs');
const path = require('path');

const files = [
  'services/geminiService.ts',
  'services/digitalWardrobeService.ts',
  'services/wardrobeService.ts',
  'services/styleCheckService.ts',
  'services/alterShopService.ts',
  'config/performance.ts',
];

const replacements = [
  ["'gemini-3.5-flash'", "'gemini-3.8-flash'"],
  ["'gemini-3.7-flash'", "'gemini-3.8-flash'"],
  ["'gemini-3.1-flash-lite'", "'gemini-3.7-flash'"],
];

for (const file of files) {
  const fullPath = path.join(__dirname, '..', file);
  if (!fs.existsSync(fullPath)) continue;
  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('Updated:', file);
  }
}
console.log('Done.');
