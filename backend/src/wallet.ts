import { db } from './db';
import crypto from 'crypto';

export const processBet = async (userId: string, gameType: string, amount: number, choice: string) => {
  if (amount <= 0) {
    throw new Error('Bet amount must be greater than 0');
  }

  const userRef = db.collection('users').doc(userId);
  const sessionRef = db.collection('gameSessions').doc();
  const transactionRef = db.collection('transactions').doc();
  const betRef = db.collection('bets').doc();

  // Run a Firestore Transaction to ensure consistency and prevent Double Spending (Race Conditions)
  return await db.runTransaction(async (transaction) => {
    // 1. Read the user document
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    if (!userData || userData.balance < amount) {
      throw new Error('Insufficient balance');
    }

    const newBalance = userData.balance - amount;

    // 2. Deduct balance
    transaction.update(userRef, { balance: newBalance });

    // 3. Create a transaction record for the BET
    transaction.set(transactionRef, {
      userId,
      type: 'BET',
      amount: -amount,
      description: `Bet placed on ${gameType}`,
      createdAt: new Date().toISOString()
    });

    // 4. Create Game Session & Bet
    transaction.set(sessionRef, {
      gameType,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });

    transaction.set(betRef, {
      userId,
      sessionId: sessionRef.id,
      amount,
      choice,
      isWin: false,
      payout: 0,
      createdAt: new Date().toISOString()
    });

    return { 
      updatedBalance: newBalance, 
      session: { id: sessionRef.id, gameType, status: 'PENDING' },
      bet: { id: betRef.id, amount, choice }
    };
  });
};
