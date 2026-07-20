import axios from 'axios';
async function run() {
    const fbId = "nxuantai";
    const ttId = "@acxuantai";
    const ytId = "@acxuantai";
    const headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
    };

    console.log("=== YOUTUBE ===");
    try {
        const cleanYtId = ytId.trim().startsWith('@') ? ytId.trim() : `@${ytId.trim()}`;
        const ytRes = await axios.get(`https://www.youtube.com/${cleanYtId.replace(/\s+/g, '')}`, { headers, timeout: 6000 });
        const html = ytRes.data || "";
        const match = html.match(/"subscriberCountText":\s*\{\s*"simpleText":\s*"([^"]+)"/i) ||
                      html.match(/"subscriberCountText".*?"label"\s*:\s*"([^"]+)"/i) ||
                      html.match(/"subscriberCountText":\s*\{\s*"runs":\s*\[\s*\{\s*"text":\s*"([^"]+)"/i) ||
                      html.match(/<meta itemprop="interactionCount" content="([0-9]+)">/i);
        if (match) {
            console.log("Found match text:", match[1]);
        }
        const nameMatch = html.match(/<meta property="og:title" content="([^"]+)">/i) ||
                          html.match(/<title>([^<]+)<\/title>/i);
        if (nameMatch) {
            console.log("Found name:", nameMatch[1].replace(" - YouTube", "").trim());
        }
    } catch (e: any) {
        console.error("YT Error:", e.message);
    }

    console.log("=== FACEBOOK ===");
    try {
        const cleanFbId = fbId.replace(/https:\/\/(www\.)?facebook\.com\//i, '').replace(/^\//, '').replace(/\s+/g, '');
        const fbRes = await axios.get(`https://www.facebook.com/${cleanFbId}`, { 
            headers: {
                "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
                "Accept-Language": "en-US,en;q=0.9"
            }, 
            timeout: 8000 
        });
        const html = fbRes.data || "";
        const ogDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) || html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
        if (ogDescMatch) {
            console.log("FB Desc:", ogDescMatch[1]);
        } else {
            console.log("FB Desc NOT FOUND. HTML length:", html.length);
        }
        const ogTitleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (ogTitleMatch) {
            console.log("FB Title:", ogTitleMatch[1]);
        }
    } catch(e: any) {
        console.error("FB error:", e.message);
    }
}
run();
