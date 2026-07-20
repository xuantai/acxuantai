import axios from 'axios';
(async () => {
    try {
        const url = "https://facebook.com/nxuantai";
        const res = await axios.get(url, {
            headers: {
                "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
                "Accept-Language": "en-US,en;q=0.9"
            }
        });
        const html = res.data;
        const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
        console.log("Title matched:", ogTitleMatch ? ogTitleMatch[1] : "None");
    } catch(e: any) {
        console.log("Error:", e.message);
    }
})();
