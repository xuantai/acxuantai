import express from "express";
import { createServer } from "vite";
import fs from "fs";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

const RECORDS_DIR = path.join(process.cwd(), "records");
if (!fs.existsSync(RECORDS_DIR)) {
    fs.mkdirSync(RECORDS_DIR, { recursive: true });
}

// API for records
app.get("/api/records/:game", (req, res) => {
    const { game } = req.params;
    const filePath = path.join(RECORDS_DIR, `${game}.json`);
    
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, "utf-8");
            return res.json(JSON.parse(data));
        } catch (e) {
            return res.status(500).json({ error: "Failed to read records" });
        }
    }
    res.json([]);
});

app.post("/api/records/:game", (req, res) => {
    const { game } = req.params;
    const { score, name, lowerIsBetter } = req.body;
    
    if (typeof score !== 'number' || !name) {
        return res.status(400).json({ error: "Invalid data" });
    }

    const filePath = path.join(RECORDS_DIR, `${game}.json`);
    let records: any[] = [];
    
    if (fs.existsSync(filePath)) {
        try {
            records = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        } catch (e) {
            records = [];
        }
    }

    // Add new record
    const newEntry = { 
        score, 
        name, 
        date: new Date().toISOString(),
        id: Math.random().toString(36).substr(2, 9)
    };
    
    records.push(newEntry);

    // Sort: lower is better for Minesweeper (time), higher is better for others
    if (lowerIsBetter) {
        records.sort((a, b) => a.score - b.score);
    } else {
        records.sort((a, b) => b.score - a.score);
    }

    // Keep top 10
    const top10 = records.slice(0, 10);
    
    fs.writeFileSync(filePath, JSON.stringify(top10, null, 2));
    try { fs.chmodSync(filePath, 0o777); } catch(e) {}
    
    // Check if the current submit is in the top 10
    const isTop10 = top10.some(r => r.id === newEntry.id);
    
    return res.json({ success: true, isTop10, records: top10 });
});

const SOCIAL_STATS_FILE = path.join(RECORDS_DIR, "777.json");
let isUpdateInProgress = false;

// Initial data
const DEFAULT_STATS = {
  facebook: 85210,
  tiktok: 411200,
  youtube: 15820,
  lastUpdate: 0
};

// RapidAPI Fetch logic
async function getStatsFromRapidAPI(currentStats?: any) {
  const fbKey = process.env.RAPIDAPI_FB_KEY || process.env.RAPIDAPI_KEY || "c6c8460a53msh54cce4eba86a610p16911bjsn6ef018aaca1d";
  const ytKey = process.env.RAPIDAPI_YT_KEY || process.env.RAPIDAPI_KEY || "c6c8460a53msh54cce4eba86a610p16911bjsn6ef018aaca1d";
  
  const stats = currentStats ? { ...currentStats } : { ...DEFAULT_STATS };
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  try {
    console.log("Fetching fresh stats from RapidAPI...");

    // 1. YouTube Stats
    try {
      const ytResponse = await axios.get('https://youtube138.p.rapidapi.com/channel/details/', {
        params: { id: 'https://www.youtube.com/@ACXUANTAI', hl: 'en', gl: 'US' },
        headers: { 'X-RapidAPI-Key': ytKey, 'X-RapidAPI-Host': 'youtube138.p.rapidapi.com' }
      });
      
      const data = ytResponse.data;
      if (data && data.stats && data.stats.subscribers) {
        stats.youtube = data.stats.subscribers;
      } else if (data && data.subscriberCountText) {
        const text = data.subscriberCountText.simpleText || "";
        const match = text.match(/([0-9.,]+)/);
        if (match) {
          let val = parseFloat(match[1].replace(/,/g, ''));
          if (text.includes('K')) val *= 1000;
          if (text.includes('M')) val *= 1000000;
          stats.youtube = Math.floor(val);
        }
      }
      console.log(`YouTube Stats: ${stats.youtube}`);
    } catch (e: any) { 
      console.log("YouTube API info (handled gracefully):", e.message);
    }

    // 2. Facebook Stats
    try {
      console.log(`Using FB Key starting with: ${fbKey.substring(0, 5)}`);
      // Corrected profile name from index.html: nxuantai. 
      // If details fails, try another endpoint if the API provider changed them
      let fbResponse;
      try {
        fbResponse = await axios.get('https://facebook-scraper3.p.rapidapi.com/profile/details', {
          params: { profile_id: 'nxuantai' }, 
          headers: { 'X-RapidAPI-Key': fbKey, 'X-RapidAPI-Host': 'facebook-scraper3.p.rapidapi.com' },
          timeout: 8000
        });
      } catch (fbApiError: any) {
        console.log(`Facebook details API call failed with info: ${fbApiError.message}. Trying direct scraping fallback...`);
      }

      if (fbResponse && fbResponse.data) {
        const data = fbResponse.data;
        fs.appendFileSync(path.join(RECORDS_DIR, "debug_api.txt"), `\n\n[FB RESPONSE]: ${JSON.stringify(data).substring(0, 1000)}`);
        
        const followerVal = data.follower_count || 
                          (data.followers && data.followers.count) || 
                          (data.about && data.about.followers) ||
                          data.subscribers_count ||
                          data.follower_count_text;
        
        if (followerVal) {
          let val = typeof followerVal === 'string' ? parseInt(followerVal.replace(/[^0-9]/g, '')) : followerVal;
          if (val > 0) stats.facebook = val;
        } else {
          const raw = JSON.stringify(data);
          const fbMatch = raw.match(/"follower[s]?_count":\s*"?([0-9.,]+)"?/i) || 
                          raw.match(/"followers":\s*\{"count":\s*(\d+)\}/i) ||
                          raw.match(/([0-9.,]+)\s*followers/i);
          if (fbMatch) {
            stats.facebook = parseInt(fbMatch[1].replace(/[,.]/g, ''));
          }
        }
      } else {
        // Facebook scraping fallback
        console.log("Fetching Facebook public page for scraping followers...");
        const fbScrapeRes = await axios.get("https://www.facebook.com/nxuantai", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
          },
          timeout: 10000
        });
        const fbHtml = fbScrapeRes.data || "";
        fs.appendFileSync(path.join(RECORDS_DIR, "debug_api.txt"), `\n\n[FB SCRAPE LENGTH]: ${fbHtml.length}`);
        
        // Match numbers of followers
        const fbMatch = fbHtml.match(/([0-9.,]+)\s*followers/i) || 
                        fbHtml.match(/([0-9.,]+)\s*người theo dõi/i) ||
                        fbHtml.match(/"follower_count":\s*(\d+)/i) ||
                        fbHtml.match(/"followers"\s*:\s*\{\s*"count"\s*:\s*(\d+)/i) ||
                        fbHtml.match(/"subscriber_count":\s*(\d+)/i);
        
        if (fbMatch) {
          let textVal = fbMatch[1];
          let val = 0;
          if (textVal.toLowerCase().includes('k')) {
            val = parseFloat(textVal.toLowerCase().replace('k', '')) * 1000;
          } else if (textVal.toLowerCase().includes('m')) {
            val = parseFloat(textVal.toLowerCase().replace('m', '')) * 1000000;
          } else {
            val = parseInt(textVal.replace(/[^0-9]/g, ''));
          }
          if (val > 0) {
            stats.facebook = Math.floor(val);
            console.log(`Scraped Facebook Followers: ${stats.facebook}`);
          }
        }
      }
      console.log(`Facebook Stats: ${stats.facebook}`);
    } catch (e: any) { 
      fs.appendFileSync(path.join(RECORDS_DIR, "debug_api.txt"), `\n\n[FB SCRAPE ERROR]: ${e.message}`);
      console.log("Facebook retrieval info (handled gracefully):", e.message);
    }

    // 3. TikTok (Scraping)
    try {
      // Adding common params to look more like a browser
      const ttRes = await axios.get("https://www.tiktok.com/@acxuantai?is_from_webapp=1&is_copy_url=0", { 
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }, 
        timeout: 12000 
      });
      const ttHtml = ttRes.data;
      fs.appendFileSync(path.join(RECORDS_DIR, "debug_api.txt"), `\n\n[TT HTML LENGTH]: ${ttHtml.length} - SNIPPET: ${ttHtml.toString().substring(0, 300)}`);
      
      const hydrationMatch = ttHtml.match(/<script id="__UNIVERSAL_DATA_FOR_REA_T_HYDRATION__" [^>]*>([^<]+)<\/script>/);
      if (hydrationMatch) {
         try {
           const jsonData = JSON.parse(hydrationMatch[1]);
           // Path might vary, let's log keys if possible or try multiple paths
           const userDetail = jsonData?.__DEFAULT_SCOPE__?.["webapp.user-detail"];
           const statObj = userDetail?.userInfo?.stats;
           
           if (statObj && statObj.followerCount) {
             stats.tiktok = statObj.followerCount;
           } else {
              fs.appendFileSync(path.join(RECORDS_DIR, "debug_api.txt"), `\n\n[TT JSON KEYS]: ${Object.keys(jsonData?.__DEFAULT_SCOPE__ || {}).join(",")}`);
           }
         } catch (e: any) {
           fs.appendFileSync(path.join(RECORDS_DIR, "debug_api.txt"), `\n\n[TT JSON PARSE ERROR]: ${e.message}`);
         }
      }

      if (stats.tiktok === DEFAULT_STATS.tiktok || stats.tiktok === 0) {
        const ttMatch = ttHtml.match(/"followerCount":(\d+)/i) || 
                        ttHtml.match(/"count":(\d+),[^{]*"label":"followers"/i) ||
                        ttHtml.match(/(\d+)\s*Followers/i);
        if (ttMatch) {
          stats.tiktok = parseInt(ttMatch[1]);
        }
      }
      console.log(`TikTok Stats: ${stats.tiktok}`);
    } catch (e: any) {
      console.log("TikTok Scrape info (handled gracefully):", e.message);
    }

    stats.lastUpdate = Date.now();
    return stats;
  } catch (error) {
    return null;
  }
}

async function fetchSocialStats() {
  let stats = { ...DEFAULT_STATS };
  let fileExists = false;

  // Đọc dữ liệu hiện có từ file
  if (fs.existsSync(SOCIAL_STATS_FILE)) {
    try {
      const data = fs.readFileSync(SOCIAL_STATS_FILE, "utf-8");
      stats = JSON.parse(data);
      fileExists = true;
    } catch (e) {
      console.error("Lỗi đọc file 777.json:", e.message);
    }
  }

  const now = Date.now();
  const EIGHT_HOURS = 8 * 60 * 60 * 1000;

  // Nếu file chưa tồn tại hoặc dữ liệu là mặc định (lần đầu), ta Cần chờ cập nhật ngay
  const forceUpdate = !fileExists || stats.lastUpdate === 0;

  if (forceUpdate || (now - (stats.lastUpdate || 0) > EIGHT_HOURS)) {
    if (!isUpdateInProgress) {
      isUpdateInProgress = true;
      console.log(forceUpdate ? "Dữ liệu trống, đang lấy mới ngay lập tức..." : "Dữ liệu cũ (8h+), đang cập nhật ngầm...");
      
      const updatePromise = getStatsFromRapidAPI(stats).then(newStats => {
        if (newStats) {
          try {
            fs.writeFileSync(SOCIAL_STATS_FILE, JSON.stringify(newStats, null, 2));
            fs.chmodSync(SOCIAL_STATS_FILE, 0o777); 
            console.log("Ghi file 777.json thành công.");
            return newStats;
          } catch (e) {
            console.error("Lỗi ghi file 777.json:", e.message);
          }
        }
        return null;
      }).finally(() => {
        isUpdateInProgress = false;
      });

      // Nếu là lần đầu hoặc dữ liệu trống, CHỜ kết quả trả về luôn cho user thấy ngay
      if (forceUpdate) {
        const updated = await updatePromise;
        if (updated) stats = updated;
      }
    }
  }

  return stats;
}

app.get("/api/social-stats", async (req, res) => {
    const stats = await fetchSocialStats();
    res.json(stats);
});

// Trigger social stats check on every request
app.use((req, res, next) => {
    // Only check for page requests or main entry points to avoid over-calculating on assets
    if (req.path === "/" || req.path.startsWith("/api")) {
        fetchSocialStats().catch(() => {});
    }
    next();
});

async function startServer() {
    if (process.env.NODE_ENV !== "production") {
        const vite = await createServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static(path.join(process.cwd(), 'dist')));
        app.get('*', (req, res) => {
          res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
        });
    }
    
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
        // Trigger initial fetch on startup
        fetchSocialStats().catch(err => console.error("Initial fetch failed:", err));
    });
}

startServer();
