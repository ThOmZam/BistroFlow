const fs = require('fs');
const code = fs.readFileSync('src/views/ClientView.tsx', 'utf8');

let braces = 0;
let inString = false;
let stringChar = '';

const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let lineBraces = 0;
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (inString) {
      if (char === '\\') { j++; continue; }
      if (char === stringChar) { inString = false; }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }
    if (char === '{') { braces++; lineBraces++; }
    if (char === '}') { braces--; lineBraces--; }
  }
  if (i > 1000 && i < 1250) {
    console.log((i+1) + ': ' + braces + ' (' + lineBraces + ') ' + line.trim().slice(0, 50));
  }
}
console.log('Final brace depth:', braces);
