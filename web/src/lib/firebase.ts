import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCasS6sA1qUh-UAy8SE1gw7xFeg-OBJmAs",
  authDomain: "hun-coin.firebaseapp.com",
  projectId: "hun-coin",
  storageBucket: "hun-coin.firebasestorage.app",
  messagingSenderId: "434650411882",
  appId: "1:434650411882:web:0934da77e1d39fa7792b13",
  measurementId: "G-ZR2J6JGQ7F"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
