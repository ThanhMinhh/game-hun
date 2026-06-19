"use client";

import { useState, useEffect } from "react";
import { Coins, LogIn, UserPlus, LogOut, ArrowRight, TrendingUp, Sparkles, AlertCircle, ArrowLeft, Gamepad2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function Home() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<{ id: string; username: string; balance: number } | null>(null);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState("");

  // Game States
  const [betAmount, setBetAmount] = useState(100);
  const [choice, setChoice] = useState<"HEADS" | "TAILS" | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<"HEADS" | "TAILS" | null>(null);
  const [winStatus, setWinStatus] = useState<"WIN" | "LOSS" | null>(null);

  // Screen Navigation
  const [currentScreen, setCurrentScreen] = useState<"MENU" | "COINFLIP" | "SLOTS">("MENU");

  // Slots States
  const [slotsFlipping, setSlotsFlipping] = useState(false);
  const [slotsResult, setSlotsResult] = useState<string[] | null>(null);
  const [slotsWinStatus, setSlotsWinStatus] = useState<"WIN" | "LOSS" | null>(null);
  const [slotsMultiplier, setSlotsMultiplier] = useState(0);

  // Profile Edit States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        setToken(idToken);
        
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/auth/sync`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${idToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            setUser({ id: firebaseUser.uid, username: data.username, balance: data.balance });
          }
        } catch (err) {
          console.error("Failed to sync user");
        }
      } else {
        setToken("");
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setAuthError(err.message.replace("Firebase: ", ""));
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError("");
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setAuthError(err.message.replace("Firebase: ", ""));
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user) return;
    if (editUsername.trim().length < 3 || editUsername.trim().length > 20) {
      return alert("Tên hiển thị phải từ 3 đến 20 ký tự.");
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/user/profile`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ username: editUsername.trim() }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error);
      } else {
        setUser({ ...user, username: data.username });
        setShowProfileModal(false);
      }
    } catch (err) {
      alert("Network Error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const placeBet = async (selectedChoice: "HEADS" | "TAILS") => {
    if (!token || !user) return;
    if (betAmount <= 0) return alert("Bet must be positive");
    if (betAmount > user.balance) return alert("Insufficient HUN!");
    
    setChoice(selectedChoice);
    setFlipping(true);
    setResult(null);
    setWinStatus(null);

    try {
      const startTime = Date.now();
      const playRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/game/coinflip/play`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ amount: betAmount, choice: selectedChoice }),
      });
      const playData = await playRes.json();
      
      if (!playRes.ok) {
        setFlipping(false);
        return alert(playData.error);
      }

      setResult(playData.resolve.result);
      const isWin = playData.resolve.result === selectedChoice;

      // Tính toán thời gian còn lại của hiệu ứng xoay (1 giây)
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 1000 - elapsed);

      setTimeout(() => {
        setWinStatus(isWin ? "WIN" : "LOSS");
        if (isWin) {
          const tax = (betAmount * 2 - betAmount) * 0.01;
          const payout = (betAmount * 2) - tax;
          setUser(prev => prev ? { ...prev, balance: prev.balance - betAmount + payout } : null);
        } else {
          setUser(prev => prev ? { ...prev, balance: prev.balance - betAmount } : null);
        }
        setFlipping(false);
      }, remainingTime);

    } catch (err) {
      setFlipping(false);
      alert("Network Error");
    }
  };

  const playSlots = async () => {
    if (!token || !user) return;
    if (betAmount <= 0) return alert("Bet must be positive");
    if (betAmount > user.balance) return alert("Insufficient HUN!");
    
    setSlotsFlipping(true);
    setSlotsResult(null);
    setSlotsWinStatus(null);

    try {
      const startTime = Date.now();
      const playRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/game/slots/play`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ amount: betAmount }),
      });
      const playData = await playRes.json();
      
      if (!playRes.ok) {
        setSlotsFlipping(false);
        return alert(playData.error);
      }

      setSlotsResult(playData.resolve.result);
      setSlotsMultiplier(playData.resolve.multiplier);
      const isWin = playData.resolve.multiplier > 0;

      // Giả lập quay hũ trong 2 giây (2000ms)
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 2000 - elapsed);

      setTimeout(() => {
        setSlotsWinStatus(isWin ? "WIN" : "LOSS");
        if (isWin) {
          const rawWinnings = betAmount * playData.resolve.multiplier;
          const tax = (rawWinnings - betAmount) * 0.01;
          const payout = rawWinnings - tax;
          setUser(prev => prev ? { ...prev, balance: prev.balance - betAmount + payout } : null);
        } else {
          setUser(prev => prev ? { ...prev, balance: prev.balance - betAmount } : null);
        }
        setSlotsFlipping(false);
      }, remainingTime);

    } catch (err) {
      setSlotsFlipping(false);
      alert("Network Error");
    }
  };

  if (!token || !user) {
    return (
      <div className="relative w-full max-w-md mx-auto mt-12 px-4">
        <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full z-0" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-6 sm:p-10 rounded-3xl relative z-10"
        >
          <div className="flex justify-center mb-6">
            <motion.div 
              animate={{ rotateY: 360 }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              className="p-4 bg-gradient-to-tr from-primary to-secondary rounded-full shadow-[0_0_30px_rgba(192,38,211,0.5)]"
            >
              <Coins className="w-12 h-12 text-white" />
            </motion.div>
          </div>
          
          <h1 className="text-4xl font-black text-center mb-2 text-neon uppercase tracking-wider">HUN ENTERTAINMENT</h1>
          <p className="text-center text-gray-400 mb-8 font-light">Play, Win, Collect.</p>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2 text-sm">
              <AlertCircle size={16} />
              {authError}
            </div>
          )}
          
          <form onSubmit={handleEmailAuth} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Email Address</label>
              <input 
                type="email" 
                className="w-full cyber-input text-white rounded-xl px-5 py-4 focus:outline-none"
                placeholder="player@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Password</label>
              <input 
                type="password" 
                className="w-full cyber-input text-white rounded-xl px-5 py-4 focus:outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              className="w-full cyber-button text-white font-black uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 mt-4 shadow-[0_0_20px_rgba(192,38,211,0.3)]"
            >
              {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
              {isLogin ? "Enter Arena" : "Create Account"}
            </button>
          </form>

          <div className="my-8 flex items-center">
            <div className="flex-1 border-t border-white/10"></div>
            <span className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-widest">Or connect with</span>
            <div className="flex-1 border-t border-white/10"></div>
          </div>

          <button 
            onClick={handleGoogleAuth}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-3 transition"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
            Continue with Google
          </button>

          <p className="text-center text-sm font-medium text-gray-400 mt-8 cursor-pointer hover:text-white transition" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "New to the arena? " : "Already a legend? "}
            <span className="text-primary hover:text-fuchsia-400">{isLogin ? "Sign up" : "Sign in"}</span>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 lg:space-y-10 mt-4 lg:mt-6 relative z-10 px-4">
      {/* Navbar / Dashboard */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel-accent p-6 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-6 sm:gap-0"
      >
        <div 
          className="flex items-center gap-4 cursor-pointer hover:bg-white/5 p-2 pr-6 rounded-2xl transition group"
          onClick={() => {
            setEditUsername(user?.username || "");
            setShowProfileModal(true);
          }}
        >
          <div className="w-14 h-14 bg-gradient-to-tr from-primary to-secondary rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-white/20 group-hover:scale-105 transition-transform">
            <span className="font-black text-2xl text-white">{user?.username.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider group-hover:text-gray-300 transition-colors">Player ID (Edit)</p>
            <p className="font-black text-xl text-neon-blue group-hover:text-blue-300 transition-colors">{user?.username}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto justify-between sm:justify-end">
          <div className="bg-black/40 px-4 sm:px-6 py-3 rounded-2xl border border-primary/30 flex items-center gap-2 sm:gap-3 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] flex-1 sm:flex-none justify-center">
            <Coins className="text-yellow-400 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="font-mono font-black text-xl sm:text-2xl text-white tracking-wider">{user?.balance.toFixed(0)} <span className="text-sm text-primary">HUN</span></span>
          </div>
          <button onClick={handleLogout} className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 transition-all">
            <LogOut size={20} />
          </button>
        </div>
      </motion.div>

      {/* Main Game Area Navigation */}
      {currentScreen !== "MENU" && (
        <button 
          onClick={() => setCurrentScreen("MENU")}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-semibold uppercase tracking-wider">Back to Sảnh Chờ</span>
        </button>
      )}

      {/* ===================== MENU SCREEN ===================== */}
      {currentScreen === "MENU" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          {/* Lật Xu Card */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setCurrentScreen("COINFLIP")}
            className="glass-panel p-10 rounded-[2.5rem] cursor-pointer group relative overflow-hidden flex flex-col items-center justify-center min-h-[400px] border border-white/5 hover:border-primary/50 transition-colors"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-32 h-32 mb-8 bg-gradient-to-tr from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(234,179,8,0.3)] group-hover:shadow-[0_0_80px_rgba(234,179,8,0.6)] transition-shadow">
              <span className="text-6xl font-black text-yellow-950">H</span>
            </div>
            <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-2">Coinflip</h2>
            <p className="text-gray-400 text-center font-medium">Thử thách nhân phẩm với Tỷ lệ thắng 50/50.</p>
            <div className="mt-8 flex items-center gap-2 text-primary font-bold uppercase tracking-wider group-hover:gap-4 transition-all">
              Chơi ngay <ArrowRight size={20} />
            </div>
          </motion.div>

          {/* Nổ Hũ Card */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setCurrentScreen("SLOTS")}
            className="glass-panel p-10 rounded-[2.5rem] cursor-pointer group relative overflow-hidden flex flex-col items-center justify-center min-h-[400px] border border-white/5 hover:border-secondary/50 transition-colors"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-32 h-32 mb-8 bg-gradient-to-tr from-blue-400 to-emerald-400 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.3)] group-hover:shadow-[0_0_80px_rgba(59,130,246,0.6)] transition-shadow rotate-12 group-hover:rotate-0">
              <span className="text-6xl">🎰</span>
            </div>
            <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-2">777 Slots</h2>
            <p className="text-gray-400 text-center font-medium">Săn Jackpot x10 tiền cược vô cùng hấp dẫn.</p>
            <div className="mt-8 flex items-center gap-2 text-secondary font-bold uppercase tracking-wider group-hover:gap-4 transition-all">
              Chơi ngay <ArrowRight size={20} />
            </div>
          </motion.div>
        </div>
      )}

      {/* ===================== COINFLIP SCREEN ===================== */}
      {currentScreen === "COINFLIP" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Game Visuals (3 columns) */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3 glass-panel p-8 lg:p-12 rounded-[2.5rem] flex flex-col items-center justify-center min-h-[350px] lg:min-h-[500px] relative overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background z-0" />
          
          <div className="coin-container relative z-10">
            <div className={`coin ${flipping ? (result ? (result === "HEADS" ? "flip-heads" : "flip-tails") : (choice === "HEADS" ? "flip-heads" : "flip-tails")) : ""}`}>
              {/* Front (Heads) */}
              <div className={`coin-face coin-front ${!flipping && result === "TAILS" ? "hidden" : ""}`}>
                <div className="w-[120px] h-[120px] rounded-full border-[6px] border-yellow-300/60 flex items-center justify-center">
                  <span className="text-6xl font-black text-yellow-100 drop-shadow-lg">H</span>
                </div>
              </div>
              
              {/* Back (Tails) */}
              <div className={`coin-face coin-back ${!flipping && result === "HEADS" ? "hidden" : ""}`}>
                <div className="w-[120px] h-[120px] rounded-full border-[6px] border-slate-300/60 flex items-center justify-center">
                  <span className="text-6xl font-black text-white drop-shadow-lg">T</span>
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {winStatus && !flipping && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className={`absolute inset-0 flex flex-col items-center justify-center backdrop-blur-md z-20 ${winStatus === "WIN" ? "bg-emerald-900/40" : "bg-red-950/40"}`}
              >
                <div className="text-center p-10 bg-black/60 rounded-3xl border border-white/10 shadow-2xl">
                  {winStatus === "WIN" ? (
                    <Sparkles className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                  ) : (
                    <AlertCircle className="w-12 h-12 lg:w-16 lg:h-16 text-red-500 mx-auto mb-4" />
                  )}
                  <h2 className={`text-4xl lg:text-6xl font-black mb-2 lg:mb-4 uppercase ${winStatus === "WIN" ? "text-emerald-400 text-shadow-[0_0_20px_#10b981]" : "text-red-500"}`}>
                    {winStatus === "WIN" ? "VICTORY!" : "DEFEAT"}
                  </h2>
                  <p className="text-xl lg:text-2xl font-mono text-white mb-6 lg:mb-8">
                    {winStatus === "WIN" ? `+${(betAmount * 2 * 0.99).toFixed(0)}` : `-${betAmount}`} HUN
                  </p>
                  <button 
                    onClick={() => setWinStatus(null)}
                    className="px-10 py-4 bg-white text-black font-black uppercase tracking-wider rounded-xl hover:bg-gray-200 transition transform hover:scale-105 active:scale-95"
                  >
                    Play Again
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Betting Controls (2 columns) */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 glass-panel p-6 sm:p-8 rounded-[2.5rem] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-3 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-white/10">
              <div className="p-3 bg-primary/20 rounded-xl">
                <TrendingUp className="text-primary w-6 h-6" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-wider">Place Bet</h2>
            </div>
            
            <div className="space-y-6 mb-10">
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  <span>Wager Amount</span>
                  <span>Max: {user?.balance}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-gray-500">HUN</span>
                  <input 
                    type="number" 
                    value={betAmount}
                    onChange={(e) => setBetAmount(Number(e.target.value))}
                    className="w-full cyber-input text-white rounded-2xl pl-16 pr-6 py-5 text-3xl font-mono font-black focus:outline-none"
                    min="10"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[10, 100, 500, "MAX"].map(amt => (
                  <button 
                    key={amt} 
                    onClick={() => setBetAmount(amt === "MAX" ? (user?.balance || 0) : Number(amt))}
                    className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-mono font-bold text-sm transition-all hover:-translate-y-1"
                  >
                    {amt === "MAX" ? "MAX" : `+${amt}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              disabled={flipping}
              onClick={() => placeBet("HEADS")}
              className="w-full relative group overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 transition-all p-6 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_20px_rgba(234,179,8,0.2)]"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <div className="relative flex items-center justify-between">
                <span className="font-black text-2xl text-yellow-950 uppercase tracking-widest">Heads</span>
                <div className="w-10 h-10 rounded-full bg-yellow-900/20 flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-yellow-950" />
                </div>
              </div>
            </button>

            <button 
              disabled={flipping}
              onClick={() => placeBet("TAILS")}
              className="w-full relative group overflow-hidden rounded-2xl bg-gradient-to-r from-slate-400 to-slate-500 hover:from-slate-300 hover:to-slate-400 transition-all p-6 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_20px_rgba(148,163,184,0.2)]"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <div className="relative flex items-center justify-between">
                <span className="font-black text-2xl text-slate-900 uppercase tracking-widest">Tails</span>
                <div className="w-10 h-10 rounded-full bg-slate-900/20 flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-slate-900" />
                </div>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
      )}

      {/* ===================== SLOTS SCREEN ===================== */}
      {currentScreen === "SLOTS" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Slots Visuals (3 columns) */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3 glass-panel p-8 lg:p-12 rounded-[2.5rem] flex flex-col items-center justify-center min-h-[350px] lg:min-h-[500px] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-secondary/10 via-background to-background z-0" />
            
            <div className="relative z-10 flex gap-4 p-8 bg-black/60 rounded-3xl border-4 border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-24 h-32 md:w-32 md:h-40 bg-white/10 rounded-xl border-2 border-white/20 flex items-center justify-center overflow-hidden relative shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                  {slotsFlipping ? (
                    <div 
                      className="absolute top-0 flex flex-col items-center gap-4 slot-spinning-vertical pt-4"
                      style={{ animationDuration: `${0.15 + i * 0.05}s` }}
                    >
                      {/* Duplicate array for seamless infinite scrolling */}
                      {["H", "💎", "🔔", "🍒", "🍋", "🍉", "H", "💎", "🔔", "🍒", "🍋", "🍉"].map((sym, idx) => (
                        <div key={idx} className="text-6xl md:text-8xl w-full text-center leading-none flex items-center justify-center h-[100px]">{sym}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-6xl md:text-8xl slot-land">{slotsResult ? slotsResult[i] : "❓"}</div>
                  )}
                </div>
              ))}
            </div>

            <AnimatePresence>
              {slotsWinStatus && !slotsFlipping && (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0, y: -20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="mt-8 text-center bg-black/40 px-10 py-6 rounded-3xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-sm z-20"
                >
                  <h2 className={`text-4xl lg:text-5xl font-black mb-2 uppercase ${slotsWinStatus === "WIN" ? "text-emerald-400 text-shadow-[0_0_20px_#10b981]" : "text-red-500"}`}>
                    {slotsWinStatus === "WIN" ? (slotsMultiplier === 10 ? "JACKPOT!" : "BIG WIN!") : "DEFEAT"}
                  </h2>
                  <p className="text-2xl font-mono text-white">
                    {slotsWinStatus === "WIN" ? `+${(betAmount * slotsMultiplier * 0.99).toFixed(0)}` : `-${betAmount}`} <span className="text-sm text-primary">HUN</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Betting Controls (2 columns) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 glass-panel p-6 sm:p-8 rounded-[2.5rem] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-white/10">
                <div className="p-3 bg-secondary/20 rounded-xl">
                  <Gamepad2 className="text-secondary w-6 h-6" />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-wider">Slot Machine</h2>
              </div>
              
              <div className="space-y-6 mb-10">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                    <span>Wager Amount</span>
                    <span>Max: {user?.balance}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-gray-500">HUN</span>
                    <input 
                      type="number" 
                      value={betAmount}
                      onChange={(e) => setBetAmount(Number(e.target.value))}
                      className="w-full cyber-input text-white rounded-2xl pl-16 pr-6 py-5 text-3xl font-mono font-black focus:outline-none"
                      min="10"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[10, 100, 500, "MAX"].map(amt => (
                    <button 
                      key={amt} 
                      onClick={() => setBetAmount(amt === "MAX" ? (user?.balance || 0) : Number(amt))}
                      className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-mono font-bold text-sm transition-all hover:-translate-y-1"
                    >
                      {amt === "MAX" ? "MAX" : `+${amt}`}
                    </button>
                  ))}
                </div>

                {/* Payout Table */}
                <div className="mt-8 bg-black/40 p-4 rounded-2xl border border-white/10 text-sm">
                  <h3 className="text-gray-400 font-bold uppercase tracking-wider mb-3 text-center">Payouts</h3>
                  <div className="space-y-2 font-mono">
                    <div className="flex justify-between"><span className="tracking-widest">H H H</span><span className="text-yellow-400 font-bold">x10</span></div>
                    <div className="flex justify-between"><span className="tracking-widest">💎 💎 💎</span><span className="text-emerald-400 font-bold">x5</span></div>
                    <div className="flex justify-between"><span className="tracking-widest">🔔 🔔 🔔</span><span className="text-blue-400 font-bold">x3</span></div>
                    <div className="flex justify-between text-gray-500"><span className="tracking-widest">ANY 3</span><span className="font-bold">x2</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button 
                disabled={slotsFlipping}
                onClick={playSlots}
                className="w-full relative group overflow-hidden rounded-2xl bg-gradient-to-r from-secondary to-blue-600 hover:from-blue-500 hover:to-secondary transition-all p-6 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_20px_rgba(59,130,246,0.2)]"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                <div className="relative flex items-center justify-center gap-4">
                  <span className="font-black text-3xl text-white uppercase tracking-widest">{slotsFlipping ? "Spinning..." : "SPIN!"}</span>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Profile Edit Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel p-8 rounded-[2rem] w-full max-w-md relative"
            >
              <button 
                onClick={() => setShowProfileModal(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-white"
              >
                ✕
              </button>
              
              <h2 className="text-3xl font-black uppercase tracking-wider mb-2 text-neon-blue">Edit Profile</h2>
              <p className="text-gray-400 mb-8 text-sm">Customize how other players see you in the arena.</p>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Display Name</label>
                  <input 
                    type="text" 
                    className="w-full cyber-input text-white rounded-xl px-5 py-4 focus:outline-none font-bold text-lg"
                    placeholder="Enter new name..."
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    maxLength={20}
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-2 text-right">{editUsername.length}/20</p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold uppercase tracking-wider transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex-1 cyber-button text-white font-black uppercase tracking-wider py-4 rounded-xl disabled:opacity-50"
                  >
                    {isSavingProfile ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
