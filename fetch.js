import http from 'https';

const check = (url) => {
    http.get(url, (res) => {
        console.log(url, res.statusCode);
        res.resume();
    });
}
check('https://www.pikachucodien.net/images/pieces2.png');
check('https://www.pikachucodien.net/images/pieces10.png');
check('https://www.pikachucodien.net/images/pieces36.png');

setTimeout(() => process.exit(0), 2000);
