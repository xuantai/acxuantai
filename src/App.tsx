/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User, UserMinus, ChevronDown, ChevronUp, Edit2, Music, Phone, Mail, Globe, Award } from 'lucide-react';
import MinesweeperGame from './components/MinesweeperGame';
import Game2048 from './components/Game2048';
import TetrisGame from './components/TetrisGame';
import PikachuGame from './components/PikachuGame';
import { Language } from './game/types';
import { TRANSLATIONS } from './game/constants';
import AdminCP from './components/AdminCP';

const STORAGE_KEY = 'acxt_global_player_name';

export default function App() {
  const [language, setLanguage] = useState<Language>(Language.VI);
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || '';
  });
  
  const [mounted, setMounted] = useState(false);
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [tempName, setTempName] = useState(playerName);
  const [isWidgetMinimized, setIsWidgetMinimized] = useState(false);

  const [isEntertainmentActive, setIsEntertainmentActive] = useState(false);
  const [adminConfig, setAdminConfig] = useState<any>(null);

  const isAdmin = window.location.pathname === '/admin' || window.location.hash === '#admin';

  useEffect(() => {
    if (isAdmin) {
      document.body.classList.add('is-admin-route');
    } else {
      document.body.classList.remove('is-admin-route');
    }
  }, [isAdmin]);

  useEffect(() => {
    fetch('/api/admin-config')
      .then(res => res.json())
      .then(data => {
        setAdminConfig(data);
        if (data.websiteTitle) {
          document.title = data.websiteTitle;
        }
        if (data.faviconUrl) {
          let fav = document.querySelector('link[rel*="icon"]') as HTMLLinkElement;
          if (fav) {
            fav.href = data.faviconUrl;
          } else {
            fav = document.createElement('link');
            fav.rel = 'shortcut icon';
            fav.href = data.faviconUrl;
            document.head.appendChild(fav);
          }
        }
      })
      .catch(err => console.log('Err loading public config in app', err));
  }, []);

  useEffect(() => {
    setMounted(true);
    
    const handleLangChange = (e: any) => {
      const newLang = e.detail === 'vn' ? Language.VI : Language.EN;
      setLanguage(newLang);
    };

    window.addEventListener('langChanged', handleLangChange);
    
    const checkActive = () => {
      const hash = window.location.hash;
      const isGameSection = ['#section7', '#section8', '#section9', '#section10'].includes(hash);
      
      const ms = document.getElementById('minesweeper-app');
      const g2048 = document.getElementById('game2048-app');
      const tetris = document.getElementById('tetris-app');
      const pikachu = document.getElementById('pikachu-app');
      
      const isGameReady = (el: HTMLElement | null) => {
        if (!el) return false;
        try {
          const style = window.getComputedStyle(el);
          return el.children.length > 0 && el.offsetParent !== null && style.display !== 'none';
        } catch (e) {
          return false;
        }
      };
      
      const isActive = isGameSection && (isGameReady(ms) || isGameReady(g2048) || isGameReady(tetris) || isGameReady(pikachu));
      
      setIsEntertainmentActive(!!isActive);
    };

    checkActive();
    const timer = setInterval(checkActive, 1000);
    window.addEventListener('hashchange', checkActive);
    const observer = new MutationObserver(checkActive);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      clearInterval(timer);
      window.removeEventListener('hashchange', checkActive);
      window.removeEventListener('langChanged', handleLangChange);
      observer.disconnect();
    };
  }, []);

  const updatePlayerName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem(STORAGE_KEY, name);
  };

  const handleSaveName = () => {
    if (tempName.trim()) {
      updatePlayerName(tempName.trim());
      setShowNameEdit(false);
    }
  };

  if (!mounted) return null;

  if (isAdmin) {
    return <AdminCP />;
  }

  // React Portals into index.html containers after mounting
  const minesweeperContainer = typeof document !== 'undefined' ? document.getElementById('minesweeper-app') : null;
  const game2048Container = typeof document !== 'undefined' ? document.getElementById('game2048-app') : null;
  const tetrisContainer = typeof document !== 'undefined' ? document.getElementById('tetris-app') : null;
  const pikachuContainer = typeof document !== 'undefined' ? document.getElementById('pikachu-app') : null;

  const isEntertainmentPage = minesweeperContainer || game2048Container || tetrisContainer || pikachuContainer;

  const renderFloatingIcon = (iconName: string) => {
    switch (iconName) {
      case 'phone': return <Phone size={22} className="sm:w-6 sm:h-6 text-white drop-shadow-md" />;
      case 'mail': return <Mail size={22} className="sm:w-6 sm:h-6 text-white drop-shadow-md" />;
      case 'globe': return <Globe size={22} className="sm:w-6 sm:h-6 text-white drop-shadow-md" />;
      case 'award': return <Award size={21} className="sm:w-[22px] sm:h-[22px] text-white drop-shadow-md" />;
      case 'music':
      default:
        return <Music size={22} className="sm:w-6 sm:h-6 text-white drop-shadow-md" />;
    }
  };

  const buttonText = adminConfig?.floatingButton?.text || (language === Language.VI ? "Kho nhạc của A.C Xuân Tài" : "A.C Xuan Tai's Music Library");
  const buttonUrl = adminConfig?.floatingButton?.url || "https://tài.vn";
  const buttonIcon = adminConfig?.floatingButton?.icon || "music";

  return (
    <>
      {minesweeperContainer && createPortal(
        <div className="flex flex-col items-center pt-5 pb-12">
          <MinesweeperGame globalPlayerName={playerName} onUpdateName={updatePlayerName} language={language} />
        </div>,
        minesweeperContainer
      )}
      
      {game2048Container && createPortal(
        <div className="flex flex-col items-center pt-5 pb-12">
          <Game2048 globalPlayerName={playerName} onUpdateName={updatePlayerName} language={language} />
        </div>,
        game2048Container
      )}
      
      {tetrisContainer && createPortal(
        <div className="flex flex-col items-center pt-5 pb-12">
          <TetrisGame globalPlayerName={playerName} onUpdateName={updatePlayerName} language={language} />
        </div>,
        tetrisContainer
      )}
      
      {pikachuContainer && createPortal(
        <div className="flex flex-col items-center pt-5 pb-12 w-full">
          <PikachuGame globalPlayerName={playerName} onUpdateName={updatePlayerName} language={language} />
        </div>,
        pikachuContainer
      )}
 
      {/* Floating Greeting Widget - Only show if on entertainment page */}
      <AnimatePresence>
        {isEntertainmentActive && (
          <motion.div 
            key="floating-widget"
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              scale: 1,
              transition: { type: 'spring', damping: 20, stiffness: 100 }
            }}
            exit={{ opacity: 0, y: 100, scale: 0.8, transition: { duration: 0.3 } }}
            className="fixed bottom-4 left-4 sm:bottom-8 sm:left-6 z-[10001] flex flex-col items-start gap-2 transition-all duration-300"
          >
            {/* Toggle Button for Mobile is now inside */}
  
            {!isWidgetMinimized && (
              <div className="bg-white/90 sm:bg-white/40 backdrop-blur-xl border border-emerald-50/50 p-1.5 rounded-[16px] shadow-2xl flex items-center gap-1.5 transition-all hover:scale-[1.02] relative group">
                <div className="flex items-center gap-1.5 pl-1 py-0.5">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-[10px] sm:rounded-[12px] bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-md overflow-hidden shrink-0">
                    {playerName ? (
                       <span className="text-sm sm:text-base font-black uppercase text-white leading-none">{playerName.charAt(0)}</span>
                    ) : (
                      <User size={16} className="sm:w-[18px] sm:h-[18px]" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-[70px] sm:min-w-[90px] justify-center">
                    <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-500 font-black leading-none mb-0.5" style={{ fontSize: '9px' }}>{TRANSLATIONS[language].hello}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-black text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis max-w-[90px] sm:max-w-none">
                        {playerName || TRANSLATIONS[language].guest}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => {
                            setTempName(playerName);
                            setShowNameEdit(true);
                          }}
                          className="w-5 h-5 sm:w-6 sm:h-6 bg-slate-100 hover:bg-emerald-500 hover:text-white text-slate-600 rounded-md transition-all flex items-center justify-center shadow-sm"
                          title={playerName ? TRANSLATIONS[language].edit : TRANSLATIONS[language].setName}
                        >
                          <Edit2 size={10} className="sm:w-[12px] sm:h-[12px]" />
                        </button>
                        {playerName && (
                          <button 
                            onClick={() => updatePlayerName('')}
                            className="w-5 h-5 sm:w-6 sm:h-6 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 rounded-md transition-all flex items-center justify-center shadow-sm"
                            title={TRANSLATIONS[language].logout}
                          >
                            <UserMinus size={10} className="sm:w-[12px] sm:h-[12px]" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="w-px h-5 sm:h-6 bg-slate-200/50 mx-0.5 sm:mx-1"></div>
  
                <button
                  onClick={() => setIsWidgetMinimized(true)}
                  className="w-6 h-6 sm:w-7 sm:h-7 mr-1 flex items-center justify-center text-slate-400 rounded-md hover:bg-slate-100 transition-all shrink-0"
                  title={TRANSLATIONS[language].minimize}
                >
                  <ChevronDown size={14} className="sm:w-[16px] sm:h-[16px]" />
                </button>
              </div>
            )}
  
            {isWidgetMinimized && (
              <button
                onClick={() => setIsWidgetMinimized(false)}
                className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500 rounded-full flex flex-col items-center justify-center text-white shadow-xl border-2 border-white animate-bounce transition-all active:scale-95 z-20 group"
                title={TRANSLATIONS[language].expand}
              >
                <User size={16} className="sm:w-[20px] sm:h-[20px]" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* Global Name Edit Modal */}
      <AnimatePresence>
        {showNameEdit && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNameEdit(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white overflow-hidden rounded-[40px] shadow-2xl max-w-sm w-full relative"
            >
              <div className="bg-gradient-to-br from-emerald-500 to-blue-600 p-10 text-center text-white pb-14">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
                  <User size={40} className="text-white" />
                </div>
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">{TRANSLATIONS[language].identification}</h2>
                <p className="text-white/70 text-xs font-medium">{TRANSLATIONS[language].identificationDesc}</p>
              </div>
 
              <div className="p-8 pt-0 -mt-8 relative z-10">
                <div className="bg-white p-6 rounded-[32px] shadow-xl border border-slate-50">
                  <div className="mb-6">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">{TRANSLATIONS[language].playerNameLabel}</label>
                    <input 
                      autoFocus
                      type="text"
                      placeholder={TRANSLATIONS[language].enterNamePlaceholder}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white outline-none rounded-2x transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                      style={{ borderRadius: '16px' }}
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    />
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={handleSaveName}
                      className="btn-brand py-4 text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-100"
                    >
                      {TRANSLATIONS[language].apply}
                    </button>
                    <button 
                      onClick={() => setShowNameEdit(false)}
                      className="py-4 bg-slate-50 text-slate-400 text-[10px] font-black rounded-full hover:bg-slate-100 transition-all uppercase tracking-widest"
                    >
                      {TRANSLATIONS[language].cancel}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
 
      {/* Global Dynamic Floating Button */}
      <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-6 z-[10000] flex items-center">
        <AnimatePresence>
          <a
            href={buttonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex items-center justify-center shrink-0 decoration-none group"
            title={buttonText}
          >
            {/* Pulsing Hint Text */}
            <motion.div
              animate={{ 
                opacity: [0, 1, 1, 0, 0],
                x: [10, 0, 0, 0, 10]
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 6, 
                times: [0, 0.1, 0.5, 0.6, 1],
                ease: "easeInOut"
              }}
              className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-gradient-to-r from-purple-900/95 to-slate-900/95 backdrop-blur-md text-white border border-purple-500/30 px-4 py-2 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1 shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping mr-1"></span>
              {buttonText}
              {/* Tooltip triangle */}
              <div className="absolute top-1/2 -translate-y-1/2 left-full w-0 h-0 border-y-[5px] border-y-transparent border-l-[6px] border-l-slate-900/95"></div>
            </motion.div>
 
            {/* Glowing / Pulse aura element behind the button */}
            <motion.div
              animate={{ 
                scale: [1, 1.25, 1],
                opacity: [0.5, 0.2, 0.5]
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 1.8, 
                ease: "easeInOut"
              }}
              className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 blur-md -z-10"
            />
 
            {/* Main Button */}
            <motion.div
              animate={{ 
                scale: [1, 1.08, 1]
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 1.8, 
                ease: "easeInOut"
              }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-xl hover:shadow-2xl border-2 border-white/60 active:scale-95 transition-all cursor-pointer relative overflow-hidden group"
            >
              {/* Dancing Icon */}
              <motion.div
                animate={{ 
                  rotate: [-12, 12, -12],
                  y: [-3, 3, -3]
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 2.2, 
                  ease: "easeInOut"
                }}
              >
                {renderFloatingIcon(buttonIcon)}
              </motion.div>
            </motion.div>
          </a>
        </AnimatePresence>
      </div>
    </>
  );
}
