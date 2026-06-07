import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Play, Volume2, VolumeX, Shuffle, Search, Maximize2, Trophy, RotateCcw, X, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../game/types';
import { TRANSLATIONS } from '../game/constants';

const R = 11; // 9 rows + 2 padding
const C = 18; // 16 cols + 2 padding
const NUM_IMAGES = 36;
const GAME_TIME = 300; // 5 minutes

type Point = { r: number; c: number };

interface RecordEntry {
  score: number;
  name: string;
  date: string;
}

const generateBoard = () => {
  const pieces = [];
  for (let i = 1; i <= NUM_IMAGES; i++) {
    pieces.push(i, i, i, i); // 4 of each -> 144
  }
  pieces.sort(() => Math.random() - 0.5);

  const newBoard = Array(R).fill(0).map(() => Array(C).fill(0));
  let idx = 0;
  for (let r = 1; r < R - 1; r++) {
    for (let c = 1; c < C - 1; c++) {
      newBoard[r][c] = pieces[idx++];
    }
  }
  return newBoard;
};

const getReachable = (startR: number, startC: number, board: number[][], targetR: number, targetC: number) => {
  const points: Point[] = [];
  points.push({ r: startR, c: startC });
  
  // Up
  for (let r = startR - 1; r >= 0; r--) {
    if (board[r][startC] === 0) points.push({ r, c: startC });
    else { if (r === targetR && startC === targetC) points.push({ r, c: startC }); break; }
  }
  // Down
  for (let r = startR + 1; r < R; r++) {
    if (board[r][startC] === 0) points.push({ r, c: startC });
    else { if (r === targetR && startC === targetC) points.push({ r, c: startC }); break; }
  }
  // Left
  for (let c = startC - 1; c >= 0; c--) {
    if (board[startR][c] === 0) points.push({ r: startR, c });
    else { if (startR === targetR && c === targetC) points.push({ r: startR, c }); break; }
  }
  // Right
  for (let c = startC + 1; c < C; c++) {
    if (board[startR][c] === 0) points.push({ r: startR, c });
    else { if (startR === targetR && c === targetC) points.push({ r: startR, c }); break; }
  }
  return points;
};

const isStraightClear = (p1: Point, p2: Point, board: number[][]) => {
  if (p1.r !== p2.r && p1.c !== p2.c) return false;
  if (p1.r === p2.r) {
    const min = Math.min(p1.c, p2.c);
    const max = Math.max(p1.c, p2.c);
    for (let c = min + 1; c < max; c++) if (board[p1.r][c] !== 0) return false;
    return true;
  } else {
    const min = Math.min(p1.r, p2.r);
    const max = Math.max(p1.r, p2.r);
    for (let r = min + 1; r < max; r++) if (board[r][p1.c] !== 0) return false;
    return true;
  }
};

const findPath = (r1: number, c1: number, r2: number, c2: number, board: number[][]) => {
  if (r1 === r2 && c1 === c2) return null;
  if (board[r1][c1] !== board[r2][c2]) return null;
  if (board[r1][c1] === 0) return null;

  const pA = getReachable(r1, c1, board, r2, c2);
  const pB = getReachable(r2, c2, board, r1, c1);

  let bestPath: Point[] | null = null;
  let minBends = 4;

  for (const a of pA) {
    for (const b of pB) {
      if (a.r === b.r && a.c === b.c) {
        let bends = 1;
        if ((a.r === r1 && a.c === c1) && (a.r === r2 && a.c === c2)) bends = -1;
        else if (a.r === r1 && a.c === c1) bends = 0;
        else if (a.r === r2 && a.c === c2) bends = 0;
        
        if (bends < minBends) {
          minBends = bends;
          if (bends === 0) bestPath = [{ r: r1, c: c1 }, { r: r2, c: c2 }];
          else bestPath = [{ r: r1, c: c1 }, a, { r: r2, c: c2 }];
        }
      } else if (isStraightClear(a, b, board)) {
        let bends = 2;
        if (bends < minBends) {
          minBends = bends;
          bestPath = [{ r: r1, c: c1 }, a, b, { r: r2, c: c2 }];
        }
      }
    }
  }

  if (!bestPath) return null;
  
  // Clean up redundant points on straight lines
  const cleanPath = [bestPath[0]];
  for (let i = 1; i < bestPath.length - 1; i++) {
    const prev = cleanPath[cleanPath.length - 1];
    const curr = bestPath[i];
    const next = bestPath[i + 1];
    if ((prev.r === curr.r && curr.r === next.r) || (prev.c === curr.c && curr.c === next.c)) {
      continue;
    }
    cleanPath.push(curr);
  }
  cleanPath.push(bestPath[bestPath.length - 1]);
  return cleanPath;
};

const checkPossibleMove = (board: number[][]) => {
  const piecesMap: Record<number, Point[]> = {};
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (board[r][c] > 0) {
        if (!piecesMap[board[r][c]]) piecesMap[board[r][c]] = [];
        piecesMap[board[r][c]].push({ r, c });
      }
    }
  }
  
  for (const pts of Object.values(piecesMap)) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (findPath(pts[i].r, pts[i].c, pts[j].r, pts[j].c, board)) {
          return [pts[i], pts[j]]; // Return a valid pair if found
        }
      }
    }
  }
  return null;
};

interface PikachuGameProps {
  globalPlayerName?: string;
  onUpdateName?: (name: string) => void;
  language: Language;
}

export default function PikachuGame({ globalPlayerName = '', onUpdateName = () => {}, language: propLanguage }: PikachuGameProps) {
  const [language, setLanguage] = useState<Language>(propLanguage);
  const [board, setBoard] = useState<number[][]>(() => generateBoard());
  const [sel, setSel] = useState<Point | null>(null);
  const [path, setPath] = useState<Point[] | null>(null);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<'IDLE'|'PLAYING'|'WON'|'LOST'>('IDLE');
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [hint, setHint] = useState<Point[] | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [shufflesLeft, setShufflesLeft] = useState(3);
  const [hintsLeft, setHintsLeft] = useState(3);
  
  const [leaderboard, setLeaderboard] = useState<RecordEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [playerName, setPlayerName] = useState(globalPlayerName);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [playerRank, setPlayerRank] = useState(0);
  const isSubmittingRef = useRef(false);
  
  const t = TRANSLATIONS[language];
  
  const timerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellDim, setCellDim] = useState({ w: 40, h: 46 });

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch('/api.php?game=pikachu');
      const data = await res.json();
      const records = Array.isArray(data) ? data : [];
      setLeaderboard(records);
      localStorage.setItem('records_pikachu', JSON.stringify(records));
    } catch (e) {
      const localData = localStorage.getItem('records_pikachu');
      if (localData) {
        try {
          setLeaderboard(JSON.parse(localData));
        } catch (err) {}
      }
    }
  }, []);

  useEffect(() => {
    fetchRecords();
    setPlayerName(globalPlayerName);
  }, [fetchRecords, globalPlayerName]);

  useEffect(() => {
    setLanguage(propLanguage);
  }, [propLanguage]);

  const submitScoreInternal = async (name: string, finalScore: number) => {
    if (!name.trim()) return;
    onUpdateName(name);

    const localKey = 'records_pikachu';
    let currentRecords: RecordEntry[] = [];
    try {
      const localData = localStorage.getItem(localKey);
      currentRecords = localData ? JSON.parse(localData) : [];
    } catch (e) {}

    const newEntry: RecordEntry = { 
      score: finalScore, 
      name, 
      date: new Date().toISOString()
    };
    
    currentRecords.push(newEntry);
    const updatedRecords = currentRecords
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    setLeaderboard(updatedRecords);
    localStorage.setItem(localKey, JSON.stringify(updatedRecords));

    try {
      const res = await fetch(`/api.php?game=pikachu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: finalScore, name })
      });
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.records);
        localStorage.setItem(localKey, JSON.stringify(data.records));
      }
    } catch (e) {
      console.log("PHP API not found - using local records");
    }
  };

  const handleScoreSubmit = async () => {
    if (!playerName.trim() || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    const finalScore = status === 'WON' ? score + (timeLeft * 2) : score;
    await submitScoreInternal(playerName, finalScore);
    setShowNameInput(false);
  };

  const playEffect = (type: 'select' | 'match' | 'error' | 'win' | 'lose') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'select') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'match') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      }
    } catch(e) {}
  };

  useEffect(() => {
    const resizeListener = () => {
      if (containerRef.current) {
        let isDesktop = window.innerWidth >= 992;
        // On mobile, use Almost full width
        let maxWidth = isDesktop ? containerRef.current.clientWidth - 16 : window.innerWidth - 8;
        let isLandscape = window.innerWidth > window.innerHeight;
        
        // Use a smaller deduction on mobile to let the grid expand more
        let deduction = isDesktop ? 220 : (isLandscape ? 50 : 120); 
        let maxHeight = window.innerHeight - deduction;
        
        let targetW = Math.floor(maxWidth / C);
        let targetH = Math.floor(maxHeight / R);
        
        // Force tile aspect ratio exactly like original (e.g. 42x51 is ~1.214)
        if (targetW * 1.214 > targetH) {
           targetW = Math.floor(targetH / 1.214);
           targetH = Math.floor(targetW * 1.214);
        } else {
           targetH = Math.floor(targetW * 1.214);
        }
        
        // Minimum sizes to prevent completely unplayable sizes
        if (targetW < 18) {
            targetW = 18;
            targetH = 20;
        }
        // No maximum bound to allow "khít" on larger screens
        
        setCellDim({ w: targetW, h: targetH });
      }
    };
    // Delay slightly to ensure layout is complete
    const timeoutId = setTimeout(resizeListener, 100);
    window.addEventListener('resize', resizeListener);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', resizeListener);
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    if (status === 'PLAYING') {
      clearTimer();
      timerRef.current = window.setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            setStatus('LOST');
            clearTimer();
            playEffect('lose');
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [status]);

  const doShuffle = useCallback(() => {
    setBoard(prev => {
      const activePieces: number[] = [];
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          if (prev[r][c] > 0) activePieces.push(prev[r][c]);
        }
      }
      activePieces.sort(() => Math.random() - 0.5);
      
      const newBoard = prev.map(row => [...row]);
      let idx = 0;
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          if (newBoard[r][c] > 0) {
            newBoard[r][c] = activePieces[idx++];
          }
        }
      }
      return newBoard;
    });
  }, []);

  useEffect(() => {
    if (status === 'PLAYING' && !path) {
       const hasMoves = checkPossibleMove(board);
       if (!hasMoves) {
           const count = board.flat().filter(x => x > 0).length;
           if (count > 0) {
               console.log("No valid moves! Auto shuffling...");
               doShuffle();
           } else {
               setStatus('WON');
               clearTimer();
           }
       }
    }
  }, [board, status, path, doShuffle]);
  
  useEffect(() => {
    if ((status === 'WON' || status === 'LOST') && !hasSubmitted) {
      const finalScore = status === 'WON' ? score + (timeLeft * 2) : score;
      
      let rank = 1;
      const sorted = [...leaderboard].sort((a,b) => b.score - a.score);
      for (const r of sorted) {
        if (finalScore > r.score) break;
        rank++;
      }
      
      const isTop10Eligible = finalScore > 0 && rank <= 10;
      if (isTop10Eligible) {
        setHasSubmitted(true);
        setPlayerRank(rank);
        if (globalPlayerName && globalPlayerName.trim()) {
            setPlayerName(globalPlayerName);
            setShowNameInput(true);
            
            // Auto submit if the user is logged in
            if (!isSubmittingRef.current) {
               isSubmittingRef.current = true;
               setTimeout(() => submitScoreInternal(globalPlayerName, finalScore), 100);
            }
        } else {
            setShowNameInput(true);
        }
      }
    }
  }, [status, hasSubmitted, leaderboard, globalPlayerName, score, timeLeft]);

  const startGame = () => {
    setBoard(generateBoard());
    setScore(0);
    setSel(null);
    setPath(null);
    setHint(null);
    setShufflesLeft(3);
    setHintsLeft(3);
    setTimeLeft(GAME_TIME);
    setStatus('PLAYING');
    setHasSubmitted(false);
    setShowNameInput(false);
    isSubmittingRef.current = false;
  };

  const handleCellClick = (r: number, c: number) => {
    if (status !== 'PLAYING' || path || board[r][c] === 0) return;

    if (!sel) {
      setSel({ r, c });
      playEffect('select');
      return;
    }

    if (sel.r === r && sel.c === c) {
      setSel(null);
      setHint(null);
      return;
    }

    if (board[sel.r][sel.c] !== board[r][c]) {
      setSel({ r, c });
      setHint(null);
      playEffect('select');
      return;
    }

    // Same type, check path
    const foundPath = findPath(sel.r, sel.c, r, c, board);
    if (foundPath) {
      setPath(foundPath);
      playEffect('match');
      setScore(s => s + 10);
      setHint(null);

      setTimeout(() => {
        setBoard(prev => {
          const newB = prev.map(row => [...row]);
          newB[sel.r][sel.c] = 0;
          newB[r][c] = 0;
          return newB;
        });
        setPath(null);
        setSel(null);
      }, 300);
    } else {
      setSel({ r, c });
      playEffect('error');
    }
  };

  const requestHint = () => {
    if (hintsLeft <= 0 || status !== 'PLAYING') return;
    const pair = checkPossibleMove(board);
    if (pair) {
      setHint(pair);
      setHintsLeft(h => h - 1);
    }
  };

  const manualShuffle = () => {
    if (shufflesLeft <= 0 || status !== 'PLAYING') return;
    doShuffle();
    setShufflesLeft(s => s - 1);
    setHint(null);
    setSel(null);
  };

  const isHinted = (r: number, c: number) => {
    return hint && hint.some(p => p.r === r && p.c === c);
  };

  return (
    <div className="flex flex-col items-center w-full relative" ref={containerRef}>
      <div className="bg-slate-800 p-1 sm:px-3 sm:py-1 rounded-xl sm:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-700 w-full max-w-[1600px] mx-auto">
        
        {/* Header HUD */}
        <div className="flex flex-wrap justify-between items-center mb-1 gap-1 sm:gap-2 bg-slate-900/50 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border border-slate-700/50">
          <div className="flex items-center space-x-2 sm:space-x-4">
             <div className="flex flex-col">
               <span className="text-slate-400 text-[9px] sm:text-xs font-bold uppercase hidden sm:block">{t.scoreTitle}</span>
               <span className="text-emerald-400 font-mono text-sm sm:text-xl font-bold leading-none">{score}</span>
             </div>
             <div className="h-4 sm:h-8 w-px bg-slate-700"></div>
             <div className="flex flex-col hidden sm:flex">
               <span className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase">{t.highScoreLabel}</span>
               <span className="text-amber-400 font-mono text-lg sm:text-xl font-bold leading-none">{leaderboard.length > 0 ? leaderboard[0].score : 0}</span>
             </div>
             <div className="h-6 sm:h-8 w-px bg-slate-700 hidden sm:block"></div>
             <div className="flex flex-col">
               <span className="text-slate-400 text-[9px] sm:text-xs font-bold uppercase hidden sm:block">⏱️</span>
               <span className={`font-mono text-sm sm:text-xl font-bold leading-none ${timeLeft < 30 ? 'text-rose-500 animate-pulse' : 'text-slate-200'}`}>
                 {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
               </span>
             </div>
          </div>
          
          <div className="flex space-x-1 sm:space-x-2 items-center">
            <button onClick={() => setShowLeaderboard(!showLeaderboard)} className="p-1.5 sm:p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md sm:rounded-lg transition flex items-center justify-center gap-1.5" title="Bảng xếp hạng">
              <Trophy size={14} className="sm:w-[18px] sm:h-[18px] w-3.5 h-3.5" />
              <span className="text-amber-400 font-mono text-[11px] font-bold leading-none sm:hidden">{leaderboard.length > 0 ? leaderboard[0].score : 0}</span>
            </button>
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 sm:p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md sm:rounded-lg transition flex items-center justify-center" title="Âm thanh">
              {soundEnabled ? <Volume2 size={14} className="sm:w-[18px] sm:h-[18px] w-3.5 h-3.5" /> : <VolumeX size={14} className="sm:w-[18px] sm:h-[18px] w-3.5 h-3.5" />}
            </button>
            <button onClick={requestHint} disabled={hintsLeft <= 0 || status !== 'PLAYING'} className="flex items-center justify-center gap-1 px-2 py-1 sm:px-3 sm:py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-md sm:rounded-lg text-[11px] sm:text-sm font-bold transition">
              <Search size={14} className="sm:w-4 sm:h-4 w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.hint} ({hintsLeft})</span>
              <span className="sm:inline lg:hidden xl:hidden 2xl:hidden">{hintsLeft}</span>
            </button>
            <button onClick={manualShuffle} disabled={shufflesLeft <= 0 || status !== 'PLAYING'} className="flex items-center justify-center gap-1 px-2 py-1 sm:px-3 sm:py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-md sm:rounded-lg text-[11px] sm:text-sm font-bold transition">
              <Shuffle size={14} className="sm:w-4 sm:h-4 w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.shuffle} ({shufflesLeft})</span>
              <span className="sm:inline lg:hidden xl:hidden 2xl:hidden">{shufflesLeft}</span>
            </button>
            <button onClick={startGame} className="flex items-center justify-center space-x-1 px-2 py-1 sm:px-3 sm:py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md sm:rounded-lg text-[11px] sm:text-sm font-bold transition shadow-lg shadow-emerald-500/20">
              <RefreshCw size={14} className="sm:w-4 sm:h-4 w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.restart}</span>
            </button>
          </div>
        </div>

        {/* Game Area */}
        <div className="relative w-full overflow-hidden bg-emerald-900/40 rounded-2xl flex flex-col items-center justify-center py-2 sm:py-4">
          
          {status === 'IDLE' && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-2xl">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-xl shadow-2xl flex items-center space-x-2"
              >
                <Play fill="currentColor" />
                <span>{t.startGame}</span>
              </motion.button>
            </div>
          )}

          {(status === 'WON' || status === 'LOST') && (
            <div className="fixed inset-0 z-[9900] flex items-center justify-center bg-slate-900/60 backdrop-blur-md pointer-events-auto p-4">
               <motion.div initial={{ scale: 0.9, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative bg-white rounded-[32px] border border-slate-100 flex flex-col min-w-[280px] w-full max-w-sm shadow-2xl overflow-hidden">
                  <div className={`p-5 sm:p-8 text-center ${status === 'WON' ? 'bg-gradient-to-br from-amber-400 to-yellow-600' : 'bg-gradient-to-br from-rose-500 to-red-600'}`}>
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-widest leading-none drop-shadow-md">
                      {status === 'WON' ? t.victory : t.defeat}
                    </h3>
                  </div>
                  <div className="p-6 sm:p-8 text-center bg-white">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.yourScore}</p>
                    <p className="text-5xl font-black text-slate-800 mb-8">{status === 'WON' ? score + (timeLeft * 2) : score}</p>
                    
                    {showNameInput ? (
                      <div className="space-y-4">
                        {playerRank === 1 ? (
                          <div className="text-amber-500 font-bold mb-4 text-xs sm:text-sm uppercase tracking-widest py-2 bg-amber-50 rounded-xl">🏆 {t.newRecord} 🏆</div>
                        ) : playerRank <= 10 && playerRank > 0 ? (
                          <div className="text-amber-500 font-bold mb-4 text-xs sm:text-sm uppercase tracking-widest py-2 bg-amber-50 rounded-xl">🎉 {t.topRank.replace('{rank}', String(playerRank))} 🎉</div>
                        ) : null}
                        
                        {!globalPlayerName ? (
                          <div className="flex flex-col gap-3">
                            <input 
                              type="text" 
                              value={playerName}
                              onChange={e => setPlayerName(e.target.value)}
                              placeholder={t.enterNamePlaceholder}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-slate-800 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-center font-bold text-lg"
                              maxLength={15}
                              autoFocus
                              onKeyDown={e => {
                                 if (e.key === 'Enter') handleScoreSubmit();
                              }}
                            />
                            <button 
                              onClick={handleScoreSubmit}
                              disabled={!playerName.trim()}
                              className="w-full py-4 bg-gradient-to-r from-amber-400 to-yellow-500 text-white rounded-xl font-black disabled:opacity-50 transition-all shadow-lg shadow-amber-200 uppercase tracking-widest text-sm"
                            >
                              {t.saveRecord}
                            </button>
                            <button 
                              onClick={() => {
                                setShowNameInput(false);
                                setStatus('PLAYING');
                              }}
                              className="w-full py-4 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 text-xs tracking-widest uppercase font-black transition-all shadow-sm mt-3 flex items-center justify-center gap-2"
                            >
                              <Eye size={14} /> {t.viewBoard}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 mt-4">
                            <button 
                              onClick={() => {
                                setShowNameInput(false);
                                setShowLeaderboard(true);
                              }}
                              className="w-full py-4 bg-gradient-to-r from-emerald-400 to-teal-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-emerald-200 uppercase tracking-widest text-sm hover:scale-105 active:scale-95"
                            >
                              {t.seeLeaderboard}
                            </button>
                            <button 
                              onClick={() => {
                                setShowNameInput(false);
                                setStatus('PLAYING');
                              }}
                              className="w-full py-4 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 text-xs tracking-widest uppercase font-black transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                              <Eye size={14} /> {t.viewBoard}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <button onClick={startGame} className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-200 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest">
                          {t.restart}
                        </button>
                        <button 
                          onClick={() => setStatus('PLAYING')}
                          className="w-full py-4 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 text-xs tracking-widest uppercase font-black transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          <Eye size={14} /> {t.viewBoard}
                        </button>
                      </div>
                    )}
                  </div>
               </motion.div>
            </div>
          )}

          {/* Leaderboard Overlay */}
          <AnimatePresence>
            {showLeaderboard && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 pointer-events-auto"
              >
                <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-2xl relative flex flex-col max-h-[85vh]">
                  <button 
                    onClick={() => setShowLeaderboard(false)}
                    className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={20} />
                  </button>

                  <div className="flex flex-col mb-6 shrink-0">
                     <h3 className="text-3xl font-black uppercase tracking-tight text-slate-800 italic">Top 10</h3>
                     <p className="text-slate-400 text-xs font-bold tracking-widest mt-1">{t.pikachuSubtitle}</p>
                  </div>
                  
                  <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                    {leaderboard.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 italic text-sm font-medium">{t.noRecords}</div>
                    ) : (
                      leaderboard.map((entry, index) => (
                        <div key={index} className={`flex justify-between items-center p-3 sm:p-4 rounded-xl sm:rounded-2xl ${index === 0 ? 'bg-amber-400 text-white shadow-lg shadow-amber-200' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-white text-amber-500' : index < 3 ? 'bg-slate-200 text-slate-700' : 'text-slate-400'}`}>
                              {index + 1}
                            </div>
                            <span className="font-bold text-sm sm:text-base truncate max-w-[120px] sm:max-w-[150px]">{entry.name}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={`font-mono font-black text-lg sm:text-xl leading-none ${index === 0 ? 'text-white' : 'text-amber-500'}`}>{entry.score}</span>
                            <span className={`text-[8px] sm:text-[9px] uppercase tracking-widest font-bold mt-1 ${index === 0 ? 'text-amber-100' : 'text-slate-400'}`}>
                              {t.scoreTitle} - {new Date(entry.date).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actual Grid Board */}
          <div className="relative pointer-events-none" style={{ width: C * cellDim.w, height: R * cellDim.h }}>
             {/* Path Overlay */}
             {path && (
               <svg className="absolute inset-0 z-20 pointer-events-none" width="100%" height="100%">
                 {/* Glow */}
                 <polyline
                   points={path.map(p => `${p.c * cellDim.w + cellDim.w/2},${p.r * cellDim.h + cellDim.h/2}`).join(' ')}
                   fill="none" stroke="rgba(251, 191, 36, 0.4)" strokeWidth={cellDim.w * 0.3} strokeLinejoin="round" strokeLinecap="round"
                 />
                 {/* Core line */}
                 <polyline
                   points={path.map(p => `${p.c * cellDim.w + cellDim.w/2},${p.r * cellDim.h + cellDim.h/2}`).join(' ')}
                   fill="none" stroke="#fbbf24" strokeWidth={cellDim.w * 0.15} strokeLinejoin="round" strokeLinecap="round"
                 />
               </svg>
             )}

             {/* Pieces */}
             <AnimatePresence>
                {board.map((row, r) => row.map((val, c) => val > 0 && (
                   <motion.div
                     key={`${r}-${c}`}
                     layout
                     initial={false}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0 }}
                     className={`absolute cursor-pointer pointer-events-auto p-0 transition-[filter,transform] duration-200 z-10
                       ${sel?.r === r && sel?.c === c ? 'brightness-[1.15] drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] z-20 scale-[1.03]' : 'hover:brightness-110 hover:scale-[1.02]'}
                       ${isHinted(r, c) ? 'animate-pulse drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]' : ''}
                     `}
                     style={{
                       left: c * cellDim.w, top: r * cellDim.h, width: cellDim.w, height: cellDim.h
                     }}
                     onClick={() => handleCellClick(r, c)}
                   >
                      <div className={`w-full h-full relative flex items-center justify-center overflow-hidden
                         ${sel?.r === r && sel?.c === c ? 'ring-[3px] ring-amber-400 ring-inset z-10' : ''}
                         ${isHinted(r, c) ? 'ring-[3px] ring-emerald-400 ring-inset z-10' : ''}
                      `}>
                         <img 
                           src={`https://acxuantai.com/img/pokemons/pieces${val}.png`} 
                           alt={`Piece ${val}`}
                           className="w-full h-full object-fill select-none pointer-events-none opacity-100 block m-0"
                           draggable={false}
                         />
                         {(sel?.r === r && sel?.c === c) && <div className="absolute inset-0 bg-amber-400/20"></div>}
                      </div>
                   </motion.div>
                )))}
             </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* Tip text positioned completely outside the game screen container */}
      <div className="w-full max-w-[90%] sm:max-w-md mx-auto text-center pointer-events-none opacity-80 z-20 mt-4 mb-2 bg-slate-900/60 py-2 sm:py-3 rounded-xl border border-slate-700/50 shadow-inner block">
         <p className="text-emerald-100/90 font-medium text-[10px] sm:text-xs tracking-wide px-2">
           {t.pikachuTip}
         </p>
      </div>
    </div>
  );
}
