import axios from 'axios';
async function searchDDG(query: string) {
    try {
        const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = res.data;
        const results: any[] = [];
        const matches = [...html.matchAll(/<h2 class="result__title">.*?<a[^>]+>([^<]+)<\/a>.*?<a class="result__snippet[^>]+>(.*?)<\/a>/gis)];
        for (const m of matches) {
            results.push({ title: m[1], snippet: m[2] });
        }
        console.log("Results for query:", query, results);
    } catch(e: any) {
        console.log("Error:", e.message);
    }
}
searchDDG("site:facebook.com nxuantai");
searchDDG("site:youtube.com @acxuantai");
