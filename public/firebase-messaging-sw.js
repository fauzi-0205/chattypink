importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Inisialisasi Firebase di dalam Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyDnH4ZQT7wIngtVmDyJz62goLP5LBijnEY", // Gunakan API Key asli kamu
  authDomain: "chat-app-belajar-bdb52.firebaseapp.com",
  projectId: "chat-app-belajar-bdb52",
  storageBucket: "chat-app-belajar-bdb52.firebasestorage.app",
  messagingSenderId: "720413194298",
  appId: "1:720413194298:web:f7d47a3d9c893b872b5d03"
});

const messaging = firebase.messaging();

// Menangani notifikasi saat tab atau aplikasi sedang ditutup (Background)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Pesan diterima di background:', payload);

  const notificationTitle = payload.notification.title || "Pesan Baru!";
  const notificationOptions = {
    body: payload.notification.body || "Ada pesan masuk di Chatty Pink!",
    icon: '/icon.png', // Pastikan kamu punya file icon.png di folder public/
    badge: '/icon.png', // Icon kecil di status bar Android
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});