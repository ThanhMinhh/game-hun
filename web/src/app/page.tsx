"use client";

import { useState, useEffect } from "react";
import { Coins, LogIn, UserPlus, LogOut, ArrowRight, TrendingUp, Sparkles, AlertCircle } from "lucide-react";
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
      const betRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/game/coinflip/bet`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ amount: betAmount, choice: selectedChoice }),
      });
      const betData = await betRes.json();
      
      if (!betRes.ok) {
        setFlipping(false);
        return alert(betData.error);
      }

      setUser({ ...user, balance: betData.updatedBalance });

      // Gọi API kết quả ngay lập tức
      const resolveRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/game/coinflip/resolve`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId: betData.session.id }),
      });
      const resolveData = await resolveRes.json();
      
      if (resolveRes.ok) {
        setResult(resolveData.result);
        const isWin = resolveData.result === selectedChoice;

        // Tính toán thời gian còn lại của hiệu ứng xoay (1 giây)
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, 1000 - elapsed);

        setTimeout(() => {
          setWinStatus(isWin ? "WIN" : "LOSS");
          if (isWin) {
            const tax = (betAmount * 2 - betAmount) * 0.01;
            const payout = (betAmount * 2) - tax;
            setUser(prev => prev ? { ...prev, balance: prev.balance + payout } : null);
          }
          setFlipping(false);
        }, remainingTime);
      } else {
        setFlipping(false);
      }

    } catch (err) {
      setFlipping(false);
      alert("Network Error");
    }
  };

  if (!token || !user) {
    return (
      <div className="relative w-full max-w-md mx-auto mt-12">
        <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full z-0" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-10 rounded-3xl relative z-10"
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
    <div className="w-full max-w-5xl mx-auto space-y-10 mt-6 relative z-10">
      {/* Navbar / Dashboard */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel-accent p-6 rounded-3xl flex justify-between items-center"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-primary to-secondary rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-white/20">
            <span className="font-black text-2xl text-white">{user?.username.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Player ID</p>
            <p className="font-black text-xl text-neon-blue">{user?.username}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="bg-black/40 px-6 py-3 rounded-2xl border border-primary/30 flex items-center gap-3 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
            <Coins className="text-yellow-400 w-6 h-6" />
            <span className="font-mono font-black text-2xl text-white tracking-wider">{user?.balance.toFixed(0)} <span className="text-sm text-primary">HUN</span></span>
          </div>
          <button onClick={handleLogout} className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 transition-all">
            <LogOut size={20} />
          </button>
        </div>
      </motion.div>

      {/* Main Game Area */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Game Visuals (3 columns) */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3 glass-panel p-12 rounded-[2.5rem] flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden"
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
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  )}
                  <h2 className={`text-6xl font-black mb-4 uppercase ${winStatus === "WIN" ? "text-emerald-400 text-shadow-[0_0_20px_#10b981]" : "text-red-500"}`}>
                    {winStatus === "WIN" ? "VICTORY!" : "DEFEAT"}
                  </h2>
                  <p className="text-2xl font-mono text-white mb-8">
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
          className="lg:col-span-2 glass-panel p-8 rounded-[2.5rem] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-white/10">
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
              
              <div className="grid grid-cols-4 gap-3">
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
    </div>
  );
}
