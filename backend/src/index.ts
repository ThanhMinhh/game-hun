import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

import { syncUser, updateProfile } from './auth';
import { processBet } from './wallet';
import { resolveCoinflip } from './game';
import { auth } from './db';

app.post('/api/auth/sync', syncUser);

// Middleware to verify Firebase Auth Token
const requireAuth = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = { userId: decodedToken.uid, email: decodedToken.email };
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.post('/api/user/profile', requireAuth, updateProfile);

app.post('/api/game/coinflip/bet', requireAuth, async (req: any, res: any) => {
  try {
    const { amount, choice } = req.body;
    const result = await processBet(req.user.userId, 'COINFLIP', amount, choice);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/game/coinflip/resolve', requireAuth, async (req: any, res: any) => {
  try {
    const { sessionId } = req.body;
    const result = await resolveCoinflip(sessionId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Gộp 2 thao tác thành 1 API duy nhất để giảm một nửa thời gian Ping qua mạng
app.post('/api/game/coinflip/play', requireAuth, async (req: any, res: any) => {
  try {
    const { amount, choice } = req.body;
    const betResult = await processBet(req.user.userId, 'COINFLIP', amount, choice);
    const resolveResult = await resolveCoinflip(betResult.session.id);
    
    res.json({
      bet: betResult,
      resolve: resolveResult
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Hun Entertainment Backend is running' });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
