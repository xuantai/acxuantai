import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');
code = code.replace(/text-stone-550/g, 'text-stone-500');
code = code.replace(/bg-red-650/g, 'bg-red-600');
code = code.replace(/text-red-650/g, 'text-red-600');
code = code.replace(/rose-650/g, 'rose-600');
fs.writeFileSync('src/App.tsx', code);
console.log('done colors');
