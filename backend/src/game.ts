import { db } from './db';
import crypto from 'crypto';

export const resolveCoinflip = async (sessionId: string) => {
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

    // RNG cho Coinflip (50/50)
    const resultChoice = Math.random() < 0.5 ? 'HEADS' : 'TAILS';

    // Lấy tất cả các bets của session này 
    // (Query thông thường không tham gia lock, nhưng lấy dữ liệu trước khi write)
    const betsSnapshot = await db.collection('bets').where('sessionId', '==', sessionId).get();

    const usersToUpdate: { ref: any, newBalance: number, payout: number, userId: string, taxAmount: number }[] = [];

    // Thực hiện tất cả các lệnh READ (transaction.get) trước khi có bất kỳ lệnh WRITE nào
    for (const betDoc of betsSnapshot.docs) {
      const betData = betDoc.data();
      const isWin = betData.choice === resultChoice;

      if (isWin) {
        const userRef = db.collection('users').doc(betData.userId);
        const userDoc = await transaction.get(userRef); // BẮT BUỘC ĐỌC TRƯỚC WRITE
        const userData = userDoc.data();

        if (userData) {
          const TAX_RATE = 0.01; // 5% tax
          const rawWinnings = betData.amount * 2;
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
    // Sinh hash Provably Fair
    const secret = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(`${resultChoice}-${secret}`).digest('hex');

    // 1. Cập nhật session
    transaction.update(sessionRef, {
      status: 'COMPLETED',
      result: resultChoice,
      secret,
      hash,
      completedAt: new Date().toISOString()
    });

    // 2. Cập nhật bets và users
    for (const betDoc of betsSnapshot.docs) {
      const betData = betDoc.data();
      const betRef = db.collection('bets').doc(betDoc.id);

      const isWin = betData.choice === resultChoice;
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
          description: `Won Coinflip (Tax: ${userUpdate.taxAmount} HUN)`,
          createdAt: new Date().toISOString()
        });
      }
    }

    return { result: resultChoice, hash, secret };
  });
};
