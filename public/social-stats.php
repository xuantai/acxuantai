<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$recordsDir = __DIR__ . '/records';
if (!file_exists($recordsDir)) {
    mkdir($recordsDir, 0777, true);
}

$statsFile = $recordsDir . '/777.json';
$eightHours = 8 * 60 * 60; // 8 hours in seconds

$defaultStats = [
    'facebook' => 85210,
    'tiktok' => 411200,
    'youtube' => 15820,
    'lastUpdate' => 0
];

$stats = $defaultStats;
$fileExists = file_exists($statsFile);

if ($fileExists) {
    $content = file_get_contents($statsFile);
    if (!empty($content)) {
        $parsed = json_decode($content, true);
        if (is_array($parsed)) {
            $stats = $parsed;
        }
    }
}

$now = time();
$forceUpdate = !$fileExists || empty($content) || $stats['lastUpdate'] == 0;

if ($forceUpdate || ($now - $stats['lastUpdate'] > $eightHours)) {
    // API Keys (Change if needed)
    $rapidApiKey = "c6c8460a53msh54cce4eba86a610p16911bjsn6ef018aaca1d"; // Your fallback key from Node

    $newStats = $stats;
    $updated = false;

    // Helper to make curl request
    function curl_get($url, $headers = []) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        if (!empty($headers)) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        }
        $data = curl_exec($ch);
        curl_close($ch);
        return $data;
    }

    // 1. YouTube Stats
    $ytUrl = "https://youtube138.p.rapidapi.com/channel/details/?id=https://www.youtube.com/@ACXUANTAI&hl=en&gl=US";
    $ytHeaders = [
        "X-RapidAPI-Key: " . $rapidApiKey,
        "X-RapidAPI-Host: youtube138.p.rapidapi.com"
    ];
    $ytRes = curl_get($ytUrl, $ytHeaders);
    if ($ytRes) {
        $ytData = json_decode($ytRes, true);
        if (isset($ytData['stats']['subscribers'])) {
            $newStats['youtube'] = (int)$ytData['stats']['subscribers'];
            $updated = true;
        } elseif (isset($ytData['subscriberCountText']['simpleText'])) {
            $text = $ytData['subscriberCountText']['simpleText'];
            if (preg_match('/([0-9\.,]+)/', $text, $matches)) {
                $val = (float)str_replace(',', '', $matches[1]);
                if (strpos($text, 'K') !== false) $val *= 1000;
                if (strpos($text, 'M') !== false) $val *= 1000000;
                $newStats['youtube'] = (int)$val;
                $updated = true;
            }
        }
    }

    // 2. Facebook Stats
    $fbUrl = "https://facebook-scraper3.p.rapidapi.com/profile/details?profile_id=nxuantai";
    $fbHeaders = [
        "X-RapidAPI-Key: " . $rapidApiKey,
        "X-RapidAPI-Host: facebook-scraper3.p.rapidapi.com"
    ];
    $fbRes = curl_get($fbUrl, $fbHeaders);
    if ($fbRes) {
        $fbData = json_decode($fbRes, true);
        $followerVal = $fbData['follower_count'] 
            ?? $fbData['followers']['count'] 
            ?? $fbData['about']['followers'] 
            ?? $fbData['subscribers_count'] 
            ?? $fbData['follower_count_text'] 
            ?? null;
            
        if ($followerVal) {
            $val = (int)preg_replace('/[^0-9]/', '', (string)$followerVal);
            if ($val > 0) {
                $newStats['facebook'] = $val;
                $updated = true;
            }
        } else {
            if (preg_match('/"follower[s]?_count"\s*:\s*"?([0-9\.,]+)"?/i', $fbRes, $matches) || 
                preg_match('/([0-9\.,]+)\s*followers/i', $fbRes, $matches)) {
                $newStats['facebook'] = (int)str_replace([',','.'], '', $matches[1]);
                $updated = true;
            }
        }
    }

    // 3. TikTok Stats
    $ttUrl = "https://www.tiktok.com/@acxuantai?is_from_webapp=1&is_copy_url=0";
    $ttHeaders = [
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language: en-US,en;q=0.9"
    ];
    $ttRes = curl_get($ttUrl, $ttHeaders);
    if ($ttRes) {
        if (preg_match('/<script id="__UNIVERSAL_DATA_FOR_REA_T_HYDRATION__" [^>]*>([^<]+)<\/script>/', $ttRes, $matches)) {
            $jsonData = json_decode($matches[1], true);
            $followerCount = $jsonData['__DEFAULT_SCOPE__']['webapp.user-detail']['userInfo']['stats']['followerCount'] ?? null;
            if ($followerCount) {
                $newStats['tiktok'] = (int)$followerCount;
                $updated = true;
            }
        }
        
        if (!$updated || $newStats['tiktok'] == $defaultStats['tiktok']) {
            if (preg_match('/"followerCount":(\d+)/i', $ttRes, $matches) || 
                preg_match('/(\d+)\s*Followers/i', $ttRes, $matches)) {
                $newStats['tiktok'] = (int)$matches[1];
                $updated = true;
            }
        }
    }

    if ($updated || $forceUpdate) {
        $newStats['lastUpdate'] = time();
        file_put_contents($statsFile, json_encode($newStats, JSON_PRETTY_PRINT));
        @chmod($statsFile, 0777);
        $stats = $newStats;
    }
}

echo json_encode($stats);
?>
