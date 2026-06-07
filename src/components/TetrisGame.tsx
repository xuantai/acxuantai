import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Pause, Play, Skull, Eye } from 'lucide-react';
import { Language } from '../game/types';
import { TRANSLATIONS } from '../game/constants';

const COLS = 10;
const ROWS = 20;

type Piece = {
  shape: number[][];
  color: string;
};

const PIECES: Piece[] = [
  { shape: [[1, 1, 1, 1]], color: 'bg-cyan-400' }, // I
  { shape: [[1, 1], [1, 1]], color: 'bg-yellow-400' }, // O
  { shape: [[0, 1, 0], [1, 1, 1]], color: 'bg-purple-500' }, // T
  { shape: [[1, 0, 0], [1, 1, 1]], color: 'bg-blue-600' }, // L
  { shape: [[0, 0, 1], [1, 1, 1]], color: 'bg-orange-500' }, // J
  { shape: [[1, 1, 0], [0, 1, 1]], color: 'bg-green-500' }, // S
  { shape: [[0, 1, 1], [1, 1, 0]], color: 'bg-red-500' }, // Z
];

interface RecordEntry {
  score: number;
  name: string;
  date: string;
}

interface TetrisGameProps {
  globalPlayerName: string;
  onUpdateName: (name: string) => void;
  language: Language;
}

const TetrisGame: React.FC<TetrisGameProps> = ({ globalPlayerName, onUpdateName, language: propLanguage }) => {
  const [language, setLanguage] = useState<Language>(propLanguage);
  const [board, setBoard] = useState<(string | null)[][]>(
    Array(ROWS).fill(null).map(() => Array(COLS).fill(null))
  );
  const [currentPiece, setCurrentPiece] = useState<{
    pos: { x: number; y: number };
    piece: Piece;
  } | null>(null);
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<RecordEntry[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [playerName, setPlayerName] = useState(globalPlayerName);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [playerRank, setPlayerRank] = useState(0);
  const isSubmittingRef = useRef(false);
  
  const t = TRANSLATIONS[language];
  
  const gameLoopRef = useRef<number | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch('/api.php?game=tetris');
      const data = await res.json();
      const records = Array.isArray(data) ? data : [];
      setLeaderboard(records);
      localStorage.setItem('records_tetris', JSON.stringify(records));
    } catch (e) {
      const localData = localStorage.getItem('records_tetris');
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

  const spawnPiece = useCallback(() => {
    const piece = PIECES[Math.floor(Math.random() * PIECES.length)];
    const pos = { x: Math.floor(COLS / 2) - Math.floor(piece.shape[0].length / 2), y: 0 };
    
    if (checkCollision(pos, piece.shape, board)) {
      setGameOver(true);
      return null;
    }
    return { pos, piece };
  }, [board]);

  const initializeGame = useCallback(() => {
    setBoard(Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
    setScore(0);
    setGameOver(false);
    setHasSubmitted(false);
    setIsPaused(false);
    setShowNameInput(false);
    isSubmittingRef.current = false;
    const first = PIECES[Math.floor(Math.random() * PIECES.length)];
    setCurrentPiece({
      pos: { x: Math.floor(COLS / 2) - Math.floor(first.shape[0].length / 2), y: 0 },
      piece: first
    });
  }, []);

  useEffect(() => {
    fetchRecords();
    initializeGame();
  }, [fetchRecords, initializeGame]);

  const checkCollision = (pos: { x: number; y: number }, shape: number[][], currentBoard: (string | null)[][]) => {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const newX = pos.x + x;
          const newY = pos.y + y;
          if (
            newX < 0 || newX >= COLS ||
            newY >= ROWS ||
            (newY >= 0 && currentBoard[newY][newX])
          ) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const rotate = (shape: number[][]) => {
    return shape[0].map((_, index) => shape.map(row => row[index]).reverse());
  };

  const move = useCallback((dx: number, dy: number) => {
    if (!currentPiece || gameOver || isPaused || showNameInput) return;

    if (!checkCollision({ x: currentPiece.pos.x + dx, y: currentPiece.pos.y + dy }, currentPiece.piece.shape, board)) {
      setCurrentPiece(prev => prev ? { ...prev, pos: { x: prev.pos.x + dx, y: prev.pos.y + dy } } : null);
      return true;
    }
    return false;
  }, [currentPiece, board, gameOver, isPaused, showNameInput]);

  const rotatePiece = useCallback(() => {
    if (!currentPiece || gameOver || isPaused || showNameInput) return;
    const newShape = rotate(currentPiece.piece.shape);
    if (!checkCollision(currentPiece.pos, newShape, board)) {
      setCurrentPiece(prev => prev ? { ...prev, piece: { ...prev.piece, shape: newShape } } : null);
    }
  }, [currentPiece, board, gameOver, isPaused, showNameInput]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || gameOver || isPaused || showNameInput) return;
    
    let dy = 0;
    while (!checkCollision({ x: currentPiece.pos.x, y: currentPiece.pos.y + dy + 1 }, currentPiece.piece.shape, board)) {
      dy++;
    }
    
    if (dy > 0) {
      const finalPos = { x: currentPiece.pos.x, y: currentPiece.pos.y + dy };
      // Update position to the bottom immediately
      setCurrentPiece(prev => prev ? { ...prev, pos: finalPos } : null);
      
      // We need to wait for state update or use callback?
      // Actually, we can just perform the "land" logic here for better UX
      const newBoard = board.map(row => [...row]);
      currentPiece.piece.shape.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val) {
            const boardY = finalPos.y + y;
            if (boardY >= 0) {
              newBoard[boardY][finalPos.x + x] = currentPiece.piece.color;
            }
          }
        });
      });

      // Clear lines logic (duplicated from drop for simplicity or extracted)
      let linesCleared = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (newBoard[y].every(cell => cell !== null)) {
          newBoard.splice(y, 1);
          newBoard.unshift(Array(COLS).fill(null));
          linesCleared++;
          y++;
        }
      }

      if (linesCleared > 0) {
        setScore(prev => prev + (linesCleared === 1 ? 100 : linesCleared === 2 ? 300 : linesCleared === 3 ? 500 : 800));
      }

      setBoard(newBoard);
      const next = spawnPiece();
      if (next) {
        setCurrentPiece(next);
      } else {
        setGameOver(true);
      }
    }
  }, [currentPiece, board, spawnPiece, gameOver, isPaused, showNameInput]);

  const drop = useCallback(() => {
    if (!currentPiece || gameOver || isPaused || showNameInput) return;

    if (!move(0, 1)) {
      // Land
      const newBoard = board.map(row => [...row]);
      currentPiece.piece.shape.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val) {
            const boardY = currentPiece.pos.y + y;
            if (boardY >= 0) {
              newBoard[boardY][currentPiece.pos.x + x] = currentPiece.piece.color;
            }
          }
        });
      });

      // Clear lines
      let linesCleared = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (newBoard[y].every(cell => cell !== null)) {
          newBoard.splice(y, 1);
          newBoard.unshift(Array(COLS).fill(null));
          linesCleared++;
          y++; // Check the same row again
        }
      }

      if (linesCleared > 0) {
        setScore(prev => prev + (linesCleared === 1 ? 100 : linesCleared === 2 ? 300 : linesCleared === 3 ? 500 : 800));
      }

      setBoard(newBoard);
      const next = spawnPiece();
      if (next) {
        setCurrentPiece(next);
      } else {
        setGameOver(true);
      }
    }
  }, [currentPiece, board, move, spawnPiece, gameOver, isPaused, showNameInput]);

  useEffect(() => {
    if (!gameOver && !isPaused && !showNameInput) {
      gameLoopRef.current = window.setInterval(drop, Math.max(100, 800 - (Math.floor(score / 500) * 100)));
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [drop, gameOver, isPaused, score, showNameInput]);

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

    if (Math.max(absX, absY) > 20) {
      if (absY > absX && dy > 20) drop(); // Swipe down to drop
      else if (absX > absY) {
        if (dx > 20) move(1, 0); // Swipe right
        else if (dx < -20) move(-1, 0); // Swipe left
      } else if (absY > absX && dy < -20) rotatePiece(); // Swipe up to rotate
    }
    touchStart.current = null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        const activeSection = document.querySelector('.section.active');
        if (activeSection && activeSection.id === 'section9') {
          e.preventDefault();
          e.stopPropagation();
          if (e.key === 'ArrowLeft') move(-1, 0);
          else if (e.key === 'ArrowRight') move(1, 0);
          else if (e.key === 'ArrowDown') drop();
          else if (e.key === 'ArrowUp') rotatePiece();
          else if (e.key === ' ') {
            hardDrop();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [move, drop, rotatePiece]);

  const submitScoreInternal = async (name: string, finalScore: number) => {
    if (!name.trim() || finalScore <= 0) return;
    onUpdateName(name);

    // Local fallback for static hosting
    const localKey = 'records_tetris';
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
      const res = await fetch('/api.php?game=tetris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score: finalScore })
      });
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.records);
        localStorage.setItem(localKey, JSON.stringify(data.records));
      }
    } catch (e) {}
  };

  const submitScore = async () => {
    if (!playerName.trim() || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    await submitScoreInternal(playerName, score);
    setShowNameInput(false);
  };

  const bestScore = leaderboard.length > 0 ? leaderboard[0].score : 0;

  const renderBoard = () => {
    const displayBoard = board.map(row => [...row]);
    if (currentPiece) {
      currentPiece.piece.shape.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val) {
            const boardY = currentPiece.pos.y + y;
            const boardX = currentPiece.pos.x + x;
            if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
              displayBoard[boardY][boardX] = currentPiece.piece.color;
            }
          }
        });
      });
    }

    return displayBoard.map((row, y) => (
      row.map((color, x) => (
        <div
          key={`${y}-${x}`}
          className={`w-full aspect-square border-[0.5px] border-slate-100/50 ${color || 'bg-white'}`}
        />
      ))
    ));
  };

  return (
    <div className="w-full max-w-[400px] mx-auto bg-white rounded-[30px] p-5 sm:p-6 shadow-[0_10px_50px_rgba(0,0,0,0.05)] font-sans text-slate-800">
      <div className="flex flex-col gap-4">
        {/* Stats Section with Buttons Embedded */}
        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 gap-2">
          <div className="flex flex-col flex-1 items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.scoreTitle}</span>
            <div className="bg-slate-900 text-emerald-500 font-mono text-lg px-2 py-1 rounded shadow-inner w-full text-center">
              {score}
            </div>
          </div>
          
          <div className="flex gap-1.5 items-center justify-center pt-4">
            <button
               onClick={() => setShowLeaderboard(true)}
               className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-emerald-500 border border-slate-100 hover:bg-emerald-50 transition-all shadow-sm"
             >
               <Trophy size={14} />
             </button>
             <button
               onClick={() => setIsPaused(p => !p)}
               className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 ${
                 isPaused ? 'bg-amber-500 text-white border-amber-400' : 'bg-white text-slate-400 border-slate-100'
               }`}
             >
               {isPaused ? <Play size={14} /> : <Pause size={14} />}
             </button>
             <button
                onClick={initializeGame}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white hover:brightness-110 transition-all shadow-md shadow-emerald-100"
              >
                <RotateCcw size={14} />
              </button>
          </div>

          <div className="flex flex-col flex-1 items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.highScoreLabel}</span>
            <div className="bg-slate-900 text-emerald-400 font-mono text-lg px-2 py-1 rounded shadow-inner w-full text-center">
              {bestScore}
            </div>
          </div>
        </div>

        {/* Board Section */}
        <div 
          className="relative border-4 border-slate-100 bg-slate-900/5 rounded-2xl overflow-hidden shadow-inner mx-auto touch-none pointer-events-auto" 
          style={{ width: 'min(100%, 220px)', height: '440px' }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleTouchStart(e as unknown as React.TouchEvent);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleTouchEnd(e as unknown as React.TouchEvent);
          }}
        >
          <div className="grid grid-cols-10 grid-rows-20 w-full h-full gap-[1px] bg-slate-200">
            {renderBoard()}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {(gameOver || showNameInput) && (
            <div className="fixed inset-0 z-[9900] flex items-center justify-center bg-slate-900/60 backdrop-blur-md pointer-events-auto p-4">
               <motion.div initial={{ scale: 0.9, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative bg-white rounded-[32px] border border-slate-100 flex flex-col min-w-[280px] w-full max-w-sm shadow-2xl overflow-hidden">
                  <div className="p-5 sm:p-8 text-center bg-gradient-to-br from-violet-500 to-indigo-600">
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-widest leading-none drop-shadow-md">
                      {t.gameOver}
                    </h3>
                  </div>
                  <div className="p-6 sm:p-8 text-center bg-white flex flex-col items-center">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.yourScore}</p>
                    <p className="text-5xl font-black text-slate-800 mb-8">{score}</p>
                    
                    {showNameInput && score > 0 && (leaderboard.length < 10 || score > (leaderboard[9]?.score || 0)) && !globalPlayerName && !hasSubmitted ? (
                      <div className="w-full space-y-4 mb-6">
                        {playerRank === 1 ? (
                          <div className="text-violet-500 font-bold text-xs sm:text-sm uppercase tracking-widest py-2 bg-violet-50 rounded-xl">🏆 {t.newRecord} 🏆</div>
                        ) : playerRank <= 10 && playerRank > 0 ? (
                          <div className="text-violet-500 font-bold text-xs sm:text-sm uppercase tracking-widest py-2 bg-violet-50 rounded-xl">🎉 {t.topRank.replace('{rank}', String(playerRank))} 🎉</div>
                        ) : null}
                        
                        <input 
                          type="text" 
                          value={playerName}
                          onChange={e => setPlayerName(e.target.value)}
                          placeholder={t.enterNamePlaceholder}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-slate-800 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 text-center font-bold text-lg"
                          maxLength={15}
                          autoFocus
                          onKeyDown={e => {
                              if (e.key === 'Enter' && playerName.trim()) submitScore();
                          }}
                        />
                        <button 
                          onClick={submitScore}
                          disabled={!playerName.trim()}
                          className="w-full py-4 bg-gradient-to-r from-violet-500 to-indigo-600 text-white rounded-xl font-black disabled:opacity-50 transition-all shadow-lg shadow-violet-200 uppercase tracking-widest text-sm"
                        >
                          {t.saveRecord}
                        </button>
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-3 w-full">
                      <button 
                        onClick={initializeGame} 
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-black text-sm shadow-lg shadow-violet-200 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                      >
                        {t.restart}
                      </button>
                      {(hasSubmitted || globalPlayerName) && (
                        <button 
                          onClick={() => {
                            setShowNameInput(false);
                            setGameOver(false);
                            setShowLeaderboard(true);
                          }}
                          className="w-full py-4 bg-gradient-to-r from-emerald-400 to-teal-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-emerald-200 uppercase tracking-widest text-sm hover:scale-105 active:scale-95"
                        >
                          {t.seeLeaderboard}
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          setGameOver(false);
                          setShowNameInput(false);
                        }}
                        className="w-full py-4 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 text-xs tracking-widest uppercase font-black transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        <Eye size={14} /> {t.viewBoard}
                      </button>
                    </div>
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
                   <p className="text-slate-400 text-xs font-bold tracking-widest mt-1">{t.colorTetris}</p>
                </div>
                
                <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 italic text-sm font-medium">{t.noRecords}</div>
                  ) : (
                    leaderboard.slice(0, 10).map((entry, index) => (
                      <div key={index} className={`flex justify-between items-center p-3 sm:p-4 rounded-xl sm:rounded-2xl ${index === 0 ? 'bg-violet-500 text-white shadow-lg shadow-violet-200' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-white text-violet-600' : index < 3 ? 'bg-slate-200 text-slate-700' : 'text-slate-400'}`}>
                            {index + 1}
                          </div>
                          <span className="font-bold text-sm sm:text-base truncate max-w-[120px] sm:max-w-[150px]">{entry.name}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={`font-mono font-black text-lg sm:text-xl leading-none ${index === 0 ? 'text-white' : 'text-violet-500'}`}>{entry.score}</span>
                          <span className={`text-[8px] sm:text-[9px] uppercase tracking-widest font-bold mt-1 ${index === 0 ? 'text-violet-200' : 'text-slate-400'}`}>
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

          {/* Game Controls */}
          <div className="flex flex-col items-center gap-6 mt-6">
            <div className="flex gap-2 p-3 bg-slate-50/50 rounded-3xl border border-slate-100 shadow-inner">
              <button
                onClick={() => move(-1, 0)}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm active:scale-90 transition-all font-bold text-2xl"
              >
                ←
              </button>
              <button
                onClick={() => drop()}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm active:scale-90 transition-all font-bold text-2xl"
              >
                ↓
              </button>
              <button
                onClick={() => move(1, 0)}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm active:scale-90 transition-all font-bold text-2xl"
              >
                →
              </button>
              <button
                onClick={() => rotatePiece()}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-400 text-white flex items-center justify-center shadow-lg shadow-amber-100 active:scale-90 transition-all font-bold text-2xl"
              >
                ↑
              </button>
              <button
                onClick={() => hardDrop()}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-100 active:scale-90 transition-all font-black text-2xl ml-2"
              >
                ⤓
              </button>
            </div>

            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center opacity-70">
              {t.tetrisInstructions}
            </div>
          </div>
      </div>
    </div>
  );
};

export default TetrisGame;
