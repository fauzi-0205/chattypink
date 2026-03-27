<script setup>
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, onMounted } from 'vue';

const { $auth, $db } = useNuxtApp();
const users = ref([]);
const currentUser = ref(null);
const searchQuery = ref("");
const showLoveAnimation = ref(false);

// --- AUDIO SETTINGS ✨ ---
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3";

const playNotification = () => {
  const audio = new Audio(NOTIFICATION_SOUND);
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

// --- NOTIFICATION SETUP ---
const setupNotifications = async (user) => {
  if (process.server) return; // Wajib: Jangan jalankan di server!

  try {
    const messaging = getMessaging();
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const token = await getToken(messaging, { 
        vapidKey: 'BHXeJv7ukgU-Q6T4TWqHmhabFH5r6aLMoPgnydVi1kHedmLkM6wEMo31v6HxO7FBD6QJvDbfz6orSULjWwbs2s0' 
      });

      if (token) {
        console.log("Token FCM Berhasil Didapat:", token);
        await updateDoc(doc($db, "users", user.uid), {
          fcmToken: token
        });
      }
    }
  } catch (error) {
    console.error("Gagal setting notifikasi:", error);
  }
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

// Filter users berdasarkan search
const filteredUsers = () => {
  if (!searchQuery.value) return users.value;
  return users.value.filter(user => 
    user.displayName?.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
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
          lastMessage: "💬 Belum ada pesan",
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
              usersData[index].lastMessage = "🎙️ Pesan suara";
            } else if (latestMsg.imageUrl) {
              usersData[index].lastMessage = "📷 Foto";
            } else if (latestMsg.text) {
              usersData[index].lastMessage = latestMsg.text.length > 35 ? latestMsg.text.substring(0, 35) + "..." : latestMsg.text;
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
                usersData[index].lastMsgTime = msgDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
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

        // Sort by last message time (pesan terbaru di atas)
        usersData.sort((a, b) => {
          if (!a.lastMsgTime && !b.lastMsgTime) return 0;
          if (!a.lastMsgTime) return 1;
          if (!b.lastMsgTime) return -1;
          // Sort berdasarkan waktu terbaru
          const getTimeValue = (timeStr) => {
            if (timeStr === "Baru saja") return Date.now();
            if (timeStr.includes("menit")) return Date.now() - parseInt(timeStr) * 60000;
            if (timeStr.includes("jam")) return Date.now() - parseInt(timeStr) * 3600000;
            if (timeStr.includes("hari")) return Date.now() - parseInt(timeStr) * 86400000;
            return 0;
          };
          return getTimeValue(b.lastMsgTime) - getTimeValue(a.lastMsgTime);
        });

        users.value = [...usersData];
        isInitialLoad = false;
      });
    });
  });
});
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-gradient-to-b from-pink-50 via-rose-50 to-orange-50 h-[100dvh] w-full overflow-hidden">
    
    <!-- Dekorasi Lucu (Ringan, Tanpa Animasi Berat) -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="absolute top-5 left-3 opacity-30 text-2xl">🌸</div>
      <div class="absolute top-1/4 right-2 opacity-30 text-xl">💖</div>
      <div class="absolute bottom-1/3 left-2 opacity-30 text-xl">✨</div>
      <div class="absolute bottom-10 right-3 opacity-30 text-2xl">🐱</div>
      <div class="absolute top-1/2 left-1 opacity-30 text-xl">🎀</div>
      <div class="absolute bottom-1/4 right-1/3 opacity-30 text-xl">🦄</div>
    </div>

    <!-- Floating Heart Effect (Ringan) -->
    <div v-if="showLoveAnimation" class="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div class="text-6xl font-bold animate-ping-once">💖</div>
    </div>

    <!-- Header Lucu Sesuai Chat -->
    <header class="bg-white/95 backdrop-blur-sm border-b-4 border-pink-200 px-5 py-4 flex justify-between items-center shrink-0 z-50 shadow-sm">
      <div>
        <h1 class="text-xl font-black bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent flex items-center gap-1">
          💬 Chatty
          <span class="text-base">🐣</span>
        </h1>
        <div class="flex items-center gap-1 mt-0.5">
          <div class="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
          <p class="text-[10px] font-bold text-pink-400">
            {{ users.filter(u => u.isOnline).length }} teman online
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button @click="navigateTo('/settings')" 
                class="w-9 h-9 bg-pink-100 text-pink-500 rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-sm">
          <span class="text-base">😊</span>
        </button>

        <button @click="$auth.signOut()" 
                class="w-9 h-9 bg-white rounded-full flex items-center justify-center text-pink-400 active:scale-95 transition-transform shadow-sm border border-pink-100">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke-width="2"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Search Bar -->
    <div class="px-4 pt-3 pb-2">
      <div class="bg-white/90 rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-sm border border-pink-100">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-width="2"/>
        </svg>
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Cari teman..." 
          class="bg-transparent flex-1 outline-none text-sm text-gray-700 placeholder:text-pink-300"
        >
        <span class="text-sm text-pink-400">🔍</span>
      </div>
    </div>

    <!-- List Chat -->
    <main class="flex-1 overflow-y-auto px-4 pb-28 pt-1">
      
      <!-- Empty State -->
      <div v-if="filteredUsers().length === 0" class="flex flex-col items-center justify-center h-64">
        <div class="w-20 h-20 bg-gradient-to-br from-pink-200 to-orange-200 rounded-full flex items-center justify-center shadow-md">
          <span class="text-4xl">💕</span>
        </div>
        <p class="text-sm font-bold text-pink-500 mt-4">Belum ada teman nih 😢</p>
        <p class="text-xs text-pink-400 mt-1 text-center px-8">
          Ajak temanmu dan mulai ngobrol seru! 🥰
        </p>
      </div>
      
      <!-- User List - Style Sesuai Chat -->
      <div v-for="user in filteredUsers()" :key="user.uid" 
           @click="navigateTo(`/chat/${user.uid}`)"
           class="flex items-center gap-3 px-3 py-2.5 mb-2 bg-white rounded-2xl active:bg-pink-50 transition-all cursor-pointer shadow-sm border border-pink-100">
        
        <!-- Avatar dengan Status -->
        <div class="relative shrink-0">
          <div class="w-12 h-12 bg-gradient-to-br from-pink-400 to-orange-400 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm overflow-hidden">
            <img v-if="user.photoURL" :src="user.photoURL" class="w-full h-full object-cover" />
            <span v-else>{{ user.displayName?.charAt(0).toUpperCase() || '?' }}</span>
          </div>
          <div class="absolute -bottom-0.5 -right-0.5">
            <div v-if="user.isOnline" class="w-3 h-3 bg-green-400 rounded-full ring-2 ring-white"></div>
            <div v-else class="w-3 h-3 bg-gray-300 rounded-full ring-2 ring-white"></div>
          </div>
        </div>
        
        <!-- Info Chat -->
        <div class="flex-1 overflow-hidden">
          <div class="flex justify-between items-center mb-0.5">
            <h2 class="font-bold text-sm text-gray-800 truncate max-w-[140px]">
              {{ user.displayName || 'Pengguna' }}
            </h2>
            <span class="text-[9px] text-pink-400 font-medium whitespace-nowrap ml-2">
              {{ user.lastMsgTime || 'Baru' }}
            </span>
          </div>
          
          <div class="flex items-center gap-1">
            <!-- Status Centang -->
            <span v-if="user.lastMsgStatus === 'read'" class="text-[10px] text-pink-400 shrink-0">✔✔</span>
            <span v-else-if="user.lastMsgStatus === 'sent'" class="text-[10px] text-pink-200 shrink-0">✔</span>
            
            <!-- Pesan Terakhir -->
            <p :class="user.unreadCount > 0 ? 'text-gray-800 font-semibold' : 'text-gray-400'" 
               class="text-[11px] truncate flex-1">
              <span v-if="user.unreadCount > 0" class="text-pink-500 font-bold mr-0.5">●</span>
              {{ user.lastMessage }}
            </p>
          </div>
        </div>

        <!-- Badge Unread -->
        <div v-if="user.unreadCount > 0" 
             class="shrink-0 bg-gradient-to-r from-pink-500 to-orange-500 text-white text-[10px] font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full shadow-sm">
          {{ user.unreadCount }}
        </div>
      </div>

      <!-- Info Online Count -->
      <div v-if="filteredUsers().length > 0" class="text-center py-4">
        <p class="text-[9px] text-pink-300 font-medium">
          💕 {{ users.filter(u => u.isOnline).length }} teman online • {{ filteredUsers().length }} total chat 💕
        </p>
      </div>
    </main>

    <!-- Bottom Navigation Simple -->
    <nav class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t-2 border-pink-100 px-6 py-2 flex justify-around items-center z-50">
      <button @click="navigateTo('/')" class="flex flex-col items-center gap-0.5 active:scale-95 transition-transform">
        <div class="p-2 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke-width="2"/>
          </svg>
        </div>
        <span class="text-[9px] font-bold text-pink-500">Chat</span>
      </button>

      <button @click="navigateTo('/stories')" class="flex flex-col items-center gap-0.5 active:scale-95 transition-transform">
        <div class="p-2 rounded-full bg-pink-50 text-pink-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke-width="2"/>
            <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" stroke-width="2"/>
          </svg>
        </div>
        <span class="text-[9px] font-bold text-gray-400">Status</span>
      </button>

      <button @click="triggerLoveAnimation" class="flex flex-col items-center gap-0.5 active:scale-95 transition-transform">
        <div class="p-2 rounded-full bg-pink-50 text-pink-400">
          <span class="text-xl leading-5">💕</span>
        </div>
        <span class="text-[9px] font-bold text-gray-400">Love</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
/* Animasi Ringan - Tidak Membuat Lag */
@keyframes ping-once {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-ping-once {
  animation: ping-once 0.3s ease-out forwards;
}

/* Scrollbar Disabled */
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

/* Transisi Halus */
.active\:scale-95:active {
  transform: scale(0.95);
}

/* Hover Effect Ringan */
.bg-white {
  transition: all 0.15s ease;
}

.bg-white:active {
  background-color: #fdf2f8;
}
</style>