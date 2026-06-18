import { Request, Response } from 'express';
import { db, auth } from './db';

// This endpoint is called by the frontend after a successful Firebase Login
// It ensures the user document exists in Firestore and gives them a starting balance.
export const syncUser = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    const email = decodedToken.email;
    const username = decodedToken.name || email?.split('@')[0] || 'Player';

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // First time login - Create user document with starting balance
      await userRef.set({
        id: userId,
        username,
        email,
        balance: 1000,
        createdAt: new Date().toISOString()
      });
      res.json({ message: 'User created', balance: 1000, username });
    } else {
      const data = userDoc.data();
      res.json({ message: 'User synced', balance: data?.balance, username: data?.username });
    }
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Internal server error or invalid token' });
  }
};
