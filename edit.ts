import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');
code = code.replace(/overflow-x-hidden/g, '');
fs.writeFileSync('src/App.tsx', code);
console.log('done');
