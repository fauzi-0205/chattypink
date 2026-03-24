<script setup>
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, onMounted } from 'vue';

const { $auth, $db } = useNuxtApp();
const users = ref([]);
const currentUser = ref(null);
const showLoveAnimation = ref(false);

// --- AUDIO SETTINGS ✨ ---
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3";

const playNotification = () => {
  const audio = new Audio(NOTIFICATION_SOUND);
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

// Update status aktif kita sendiri
const updateMyStatus = async () => {
  if (currentUser.value) {
    await updateDoc(doc($db, "users", currentUser.value.uid), {
      lastActive: serverTimestamp()
    });
  }
};

// Animasi love random
const triggerLoveAnimation = () => {
  showLoveAnimation.value = true;
  setTimeout(() => {
    showLoveAnimation.value = false;
  }, 1000);
};

onMounted(() => {
  $auth.onAuthStateChanged((user) => {
    if (!user) return navigateTo('/login');
    currentUser.value = user;

    updateMyStatus();
    setInterval(updateMyStatus, 60000);

    // 1. Ambil Data Users
    const qUsers = query(collection($db, "users"), where("uid", "!=", user.uid));
    
    onSnapshot(qUsers, (snapshot) => {
      let usersData = snapshot.docs.map(doc => {
        const data = doc.data();
        const isOnline = data.lastActive?.seconds * 1000 > Date.now() - 120000;
        
        return {
          uid: doc.id,
          ...data,
          isOnline,
          lastMessage: "Belum ada pesan",
          unreadCount: 0,
          lastMsgStatus: "",
          lastMsgTime: null
        };
      });

      // 2. Ambil Pesan untuk Notifikasi & Update List
      const qMessages = query(collection($db, "messages"), orderBy("createdAt", "desc"));
      
      let isInitialLoad = true;

      onSnapshot(qMessages, (msgSnapshot) => {
        const allMsgs = msgSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // --- CEK PESAN BARU UNTUK SUARA ✨ ---
        msgSnapshot.docChanges().forEach((change) => {
          if (change.type === "added" && !isInitialLoad) {
            const newMsg = change.doc.data();
            if (newMsg.receiverId === user.uid && !newMsg.isRead) {
              playNotification();
              triggerLoveAnimation();
            }
          }
        });

        // 3. Update Tampilan Pesan Terakhir di List User
        usersData.forEach((u, index) => {
          const latestMsg = allMsgs.find(m => 
            (m.senderId === user.uid && m.receiverId === u.uid) ||
            (m.senderId === u.uid && m.receiverId === user.uid)
          );

          if (latestMsg) {
            if (latestMsg.audioUrl) {
              usersData[index].lastMessage = "🎙️ Pesan Suara";
            } else if (latestMsg.imageUrl) {
              usersData[index].lastMessage = "📷 Foto";
            } else if (latestMsg.text) {
              usersData[index].lastMessage = latestMsg.text.length > 30 ? latestMsg.text.substring(0, 30) + "..." : latestMsg.text;
            }
            
            if (latestMsg.senderId === user.uid) {
              usersData[index].lastMsgStatus = latestMsg.isRead ? "read" : "sent";
            } else {
              usersData[index].lastMsgStatus = "";
            }
            
            // Format waktu
            if (latestMsg.createdAt) {
              const msgDate = new Date(latestMsg.createdAt.seconds * 1000);
              const now = new Date();
              const diffMs = now - msgDate;
              const diffMins = Math.floor(diffMs / 60000);
              const diffHours = Math.floor(diffMs / 3600000);
              const diffDays = Math.floor(diffMs / 86400000);
              
              if (diffMins < 1) {
                usersData[index].lastMsgTime = "Baru saja";
              } else if (diffMins < 60) {
                usersData[index].lastMsgTime = `${diffMins} menit lalu`;
              } else if (diffHours < 24) {
                usersData[index].lastMsgTime = `${diffHours} jam lalu`;
              } else if (diffDays < 7) {
                usersData[index].lastMsgTime = `${diffDays} hari lalu`;
              } else {
                usersData[index].lastMsgTime = msgDate.toLocaleDateString('id-ID');
              }
            }
          }

          // Hitung Unread per User
          const incomingMsgs = allMsgs.filter(m => 
            m.senderId === u.uid && 
            m.receiverId === user.uid && 
            m.isRead === false
          );
          usersData[index].unreadCount = incomingMsgs.length;
        });

        // Sort by last message time
        usersData.sort((a, b) => {
          if (!a.lastMsgTime && !b.lastMsgTime) return 0;
          if (!a.lastMsgTime) return 1;
          if (!b.lastMsgTime) return -1;
          return 0; // Keep order
        });

        users.value = [...usersData];
        isInitialLoad = false;
      });
    });
  });
});
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-gradient-to-br from-pink-100 via-rose-100 to-purple-100 h-[100dvh] w-full overflow-hidden">
    
    <!-- Background Animasi Gemess -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="absolute top-5 left-3 animate-float-slow">
        <span class="text-3xl">🌸</span>
      </div>
      <div class="absolute top-1/4 right-2 animate-bounce-gentle">
        <span class="text-2xl">💖</span>
      </div>
      <div class="absolute bottom-1/3 left-2 animate-spin-soft">
        <span class="text-2xl">✨</span>
      </div>
      <div class="absolute bottom-10 right-3 animate-float-delay">
        <span class="text-3xl">🐱</span>
      </div>
      <div class="absolute top-1/2 left-1 animate-wiggle">
        <span class="text-2xl">🎀</span>
      </div>
      <div class="absolute top-1/3 left-1/4 animate-pulse-soft">
        <span class="text-4xl">💕</span>
      </div>
      <div class="absolute bottom-1/4 right-1/3 animate-float-slow">
        <span class="text-2xl">🦄</span>
      </div>
      
      <!-- Love Rain Animation -->
      <div v-for="i in 8" :key="i" class="love-rain" :style="{ left: i * 12 + '%', animationDelay: i * 0.6 + 's' }">
        💕
      </div>
    </div>

    <!-- Floating Hearts Effect -->
    <div v-if="showLoveAnimation" class="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div class="heart-explosion">
        <span class="text-6xl animate-bounce-heart">💖</span>
        <span class="text-5xl absolute animate-float-up" style="left: -40px">💕</span>
        <span class="text-5xl absolute animate-float-up-delay" style="right: -40px">💗</span>
        <span class="text-4xl absolute animate-float-up-slow" style="top: -50px">💝</span>
      </div>
    </div>

    <!-- Header Gemess -->
    <header class="bg-white/95 backdrop-blur-xl border-b-4 border-pink-300 px-6 py-5 flex justify-between items-center shrink-0 z-50 shadow-2xl">
      <div>
        <h1 class="text-2xl font-black bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent tracking-tight">
          💬 Chatty Pink
        </h1>
        <div class="flex items-center gap-1 mt-1">
          <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <p class="text-[11px] font-bold text-pink-500 uppercase tracking-widest">
            {{ users.filter(u => u.isOnline).length }} Teman Online
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button @click="navigateTo('/settings')" 
                class="w-10 h-10 bg-gradient-to-r from-pink-100 to-rose-100 text-pink-600 rounded-full flex items-center justify-center hover:from-pink-200 hover:to-rose-200 transition-all active:scale-90 shadow-md">
          <span class="text-lg">⚙️</span>
        </button>

        <button @click="$auth.signOut()" 
                class="w-10 h-10 bg-white/80 rounded-full flex items-center justify-center text-pink-400 hover:text-pink-600 transition-all active:scale-90 shadow-md hover:shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Search Bar -->
    <div class="px-6 py-3">
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-3 flex items-center gap-2 text-pink-400 shadow-lg border border-pink-200">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-width="2.5"/>
        </svg>
        <input type="text" placeholder="Cari teman lucu..." class="bg-transparent flex-1 outline-none text-sm text-gray-700 placeholder:text-pink-300">
        <span class="text-sm">💕</span>
      </div>
    </div>

    <!-- List Chat -->
    <main class="flex-1 overflow-y-auto pt-2 pb-24 px-4">
      
      <!-- Empty State -->
      <div v-if="users.length === 0" class="flex flex-col items-center justify-center h-64">
        <div class="relative">
          <div class="w-24 h-24 bg-gradient-to-br from-pink-300 to-rose-400 rounded-full flex items-center justify-center shadow-2xl animate-float-gentle">
            <span class="text-5xl">💕</span>
          </div>
          <div class="absolute -top-2 -right-2 animate-bounce">
            <span class="text-3xl">✨</span>
          </div>
        </div>
        <p class="text-base font-bold text-pink-600 mt-6">Belum ada teman nih 😢</p>
        <p class="text-sm text-pink-500 mt-2 text-center px-8">
          Ajak temanmu untuk bergabung<br>
dan mulai ngobrol seru! 🥰
        </p>
      </div>
      
      <!-- User List -->
      <div v-for="(user, idx) in users" :key="user.uid" 
           @click="navigateTo(`/chat/${user.uid}`)"
           class="flex items-center px-4 py-3 mb-2 bg-white/80 backdrop-blur-sm rounded-2xl hover:bg-white/95 active:bg-pink-50 transition-all cursor-pointer group shadow-md hover:shadow-xl border border-pink-100 animate-slide-in"
           :style="{ animationDelay: idx * 0.05 + 's' }">
        
        <div class="relative shrink-0">
          <div class="w-14 h-14 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg transition-transform group-active:scale-95 overflow-hidden">
            <img v-if="user.photoURL" :src="user.photoURL" class="w-full h-full object-cover" />
            <span v-else>{{ user.displayName?.charAt(0).toUpperCase() }}</span>
          </div>
          <div v-if="user.isOnline" class="absolute bottom-0 right-0">
            <div class="w-4 h-4 bg-green-500 rounded-full animate-ping absolute"></div>
            <div class="w-4 h-4 bg-green-500 rounded-full relative ring-2 ring-white"></div>
          </div>
          <div v-else class="absolute bottom-0 right-0 w-4 h-4 bg-gray-400 rounded-full ring-2 ring-white"></div>
        </div>
        
        <div class="ml-3 flex-1 overflow-hidden">
          <div class="flex justify-between items-center mb-1">
            <h2 class="font-bold text-[15px] text-gray-800 truncate">
              {{ user.displayName }}
              <span v-if="user.isOnline" class="text-[10px] text-green-500 ml-1">●</span>
            </h2>
            <span class="text-[9px] text-pink-400 font-medium whitespace-nowrap ml-2">
              {{ user.lastMsgTime || 'Baru bergabung' }}
            </span>
          </div>
          
          <div class="flex items-center gap-1.5">
            <div v-if="user.lastMsgStatus === 'read'" class="flex shrink-0">
              <span class="text-[10px] text-pink-500">✔✔</span>
            </div>
            <div v-else-if="user.lastMsgStatus === 'sent'" class="flex shrink-0">
              <span class="text-[10px] text-pink-300">✔</span>
            </div>
            
            <p :class="user.unreadCount > 0 ? 'text-gray-900 font-bold' : 'text-gray-500'" 
               class="text-[12px] truncate leading-tight flex-1">
              <span v-if="user.unreadCount > 0" class="font-bold text-pink-600">• </span>
              {{ user.lastMessage || '💬 Belum ada pesan' }}
            </p>
          </div>
        </div>

        <div v-if="user.unreadCount > 0" 
             class="ml-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[11px] font-bold min-w-[24px] h-6 flex items-center justify-center rounded-full shadow-lg animate-pulse">
          {{ user.unreadCount }}
        </div>
      </div>

      <!-- Suggestion Message -->
      <div v-if="users.length > 0" class="text-center py-6">
        <p class="text-[10px] text-pink-400 animate-pulse">
          💕 {{ users.filter(u => u.isOnline).length }} teman sedang online 💕
        </p>
      </div>
    </main>

    <!-- Bottom Navigation Gemess -->
    <nav class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t-4 border-pink-300 px-8 py-3 flex justify-around items-center z-50 shadow-[0_-4px_20px_rgba(236,72,153,0.1)]">
      <button @click="navigateTo('/')" class="flex flex-col items-center gap-1 transition-all active:scale-90 group">
        <div class="p-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg group-hover:shadow-xl">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="text-[10px] font-black text-pink-500 uppercase tracking-widest">Chat</span>
      </button>

      <button @click="navigateTo('/stories')" class="flex flex-col items-center gap-1 transition-all active:scale-90 group">
        <div class="p-2.5 rounded-2xl bg-pink-50 text-pink-400 group-hover:bg-pink-100 group-hover:text-pink-500 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-pink-400">Status</span>
      </button>

      <button @click="triggerLoveAnimation" class="flex flex-col items-center gap-1 transition-all active:scale-90 group">
        <div class="p-2.5 rounded-2xl bg-pink-50 text-pink-400 group-hover:bg-pink-100 group-hover:text-pink-500 transition-all">
          <span class="text-2xl">💕</span>
        </div>
        <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-pink-400">Love</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
/* Animasi Gemess */
@keyframes bounce-gentle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

@keyframes float-slow {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
}

@keyframes float-delay {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-12px); }
}

@keyframes spin-soft {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(10deg); }
  75% { transform: rotate(-10deg); }
}

@keyframes pulse-soft {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.8; }
}

@keyframes float-gentle {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-15px); }
}

@keyframes bounce-heart {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.8; }
}

@keyframes float-up {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-100px) scale(1.5); opacity: 0; }
}

@keyframes float-up-delay {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-80px) scale(1.3); opacity: 0; }
}

@keyframes float-up-slow {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-120px) scale(1.8); opacity: 0; }
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes love-rain-fall {
  0% {
    transform: translateY(-20px) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.5;
  }
  90% {
    opacity: 0.5;
  }
  100% {
    transform: translateY(100vh) rotate(360deg);
    opacity: 0;
  }
}

/* Class Animations */
.animate-bounce-gentle {
  animation: bounce-gentle 3s ease-in-out infinite;
}

.animate-float-slow {
  animation: float-slow 6s ease-in-out infinite;
}

.animate-float-delay {
  animation: float-delay 5s ease-in-out infinite;
  animation-delay: 1s;
}

.animate-spin-soft {
  animation: spin-soft 8s linear infinite;
}

.animate-wiggle {
  animation: wiggle 3s ease-in-out infinite;
}

.animate-pulse-soft {
  animation: pulse-soft 2s ease-in-out infinite;
}

.animate-float-gentle {
  animation: float-gentle 4s ease-in-out infinite;
}

.animate-bounce-heart {
  animation: bounce-heart 0.5s ease-in-out;
}

.animate-float-up {
  animation: float-up 1s ease-out forwards;
}

.animate-float-up-delay {
  animation: float-up-delay 1s ease-out forwards;
  animation-delay: 0.2s;
}

.animate-float-up-slow {
  animation: float-up-slow 1.2s ease-out forwards;
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out forwards;
  opacity: 0;
}

/* Love Rain */
.love-rain {
  position: absolute;
  top: -20px;
  font-size: 20px;
  animation: love-rain-fall 5s linear infinite;
  pointer-events: none;
  opacity: 0.5;
}

/* Heart Explosion */
.heart-explosion {
  position: relative;
  animation: heart-explosion 0.5s ease-out;
}

@keyframes heart-explosion {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Scrollbar */
main::-webkit-scrollbar {
  display: none;
}

main {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Tap Highlight Remove */
* {
  -webkit-tap-highlight-color: transparent;
}
</style>