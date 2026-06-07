import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Eye } from 'lucide-react';
import { Language } from '../game/types';
import { TRANSLATIONS } from '../game/constants';

type Grid = number[][];

interface RecordEntry {
  score: number;
  name: string;
  date: string;
}

const GRID_SIZE = 4;

interface Game2048Props {
  globalPlayerName: string;
  onUpdateName: (name: string) => void;
  language: Language;
}

const Game2048: React.FC<Game2048Props> = ({ globalPlayerName, onUpdateName, language: propLanguage }) => {
  const [language, setLanguage] = useState<Language>(propLanguage);
  const [grid, setGrid] = useState<Grid>(Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0)));
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<RecordEntry[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [playerName, setPlayerName] = useState(globalPlayerName);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [playerRank, setPlayerRank] = useState(0);
  const isSubmittingRef = useRef(false);

  const t = TRANSLATIONS[language];

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch('/api.php?game=2048');
      const data = await res.json();
      const records = Array.isArray(data) ? data : [];
      setLeaderboard(records);
      localStorage.setItem('records_2048', JSON.stringify(records));
    } catch (e) {
      const localData = localStorage.getItem('records_2048');
      if (localData) {
        try {
          setLeaderboard(JSON.parse(localData));
        } catch (err) {}
      }
    }
  }, []);

  useEffect(() => {
    setPlayerName(globalPlayerName);
  }, [globalPlayerName]);

  useEffect(() => {
    setLanguage(propLanguage);
  }, [propLanguage]);

  const initializeGame = useCallback(() => {
    let newGrid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    newGrid = addRandomTile(addRandomTile(newGrid));
    setGrid(newGrid);
    setScore(0);
    setGameOver(false);
    setHasSubmitted(false);
    setShowNameInput(false);
    isSubmittingRef.current = false;
  }, []);

  useEffect(() => {
    fetchRecords();
    initializeGame();
  }, [fetchRecords, initializeGame]);

  useEffect(() => {
    if (gameOver && !hasSubmitted) {
      let rank = 1;
      const sorted = [...leaderboard].sort((a,b) => b.score - a.score);
      for (const r of sorted) {
        if (score > r.score) break;
        rank++;
      }
      const isTop10Eligible = score > 0 && rank <= 10;
      if (isTop10Eligible) {
        setHasSubmitted(true);
        setPlayerRank(rank);
        if (globalPlayerName && globalPlayerName.trim()) {
          setPlayerName(globalPlayerName);
          setShowNameInput(true);
          
          if (!isSubmittingRef.current) {
             isSubmittingRef.current = true;
             setTimeout(() => submitScoreInternal(globalPlayerName, score), 100);
          }
        } else {
          setShowNameInput(true);
        }
      }
    }
  }, [gameOver, score, leaderboard, globalPlayerName, hasSubmitted]);

  const addRandomTile = (currentGrid: Grid) => {
    const emptyTiles = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (currentGrid[r][c] === 0) emptyTiles.push({ r, c });
      }
    }
    if (emptyTiles.length === 0) return currentGrid;
    const { r, c } = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
    const newGrid = currentGrid.map(row => [...row]);
    newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
    return newGrid;
  };

  const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameOver || showNameInput) return;

    let newGrid = grid.map(row => [...row]);
    let moved = false;
    let newScore = score;

    const rotateGrid = (g: Grid) => {
      const res = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          res[c][GRID_SIZE - 1 - r] = g[r][c];
        }
      }
      return res;
    };

    // Normalize direction to "left"
    let rotations = 0;
    if (direction === 'up') rotations = 1;
    else if (direction === 'right') rotations = 2;
    else if (direction === 'down') rotations = 3;

    for (let i = 0; i < rotations; i++) newGrid = rotateGrid(newGrid);

    // Slide and merge left
    for (let r = 0; r < GRID_SIZE; r++) {
      let row = newGrid[r].filter(val => val !== 0);
      for (let i = 0; i < row.length - 1; i++) {
        if (row[i] === row[i + 1]) {
          row[i] *= 2;
          newScore += row[i];
          row.splice(i + 1, 1);
          moved = true;
        }
      }
      const newRow = row.concat(Array(GRID_SIZE - row.length).fill(0));
      if (newRow.join(',') !== newGrid[r].join(',')) moved = true;
      newGrid[r] = newRow;
    }

    // Rotate back
    for (let i = 0; i < (4 - rotations) % 4; i++) newGrid = rotateGrid(newGrid);

    if (moved) {
      const gridWithNewTile = addRandomTile(newGrid);
      setGrid(gridWithNewTile);
      setScore(newScore);

      // Check game over
      if (isGameOver(gridWithNewTile)) {
        setGameOver(true);
      }
    }
  }, [grid, score, leaderboard, gameOver, showNameInput, globalPlayerName]);

  const isGameOver = (g: Grid) => {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (g[r][c] === 0) return false;
        if (c < GRID_SIZE - 1 && g[r][c] === g[r][c + 1]) return false;
        if (r < GRID_SIZE - 1 && g[r][c] === g[r + 1][c]) return false;
      }
    }
    return true;
  };

  const touchStart = useRef<{ x: number, y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 30) {
      if (absX > absY) move(dx > 0 ? 'right' : 'left');
      else move(dy > 0 ? 'down' : 'up');
    }
    touchStart.current = null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const activeSection = document.querySelector('.section.active');
        if (activeSection && activeSection.id === 'section8') {
          e.preventDefault();
          e.stopPropagation();
          if (e.key === 'ArrowUp') move('up');
          else if (e.key === 'ArrowDown') move('down');
          else if (e.key === 'ArrowLeft') move('left');
          else if (e.key === 'ArrowRight') move('right');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [move]);

  const submitScoreInternal = async (name: string, finalScore: number) => {
    if (!name.trim()) return;
    onUpdateName(name);

    // Local fallback for static hosting
    const localKey = 'records_2048';
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
    
    const updatedRecords = [...currentRecords, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    setLeaderboard(updatedRecords);
    localStorage.setItem(localKey, JSON.stringify(updatedRecords));

    try {
      const res = await fetch('/api.php?game=2048', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score: finalScore })
      });
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.records);
        localStorage.setItem(localKey, JSON.stringify(data.records));
      }
    } catch (e) {
      console.log("PHP API not found or server offline - using local records");
    }
  };

  const submitScore = async () => {
    if (!playerName.trim() || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    await submitScoreInternal(playerName, score);
    setShowNameInput(false);
  };

  const bestScore = leaderboard.length > 0 ? leaderboard[0].score : 0;

  const getTileColor = (val: number) => {
    const colors: Record<number, string> = {
      2: 'bg-[#eee4da] text-[#776e65]',
      4: 'bg-[#ede0c8] text-[#776e65]',
      8: 'bg-[#f2b179] text-white',
      16: 'bg-[#f59563] text-white',
      32: 'bg-[#f67c5f] text-white',
      64: 'bg-[#f65e3b] text-white',
      128: 'bg-[#edcf72] text-white',
      256: 'bg-[#edcc61] text-white',
      512: 'bg-[#edc850] text-white',
      1024: 'bg-[#edc53f] text-white',
      2048: 'bg-[#edc22e] text-white',
    };
    return colors[val] || 'bg-[#3c3a32] text-white';
  };

  return (
    <div className="w-full max-w-[500px] mx-auto bg-white rounded-[30px] p-5 sm:p-8 shadow-[0_10px_50px_rgba(0,0,0,0.05)] font-sans selection:bg-transparent text-slate-800">
      <div className="flex flex-col gap-6">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-2">
           <h2 className="text-2xl font-black tracking-tighter uppercase text-slate-800 italic">2048</h2>
           <div className="flex gap-2">
              <button
                onClick={() => setShowLeaderboard(!showLeaderboard)}
                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-emerald-500 border border-slate-100 hover:bg-emerald-50 transition-all shadow-sm"
              >
                <Trophy size={18} />
              </button>
              <button
                onClick={initializeGame}
                className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white hover:bg-emerald-600 transition-all shadow-md shadow-emerald-100"
              >
                <RotateCcw size={18} />
              </button>
           </div>
        </div>

        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">{t.scoreTitle}</span>
            <div className="bg-slate-900 text-emerald-500 font-mono text-xl px-4 py-1 rounded shadow-inner min-w-[80px] text-center">
              {score}
            </div>
          </div>
          <div className="w-px h-8 bg-slate-200"></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">{t.highScoreLabel}</span>
            <div className="bg-slate-900 text-emerald-400 font-mono text-xl px-4 py-1 rounded shadow-inner min-w-[80px] text-center">
              {bestScore}
            </div>
          </div>
        </div>

        {/* Grid Section */}
        <div 
          className="bg-slate-200 p-2 sm:p-3 rounded-2xl relative aspect-square shadow-inner border border-slate-300/50 touch-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="grid grid-cols-4 gap-2 sm:gap-3 h-full w-full">
            {grid.map((row, r) => (
              row.map((val, c) => (
                <div
                  key={`${r}-${c}`}
                  className="bg-white/40 rounded-lg relative"
                >
                  <AnimatePresence>
                    {val !== 0 && (
                      <motion.div
                        key="tile"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className={`absolute inset-0 flex items-center justify-center rounded-lg font-black text-xl sm:text-2xl shadow-sm ${getTileColor(val)}`}
                      >
                        {val}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            ))}
          </div>

          <AnimatePresence>
            {(gameOver || showNameInput) && (
            <div className="fixed inset-0 z-[9900] flex items-center justify-center bg-slate-900/60 backdrop-blur-md pointer-events-auto p-4">
               <motion.div initial={{ scale: 0.9, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative bg-white rounded-[32px] border border-slate-100 flex flex-col min-w-[280px] w-full max-w-sm shadow-2xl overflow-hidden">
                  <div className="p-5 sm:p-8 text-center bg-gradient-to-br from-red-500 to-orange-600">
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-widest leading-none drop-shadow-md">
                      {t.gameOver}
                    </h3>
                  </div>
                  <div className="p-6 sm:p-8 text-center bg-white">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.yourScore}</p>
                    <p className="text-5xl font-black text-slate-800 mb-8">{score}</p>
                    
                    {showNameInput ? (
                      <div className="space-y-4">
                        {playerRank === 1 ? (
                          <div className="text-red-500 font-bold mb-4 text-xs sm:text-sm uppercase tracking-widest py-2 bg-red-50 rounded-xl">🏆 {t.newRecord} 🏆</div>
                        ) : playerRank <= 10 && playerRank > 0 ? (
                          <div className="text-red-500 font-bold mb-4 text-xs sm:text-sm uppercase tracking-widest py-2 bg-red-50 rounded-xl">🎉 {t.topRank.replace('{rank}', String(playerRank))} 🎉</div>
                        ) : null}
                        
                        {!globalPlayerName ? (
                          <div className="flex flex-col gap-3">
                            <input 
                              type="text" 
                              value={playerName}
                              onChange={e => setPlayerName(e.target.value)}
                              placeholder={t.enterNamePlaceholder}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-slate-800 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 text-center font-bold text-lg"
                              maxLength={15}
                              autoFocus
                              onKeyDown={e => {
                                 if (e.key === 'Enter') submitScore();
                              }}
                            />
                            <button 
                              onClick={submitScore}
                              disabled={!playerName.trim()}
                              className="w-full py-4 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-xl font-black disabled:opacity-50 transition-all shadow-lg shadow-red-200 uppercase tracking-widest text-sm"
                            >
                              {t.saveRecord}
                            </button>
                            <button 
                              onClick={() => {
                                setShowNameInput(false);
                                setGameOver(false);
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
                                setGameOver(false);
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
                        <button onClick={initializeGame} className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-orange-600 text-white font-black text-sm shadow-lg shadow-red-200 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest">
                          {t.restart}
                        </button>
                        <button 
                          onClick={() => setGameOver(false)}
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
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>

                <div className="flex flex-col mb-6 shrink-0">
                   <h3 className="text-3xl font-black uppercase tracking-tight text-slate-800 italic">Top 10</h3>
                   <p className="text-slate-400 text-xs font-bold tracking-widest mt-1">{t.game2048Subtitle}</p>
                </div>
                
                <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 italic text-sm font-medium">{t.noRecords}</div>
                  ) : (
                    leaderboard.slice(0, 10).map((entry, index) => (
                      <div key={index} className={`flex justify-between items-center p-3 sm:p-4 rounded-xl sm:rounded-2xl ${index === 0 ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-white text-orange-600' : index < 3 ? 'bg-slate-200 text-slate-700' : 'text-slate-400'}`}>
                            {index + 1}
                          </div>
                          <span className="font-bold text-sm sm:text-base truncate max-w-[120px] sm:max-w-[150px]">{entry.name}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={`font-mono font-black text-lg sm:text-xl leading-none ${index === 0 ? 'text-white' : 'text-orange-500'}`}>{entry.score}</span>
                          <span className={`text-[8px] sm:text-[9px] uppercase tracking-widest font-bold mt-1 ${index === 0 ? 'text-orange-200' : 'text-slate-400'}`}>
                            {t.scoreTitle} - {entry.date ? new Date(entry.date).toLocaleDateString('vi-VN') : ''}
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
        </div>

        <p className="text-slate-300 text-center text-[10px] font-bold uppercase tracking-[0.3em]">
          {t.game2048Instructions}
        </p>
      </div>
    </div>
  );
};

export default Game2048;
