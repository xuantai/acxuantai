import express from "express";
import { createServer } from "vite";
import fs from "fs";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import { initializeApp, getApps } from "firebase/app";
import { initializeFirestore, doc, getDoc, setDoc } from "firebase/firestore";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Read Firebase configurations from file at root
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (e: any) {
    console.error("Error reading firebase-applet-config.json:", e.message);
  }
}

// Initialize Firebase Client DB references
let firestoreDb: any = null;
try {
  if (firebaseConfig.projectId) {
    let firebaseApp;
    if (getApps().length === 0) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      firebaseApp = getApps()[0];
    }
    const dbId = firebaseConfig.firestoreDatabaseId || "ai-studio-c02b7e6b-3a86-4bca-8854-20a8c0a0fc52";
    // Using initializeFirestore with experimentalForceLongPolling: true guarantees maximum
    // connection stability in Node.js/Cloud Run environments, totally avoiding Grpc/stream failures.
    firestoreDb = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true
    }, dbId);
    console.log(`Firebase Client SDK initialized successfully using Database: ${dbId} with long-polling`);
  } else {
    console.warn("firebaseConfig.projectId is missing. Firebase Client SDK integration is disabled.");
  }
} catch (error: any) {
  console.error("Firebase Client SDK initialization skipped or failed gracefully:", error.message);
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

app.post("/api/remove-bg", async (req, res) => {
  try {
     const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'Chưa cấu hình REMOVE_BG_API_KEY trong biến môi trường hệ thống. Vui lòng thêm biến môi trường này và thử lại.' });
    }
    const { imageB64 } = req.body;
    if (!imageB64) {
      return res.status(400).json({ error: 'Missing image data' });
    }
    const base64Data = imageB64.replace(/^data:image\/\w+;base64,/, "");
    
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        image_file_b64: base64Data,
        size: 'auto',
        format: 'png'
      })
    });

    if (!response.ok) {
       const text = await response.text();
       throw new Error('remove.bg API error: ' + response.statusText + ' ' + text);
    }

    const data = await response.json();
    res.json({ result: `data:image/png;base64,${data.data.result_b64}` });

  } catch (err: any) {
    console.error('remove.bg error:', err);
    res.status(500).json({ error: err.message || 'Error communicating with remove.bg' });
  }
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

// SOCIAL STATS API WITH LIVE SCRAPING & ADMIN CONFIG TEMPORARY FALLBACK
let liveSocialStats = {
    facebook: null as number | null,
    facebookName: "" as string,
    tiktok: null as number | null,
    tiktokName: "" as string,
    youtube: null as number | null,
    youtubeName: "" as string,
    facebookId: "",
    tiktokId: "",
    youtubeId: "",
    lastChecked: 0
};
let isFetchRunning = false;

const decodeHtmlEntities = (text: string) => {
    return text.replace(/&#([0-9]{1,3});/gi, (match, numStr) => {
        return String.fromCharCode(parseInt(numStr, 10));
    }).replace(/&#x([0-9a-f]{1,4});/gi, (match, hexStr) => {
        return String.fromCharCode(parseInt(hexStr, 16));
    }).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
};

async function updateSocialStatsLive(fbId: string, ttId: string, ytId: string) {
    if (isFetchRunning) return;
    isFetchRunning = true;
    console.log(`Starting background social statistics scrape for: FB(${fbId}), TT(${ttId}), YT(${ytId})`);

    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
    };

    // 1. YouTube Scrape
    try {
        const cleanYtId = ytId.trim().startsWith('@') ? ytId.trim() : `@${ytId.trim()}`;
        const ytRes = await axios.get(`https://www.youtube.com/${cleanYtId.replace(/\s+/g, '')}`, { headers, timeout: 6000 });
        const html = ytRes.data || "";
        const match = html.match(/"subscriberCountText":\s*\{\s*"simpleText":\s*"([^"]+)"/i) ||
                      html.match(/"subscriberCountText".*?"label"\s*:\s*"([^"]+)"/i) ||
                      html.match(/"subscriberCountText":\s*\{\s*"runs":\s*\[\s*\{\s*"text":\s*"([^"]+)"/i) ||
                      html.match(/<meta itemprop="interactionCount" content="([0-9]+)">/i);
        if (match) {
            const textVal = match[1];
            let val = parseFloat(textVal.replace(/,/g, '.').replace(/[^0-9.]/g, ''));
            if (textVal.toLowerCase().includes('k') || textVal.toLowerCase().includes('ngàn') || textVal.toLowerCase().includes('thousand') || textVal.toLowerCase().includes('nhìn') || textVal.toLowerCase().includes('nghin')) val *= 1000;
            if (textVal.toLowerCase().includes('m') || textVal.toLowerCase().includes('tr') || textVal.toLowerCase().includes('triệu') || textVal.toLowerCase().includes('million')) val *= 1000000;
            if (textVal.includes('萬') || textVal.includes('万')) val *= 10000;
            if (val > 0) {
                liveSocialStats.youtube = Math.floor(val);
                console.log(`Successfully scraped YouTube live subscribers: ${liveSocialStats.youtube}`);
            }
        }
        const nameMatch = html.match(/<meta property="og:title" content="([^"]+)">/i) ||
                          html.match(/<title>([^<]+)<\/title>/i);
        if (nameMatch) {
            let ytName = nameMatch[1].replace(" - YouTube", "").trim();
            if (ytName) {
                liveSocialStats.youtubeName = ytName;
                console.log(`Successfully scraped YouTube live name: ${ytName}`);
            }
        }
    } catch (e: any) {
        console.warn(`YouTube Scrape failed (will use Admin CP fallback): ${e.message}`);
    }

    // 2. TikTok Scrape
    try {
        const cleanTtId = ttId.startsWith('@') ? ttId : `@${ttId}`;
        const ttRes = await axios.get(`https://www.tiktok.com/${cleanTtId}`, { headers, timeout: 6000 });
        const html = ttRes.data || "";
        
        let parsedFromHydration = false;
        const hydrationMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" [^>]*>([^<]+)<\/script>/);
        if (hydrationMatch) {
            try {
                const jsonData = JSON.parse(hydrationMatch[1]);
                const userDetail = jsonData?.__DEFAULT_SCOPE__?.["webapp.user-detail"];
                const statObj = userDetail?.userInfo?.stats;
                const userObj = userDetail?.userInfo?.user;
                if (statObj && typeof statObj.followerCount === "number" && statObj.followerCount > 0) {
                    liveSocialStats.tiktok = statObj.followerCount;
                    parsedFromHydration = true;
                    console.log(`Successfully parsed TikTok live followers from hydration: ${liveSocialStats.tiktok}`);
                }
                if (userObj && userObj.nickname) {
                    liveSocialStats.tiktokName = userObj.nickname;
                    console.log(`Successfully parsed TikTok nickname from hydration: ${liveSocialStats.tiktokName}`);
                }
            } catch (jsonErr) {}
        }
        
        if (!parsedFromHydration) {
            const ttMatch = html.match(/"followerCount":(\d+)/i) || 
                            html.match(/"count":(\d+),[^{]*"label":"followers"/i) ||
                            html.match(/(\d+)\s*Followers/i);
            if (ttMatch) {
                const val = parseInt(ttMatch[1]);
                if (val > 0) {
                    liveSocialStats.tiktok = val;
                    console.log(`Successfully scraped TikTok live followers: ${liveSocialStats.tiktok}`);
                }
            }
        }
        const nameMatch = html.match(/<meta property="og:title" content="([^"]+)">/i) ||
                          html.match(/<title>([^<]+)<\/title>/i);
        if (nameMatch) {
            let ttName = nameMatch[1].split('(@')[0].trim();
            if (ttName && !ttName.includes('TikTok') && !ttName.includes('Make Your Day')) {
                liveSocialStats.tiktokName = ttName;
                console.log(`Successfully scraped TikTok live name: ${ttName}`);
            }
        }
    } catch (e: any) {
        console.warn(`TikTok Scrape failed (will use Admin CP fallback): ${e.message}`);
    }

    // 3. Facebook Scrape
    try {
        const cleanFbId = fbId.replace(/https:\/\/(www\.)?facebook\.com\//i, '').replace(/^\//, '').replace(/\s+/g, '');
        // Using facebookexternalhit ensures Facebook returns open graph data and no login wall
        const fbRes = await axios.get(`https://www.facebook.com/${cleanFbId}`, { 
            headers: {
                "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
                "Accept-Language": "en-US,en;q=0.9"
            }, 
            timeout: 8000 
        });
        const html = fbRes.data || "";
        
        let val = 0;
        const ogDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) || html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
        if (ogDescMatch) {
            const ogDesc = ogDescMatch[1];
            const fbMatch = ogDesc.match(/([0-9.,KMB]+)\s+(followers|likes)/i) || ogDesc.match(/([0-9.,KMB]+)\s+người theo dõi/i);
            if (fbMatch) {
                const textVal = fbMatch[1].toUpperCase();
                if (textVal.includes('K')) {
                    val = parseFloat(textVal.replace('K', '').replace(',', '.')) * 1000;
                } else if (textVal.includes('M')) {
                    val = parseFloat(textVal.replace('M', '').replace(',', '.')) * 1000000;
                } else {
                    val = parseInt(textVal.replace(/[^0-9]/g, ''));
                }
                if (val > 0) {
                    liveSocialStats.facebook = val;
                    console.log(`Successfully scraped Facebook live followers: ${liveSocialStats.facebook}`);
                }
            }
        }
        
        const ogTitleMatch = html.match(/<title>([^<]+)<\/title>/i) || 
                             html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) || 
                             html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
        if (ogTitleMatch) {
            let fbName = decodeHtmlEntities(ogTitleMatch[1]).replace(" | Facebook", "").split(" - ")[0].trim();
            if (fbName && fbName !== "Facebook" && !fbName.includes("Log In")) {
                liveSocialStats.facebookName = fbName;
                console.log(`Successfully scraped Facebook live name: ${fbName}`);
            }
        }
    } catch (e: any) {
        console.warn(`Facebook Scrape failed (will use Admin CP fallback): ${e.message}`);
    }

    liveSocialStats.lastChecked = Date.now();
    isFetchRunning = false;
}

app.get("/api/social-stats", async (req, res) => {
    let configFb = 0;
    let configTt = 0;
    let configYt = 0;
    let configFbName = "";
    let configTtName = "";
    let configYtName = "";
    let fbId = "nxuantai";
    let ttId = "@acxuantai";
    let ytId = "@acxuantai";

    // Load from Firestore first, fallback to local config
    const ADMIN_CONFIG_FILE = path.join(RECORDS_DIR, "admin_config.json");
    let loadedFromFirestore = false;

    if (firestoreDb) {
        try {
            const docRef = doc(firestoreDb, "configs", "admin_config");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const config = docSnap.data();
                if (config && config.socials) {
                    if (config.socials.facebook !== undefined) fbId = config.socials.facebook;
                    if (config.socials.tiktok !== undefined) ttId = config.socials.tiktok;
                    if (config.socials.youtube !== undefined) ytId = config.socials.youtube;
                    if (config.socials.facebookFollowers !== undefined) configFb = Number(config.socials.facebookFollowers);
                    if (config.socials.tiktokFollowers !== undefined) configTt = Number(config.socials.tiktokFollowers);
                    if (config.socials.youtubeFollowers !== undefined) configYt = Number(config.socials.youtubeFollowers);
                    if (config.socials.facebookName !== undefined) configFbName = config.socials.facebookName;
                    if (config.socials.tiktokName !== undefined) configTtName = config.socials.tiktokName;
                    if (config.socials.youtubeName !== undefined) configYtName = config.socials.youtubeName;
                    loadedFromFirestore = true;
                }
            }
        } catch (e: any) {
            console.error("Error reading social stats from Firestore:", e.message);
        }
    }

    if (!loadedFromFirestore && fs.existsSync(ADMIN_CONFIG_FILE)) {
        try {
            const data = fs.readFileSync(ADMIN_CONFIG_FILE, "utf-8");
            const config = JSON.parse(data);
            if (config && config.socials) {
                if (config.socials.facebook !== undefined) fbId = config.socials.facebook;
                if (config.socials.tiktok !== undefined) ttId = config.socials.tiktok;
                if (config.socials.youtube !== undefined) ytId = config.socials.youtube;
                if (config.socials.facebookFollowers !== undefined) configFb = Number(config.socials.facebookFollowers);
                if (config.socials.tiktokFollowers !== undefined) configTt = Number(config.socials.tiktokFollowers);
                if (config.socials.youtubeFollowers !== undefined) configYt = Number(config.socials.youtubeFollowers);
                if (config.socials.facebookName !== undefined) configFbName = config.socials.facebookName;
                if (config.socials.tiktokName !== undefined) configTtName = config.socials.tiktokName;
                if (config.socials.youtubeName !== undefined) configYtName = config.socials.youtubeName;
            }
        } catch (e) {
            console.error("Error reading social stats from local config:", e);
        }
    }

    // Clear cache if the target IDs have changed dynamically
    if (fbId !== liveSocialStats.facebookId) {
        liveSocialStats.facebook = null;
        liveSocialStats.facebookName = "";
        liveSocialStats.facebookId = fbId;
        liveSocialStats.lastChecked = 0;
    }
    if (ttId !== liveSocialStats.tiktokId) {
        liveSocialStats.tiktok = null;
        liveSocialStats.tiktokName = "";
        liveSocialStats.tiktokId = ttId;
        liveSocialStats.lastChecked = 0;
    }
    if (ytId !== liveSocialStats.youtubeId) {
        liveSocialStats.youtube = null;
        liveSocialStats.youtubeName = "";
        liveSocialStats.youtubeId = ytId;
        liveSocialStats.lastChecked = 0;
    }

    // Trigger update if data is stale (cached for 30 minutes)
    const STALE_TIME = 30 * 60 * 1000;
    if (Date.now() - liveSocialStats.lastChecked > STALE_TIME || req.query.force === "true") {
        // If we don't have data yet (first run or ID changed), await the result synchronously
        if (liveSocialStats.lastChecked === 0) {
            await updateSocialStatsLive(fbId, ttId, ytId).catch(err => console.error("Error checking live social stats synchronously:", err));
        } else {
            // Otherwise, update in background
            updateSocialStatsLive(fbId, ttId, ytId).catch(err => console.error("Error checking live social stats asynchronously:", err));
        }
    }

    // Check query override parameter as quick manual debugs if present
    const forceFb = req.query.facebook ? Number(req.query.facebook) : null;
    const forceTt = req.query.tiktok ? Number(req.query.tiktok) : null;
    const forceYt = req.query.youtube ? Number(req.query.youtube) : null;

    console.log("DEBUG /api/social-stats values:", { forceYt, liveYt: liveSocialStats.youtube, configYt });

    res.json({
        facebook: forceFb || (configFb > 1 ? configFb : liveSocialStats.facebook) || 82000,
        facebookName: configFbName || liveSocialStats.facebookName || "Nguyễn Xuân Tài",
        facebookId: fbId,
        tiktok: forceTt || (configTt > 1 ? configTt : liveSocialStats.tiktok) || 409500,
        tiktokName: configTtName || liveSocialStats.tiktokName || "A.C Xuân Tài",
        tiktokId: ttId,
        youtube: forceYt || (configYt > 1 ? configYt : liveSocialStats.youtube) || 35400,
        youtubeName: configYtName || liveSocialStats.youtubeName || "A.C XUÂN TÀI",
        youtubeId: ytId,
        lastUpdate: liveSocialStats.lastChecked || Date.now()
    });
});

// ADMIN CONFIGURATION AND PERSISTENCE API
const ADMIN_CONFIG_FILE = path.join(RECORDS_DIR, "admin_config.json");

const DEFAULT_ADMIN_CONFIG = {
  logoUrl: "https://acxuantai.com/img/logo/logo-black.png",
  logoWhiteUrl: "https://acxuantai.com/img/logo/logo-white.png",
  faviconUrl: "https://acxuantai.com/favicon.ico",
  websiteTitle: "A.C Xuân Tài - Singer-songwriter, Music Producer",
  coverImageUrl: "https://acxuantai.com/img/about-img4.png",
  coverImageTransparent: "",
  roles: ["Ca nhạc sĩ", "Music Producer", "MV/ Film/ TVC Producer", "Content Creator", "KOL"],
  artistName: "A.C Xuân Tài",
  bio1: "Singer-songwriter, Music Producer",
  bio2: "Founder & CEO of XT Production",
  education: [
    { year: "2009 - 2012", title: "THPT Chuyên Phan Bội Châu - Nghệ An", desc: "Học sinh lớp chuyên Tin (A2k38), tại trường THPT chuyên Phan Bội Châu - Nghệ An" },
    { year: "2012 - 2016", title: "Đại Học FPT", desc: "Sinh viên ngành Kỹ Thuật Phần Mềm, Đại Học FPT Hà Nội với Học Bổng Toàn Phần. Tốt nghiệp năm 2016." },
    { year: "05/2015 - 09/2015", title: "Thực Tập Tại Nhật Bản", desc: "Thực tập tại công ty Suzuki Shouten ở Osaka, Nhật Bản trong vai trò Web Developer." },
    { year: "10/2014", title: "Trao đổi sinh viên tại ĐH Bunkyo", desc: "Tham gia chương trình trao đổi sinh viên tại trường ĐH Bunkyo ở Tokyo, Nhật Bản." }
  ],
  experience: [
    { year: "2025", title: "Nhạc Phim điện ảnh Hoàng Tử Quỷ", desc: "Sáng tác, sản xuất và thể hiện ca khúc \"Một Thời Khắc Khác - A.C Xuân Tài, DT Tập Rap\" nhạc phim điện ảnh Hoàng Tử Quỷ ( Đạo diễn: Trần Hữu Tấn, Diễn viên: Anh Tú Atus, Lương Thế Thành, Hoàng Linh Chi...), khởi chiếu từ 5.12.2025 tại các rạp trên toàn quốc.." },
    { year: "2023", title: "Top 1 Trending Youtube Music Việt nam", desc: "Sáng tác ca khúc \"Vì Em Chưa Bao Giờ Khóc - Hà Nhi\", giữ vị trí Top 1 Trending Youtube Music Việt Nam trong 2 tuần." },
    { year: "2023", title: "Vinhomes Ca", desc: "Sáng tác ca khúc \"Vươn Xa Cùng Thế Giới\", Giải nhì cuộc thi Sáng Tác Ca Khúc 30 năm Vingroup, giải thưởng 500 triệu đồng. Ca khúc sau đó được sử dụng làm Vinhomes Ca" },
    { year: "2021", title: "Ca Khúc Chủ Đề Running Man Vietnam ss2", desc: "Sáng Tác, Thể hiện và Sản xuất Ca khúc chủ đề \"Chạy Đi\" của Running Man Vietnam season 2 - Chơi Là Chạy. Giải Nhất cuộc thi sáng tác Themes Song." },
    { year: "2020", title: "Giám Đốc Âm Nhạc - Web Drama Hoàng Quý Muội", desc: "Giám Đốc Âm nhạc dự án Web Drama lớn của đạo diễn Luk Van - \"Hoàng Quý Muội\", Sáng Tác và Sản Xuất toàn bộ soundtrack trong phim, trong đó có 3 ca khúc OST.\nBỏ Lỡ Nhau Rồi - Hải Nam\nNếu Chúng Ta Chưa Từng Gặp - A.C Xuân Tài\nLà Vì Anh - Mai Fin ft. A.C Xuân Tài" },
    { year: "2019-nay", title: "Giám Đốc Sản Xuất, Đạo Diễn MV", desc: "Giám Đốc Sản Xuất và Đạo Diễn các MV như:\n7 Tỷ Người - A.C Xuân Tài ft. Deus Tiến Đạt (2019)\nPhải Chăng Trưởng Thành Là Chia Ly - A.C Xuân Tài (2020)\nSau 30 - A.C Xuân Tài ft. Mina Phan, Duy Andy (2021)\nAnh Đã Tìm Được Em - A.C Xuân Tài (2022)\nChầm Chậm Cùng Anh - A.C Xuân Tài (2022)\n...\nvới rất nhiều nghệ sĩ khách mời nổi tiếng như: Lynk Lee, Đức SVM, Lê Lý Lan Hương, Lương Huy, Thúy Kiều FAPTV, Yuno Bigboi, Củ Tỏi, Zero9, ..." },
    { year: "2018-nay", title: "Khách Mời Game Show", desc: "Là khách mời của rât nhiều Game Show truyền hình nổi tiếng như:\nKý Ức Vui Vẻ (ss3 #10)\nKhúc Hát Se Duyên (#13)\nSàn Đấu Ca Từ (ss3 #12, ss4 #14)\nĐấu Trường Âm Nhạc (ss3 #11)\nAi Là Triệu Phú (17/6/2025)\nCa Sĩ Bí Ẩn (ss3 #3)\nGiọng Ca Bí Ẩn (ss2 #6)\nBản Lĩnh Ngôi Sao (#129)\nNgười Hát Tình Ca 2024 (#6)\nKhuôn Mặt Đáng Tin (#16)\nĐối Mặt Thời Gian (ss1 #4)\nChọn Đâu Cho Đúng (ss3 #6)\nTrai Đẹp Vào Bếp (#18)\nTình Khúc Giao Mùa (ss2 #4)\nTặng Em Một Bản Tình Ca (#3)\n..." },
    { year: "2017-nay", title: "Sản Xuất nhạc Phim Web Drama", desc: "Sáng tác, hát và sản xuất OST cho rất nhiều Web Drama triệu view như: SVM Mì Tôm, Tình Đầu Đại Ca, Năm Đó Chúng Ta 18, Tự Giác Yêu Anh, Thiên Ân Phiêu Lưu Ký, Vợ Chồng Sửu Nhi, WHO ARE YOU..." },
    { year: "2016", title: "Nhạc phim Điện Ảnh \"Tháng 5 Để Dành\"", desc: "Sáng tác ca khúc \"Cơn Mưa Tuổi Thanh Xuân - Lynk Lee\", OST Phim Điện Ảnh \"Tháng 5 Để Dành\" của Đạo diễn Lê Hà Nguyên." },
    { year: "2015-nay", title: "Sản Xuất Nhạc Quảng Cáo, Nhạc Thương Hiệu", desc: "Sáng Tác, Thể hiện và Sản xuất các ca khúc nhạc Thương Hiệu, nhạc Quảng Cáo cho các Thương Hiệu lớn nhỏ như: Nội Thất Ahome, Đại Học FPT, Đại Học Văn Hiến, GIZ, Sumo Yakiniku, Kichi Kichi..." }
  ],
  portfolio: [
    { imageUrl: "https://acxuantai.com/img/portfolio/01.jpg", title: "Đấu Trường Âm Nhạc", role: "Người Chơi", url: "https://www.youtube.com/watch?v=W0_x5xqWI-E" },
    { imageUrl: "https://acxuantai.com/img/portfolio/02.jpg", title: "Trai Đẹp vào Bếp", role: "Khách Mời", url: "https://www.youtube.com/watch?v=3seFVv1Obic" },
    { imageUrl: "https://acxuantai.com/img/portfolio/03.jpg", title: "Ký Ức Vui Vẻ", role: "Ca Sĩ Biểu Diễn", url: "https://www.youtube.com/watch?v=bs5UOaPj0wA" },
    { imageUrl: "https://acxuantai.com/img/portfolio/04.jpg", title: "Sàn Đấu Ca Từ", role: "Người Chơi", url: "https://www.youtube.com/watch?v=nLsgBN0qyqk" },
    { imageUrl: "https://acxuantai.com/img/portfolio/08.jpg", title: "MV Sau 30", role: "Giám Đốc Sản Xuất, Đạo Diễn, Diễn Viên, Ca Sĩ, Nhạc Sĩ", url: "https://www.youtube.com/watch?v=5sfkgT-_LD8" },
    { imageUrl: "https://acxuantai.com/img/portfolio/06.jpg", title: "La La School", role: "Diễn Viên", url: "https://youtu.be/QFiSU0f-pbc?t=1078" },
    { imageUrl: "https://acxuantai.com/img/portfolio/05.jpg", title: "Hoàng Quý Muội", role: "Giám Đốc Âm Nhạc, Diễn Viên", url: "https://pops.vn/series/hoang-quy-muoi-5fae5a102b1bd200354e4c88" },
    { imageUrl: "https://acxuantai.com/img/portfolio/07.jpg", title: "Ca Sĩ Bí Ẩn", role: "Ca Sĩ Biểu Diễn", url: "https://www.youtube.com/watch?v=WPQSWe1cFxY&t=285s" }
  ],
  socials: {
    facebook: "nxuantai",
    facebookName: "Nguyễn Xuân Tài",
    tiktok: "@acxuantai",
    tiktokName: "A.C Xuân Tài",
    youtube: "@acxuantai",
    youtubeName: "A.C Xuân Tài",
    facebookFollowers: 82190,
    tiktokFollowers: 409505,
    youtubeFollowers: 15700
  },
  services: [
    { name: "Sáng Tác", desc: "Sáng tác bài hát, nhạc phim, nhạc quảng cáo." },
    { name: "Biểu Diễn", desc: "Ca sĩ biểu diễn tại các sự kiện chuyên nghiệp." },
    { name: "Quảng Bá", desc: "KOL/Booking quảng bá thương hiệu cá nhân và doanh nghiệp." },
    { name: "Sản Xuất", desc: "Sản xuất MV, Phim, Viral Clips chuyên nghiệp." },
    { name: "Sáng Tạo", desc: "Sáng tạo nội dung trên đa nền tảng xã hội." },
    { name: "Âm Nhạc", desc: "Music Producer & Audio Production trọn gói." },
    { name: "Hòa Âm Phối Khí", desc: "Hòa âm phối khí chuyên nghiệp cho ca sĩ." },
    { name: "Thu Âm", desc: "Thu âm phòng thu chất lượng cao, hậu kỳ chuyên sâu." },
    { name: "Đào Tạo", desc: "Đạo tạo sản xuất âm nhạc và thanh họa." }
  ],
  contacts: {
    phone: "085.6600666",
    email: "hi@acxuantai.com",
    customOptions: [
      { title: "Kho nhạc & Demo", desc: "tài.vn", url: "https://tài.vn" }
    ]
  },
  games: {
    minesweeperName: "Dò Mìn",
    game2048Name: "2048",
    tetrisName: "Xếp Hình",
    pikachuName: "Pikachu"
  },
  floatingButton: {
    icon: "music",
    text: "Kho Nhạc",
    url: "https://tài.vn"
  }
};

app.get("/api/admin-config", async (req, res) => {
    const handleSelfHealing = (config: any) => {
        if (!config) return config;
        let dirty = false;
        if (!config.faviconUrl || config.faviconUrl === "https://acxuantai.com/img/flags/us.svg") {
            config.faviconUrl = "https://acxuantai.com/favicon.ico";
            dirty = true;
        }
        if (!config.experience || config.experience.length <= 2) {
            config.experience = DEFAULT_ADMIN_CONFIG.experience;
            dirty = true;
        }
        if (dirty) {
            fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(config, null, 2));
            if (firestoreDb) {
                const docRef = doc(firestoreDb, "configs", "admin_config");
                setDoc(docRef, config, { merge: true }).catch(err => console.error("Self-heal Firestore save err:", err));
            }
        }
        return config;
    };

    // 1. Try local cache file
    if (fs.existsSync(ADMIN_CONFIG_FILE)) {
        try {
            const data = fs.readFileSync(ADMIN_CONFIG_FILE, "utf-8");
            let parsed = JSON.parse(data);
            if (parsed) {
                delete parsed.writeToken;
                parsed = handleSelfHealing(parsed);
            }
            return res.json(parsed);
        } catch (e) {
            console.error("Failed to parse local admin_config.json, falling back...");
        }
    }

    // 2. Try Firestore
    if (firestoreDb) {
        try {
            const docRef = doc(firestoreDb, "configs", "admin_config");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                let configData = docSnap.data();
                if (configData) {
                    delete configData.writeToken;
                    configData = handleSelfHealing(configData);
                }
                fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(configData, null, 2));
                return res.json(configData);
            }
        } catch (e: any) {
            console.error("Error reading admin config from Firestore:", e.message);
        }
    }

    // 3. Fallback to default
    return res.json(DEFAULT_ADMIN_CONFIG);
});

app.post("/api/admin/save-config", async (req, res) => {
    const { password, config } = req.body;
    if (password !== "MatKhauDay123") {
        return res.status(401).json({ error: "Incorrect password" });
    }
    if (!config || typeof config !== "object") {
        return res.status(400).json({ error: "Invalid config object" });
    }

    // Save locally
    try {
        fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(config, null, 2));
        try { fs.chmodSync(ADMIN_CONFIG_FILE, 0o777); } catch(e) {}
    } catch (e) {
        console.error("Failed to write local config:", e);
    }

    // Save to Firestore for Cloud persistence
    if (firestoreDb) {
        try {
            const docRef = doc(firestoreDb, "configs", "admin_config");
            await setDoc(docRef, {
                ...config,
                writeToken: "e9b1d120-fbc0-4c8d-b089-a29d6756811e"
            });
            console.log("Admin config synced to Cloud Firestore.");
        } catch (e: any) {
            console.error("Failed to sync Admin config to Firestore:", e.message);
        }
    }

    return res.json({ success: true });
});

// Update records from admin (delete record/edit name/reset game records)
app.post("/api/admin/records/update", (req, res) => {
    const { password, game, records } = req.body;
    if (password !== "MatKhauDay123") {
        return res.status(401).json({ error: "Incorrect password" });
    }
    if (!game || !Array.isArray(records)) {
        return res.status(400).json({ error: "Invalid data params" });
    }
    const filePath = path.join(RECORDS_DIR, `${game}.json`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(records.slice(0, 10), null, 2));
        try { fs.chmodSync(filePath, 0o777); } catch(e) {}
        return res.json({ success: true, records });
    } catch (e) {
        return res.status(500).json({ error: "Failed to write records file" });
    }
});

// PHP query mapping backwards compatibility for the game instances
app.get("/api.php", (req, res) => {
    const { game } = req.query;
    if (!game) return res.status(400).json({ error: "Missing game parameter" });
    const filePath = path.join(RECORDS_DIR, `${game}.json`);
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, "utf-8");
            return res.json(JSON.parse(data));
        } catch (e) {
            return res.status(500).json({ error: "Failed to read records" });
        }
    }
    return res.json([]);
});

app.post("/api.php", (req, res) => {
    const { game } = req.query;
    if (!game) return res.status(400).json({ error: "Missing game parameter" });
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
    const newEntry = { 
        score, 
        name, 
        date: new Date().toISOString(),
        id: Math.random().toString(36).substr(2, 9)
    };
    records.push(newEntry);
    
    // Sort: lower is better for Minesweeper, higher is better for others
    const isLowerBetter = lowerIsBetter || (game === "minesweeper" || (typeof game === 'string' && game.startsWith("minesweeper")));
    if (isLowerBetter) {
        records.sort((a, b) => a.score - b.score);
    } else {
        records.sort((a, b) => b.score - a.score);
    }
    const top10 = records.slice(0, 10);
    try {
        fs.writeFileSync(filePath, JSON.stringify(top10, null, 2));
        fs.chmodSync(filePath, 0o777);
    } catch(e) {}
    
    return res.json({ success: true, isTop10: top10.some(r => r.id === newEntry.id), records: top10 });
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
    });
}

startServer();
