import axios from 'axios';
async function run() {
    const ytId = "@acxuantai";
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
    };
    try {
        const cleanYtId = ytId.trim().startsWith('@') ? ytId.trim() : `@${ytId.trim()}`;
        const ytRes = await axios.get(`https://www.youtube.com/${cleanYtId.replace(/\s+/g, '')}`, { headers, timeout: 6000 });
        const html = ytRes.data || "";
        const match = html.match(/"subscriberCountText":\s*\{\s*"simpleText":\s*"([^"]+)"/i) ||
                      html.match(/"subscriberCountText".*?"label"\s*:\s*"([^"]+)"/i) ||
                      html.match(/"subscriberCountText":\s*\{\s*"runs":\s*\[\s*\{\s*"text":\s*"([^"]+)"/i) ||
                      html.match(/<meta itemprop="interactionCount" content="([0-9]+)">/i);
        if (match) {
            console.log("YT Subs Match:", match[1]);
        }
    } catch (e) {
        console.log("Error", e);
    }
}
run();
