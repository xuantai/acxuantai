<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$file = 'records/records.json';

// Ensure directory exists
if (!is_dir('records')) {
    @mkdir('records', 0777, true);
}

// Khởi tạo file nếu chưa có
if (!file_exists($file)) {
    file_put_contents($file, json_encode([
        'minesweeper_beginner' => [],
        'minesweeper_intermediate' => [],
        'minesweeper_expert' => [],
        '2048' => [],
        'tetris' => [],
        'pikachu' => []
    ]));
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$game = $_GET['game'] ?? '';

$data = json_decode(file_get_contents($file), true);

// Đảm bảo game pikachu hoặc game mới có trong data
if ($game && !isset($data[$game])) {
    $data[$game] = [];
}

if ($method === 'GET') {
    if ($game && isset($data[$game])) {
        echo json_encode($data[$game]);
    } else {
        echo json_encode($data);
    }
} 
elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($game && isset($data[$game]) && $input) {
        $newEntry = [
            'name' => htmlspecialchars($input['name'] ?? 'Anonymous'),
            'score' => (int)($input['score'] ?? 0),
            'date' => date('c'),
            'id' => uniqid()
        ];
        
        $data[$game][] = $newEntry;
        
        // Sắp xếp: Mặc định là điểm cao lên đầu (High Score)
        // Lưu ý: Nếu bạn muốn Minesweeper bản cũ (tính giây) thì mới để thấp lên đầu.
        // Ở đây chúng ta đổi sang tính điểm tích lũy nên mặc định là cao lên đầu.
        usort($data[$game], function($a, $b) { 
            if ($a['score'] === $b['score']) {
                return strtotime($b['date']) - strtotime($a['date']); // Cùng điểm thì ai mới hơn lên trước
            }
            return $b['score'] - $a['score']; 
        });
        
        // Giữ top 10
        $data[$game] = array_slice($data[$game], 0, 10);
        
        if (file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT))) {
            echo json_encode(['success' => true, 'records' => $data[$game]]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Could not write to file. Check permissions (chmod 777).']);
        }
    }
}
?>
