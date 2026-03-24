<script setup>
import { 
  collection, addDoc, query, orderBy, onSnapshot, 
  serverTimestamp, where, Timestamp, deleteDoc, doc 
} from "firebase/firestore";
import { ref, onMounted, computed } from 'vue';

const { $auth, $db } = useNuxtApp();
const stories = ref([]);
const isUploading = ref(false);
const currentUser = ref(null);
const selectedStory = ref(null);
const showStoryViewer = ref(false);
const loveCounter = ref(0);

// Group stories by user
const groupedStories = computed(() => {
  const groups = {};
  stories.value.forEach(story => {
    if (!groups[story.userId]) {
      groups[story.userId] = {
        userId: story.userId,
        userDisplayName: story.userDisplayName,
        userPhoto: story.userPhoto,
        stories: [],
        lastUpdated: story.createdAt
      };
    }
    groups[story.userId].stories.push(story);
    if (story.createdAt > groups[story.userId].lastUpdated) {
      groups[story.userId].lastUpdated = story.createdAt;
    }
  });
  
  // Sort by last updated
  return Object.values(groups).sort((a, b) => {
    if (!a.lastUpdated && !b.lastUpdated) return 0;
    if (!a.lastUpdated) return 1;
    if (!b.lastUpdated) return -1;
    return b.lastUpdated.seconds - a.lastUpdated.seconds;
  });
});

onMounted(() => {
  $auth.onAuthStateChanged((user) => {
    if (!user) return navigateTo('/login');
    currentUser.value = user;

    // Ambil story 24 jam terakhir saja
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const q = query(
      collection($db, "stories"),
      where("createdAt", ">", Timestamp.fromDate(yesterday)),
      orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
      stories.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    });
  });
});

const handleFileUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  isUploading.value = true;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'preset_toko'); 
  
  const type = file.type.includes('video') ? 'video' : 'image';
  if (type === 'video') formData.append('resource_type', 'video');

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/dazzpveus/upload`, { 
      method: 'POST', 
      body: formData 
    });
    const data = await res.json();

    await addDoc(collection($db, "stories"), {
      userId: currentUser.value.uid,
      userDisplayName: currentUser.value.displayName,
      userPhoto: currentUser.value.photoURL,
      mediaUrl: data.secure_url,
      type: type,
      createdAt: serverTimestamp()
    });
    
    // Love animation
    loveCounter.value++;
    showLoveAnimation();
  } catch (err) {
    console.error(err);
    alert("Gagal upload story 😢");
  } finally {
    isUploading.value = false;
  }
};

const deleteStory = async (storyId) => {
  if (confirm("💔 Hapus story ini?")) {
    try {
      await deleteDoc(doc($db, "stories", storyId));
    } catch (err) {
      alert("Gagal menghapus story");
    }
  }
};

const viewStory = (story) => {
  selectedStory.value = story;
  showStoryViewer.value = true;
};

const closeStoryViewer = () => {
  showStoryViewer.value = false;
  selectedStory.value = null;
};

const formatTime = (timestamp) => {
  if (!timestamp) return "Baru saja";
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  return "Kemarin";
};

const showLoveAnimation = () => {
  const heart = document.createElement('div');
  heart.innerHTML = '💕';
  heart.style.position = 'fixed';
  heart.style.left = Math.random() * window.innerWidth + 'px';
  heart.style.bottom = '100px';
  heart.style.fontSize = '40px';
  heart.style.pointerEvents = 'none';
  heart.style.zIndex = '1000';
  heart.style.animation = 'floatUp 1s ease-out forwards';
  document.body.appendChild(heart);
  setTimeout(() => heart.remove(), 1000);
};
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
        <span class="text-3xl">📸</span>
      </div>
      <div class="absolute top-1/2 left-1 animate-wiggle">
        <span class="text-2xl">🎬</span>
      </div>
      <div class="absolute top-1/3 left-1/4 animate-pulse-soft">
        <span class="text-4xl">💕</span>
      </div>
      
      <!-- Love Rain -->
      <div v-for="i in 8" :key="i" class="love-rain" :style="{ left: i * 12 + '%', animationDelay: i * 0.6 + 's' }">
        💕
      </div>
    </div>

    <!-- Header Gemess -->
    <header class="bg-white/95 backdrop-blur-xl border-b-4 border-pink-300 px-6 py-5 flex justify-between items-center shrink-0 z-50 shadow-2xl">
      <div>
        <h1 class="text-2xl font-black bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent tracking-tight">
          📸 Story Time
        </h1>
        <div class="flex items-center gap-1 mt-1">
          <span class="text-sm">✨</span>
          <p class="text-[11px] font-bold text-pink-500 uppercase tracking-widest">
            {{ groupedStories.length }} Cerita Hari Ini
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button @click="navigateTo('/')" 
                class="w-10 h-10 bg-gradient-to-r from-pink-100 to-rose-100 text-pink-600 rounded-full flex items-center justify-center hover:from-pink-200 hover:to-rose-200 transition-all active:scale-90 shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke-width="2"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Stories List -->
    <main class="flex-1 overflow-y-auto p-4 pb-24">
      
      <!-- My Story Card -->
      <div class="mb-6 bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-pink-200 animate-slide-in">
        <div class="flex items-center gap-4">
          <div class="relative">
            <div class="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg overflow-hidden">
              <img v-if="currentUser?.photoURL" :src="currentUser.photoURL" class="w-full h-full object-cover" />
              <span v-else>{{ currentUser?.displayName?.charAt(0).toUpperCase() || 'U' }}</span>
            </div>
            <div class="absolute -bottom-1 -right-1">
              <label class="w-6 h-6 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
                <input type="file" class="hidden" accept="image/*,video/*" @change="handleFileUpload" />
                <span class="text-white text-xs">+</span>
              </label>
            </div>
          </div>
          <div class="flex-1">
            <p class="font-bold text-gray-800">Ceritakan momenmu ✨</p>
            <p class="text-[11px] text-pink-500 mt-0.5">Klik + untuk upload story</p>
          </div>
          <div v-if="isUploading" class="animate-spin">
            <span class="text-2xl">⏳</span>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="groupedStories.length === 0 && !isUploading" class="flex flex-col items-center justify-center py-16">
        <div class="relative">
          <div class="w-24 h-24 bg-gradient-to-br from-pink-300 to-rose-400 rounded-full flex items-center justify-center shadow-2xl animate-float-gentle">
            <span class="text-5xl">📸</span>
          </div>
          <div class="absolute -top-2 -right-2 animate-bounce">
            <span class="text-3xl">✨</span>
          </div>
        </div>
        <p class="text-base font-bold text-pink-600 mt-6">Belum ada story nih 😢</p>
        <p class="text-sm text-pink-500 mt-2 text-center px-8">
          Upload story pertamamu<br>
dan bagikan momen seru! 🥰
        </p>
      </div>

      <!-- Stories Grid -->
      <div v-for="group in groupedStories" :key="group.userId" class="mb-4 animate-slide-in">
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-pink-200">
          <!-- User Info -->
          <div class="p-4 border-b border-pink-100 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="relative">
                <div class="w-12 h-12 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center text-white font-bold shadow-md overflow-hidden">
                  <img v-if="group.userPhoto" :src="group.userPhoto" class="w-full h-full object-cover" />
                  <span v-else>{{ group.userDisplayName?.charAt(0).toUpperCase() }}</span>
                </div>
                <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white"></div>
              </div>
              <div>
                <p class="font-bold text-gray-800">{{ group.userDisplayName }}</p>
                <p class="text-[10px] text-pink-500">{{ formatTime(group.lastUpdated) }}</p>
              </div>
            </div>
            <div class="text-xs text-pink-400">
              {{ group.stories.length }} story
            </div>
          </div>

          <!-- Stories Preview -->
          <div class="p-3 grid grid-cols-3 gap-2">
            <div v-for="story in group.stories.slice(0, 3)" :key="story.id" 
                 @click="viewStory(story)"
                 class="relative aspect-square rounded-xl overflow-hidden cursor-pointer group-hover:scale-105 transition-transform">
              <img v-if="story.type === 'image'" :src="story.mediaUrl" class="w-full h-full object-cover" />
              <video v-else :src="story.mediaUrl" class="w-full h-full object-cover"></video>
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all"></div>
              <div v-if="story.type === 'video'" class="absolute bottom-1 right-1 bg-black/50 rounded-full p-1">
                <span class="text-white text-[10px]">🎬</span>
              </div>
              <button v-if="story.userId === currentUser?.uid" 
                      @click.stop="deleteStory(story.id)"
                      class="absolute top-1 right-1 bg-red-500/80 rounded-full p-1 hover:bg-red-600 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12" stroke-width="2"/>
                </svg>
              </button>
            </div>
            <div v-if="group.stories.length > 3" 
                 @click="viewStory(group.stories[0])"
                 class="bg-gradient-to-br from-pink-200 to-rose-200 rounded-xl flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
              <span class="text-2xl text-pink-500">+{{ group.stories.length - 3 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Cute Message -->
      <div class="text-center py-6">
        <p class="text-[10px] text-pink-400 animate-pulse">
          💕 Ceritakan momen indahmu! 💕
        </p>
      </div>
    </main>

    <!-- Bottom Navigation -->
    <nav class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t-4 border-pink-300 px-8 py-3 flex justify-around items-center z-50 shadow-[0_-4px_20px_rgba(236,72,153,0.1)]">
      <button @click="navigateTo('/')" class="flex flex-col items-center gap-1 transition-all active:scale-90 group">
        <div class="p-2.5 rounded-2xl bg-pink-50 text-pink-400 group-hover:bg-pink-100 group-hover:text-pink-500 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke-width="2"/>
          </svg>
        </div>
        <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-pink-400">Chat</span>
      </button>

      <button @click="navigateTo('/stories')" class="flex flex-col items-center gap-1 transition-all active:scale-90 group">
        <div class="p-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg group-hover:shadow-xl">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke-width="2"/>
            <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" stroke-width="2"/>
          </svg>
        </div>
        <span class="text-[10px] font-black text-pink-500 uppercase tracking-widest">Status</span>
      </button>

      <button @click="() => { loveCounter++; showLoveAnimation(); }" class="flex flex-col items-center gap-1 transition-all active:scale-90 group">
        <div class="p-2.5 rounded-2xl bg-pink-50 text-pink-400 group-hover:bg-pink-100 group-hover:text-pink-500 transition-all">
          <span class="text-2xl">💕</span>
        </div>
        <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-pink-400">Love</span>
      </button>
    </nav>

    <!-- Story Viewer Modal -->
    <div v-if="showStoryViewer && selectedStory" 
         class="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center animate-fade-in"
         @click="closeStoryViewer">
      <div class="relative w-full h-full flex items-center justify-center p-4" @click.stop>
        <button @click="closeStoryViewer" 
                class="absolute top-5 right-5 text-white text-2xl z-10 bg-black/50 rounded-full p-2 hover:bg-black/70 transition-all">
          ✕
        </button>
        
        <div class="max-h-[90vh] max-w-full">
          <img v-if="selectedStory.type === 'image'" :src="selectedStory.mediaUrl" class="max-h-[85vh] w-auto object-contain rounded-2xl shadow-2xl" />
          <video v-else :src="selectedStory.mediaUrl" controls autoplay class="max-h-[85vh] w-auto rounded-2xl shadow-2xl"></video>
        </div>
        
        <div class="absolute bottom-10 left-0 right-0 text-center">
          <div class="inline-block bg-black/50 backdrop-blur-lg rounded-full px-4 py-2">
            <p class="text-white text-sm font-bold">{{ selectedStory.userDisplayName }}</p>
            <p class="text-white/70 text-[10px]">{{ formatTime(selectedStory.createdAt) }}</p>
          </div>
        </div>
      </div>
    </div>
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

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
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

@keyframes floatUp {
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-200px) scale(1.5);
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

.animate-slide-in {
  animation: slide-in 0.3s ease-out forwards;
  opacity: 0;
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
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

/* Grid Stories */
.grid-cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
</style>