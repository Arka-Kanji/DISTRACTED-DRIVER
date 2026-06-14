/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { PixelCar } from './components/PixelCar';
import { audioManager } from './audio';
import { rawFallbacks } from './fallbackTexts';

const VIRTUAL_WIDTH = 1000;
const CAR_WIDTH = 100;
const HITBOX_WIDTH = CAR_WIDTH * 0.7;

let availableFallbacks: string[] = [];

function getNextFallbackText(fallbacks: string[]) {
  if (availableFallbacks.length === 0) {
    availableFallbacks = [...fallbacks];
  }
  const randomIndex = Math.floor(Math.random() * availableFallbacks.length);
  const selectedText = availableFallbacks.splice(randomIndex, 1)[0];
  return selectedText;
}

export default function App() {
  const [gameState, setGameState] = useState<'loading' | 'start' | 'playing' | 'crashed' | 'gameover' | 'win'>('loading');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');
  const [lives, setLives] = useState(3);
  const [bestTimes, setBestTimes] = useState<{ Easy: number | null; Medium: number | null; Hard: number | null }>({
    Easy: null,
    Medium: null,
    Hard: null,
  });
  const [targetText, setTargetText] = useState("");
  const [typedText, setTypedText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [translateY, setTranslateY] = useState(0);

  const _lives = useRef(3);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerTextContainerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  
  useEffect(() => {
    const e = localStorage.getItem('bestTime_Easy');
    const m = localStorage.getItem('bestTime_Medium');
    const h = localStorage.getItem('bestTime_Hard');
    setBestTimes({
      Easy: e ? parseFloat(e) : null,
      Medium: m ? parseFloat(m) : null,
      Hard: h ? parseFloat(h) : null
    });
  }, []);
  
  useEffect(() => {
    if (cursorRef.current && innerTextContainerRef.current) {
      // Calculate which line the cursor is currently on and shift appropriately
      const cursorTop = cursorRef.current.offsetTop;
      const style = window.getComputedStyle(innerTextContainerRef.current);
      // Fallback to 40 if parsing fails (our minimum CSS line-height)
      const lineHeight = parseFloat(style.lineHeight) || 40;
      
      const currentLine = Math.floor((cursorTop + 5) / lineHeight);
      
      // Shift so the active line is always visually at the top
      setTranslateY(-currentLine * lineHeight);
    }
  }, [typedText, errorText, targetText, gameState]);

  const engineRef = useRef({
    playerLane: 1 as 0 | 1 | 2,
    playerX: 820,
    obstacles: [] as any[],
    spawnTimer: 100,
    roadOffset: 0,
    timerRunning: false,
    timeElapsed: 0,
    difficulty: 'Easy' as 'Easy' | 'Medium' | 'Hard'
  });

  const [_, setTick] = useState(0);
  const requestRef = useRef<number>(undefined);
  const lastTimeRef = useRef<number>(0);

  const resetAndLoad = useCallback(async (restartFromEnd: boolean = false) => {
    if (restartFromEnd) {
      audioManager.startBackgroundAudio(true);
    }
    setGameState('loading');
    setLives(3);
    _lives.current = 3;
    setTypedText('');
    setErrorText(null);
    engineRef.current.obstacles = [];
    engineRef.current.playerLane = 1;
    engineRef.current.timerRunning = false;
    engineRef.current.timeElapsed = 0;
    
    // Silently use fallback mechanics
    const fallbacks = rawFallbacks.map(text => {
        let result = text;
        if (result.length > 250) {
           result = result.substring(0, 250);
        }
        result = result.replace(/[\s.,;:!?]+$/, '');
        result += '.';
        return result;
      });

      const newText = getNextFallbackText(fallbacks);
      setTargetText(newText);
    
    setTimeout(() => {
      setGameState('start');
    }, 500); // 500ms loading state delay
  }, []);

  useEffect(() => {
    resetAndLoad(false);
  }, [resetAndLoad]);

  useEffect(() => {
    const startAudio = () => {
      audioManager.startBackgroundAudio(false);
      window.removeEventListener('click', startAudio);
      window.removeEventListener('keydown', startAudio);
    };
    window.addEventListener('click', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });

    audioManager.init();
    
    return () => {
      window.removeEventListener('click', startAudio);
      window.removeEventListener('keydown', startAudio);
    };
  }, []);

  const crash = useCallback(() => {
    setGameState('crashed');
    _lives.current -= 1;
    setLives(_lives.current);

    if (_lives.current <= 0) {
      audioManager.playCrashSound();
      setTimeout(() => {
        audioManager.playGameOverSound();
      }, 500);
    } else {
      audioManager.playCrashSound();
    }

    setTimeout(() => {
      if (_lives.current <= 0) {
        setGameState('gameover');
      } else {
        engineRef.current.obstacles = [];
        engineRef.current.spawnTimer = 500;
        engineRef.current.playerLane = 1;
        setGameState('playing');
        
        // Auto focus text input area (or rather, ensure keyboard listeners remain active)
        if (containerRef.current) containerRef.current.focus();
      }
    }, 1500);
  }, []);

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current !== 0 && gameState === 'playing') {
      // Safe delta calculation
      const dt = Math.min(time - lastTimeRef.current, 50); 
      const state = engineRef.current;

      state.roadOffset = (state.roadOffset + dt * 0.25) % 100;
      
      if (state.timerRunning) {
        state.timeElapsed += dt;
      }

      let collision = false;
      state.obstacles.forEach(obs => {
        obs.x += obs.speed * (dt / 16);

        if (!obs.passed && obs.x > state.playerX + CAR_WIDTH / 2) {
          obs.passed = true;
        }

        if (obs.lane === state.playerLane) {
          const overlap = (obs.x < state.playerX + HITBOX_WIDTH) && (obs.x + HITBOX_WIDTH > state.playerX);
          if (overlap) {
            collision = true;
          }
        }
      });

      state.obstacles = state.obstacles.filter(o => o.x < VIRTUAL_WIDTH + 200);

      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        let baseSpeed = 4;
        let randSpeed = 2.5;
        let baseSpawn = 800;
        let randSpawn = 1200;
        
        if (state.difficulty === 'Medium') {
          baseSpeed = 6;
          randSpeed = 3;
          baseSpawn = 600;
          randSpawn = 800;
        } else if (state.difficulty === 'Hard') {
          baseSpeed = 9;
          randSpeed = 3.5;
          baseSpawn = 400;
          randSpawn = 600;
        }

        state.obstacles.push({
          id: Math.random(),
          x: -150,
          lane: Math.floor(Math.random() * 3),
          color: ['#f97316', '#eab308', '#22c55e', '#ef4444'][Math.floor(Math.random() * 4)],
          speed: baseSpeed + Math.random() * randSpeed,
          passed: false
        });
        state.spawnTimer = baseSpawn + Math.random() * randSpawn;
      }

      if (collision) {
        crash();
      }

      setTick(t => t + 1);
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [gameState, crash]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [animate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Prevent Arrow defaults site-wide to stop scrolling
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
      }

      if (gameState !== 'playing') return;

      if (e.key === 'ArrowUp') {
        engineRef.current.playerLane = Math.max(0, engineRef.current.playerLane - 1) as 0 | 1 | 2;
        return;
      }
      if (e.key === 'ArrowDown') {
        engineRef.current.playerLane = Math.min(2, engineRef.current.playerLane + 1) as 0 | 1 | 2;
        return;
      }

      if (e.key === 'Backspace') {
        if (errorText !== null) setErrorText(null);
        return;
      }

      if (errorText !== null) {
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          audioManager.playWrongSound();
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const expected = targetText[typedText.length];

        if (e.key === expected) {
          audioManager.playTypingSound();
          const newTyped = typedText + e.key;
          setTypedText(newTyped);
          
          if (newTyped.length === targetText.length) {
            setGameState('win');
            audioManager.playWinSound();
            engineRef.current.timerRunning = false;
            
            const finalTime = engineRef.current.timeElapsed;
            const key = 'bestTime_' + difficulty;
            const currentBest = localStorage.getItem(key);
            if (!currentBest || finalTime < parseFloat(currentBest)) {
              localStorage.setItem(key, finalTime.toString());
              setBestTimes(prev => ({
                ...prev,
                [difficulty]: finalTime
              }));
            }
          }
        } else {
          audioManager.playWrongSound();
          setErrorText(e.key);
        }
      }
    };
    window.addEventListener('keydown', handleKey, { passive: false });
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, targetText, typedText, errorText]);

  const startGame = () => {
    setGameState('playing');
    engineRef.current.timerRunning = true;
    audioManager.init();
    audioManager.startBackgroundAudio();
    if (containerRef.current) containerRef.current.focus();
  };

  return (
    <>
      {/* Mobile Not Supported Message */}
      <div className="flex md:hidden min-h-screen bg-[#222] text-white flex-col items-center justify-center p-8 text-center font-sans tracking-wide">
        <h2 className="text-3xl font-black uppercase text-yellow-500 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-4">
          Mobile Browsers<br/>Not Supported
        </h2>
        <p className="text-gray-300 font-mono text-sm leading-relaxed max-w-sm">
          <strong>Distracted Driver</strong> requires a physical keyboard to type messages while dodging cars. Please open this game on a Desktop or Laptop computer to play.
        </p>
      </div>

      {/* Main Game (Desktop Only) */}
      <div className="hidden md:flex min-h-screen bg-[#333] text-white items-center justify-center p-4 font-sans select-none relative">
        <div className="w-full max-w-5xl flex flex-col gap-3 sm:gap-4 focus:outline-none outline-none" ref={containerRef} tabIndex={-1}>
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start w-full gap-2 sm:gap-0">
          <div className="text-left">
            <h1 className="text-4xl sm:text-5xl font-black tracking-widest text-[#fde047] uppercase drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
              Distracted Driver
            </h1>
            <p className="text-gray-300 mt-2 font-mono text-sm sm:text-lg uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis flex items-baseline">
              TYPE THE MESSAGE. DODGE THE CARS. STAY ALIVE.
              <span className="text-[0.65rem] sm:text-xs opacity-75 ml-2 font-normal tracking-normal whitespace-nowrap">
                (Controls: Up/Down Arrows to control the car)
              </span>
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="font-mono text-xl sm:text-2xl font-black text-yellow-400 bg-black/50 px-4 py-2 rounded-lg border-2 border-yellow-400/50 inline-block text-center whitespace-nowrap">
               BEST TIME<br/>
               <span className="text-white">{bestTimes[difficulty] !== null ? (bestTimes[difficulty]! / 1000).toFixed(2) + 's' : '--.--s'}</span>
            </div>
          </div>
        </div>

        {/* Top Panel: Texting */}
        <div className="overflow-hidden flex flex-col relative">
          
          {/* Typing Area */}
          <div className="font-mono text-[24px] sm:text-[32px] leading-[40px] sm:leading-[48px] h-[120px] sm:h-[144px] overflow-hidden relative break-words whitespace-pre-wrap outline-none tracking-tight">
            
            {gameState === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center z-20 backdrop-blur-sm transition-all bg-[#333]/80">
                 <div className="text-yellow-400 animate-pulse font-mono text-xl sm:text-2xl uppercase tracking-widest flex items-center gap-3">
                   Loading next route...
                 </div>
              </div>
            )}
            
            {gameState === 'start' && (
              <div className="absolute inset-0 flex items-center justify-center z-20 backdrop-blur-sm transition-all bg-[#333]/60">
                 <button onClick={startGame} className="bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 px-10 rounded-xl text-xl animate-pulse uppercase tracking-widest shadow-xl transition-transform hover:scale-105 active:scale-95">
                   Start Engine
                 </button>
              </div>
            )}
            
            {gameState === 'gameover' && (
               <div className="fixed inset-0 flex items-center justify-center bg-red-900/90 z-50 backdrop-blur-md flex-col gap-6">
                 <h2 className="text-6xl font-black text-white drop-shadow-[0_0_15px_red]">GAME OVER</h2>
                 <button onClick={() => resetAndLoad(true)} className="bg-white hover:bg-gray-100 text-red-900 font-black py-3 px-8 rounded-lg text-xl uppercase tracking-wider transform transition-transform hover:scale-105 active:scale-95">Restart</button>
               </div>
            )}

            <div 
              ref={innerTextContainerRef}
              className="relative z-10 w-full text-left transition-transform duration-300 ease-out will-change-transform"
              style={{ transform: `translateY(${translateY}px)` }}
            >
              <span className="text-[#bfdbfe] drop-shadow-[0_0_8px_rgba(96,165,250,0.8)] transition-all font-medium py-1">
                {targetText.slice(0, typedText.length)}
              </span>
              
              {errorText !== null && (
                <span className="text-red-500 font-bold bg-red-900/40 border border-red-500/50 rounded drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                  {errorText === ' ' ? '\u00A0' : errorText}
                </span>
              )}

              <span ref={cursorRef} className="relative inline-block w-0 h-0 mix-blend-screen">
                {(gameState === 'playing' || gameState === 'start') && (
                  <span className={`absolute top-1/2 -mt-[0.6em] h-[1.2em] w-[4px] ${errorText !== null ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-yellow-400 shadow-[0_0_15px_#fde047]'} animate-pulse rounded-full left-0`}></span>
                )}
              </span>
              
              <span className="text-[#888] font-medium opacity-80">
                {targetText.slice(typedText.length + (errorText !== null ? 1 : 0))}
              </span>
            </div>
            
            {/* Vignette effect over text (adjust to main bg) */}
            <div className="absolute inset-0 shadow-[inset_0_20px_20px_-20px_#333,inset_0_-20px_20px_-20px_#333] pointer-events-none z-10"></div>
          </div>
        </div>

        {/* Bottom Panel: Driving */}
        <div className="bg-[#111] p-3 sm:p-5 rounded-xl shadow-2xl border-4 sm:border-8 border-[#0a0a0a]">
           <div className="rounded-lg overflow-hidden relative flex flex-col h-[300px] sm:h-[360px] border-4 border-[#222]">
             
             {/* HUD / Top Grass */}
             <div className="h-20 sm:h-24 bg-[#1a4014] relative z-20 flex justify-between items-center px-4 sm:px-6 shadow-[inset_0_-4px_0_rgba(0,0,0,0.2)]">
                <div className="flex gap-2 sm:gap-6 items-center">
                   <div className="font-mono text-lg sm:text-xl font-black text-black bg-white/90 px-3 py-2 rounded-lg border-b-4 border-gray-400 flex items-center justify-between min-w-[140px] sm:min-w-[160px]">
                     <select 
                       value={difficulty}
                       onChange={(e) => {
                         const val = e.target.value as 'Easy' | 'Medium' | 'Hard';
                         setDifficulty(val);
                         engineRef.current.difficulty = val;
                         // Auto-focus container after changing difficulty so game captures keys
                         if (containerRef.current) containerRef.current.focus();
                       }}
                       disabled={gameState !== 'loading' && gameState !== 'start'}
                       className="bg-transparent outline-none w-full appearance-none cursor-pointer text-center font-black"
                     >
                       <option value="Easy">EASY</option>
                       <option value="Medium">MEDIUM</option>
                       <option value="Hard">HARD</option>
                     </select>
                   </div>
                   <div className="font-mono text-xl sm:text-2xl font-black text-black bg-white/90 px-3 sm:px-5 py-2 rounded-lg border-b-4 border-gray-400 flex items-center justify-between min-w-[170px] sm:min-w-[210px]">
                     <span>TIME:</span>
                     <span>{(engineRef.current.timeElapsed / 1000).toFixed(2).padStart(5, '0')}s</span>
                   </div>
                   <div className="font-mono text-xl sm:text-2xl font-black text-black bg-white/90 px-3 sm:px-5 py-2 rounded-lg border-b-4 border-gray-400 flex items-center justify-between min-w-[120px] sm:min-w-[140px]">
                     <span>LIVES:</span>
                     <span className={lives <= 1 ? "text-red-600 animate-bounce" : ""}>{lives}</span>
                   </div>
                </div>

                <div className="flex gap-1 sm:gap-2">
                  {Array.from({length: 3}).map((_, i) => (
                    <Heart 
                       key={i} 
                       className={`w-8 h-8 sm:w-10 sm:h-10 transition-all duration-300 ${i < lives ? 'fill-red-500 text-red-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]' : 'fill-black/30 text-black/50'}`} 
                    />
                  ))}
                </div>
             </div>

             {/* Road Area */}
             <div className="flex-1 bg-gradient-to-b from-[#222] via-[#333] to-[#222] relative overflow-hidden border-y-[6px] border-gray-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                
                {/* Horizontal Dashed Line (Road Markings) */}
                <div className="absolute w-[200%] h-3 top-1/3 -translate-y-1/2 flex items-center pointer-events-none" style={{
                   transform: `translateX(calc(-10% + ${engineRef.current.roadOffset}px))`,
                   backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.6) 40%, transparent 40%, transparent 100%)',
                   backgroundSize: '120px 100%',
                }}></div>
                <div className="absolute w-[200%] h-3 top-2/3 -translate-y-1/2 flex items-center pointer-events-none" style={{
                   transform: `translateX(calc(-10% + ${engineRef.current.roadOffset}px))`,
                   backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.6) 40%, transparent 40%, transparent 100%)',
                   backgroundSize: '120px 100%',
                }}></div>

                {/* Render Obstacles */}
                {engineRef.current.obstacles.map(o => (
                   <div key={o.id} className="absolute transform -translate-y-1/2 will-change-transform"
                        style={{ left: `${(o.x / VIRTUAL_WIDTH) * 100}%`, top: o.lane === 0 ? '16.66%' : o.lane === 1 ? '50%' : '83.33%' }}>
                     <PixelCar color={o.color} className="w-[70px] sm:w-[90px]" />
                   </div>
                ))}

                {/* Player Car */}
                <div className={`absolute transform -translate-y-1/2 transition-all duration-[80px] ease-out will-change-transform z-10 ${gameState === 'crashed' ? 'scale-[1.15] opacity-80' : ''}`}
                     style={{ left: `${(engineRef.current.playerX / VIRTUAL_WIDTH) * 100}%`, top: engineRef.current.playerLane === 0 ? '16.66%' : engineRef.current.playerLane === 1 ? '50%' : '83.33%' }}>
                     
                     {gameState === 'crashed' && (
                        <div className="absolute inset-[-60px] z-0 flex items-center justify-center pointer-events-none">
                           <div className="w-full h-full bg-orange-500 rounded-full blur-[15px] animate-ping opacity-60"></div>
                           <div className="absolute text-5xl sm:text-6xl font-black text-white drop-shadow-[0_0_15px_red] rotate-[-20deg] z-20 mix-blend-overlay">CRASH!</div>
                        </div>
                     )}

                     <PixelCar color="#3b82f6" facingLeft className="w-[70px] sm:w-[90px] drop-shadow-[0_15px_15px_rgba(0,0,0,0.7)] z-10 relative" isPlayer/>
                </div>
             </div>

             {/* Bottom Grass */}
             <div className="h-10 sm:h-12 bg-[#1a4014] shadow-[inset_0_4px_10px_rgba(0,0,0,0.4)] relative"></div>
           </div>
        </div>
        
      </div>

      {gameState === 'win' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6 p-10 bg-[#1f1f1f] border-4 border-green-500 rounded-2xl shadow-[0_0_50px_rgba(34,197,94,0.3)] text-center max-w-[90vw]">
            <h2 className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-lime-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]">
              YOU WON!
            </h2>
            <div className="flex flex-col gap-2 scale-105">
              <div className="text-2xl text-gray-300 font-mono flex justify-between gap-8 w-full border-b border-gray-700 pb-2">
                <span>DIFFICULTY:</span> <span className="text-white font-black uppercase text-right">{difficulty}</span>
              </div>
              <div className="text-2xl text-gray-300 font-mono flex justify-between gap-8 w-full border-b border-gray-700 pb-2">
                <span>LIVES LEFT:</span> <span className="text-white font-black text-right">{lives}</span>
              </div>
              <div className="text-3xl text-yellow-400 font-mono flex justify-between gap-8 w-full pt-2">
                <span>TIME:</span> <span className="font-black text-right">{(engineRef.current.timeElapsed / 1000).toFixed(2)}s</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <button 
                onClick={() => resetAndLoad(true)} 
                className="bg-green-500 hover:bg-green-400 text-black font-black py-4 px-10 rounded-xl text-2xl uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all hover:scale-105 active:scale-95"
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

