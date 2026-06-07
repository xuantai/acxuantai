import https from 'https';
import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'public', 'img', 'pokemons');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

for (let i = 1; i <= 36; i++) {
    const file = fs.createWriteStream(path.join(dir, `pieces${i}.png`));
    https.get(`https://www.pikachucodien.net/images/pieces${i}.png`, function(response) {
        response.pipe(file);
    });
}
console.log('Downloading 36 images...');
