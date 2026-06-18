import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import path from 'path';

try {
  const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
  initializeApp({
    credential: cert(serviceAccountPath),
    projectId: 'hun-coin'
  });
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.warn('⚠️ Firebase Admin Initialization Warning:');
  console.warn('Could not load serviceAccountKey.json. Fallback initializing without cert...');
  initializeApp({ projectId: 'hun-coin' });
}

export const db = getFirestore();
export const auth = getAuth();
