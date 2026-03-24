import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export default defineNuxtPlugin(() => {
  const firebaseConfig = {
    apiKey: "AIzaSyDnH4ZQT7wIngtVmDyJz62goLP5LBijnEY",
    authDomain: "chat-app-belajar-bdb52.firebaseapp.com",
    projectId: "chat-app-belajar-bdb52",
    storageBucket: "chat-app-belajar-bdb52.firebasestorage.app",
    messagingSenderId: "720413194298",
    appId: "1:720413194298:web:f7d47a3d9c893b872b5d03"
  };

  // 1. Inisialisasi Firebase App
  const app = initializeApp(firebaseConfig);

  // 2. Berikan akses auth dan db ke seluruh aplikasi
  return {
    provide: {
      auth: getAuth(app),
      db: getFirestore(app)
    }
  };
});