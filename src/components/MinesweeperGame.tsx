import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flag, Bomb, RotateCcw, Timer, Trophy, Skull, User, Globe, Pause, Play, X, Maximize2 } from 'lucide-react';
import { Difficulty, GameSettings, CellState, CellData, GameStatus, Language } from '../game/types';
import { DIFFICULTY_SETTINGS, TRANSLATIONS } from '../game/constants';

interface RecordEntry {
  score: number;
  name: string;
  date: string;
  id?: string;
}

interface MinesweeperGameProps {
  globalPlayerName: string;
  onUpdateName: (name: string) => void;
  language: Language;
}

const MinesweeperGame: React.FC<MinesweeperGameProps> = ({ globalPlayerName, onUpdateName, language: propLanguage }) => {
  const [language, setLanguage] = useState<Language>(propLanguage);
  const [playerName, setPlayerName] = useState<string>(globalPlayerName);
  const [tempName, setTempName] = useState<string>(globalPlayerName);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [showWelcome, setShowWelcome] = useState<boolean>(!globalPlayerName);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.BEGINNER);
  const [settings, setSettings] = useState<GameSettings>(DIFFICULTY_SETTINGS[Difficulty.BEGINNER]);
  const [grid, setGrid] = useState<CellData[][]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [minesCount, setMinesCount] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(1);
  const [cumulativeScore, setCumulativeScore] = useState(0);
  const [lastLevelScore, setLastLevelScore] = useState(0);
  const [losingCell, setLosingCell] = useState<{r: number, c: number} | null>(null);
  const [showCustomSettings, setShowCustomSettings] = useState(false);
  const [customInputs, setCustomInputs] = useState({ rows: 20, cols: 20, mines: 50 });
  const [leaderboard, setLeaderboard] = useState<RecordEntry[]>([]);
  const [showNameInput, setShowNameInput] = useState(false);
  const [isFlagMode, setIsFlagMode] = useState(false);

  const [isPaused, setIsPaused] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const isSubmittingRef = useRef(false);

  const bestScore = leaderboard.length > 0 ? Math.max(...leaderboard.map(r => r.score)) : 0;
  const score = cumulativeScore + grid.flat().filter(c => c.state === CellState.REVEALED && !c.isMine).length * (difficulty === Difficulty.BEGINNER ? 10 : (difficulty === Difficulty.INTERMEDIATE ? 20 : 50));
  const [levelUpScore, setLevelUpScore] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Prevent arrow key scrolling globally when focused on game
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        const activeSection = document.querySelector('.section.active');
        if (activeSection && ['section7', 'section8', 'section9'].includes(activeSection.id)) {
          if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
            // Prevent only the default scroll behavior
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);

  const t = TRANSLATIONS[language];

  const fetchRecords = useCallback(async () => {
    const gameId = `minesweeper_${difficulty.toLowerCase()}`;
    try {
      const res = await fetch(`/api.php?game=${gameId}`);
      const data = await res.json();
      const records = Array.isArray(data) ? data : [];
      setLeaderboard(records);
      // Also save to local storage as fallback
      localStorage.setItem(`records_${gameId}`, JSON.stringify(records));
    } catch (e) {
      // Fallback to local storage
      const localData = localStorage.getItem(`records_${gameId}`);
      if (localData) {
        try {
          setLeaderboard(JSON.parse(localData));
        } catch (err) {}
      }
    }
  }, [difficulty]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    setPlayerName(globalPlayerName);
    setTempName(globalPlayerName);
    if (globalPlayerName) setShowWelcome(false);
  }, [globalPlayerName]);

  useEffect(() => {
    setLanguage(propLanguage);
  }, [propLanguage]);

  const saveScore = async (finalScore: number) => {
    if (hasSubmitted || finalScore <= 0) return;
    
    // Only save if player actually did something (score > 0)
    const isTop10Eligible = finalScore > 0 && (leaderboard.length < 10 || finalScore > Math.min(...leaderboard.map(r => r.score)));
    
    if (isTop10Eligible) {
      setHasSubmitted(true);
      if (globalPlayerName && globalPlayerName.trim()) {
        // Auto-save if name exists
        setPlayerName(globalPlayerName);
        if (!isSubmittingRef.current) {
           isSubmittingRef.current = true;
           setTimeout(() => submitScoreInternal(globalPlayerName, finalScore), 100);
        }
      }
    }
  };

  const submitScoreInternal = async (name: string, finalScore: number) => {
    if (!name.trim() || finalScore <= 0) return;
    onUpdateName(name);
    const gameId = `minesweeper_${difficulty.toLowerCase()}`;
    
    // Optimistically update local records first
    const localKey = `records_${gameId}`;
    let currentRecords: RecordEntry[] = [];
    try {
      const localData = localStorage.getItem(localKey);
      currentRecords = localData ? JSON.parse(localData) : [];
    } catch (e) {}

    const newEntry: RecordEntry = { 
      score: finalScore, 
      name, 
      date: new Date().toISOString(),
      id: Math.random().toString(36).substr(2, 9)
    };
    
    const updatedRecords = [...currentRecords, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    setLeaderboard(updatedRecords);
    localStorage.setItem(localKey, JSON.stringify(updatedRecords));

    try {
      const res = await fetch(`/api.php?game=${gameId}`, {
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
      console.log("PHP API not found or server offline - using local records");
    }
  };

  const submitScore = async () => {
    if (!playerName.trim() || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    await submitScoreInternal(playerName, score);
    setShowNameInput(false);
  };

  const handleStartGame = () => {
    if (tempName.trim()) {
      onUpdateName(tempName);
      setShowWelcome(false);
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === Language.VI ? Language.EN : Language.VI);
  };

  const applyCustomSettings = () => {
    const newSettings = {
      rows: Math.min(Math.max(customInputs.rows, 5), 50),
      cols: Math.min(Math.max(customInputs.cols, 5), 50),
      mines: Math.min(Math.max(customInputs.mines, 1), (customInputs.rows * customInputs.cols) - 10)
    };
    setSettings(newSettings);
    setDifficulty(Difficulty.CUSTOM);
    setShowCustomSettings(false);
  };

  const initGrid = useCallback((s: GameSettings, keepScore: boolean = false, targetLevel?: number) => {
    const activeLevel = targetLevel !== undefined ? targetLevel : level;
    const newGrid: CellData[][] = [];
    for (let r = 0; r < s.rows; r++) {
      const row: CellData[] = [];
      for (let c = 0; c < s.cols; c++) {
        row.push({
          r,
          c,
          isMine: false,
          state: CellState.HIDDEN,
          neighborMines: 0,
        });
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
    setGameStatus(GameStatus.IDLE);
    // Increase difficulty slightly per level
    const extraMines = Math.floor((activeLevel - 1) * (s.mines * 0.1));
    setMinesCount(s.mines + extraMines);
    setSeconds(0);
    setLosingCell(null);
    if (!keepScore) {
      setCumulativeScore(0);
      setLevel(1);
      setLastLevelScore(0);
      setHasSubmitted(false);
      isSubmittingRef.current = false;
    }
    // Clear and restart timer sync
    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }
  }, [level]);

  // Handle initial load or difficulty change
  useEffect(() => {
    initGrid(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    if (gameStatus === GameStatus.PLAYING && !isPaused) {
      timerRef.current = setInterval(() => {
        setSeconds(s => Math.min(s + 1, 999));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStatus, isPaused]);

  const getNeighbors = (r: number, c: number, rows: number, cols: number) => {
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          neighbors.push({ r: nr, c: nc });
        }
      }
    }
    return neighbors;
  };

  const placeMines = (initialGrid: CellData[][], firstR: number, firstC: number) => {
    const newGrid = [...initialGrid.map(row => [...row])];
    const { rows, cols, mines } = settings;
    let placedMines = 0;

    while (placedMines < mines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);

      if ((r === firstR && c === firstC) || newGrid[r][c].isMine) continue;
      
      const dist = Math.max(Math.abs(r - firstR), Math.abs(c - firstC));
      if (dist <= 1 && mines < (rows * cols) - 9) continue;

      newGrid[r][c].isMine = true;
      placedMines++;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (newGrid[r][c].isMine) continue;
        const neighbors = getNeighbors(r, c, rows, cols);
        newGrid[r][c].neighborMines = neighbors.filter(n => newGrid[n.r][n.c].isMine).length;
      }
    }

    return newGrid;
  };

  const revealCell = (r: number, c: number) => {
    if (gameStatus === GameStatus.WON || gameStatus === GameStatus.LOST) return;

    let currentGrid = [...grid.map(row => [...row])];
    
    if (gameStatus === GameStatus.IDLE) {
      currentGrid = placeMines(currentGrid, r, c);
      setGameStatus(GameStatus.PLAYING);
    }

    if (currentGrid[r][c].state !== CellState.HIDDEN) return;

    if (currentGrid[r][c].isMine) {
      currentGrid[r][c].state = CellState.REVEALED;
      setLosingCell({ r, c });
      for (let row = 0; row < settings.rows; row++) {
        for (let col = 0; col < settings.cols; col++) {
          if (currentGrid[row][col].isMine) {
            currentGrid[row][col].state = CellState.REVEALED;
          }
        }
      }
      setGrid(currentGrid);
      setGameStatus(GameStatus.LOST);
      saveScore(score); 
      setShowGameOverModal(true);
      return;
    }

    const revealRecursive = (gridRef: CellData[][], row: number, col: number) => {
      if (gridRef[row][col].state !== CellState.HIDDEN || gridRef[row][col].isMine) return;
      
      gridRef[row][col].state = CellState.REVEALED;

      if (gridRef[row][col].neighborMines === 0) {
        const neighbors = getNeighbors(row, col, settings.rows, settings.cols);
        neighbors.forEach(n => revealRecursive(gridRef, n.r, n.c));
      }
    };

    revealRecursive(currentGrid, r, c);
    
    let hiddenNonMines = 0;
    for (let row = 0; row < settings.rows; row++) {
      for (let col = 0; col < settings.cols; col++) {
        if (!currentGrid[row][col].isMine && currentGrid[row][col].state !== CellState.REVEALED) {
          hiddenNonMines++;
        }
      }
    }

    setGrid(currentGrid);
    if (hiddenNonMines === 0) {
      setGameStatus(GameStatus.WON);
      
      // Calculate level points: based on speed
      const multiplier = (difficulty === Difficulty.BEGINNER ? 10 : (difficulty === Difficulty.INTERMEDIATE ? 20 : 50));
      const basePoints = (settings.rows * settings.cols - settings.mines) * multiplier;
      const timeBonus = Math.max(0, 1000 - seconds * 5); 
      const levelPoints = basePoints + timeBonus;
      const totalScoreAtWin = cumulativeScore + levelPoints;
      
      setLastLevelScore(levelPoints);
      const newTotal = cumulativeScore + levelPoints;
      setCumulativeScore(newTotal);
      
      // On win, we just store for potential save, but don't show "Kỷ lục mới" yet unless they die?
      // User says: "đang bị ghi nhận là vượt cấp chưa được báo kỷ lục luôn, chờ khi nào bị nổ mới báo bạn ở top mấy"
      // So on win, we don't call saveScore(totalScoreAtWin). We wait until they lose.
      
      setShowWinModal(true);
      
      const finalGrid = currentGrid.map(row => row.map(cell => 
        cell.isMine ? { ...cell, state: CellState.FLAGGED } : cell
      ));
      setGrid(finalGrid);
      setMinesCount(0);
    }
  };

  const getDifficultyLabel = (d: Difficulty) => {
    switch (d) {
      case Difficulty.BEGINNER: return language === Language.VI ? 'Dễ' : 'Easy';
      case Difficulty.INTERMEDIATE: return language === Language.VI ? 'Vừa' : 'Medium';
      case Difficulty.EXPERT: return language === Language.VI ? 'Khó' : 'Hard';
      case Difficulty.CUSTOM: return language === Language.VI ? 'Tùy chỉnh' : 'Custom';
      default: return d;
    }
  };

  const handleCellClick = (r: number, c: number) => {
    if (gameStatus === GameStatus.WON || gameStatus === GameStatus.LOST || isPaused) return;
    if (isFlagMode) {
      toggleFlagInternal(r, c);
    } else {
      revealCell(r, c);
    }
  };

  const toggleFlagInternal = (r: number, c: number) => {
    if (isPaused) return;
    if (gameStatus !== GameStatus.PLAYING && gameStatus !== GameStatus.IDLE) return;
    
    const newGrid = [...grid.map(row => [...row])];
    const cell = newGrid[r][c];

    if (cell.state === CellState.HIDDEN) {
      cell.state = CellState.FLAGGED;
      setMinesCount(m => m - 1);
    } else if (cell.state === CellState.FLAGGED) {
      cell.state = CellState.HIDDEN;
      setMinesCount(m => m + 1);
    }

    setGrid(newGrid);
  };

  const toggleFlag = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    toggleFlagInternal(r, c);
  };

  const getCellContent = (cell: CellData) => {
    if (cell.state === CellState.FLAGGED) {
      return <Flag size={14} className="text-red-500 fill-red-500" />;
    }
    if (cell.state === CellState.HIDDEN) return null;
    if (cell.isMine) return <Bomb size={16} className="text-slate-800 fill-slate-800" />;
    if (cell.neighborMines === 0) return null;
    return (
      <span className="font-black text-sm select-none" style={{ color: getNumberColor(cell.neighborMines) }}>
        {cell.neighborMines}
      </span>
    );
  };

  const getStatusSmiley = () => {
    if (gameStatus === GameStatus.WON) return '😎';
    if (gameStatus === GameStatus.LOST) return '😵';
    return '🙂';
  };

  const getNumberColor = (num: number) => {
    const colors: Record<number, string> = {
      1: '#2563eb', // Blue
      2: '#16a34a', // Green
      3: '#dc2626', // Red
      4: '#7c3aed', // Purple
      5: '#9333ea', // Deep Purple
      6: '#0891b2', // Cyan
      7: '#000000', // Black
      8: '#4b5563', // Gray
    };
    return colors[num] || 'inherit';
  };

  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);

  return (
    <div className="w-full max-w-[1200px] mx-auto font-sans text-slate-800">
      <div className="bg-white rounded-[20px] sm:rounded-[50px] p-4 sm:p-14 shadow-[0_30px_80px_rgba(0,0,0,0.06)] border border-slate-50 relative overflow-hidden">
        
        {/* Game Area Header matching screenshot */}
        <div className="flex flex-col gap-4 sm:gap-6 mb-6">
          <div className="flex justify-between items-end px-2 sm:px-4">
            <div className="flex flex-col items-center">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{t.level}</span>
               <div className="game-lcd text-2xl sm:text-3xl text-amber-500 font-bold w-16 sm:w-24 h-10 sm:h-14 flex items-center justify-center">
                  {String(level).padStart(3, '0')}
               </div>
            </div>

            <div className="flex gap-2 mb-1">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => initGrid(settings)}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center border-b-2 sm:border-b-4 border-emerald-700 shadow-sm transition-all"
                title={t.resetMission}
              >
                <RotateCcw size={18} />
              </motion.button>

              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (gameStatus === GameStatus.PLAYING) {
                    setIsPaused(!isPaused);
                  }
                }}
                disabled={gameStatus !== GameStatus.PLAYING}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all border-b-2 sm:border-b-4 ${
                  isPaused 
                    ? 'bg-amber-500 text-white border-amber-700 shadow-lg shadow-amber-100' 
                    : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-white hover:text-emerald-500 disabled:opacity-50'
                }`}
                title={isPaused ? t.resume : t.pause}
              >
                {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
              </motion.button>
            </div>

            <div className="flex flex-col items-center">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{t.seconds}</span>
               <div className="game-lcd text-2xl sm:text-3xl text-emerald-500 font-bold w-16 sm:w-24 h-10 sm:h-14 flex items-center justify-center">
                  {String(seconds).padStart(3, '0')}
               </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-3">
            {(Object.keys(DIFFICULTY_SETTINGS) as Difficulty[]).filter(d => d !== Difficulty.CUSTOM).map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDifficulty(d);
                  setSettings(DIFFICULTY_SETTINGS[d]);
                }}
                className={`px-4 sm:px-6 py-2 sm:py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${
                  difficulty === d 
                    ? 'bg-gradient-to-r from-[#10b981] to-[#3b82f6] text-white shadow-lg shadow-emerald-200/50 scale-105' 
                    : 'bg-slate-50 text-slate-400 hover:bg-gradient-to-r hover:from-[#10b981] hover:to-[#3b82f6] hover:text-white hover:shadow-lg hover:shadow-emerald-200/40 border border-slate-100'
                }`}
              >
                {d === Difficulty.BEGINNER ? t.beginner : d === Difficulty.INTERMEDIATE ? t.intermediate : t.expert}
              </button>
            ))}
            <div className="w-[1px] h-8 bg-slate-100 mx-1 hidden sm:block" />
            <div className="flex gap-1.5">
              <button
                onClick={() => setIsFlagMode(!isFlagMode)}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all border-b-2 sm:border-b-4 ${
                  isFlagMode 
                    ? 'bg-red-500 text-white border-red-700 shadow-lg shadow-red-100' 
                    : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-white hover:text-red-400 focus:outline-none'
                }`}
                title={t.flagMode}
              >
                <Flag size={18} fill={isFlagMode ? "currentColor" : "none"} />
              </button>
              <button 
                onClick={() => setShowLeaderboardModal(true)}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-emerald-500 border-b-2 sm:border-b-4 border-slate-200 hover:bg-white transition-all shadow-sm focus:outline-none"
                title={t.leaderboardTitle}
              >
                <Trophy size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-4 custom-scrollbar mb-2 relative">
           {isPaused && (
             <div className="absolute inset-0 z-20 bg-slate-100/10 backdrop-blur-[2px] flex items-center justify-center rounded-[15px] sm:rounded-[30px]">
               <motion.button
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 onClick={() => setIsPaused(false)}
                 className="bg-emerald-500 text-white px-6 py-3 rounded-full font-black shadow-xl flex items-center gap-2 hover:scale-110 transition-transform"
               >
                 <Play size={20} fill="currentColor" /> {t.resume.toUpperCase()}
               </motion.button>
             </div>
           )}
           <div 
            className="grid gap-0.5 sm:gap-1.5 p-1.5 sm:p-3 bg-slate-50/50 rounded-[15px] sm:rounded-[30px] border-b-2 sm:border-b-4 border-slate-100 shadow-inner mx-auto w-fit"
            style={{ 
              gridTemplateColumns: `repeat(${settings.cols}, min-content)`,
            }}
          >
            {grid.map((row, r) => (
              row.map((cell, c) => (
                <motion.div
                  key={`${r}-${c}`}
                  onClick={() => handleCellClick(r, c)}
                  onContextMenu={(e) => toggleFlag(e, r, c)}
                  className={`
                    min-w-[24px] min-h-[24px] sm:min-w-[32px] sm:min-h-[32px] md:min-w-[40px] md:min-h-[40px] aspect-square rounded-sm sm:rounded-lg flex items-center justify-center text-[10px] sm:text-lg md:text-xl font-black cursor-pointer transition-all flex-shrink-0
                    ${cell.state === CellState.REVEALED 
                      ? 'bg-white shadow-sm' 
                      : 'bg-gradient-to-br from-slate-50 to-slate-200 text-slate-400 hover:from-white hover:to-slate-100 shadow-sm sm:shadow-md border-b-[1px] sm:border-b-4 border-slate-300'}
                    ${cell.state === CellState.REVEALED && cell.isMine ? 'bg-red-50 !border-red-100 text-red-500' : ''}
                    ${losingCell?.r === r && losingCell?.c === c ? 'ring-2 sm:ring-4 ring-red-500 ring-offset-1 sm:ring-offset-2 !bg-red-500 !text-white z-10 animate-pulse' : ''}
                  `}
                >
                  {getCellContent(cell)}
                </motion.div>
              ))
            ))}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-2 sm:mt-4 pb-4 sm:pb-8 flex flex-col items-center">
          <div className="flex justify-between items-center w-full max-w-[280px] sm:max-w-[400px] mb-4">
            {/* Current Score */}
            <div className="flex flex-col items-start text-center">
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">{t.scoreTitle}</span>
               <div className="game-lcd text-lg sm:text-2xl text-red-500 font-bold" style={{ color: '#ef4444' }}>
                 {String(score).padStart(4, '0')}
               </div>
            </div>

            {/* Best Score (Top 1) */}
            <div className="flex flex-col items-end text-center">
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">{t.highScoreLabel}</span>
               <div className="game-lcd text-lg sm:text-2xl text-yellow-500 font-bold" style={{ color: '#facc15' }}>
                 {String(leaderboard[0]?.score || 0).padStart(4, '0')}
               </div>
            </div>
          </div>

          <div className="bg-slate-50/80 px-5 py-2 rounded-xl border border-slate-100 shadow-sm w-fit max-w-[95%] transition-all mx-auto">
            <p className="text-slate-500 text-[10px] sm:text-xs font-bold text-center">
              {language === Language.VI ? (
                <>Mẹo: Bấm <Flag size={12} className="inline-block text-red-500 fill-red-500 mx-0.5 align-text-bottom" /> để cắm cờ ô có bom.</>
              ) : (
                <>Tip: Click <Flag size={12} className="inline-block text-red-500 fill-red-500 mx-0.5 align-text-bottom" /> to flag the mine cells.</>
              )}
            </p>
          </div>
        </div>
      </div>

        {/* Result Modals */}
      <AnimatePresence>
        {showWinModal && (
          <div className="fixed inset-0 z-[9900] flex items-center justify-center bg-slate-900/60 backdrop-blur-md pointer-events-auto p-4">
             <motion.div initial={{ scale: 0.9, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative bg-white rounded-[32px] border border-slate-100 flex flex-col min-w-[280px] w-full max-w-sm shadow-2xl overflow-hidden">
                <div className="p-5 sm:p-8 text-center bg-gradient-to-br from-emerald-400 to-teal-500">
                  <div className="flex justify-center mb-4">
                    <Trophy size={40} className="animate-bounce text-white drop-shadow-md" />
                  </div>
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-widest leading-none drop-shadow-md">
                    {t.levelCompleted.replace('{level}', String(level))}
                  </h3>
                </div>
                <div className="p-6 sm:p-8 text-center bg-white flex flex-col items-center">
                  <p className="text-slate-500 font-medium mb-8">
                    {t.pointsReceived.replace('{points}', String(lastLevelScore))}
                  </p>
                  <button 
                    onClick={() => {
                      const nextLevel = level + 1;
                      setShowWinModal(false);
                      setLevel(nextLevel);
                      initGrid(settings, true, nextLevel);
                    }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-200 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                  >
                    {t.nextLevel.replace('{level}', String(level + 1))}
                  </button>
                </div>
             </motion.div>
          </div>
        )}

        {showGameOverModal && (
          <div className="fixed inset-0 z-[9900] flex items-center justify-center bg-slate-900/60 backdrop-blur-md pointer-events-auto p-4">
             <motion.div initial={{ scale: 0.9, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative bg-white rounded-[32px] border border-slate-100 flex flex-col min-w-[280px] w-full max-w-sm shadow-2xl overflow-hidden">
                <div className={`p-5 sm:p-8 text-center ${(()=>{
                   const currentScore = score;
                   const rank = [...leaderboard, { score: currentScore, name: (globalPlayerName || playerName) }].sort((a, b) => b.score - a.score).findIndex(x => x.score === currentScore && x.name === (globalPlayerName || playerName)) + 1;
                   return (rank > 0 && rank <= 10) ? 'bg-gradient-to-br from-amber-400 to-yellow-600' : 'bg-gradient-to-br from-red-500 to-orange-600';
                })()}`}>
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-widest leading-none drop-shadow-md">
                    {(() => {
                      const currentScore = score;
                      const rank = [...leaderboard, { score: currentScore, name: (globalPlayerName || playerName) }].sort((a, b) => b.score - a.score).findIndex(x => x.score === currentScore && x.name === (globalPlayerName || playerName)) + 1;
                      
                      if (rank === 1 && currentScore > (leaderboard[0]?.score || 0)) {
                        return t.newRecord;
                      } else if (rank > 0 && rank <= 10) {
                        return t.topRank.replace('{rank}', String(rank));
                      }
                      return t.gameOver;
                    })()}
                  </h3>
                </div>
                <div className="p-6 sm:p-8 text-center bg-white flex flex-col items-center">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.yourScore}</p>
                  <p className="text-5xl font-black text-slate-800 mb-2">{score}</p>
                  <p className="text-slate-500 text-xs font-medium mb-8">
                    {t.stoppedAtLevel.replace('{level}', String(level))}
                  </p>

                  {/* Integrated Name Input for Top Records if no name exists */}
                  {score > 0 && (leaderboard.length < 10 || score > (leaderboard[9]?.score || 0)) && !globalPlayerName && !hasSubmitted ? (
                    <div className="w-full space-y-4 mb-6">
                       <input 
                        type="text" 
                        value={playerName}
                        onChange={e => setPlayerName(e.target.value)}
                        placeholder={t.enterNamePlaceholder}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-center font-bold"
                        maxLength={15}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter' && playerName.trim()) submitScore();
                        }}
                      />
                      <button 
                        onClick={submitScore}
                        disabled={!playerName.trim()}
                        className="w-full py-4 bg-gradient-to-r from-amber-400 to-yellow-500 text-white rounded-xl font-black shadow-lg shadow-amber-200 uppercase tracking-widest text-sm disabled:opacity-50"
                      >
                        {t.saveRecord}
                      </button>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 w-full">
                    <button 
                      onClick={() => {
                        setShowGameOverModal(false);
                        initGrid(settings);
                      }}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-orange-600 text-white font-black text-sm shadow-lg shadow-red-200 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                    >
                      {t.restart}
                    </button>
                    {(hasSubmitted || globalPlayerName) && (
                       <button 
                        onClick={() => {
                          setShowGameOverModal(false);
                          setShowLeaderboardModal(true);
                        }}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-white font-black text-sm shadow-lg shadow-amber-200 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                      >
                        {t.seeLeaderboard}
                      </button>
                    )}
                    <button 
                      onClick={() => setShowGameOverModal(false)}
                      className="w-full py-4 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 text-xs tracking-widest uppercase font-black transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      <Maximize2 size={14} /> {t.viewBoard}
                    </button>
                  </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboardModal && (
          <motion.div 
            key="leaderboardwrapper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6"
          >
             <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-2xl relative flex flex-col max-h-[85vh]">
              
              <button 
                  onClick={() => setShowLeaderboardModal(false)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
              </button>
              
              <div className="flex flex-col mb-6 shrink-0">
                 <h3 className="text-3xl font-black uppercase tracking-tight text-slate-800 italic">Top 10</h3>
                 <p className="text-slate-400 text-xs font-bold tracking-widest mt-1">{getDifficultyLabel(difficulty)}</p>
              </div>

              <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                {leaderboard.length > 0 ? (
                  leaderboard.map((item, index) => (
                    <div key={item.id || index} className={`flex justify-between items-center p-3 sm:p-4 rounded-xl sm:rounded-2xl ${index === 0 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-white text-emerald-600' : index < 3 ? 'bg-slate-200 text-slate-700' : 'text-slate-400'}`}>
                          {index + 1}
                        </div>
                        <span className="font-bold text-sm sm:text-base truncate max-w-[120px] sm:max-w-[150px]">{item.name}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`font-mono font-black text-lg sm:text-xl leading-none ${index === 0 ? 'text-white' : 'text-emerald-500'}`}>{item.score}</span>
                        <span className={`text-[8px] sm:text-[9px] uppercase tracking-widest font-bold mt-1 ${index === 0 ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {t.scoreTitle} - {new Date(item.date).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-400 italic text-sm font-medium">{t.noRecords}</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome Screen Overlays - Localized to target container */}
      <AnimatePresence>
        {showWelcome && (
          <div key="welcomewrapper" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              key="welcomemodal"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white rounded-[40px] shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100"
            >
              {/* Identification Header */}
              <div className="bg-gradient-to-br from-[#10b981] to-[#3b82f6] p-6 text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-3 border border-white/30">
                  <User size={28} />
                </div>
                <h2 className="text-xl font-black text-white italic uppercase tracking-widest leading-none">
                   {t.identification}
                </h2>
                <p className="text-white/80 text-[10px] font-medium mt-2">{t.identificationDesc}</p>
              </div>

              <div className="p-6 pt-5">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">
                  {t.playerNameLabel}
                </label>
                <input 
                  type="text" 
                  placeholder={t.enterNamePlaceholder}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-700 font-bold focus:outline-none focus:border-emerald-400 focus:bg-white transition-all text-center text-base mb-5"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && tempName.trim() && handleStartGame()}
                />
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleStartGame}
                    disabled={!tempName.trim()}
                    className="w-full py-3.5 rounded-[16px] bg-gradient-to-r from-[#10b981] to-[#3b82f6] text-white font-black text-sm shadow-md shadow-emerald-200/50 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all uppercase tracking-widest"
                  >
                    {t.startPlaying}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default MinesweeperGame;
