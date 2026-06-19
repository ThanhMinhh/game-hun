import { db } from './db';
import crypto from 'crypto';

const SYMBOLS = ['H', '💎', '🔔', '🍒', '🍋', '🍉'];

const getRandomSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

export const resolveSlots = async (sessionId: string) => {
  const sessionRef = db.collection('gameSessions').doc(sessionId);

  return await db.runTransaction(async (transaction) => {
    // === READ PHASE ===
    const sessionDoc = await transaction.get(sessionRef);
    if (!sessionDoc.exists) {
      throw new Error('Invalid session');
    }

    const sessionData = sessionDoc.data()!;
    if (sessionData.status === 'COMPLETED') {
      throw new Error('Session already completed');
    }

    // RNG cho Slots (3 symbols)
    const resultReels = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];

    // Tính toán hệ số nhân (Multiplier)
    let multiplier = 0;
    if (resultReels[0] === resultReels[1] && resultReels[1] === resultReels[2]) {
      const symbol = resultReels[0];
      if (symbol === 'H') multiplier = 10;
      else if (symbol === '💎') multiplier = 5;
      else if (symbol === '🔔') multiplier = 3;
      else multiplier = 2; // 🍒, 🍋, 🍉
    }

    const isWin = multiplier > 0;

    const betsSnapshot = await db.collection('bets').where('sessionId', '==', sessionId).get();

    const usersToUpdate: { ref: any, newBalance: number, payout: number, userId: string, taxAmount: number }[] = [];

    for (const betDoc of betsSnapshot.docs) {
      const betData = betDoc.data();
      
      if (isWin) {
        const userRef = db.collection('users').doc(betData.userId);
        const userDoc = await transaction.get(userRef);
        const userData = userDoc.data();

        if (userData) {
          const TAX_RATE = 0.01; // 1% tax on profits
          const rawWinnings = betData.amount * multiplier;
          const taxAmount = (rawWinnings - betData.amount) * TAX_RATE;
          const payout = rawWinnings - taxAmount;

          usersToUpdate.push({
            ref: userRef,
            newBalance: userData.balance + payout,
            payout,
            userId: betData.userId,
            taxAmount
          });
        }
      }
    }

    // === WRITE PHASE ===
    const secret = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(`${resultReels.join('-')}-${secret}`).digest('hex');

    transaction.update(sessionRef, {
      status: 'COMPLETED',
      result: resultReels,
      secret,
      hash,
      completedAt: new Date().toISOString()
    });

    for (const betDoc of betsSnapshot.docs) {
      const betData = betDoc.data();
      const betRef = db.collection('bets').doc(betDoc.id);

      const userUpdate = usersToUpdate.find(u => u.userId === betData.userId);
      const payout = userUpdate ? userUpdate.payout : 0;

      transaction.update(betRef, {
        isWin,
        payout
      });

      if (isWin && userUpdate) {
        transaction.update(userUpdate.ref, { balance: userUpdate.newBalance });

        const transRef = db.collection('transactions').doc();
        transaction.set(transRef, {
          userId: userUpdate.userId,
          type: 'WIN',
          amount: payout,
          description: `Won Slots [${resultReels.join('')}] x${multiplier} (Tax: ${userUpdate.taxAmount} HUN)`,
          createdAt: new Date().toISOString()
        });
      }
    }

    return { result: resultReels, multiplier, hash, secret };
  });
};
