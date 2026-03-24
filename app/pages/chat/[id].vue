<script setup>
import { 
  collection, addDoc, query, orderBy, onSnapshot, 
  serverTimestamp, doc, getDoc, updateDoc, where, deleteDoc 
} from "firebase/firestore";
import { ref, onMounted, nextTick, watch } from 'vue';

// Import Library Emoji
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'

const route = useRoute();
const { $auth, $db } = useNuxtApp();

// State dasar
const messages = ref([]);
const newMessage = ref("");
const currentUser = ref(null);
const friendName = ref("...");
const friendPhoto = ref(""); 
const friendStatus = ref("Offline");
const isFriendTyping = ref(false);
const isUploading = ref(false);
const replyTarget = ref(null);
const friendId = route.params.id;
const showEmojiPicker = ref(false);
const showHeartAnimation = ref(false);
const loveCounter = ref(0);

// State Preview Gambar
const selectedImage = ref(null);
const imagePreviewUrl = ref(null);

// State Voice Note
const isRecording = ref(false);
const recordingTimer = ref(0);
let mediaRecorder = null;
let audioChunks = [];
let timerInterval = null;

// --- AUDIO NOTIFIKASI ---
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3";

// --- FUNGSI GEMESS ---
const sendLove = () => {
  loveCounter.value++;
  showHeartAnimation.value = true;
  setTimeout(() => {
    showHeartAnimation.value = false;
  }, 1000);
  
  // Kirim pesan love special setiap 3 love
  if (loveCounter.value % 3 === 0) {
    const loveMessages = [
      "💕 Kamu spesial banget! 💕",
      "💖 Aku sayang kamu! 💖",
      "🌸 Kamu membuat hariku cerah! 🌸",
      "💗 Selalu ada buat kamu! 💗",
      "✨ Kamu adalah yang terbaik! ✨"
    ];
    const randomLove = loveMessages[Math.floor(Math.random() * loveMessages.length)];
    addDoc(collection($db, "messages"), {
      text: randomLove,
      senderId: currentUser.value.uid,
      receiverId: friendId,
      createdAt: serverTimestamp(),
      type: 'text',
      isRead: false,
      isSpecial: true
    });
  }
};

// --- FUNGSI EMOJI ---
const onSelectEmoji = (emoji) => {
  newMessage.value += emoji.i; 
};

const toggleEmoji = () => {
  showEmojiPicker.value = !showEmojiPicker.value;
};

const closePicker = () => {
  showEmojiPicker.value = false;
};

// --- AUTO SCROLL ---
const scrollToBottom = () => {
  nextTick(() => {
    const container = document.getElementById('chat-container');
    if (container) container.scrollTop = container.scrollHeight;
  });
};

// --- LOGIKA REAL-TIME ---
onMounted(() => {
  $auth.onAuthStateChanged(async (user) => {
    if (!user) return navigateTo('/login');
    currentUser.value = user;

    // Monitor Status Teman
    onSnapshot(doc($db, "users", friendId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        friendName.value = data.displayName || "User";
        friendPhoto.value = data.photoURL || ""; 
        const isOnline = data.lastActive?.seconds * 1000 > Date.now() - 120000;
        friendStatus.value = isOnline ? "Online" : "Offline";
        isFriendTyping.value = data.typingTo === user.uid;
      }
    });

    // Monitor Pesan
    const q = query(collection($db, "messages"), orderBy("createdAt", "asc"));
    let isInitialLoad = true;

    onSnapshot(q, (snapshot) => {
      const allMsgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter pesan khusus antara saya dan teman ini
      messages.value = allMsgs.filter(m => 
        (m.senderId === user.uid && m.receiverId === friendId) ||
        (m.senderId === friendId && m.receiverId === user.uid)
      );

      // Logika Suara & Mark as Read
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const msg = change.doc.data();
          
          // Bunyi jika ada pesan masuk dari teman saat kita sedang buka chatnya
          if (!isInitialLoad && msg.senderId === friendId && msg.receiverId === user.uid) {
             new Audio(NOTIFICATION_SOUND).play().catch(() => {});
          }

          // Otomatis tandai dibaca
          if (msg.receiverId === user.uid && !msg.isRead) {
            updateDoc(doc($db, "messages", change.doc.id), { isRead: true });
          }
        }
      });

      isInitialLoad = false;
      scrollToBottom();
    });
  });
});

// --- LOGIKA PESAN ---
const sendMessage = async () => {
  if (!newMessage.value.trim() && !imagePreviewUrl.value) return;

  const text = newMessage.value;
  const reply = replyTarget.value ? { text: replyTarget.value.text || "Media", senderId: replyTarget.value.senderId } : null;
  
  newMessage.value = ""; 
  replyTarget.value = null;
  showEmojiPicker.value = false;

  try {
    let finalImageUrl = null;
    if (imagePreviewUrl.value && selectedImage.value) {
      isUploading.value = true;
      finalImageUrl = await uploadToCloudinary(selectedImage.value, 'image');
      imagePreviewUrl.value = null;
      selectedImage.value = null;
    }

    await addDoc(collection($db, "messages"), {
      text: text || null,
      imageUrl: finalImageUrl || null,
      senderId: currentUser.value.uid,
      receiverId: friendId,
      createdAt: serverTimestamp(),
      type: finalImageUrl ? 'image' : 'text',
      isRead: false,
      replyTo: reply
    });
    
  } catch (err) {
    console.error("Gagal mengirim:", err);
  } finally {
    isUploading.value = false;
    await updateDoc(doc($db, "users", currentUser.value.uid), { typingTo: null });
    scrollToBottom();
  }
};

const deleteMessage = async (msgId) => {
  if (confirm("💔 Hapus pesan ini?")) {
    try {
      await deleteDoc(doc($db, "messages", msgId));
    } catch (err) {
      alert("Gagal menghapus pesan");
    }
  }
};

const uploadToCloudinary = async (file, type) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'preset_toko'); 
  if (type === 'audio') formData.append('resource_type', 'video');

  const res = await fetch(`https://api.cloudinary.com/v1_1/dazzpveus/upload`, { method: 'POST', body: formData });
  const data = await res.json();
  return data.secure_url;
};

const handleTyping = () => {
  if (currentUser.value) {
    updateDoc(doc($db, "users", currentUser.value.uid), { 
      typingTo: newMessage.value.length > 0 ? friendId : null 
    });
  }
};

const triggerFileInput = () => document.getElementById('file-input').click();

const handleImageUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedImage.value = file;
    imagePreviewUrl.value = URL.createObjectURL(file);
  }
};

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      isUploading.value = true;
      const audioBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
      const url = await uploadToCloudinary(audioBlob, 'audio');
      if (url) {
        await addDoc(collection($db, "messages"), {
          audioUrl: url,
          senderId: currentUser.value.uid,
          receiverId: friendId,
          createdAt: serverTimestamp(),
          type: 'audio', isRead: false
        });
      }
      isUploading.value = false;
    };
    mediaRecorder.start();
    isRecording.value = true;
    recordingTimer.value = 0;
    timerInterval = setInterval(() => recordingTimer.value++, 1000);
  } catch (err) { alert("🎤 Izin mic ditolak :("); }
};

const stopRecording = () => {
  if (mediaRecorder && isRecording.value) {
    mediaRecorder.stop();
    isRecording.value = false;
    clearInterval(timerInterval);
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
};
</script>

<template>
  <div class="fixed inset-0 flex flex-col h-[100dvh] w-full overflow-hidden bg-gradient-to-br from-pink-200 via-rose-200 to-purple-200" @click="closePicker">
    
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
    <div v-if="showHeartAnimation" class="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div class="heart-explosion">
        <span class="text-6xl animate-bounce-heart">💖</span>
        <span class="text-5xl absolute animate-float-up" style="left: -40px">💕</span>
        <span class="text-5xl absolute animate-float-up-delay" style="right: -40px">💗</span>
        <span class="text-4xl absolute animate-float-up-slow" style="top: -50px">💝</span>
      </div>
    </div>

    <!-- Header Gemess -->
    <header class="bg-white/95 backdrop-blur-xl border-b-4 border-pink-300 px-4 py-3 flex items-center shrink-0 z-50 shadow-2xl">
      <button @click="navigateTo('/')" class="mr-3 p-2 active:scale-90 transition-transform hover:bg-pink-100 rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M15 19l-7-7 7-7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="flex items-center gap-3 flex-1">
        <div class="relative">
          <div class="w-14 h-14 bg-gradient-to-br from-pink-400 via-rose-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold shadow-2xl text-xl overflow-hidden animate-pulse-ring">
            <img v-if="friendPhoto" :src="friendPhoto" class="w-full h-full object-cover" />
            <span v-else>{{ friendName.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="absolute -bottom-1 -right-1">
            <div v-if="friendStatus === 'Online'" class="relative">
              <div class="w-4 h-4 bg-green-500 rounded-full animate-ping absolute"></div>
              <div class="w-4 h-4 bg-green-500 rounded-full relative"></div>
            </div>
            <div v-else class="w-4 h-4 bg-gray-400 rounded-full"></div>
          </div>
        </div>
        <div class="flex-1">
          <h1 class="font-bold text-[18px] leading-tight bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 bg-clip-text text-transparent">
            {{ friendName }}
            <span class="text-sm ml-1" v-if="friendStatus === 'Online'">💕</span>
          </h1>
          <div class="flex items-center gap-1">
            <p class="text-[11px] font-bold" :class="isFriendTyping ? 'text-pink-500' : (friendStatus === 'Online' ? 'text-green-500' : 'text-gray-400')">
              {{ isFriendTyping ? '✍️ Sedang mengetik...' : (friendStatus === 'Online' ? '💖 Online' : '💤 Offline') }}
            </p>
            <div v-if="isFriendTyping" class="typing-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        </div>
        <button @click="sendLove" class="p-2 hover:bg-pink-100 rounded-full transition-all active:scale-110">
          <span class="text-2xl animate-pulse">💕</span>
        </button>
      </div>
    </header>

    <!-- Container Chat -->
    <main id="chat-container" class="flex-1 overflow-y-auto p-4 space-y-4 pb-10 relative" style="background: repeating-linear-gradient(45deg, rgba(255,215,235,0.2) 0px, rgba(255,215,235,0.2) 2px, transparent 2px, transparent 8px)">
      
      <!-- Welcome Message -->
      <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center">
        <div class="relative">
          <div class="w-28 h-28 bg-gradient-to-br from-pink-300 to-rose-400 rounded-full flex items-center justify-center shadow-2xl animate-float-gentle">
            <span class="text-5xl">💖</span>
          </div>
          <div class="absolute -top-2 -right-2 animate-bounce">
            <span class="text-3xl">✨</span>
          </div>
        </div>
        <p class="text-lg font-bold text-pink-600 mt-6 animate-pulse">Halo {{ friendName }}! 💕</p>
        <p class="text-sm text-pink-500 mt-2 text-center px-8">
          Ayo mulai ngobrol!<br>
          Kirim pesan lucu atau sentuh tombol 💕 untuk kirim love! 🥰
        </p>
        <div class="flex gap-2 mt-6">
          <div class="w-8 h-8 bg-pink-200 rounded-full animate-bounce-slow"></div>
          <div class="w-8 h-8 bg-rose-200 rounded-full animate-bounce-slow" style="animation-delay: 0.2s"></div>
          <div class="w-8 h-8 bg-pink-300 rounded-full animate-bounce-slow" style="animation-delay: 0.4s"></div>
        </div>
      </div>

      <!-- Messages -->
      <div v-for="(msg, idx) in messages" :key="msg.id" :class="msg.senderId === currentUser?.uid ? 'flex justify-end' : 'flex justify-start'">
        <div class="max-w-[85%] relative group animate-slide-in" :style="{ animationDelay: idx * 0.03 + 's' }">
          
          <!-- Delete Button -->
          <button v-if="msg.senderId === currentUser?.uid"
                  @click="deleteMessage(msg.id)"
                  class="absolute -left-10 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-pink-400 hover:text-pink-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-width="2"/>
            </svg>
          </button>

          <!-- Special Love Badge -->
          <div v-if="msg.isSpecial" class="absolute -top-6 left-1/2 transform -translate-x-1/2 text-pink-500 text-xs whitespace-nowrap animate-float-up">
            💕 special love! 💕
          </div>

          <div :class="msg.senderId === currentUser?.uid ? 
            'bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-3xl rounded-tr-md shadow-2xl' : 
            'bg-white/95 backdrop-blur-sm text-gray-800 rounded-3xl rounded-tl-md shadow-xl border-2 border-pink-200'"
               class="p-3.5 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl">
            
            <!-- Reply Preview -->
            <div v-if="msg.replyTo" class="bg-black/15 p-2 rounded-xl mb-2 text-[10px] border-l-4 border-pink-300 backdrop-blur-sm">
              <p class="font-bold">💬 {{ msg.replyTo.senderId === currentUser.uid ? 'Anda' : friendName }}</p>
              <p class="truncate italic text-[11px]">{{ msg.replyTo.text || 'Media' }}</p>
            </div>

            <!-- Image Message -->
            <img v-if="msg.imageUrl" :src="msg.imageUrl" class="rounded-2xl max-h-64 w-full object-cover mb-1 border-2 border-pink-200 shadow-lg hover:scale-105 transition-transform" />
            
            <!-- Audio Message -->
            <div v-if="msg.audioUrl" class="flex items-center gap-2 py-1">
              <span class="text-xl animate-pulse">🎙️</span>
              <audio :src="msg.audioUrl" controls class="h-8 w-48 rounded-full"></audio>
            </div>

            <!-- Text Message -->
            <p v-if="msg.text" class="text-[15px] px-1 leading-relaxed font-medium">
              {{ msg.text }}
              <span v-if="Math.random() > 0.8 && msg.senderId !== currentUser?.uid" class="inline-block ml-1 animate-bounce">💕</span>
            </p>
            
            <!-- Timestamp -->
            <div class="text-[9px] mt-2 flex justify-end gap-1 font-bold" :class="msg.senderId === currentUser?.uid ? 'text-pink-100' : 'text-pink-400'">
              <span>{{ msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...' }}</span>
              <span v-if="msg.senderId === currentUser?.uid">{{ msg.isRead ? '✔✔' : '✔' }}</span>
              <span v-else-if="!msg.isRead" class="text-pink-400">💕 baru</span>
            </div>
          </div>

          <!-- Reply Button -->
          <button @click="replyTarget = msg" 
                  class="absolute -bottom-6 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap" 
                  :class="msg.senderId === currentUser?.uid ? 'right-0 text-pink-400' : 'left-0 text-pink-400'">
            💕 Balas 💕
          </button>
        </div>
      </div>
    </main>

    <!-- Footer Input -->
    <footer class="p-3 bg-white/95 backdrop-blur-xl border-t-4 border-pink-300 shrink-0 relative shadow-2xl" @click.stop>
      
      <!-- Reply Preview -->
      <div v-if="replyTarget" class="mb-2 bg-gradient-to-r from-pink-100 to-rose-100 p-3 rounded-2xl text-xs flex justify-between items-center border-2 border-pink-300 shadow-lg animate-slide-up">
        <div class="border-l-4 border-pink-500 pl-3 overflow-hidden">
          <p class="font-bold text-pink-600 text-[11px]">💬 Membalas {{ replyTarget.senderId === currentUser.uid ? 'Anda' : friendName }}</p>
          <p class="truncate text-gray-600 italic text-[11px]">{{ replyTarget.text || '📷 Media' }}</p>
        </div>
        <button @click="replyTarget = null" class="p-1.5 bg-white rounded-full shadow-md hover:shadow-lg transition-all active:scale-90">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" stroke-width="3"/></svg>
        </button>
      </div>

      <!-- Image Preview -->
      <div v-if="imagePreviewUrl" class="absolute bottom-24 left-4 p-2 bg-white rounded-2xl shadow-2xl border-2 border-pink-200 animate-slide-up">
        <div class="relative">
          <img :src="imagePreviewUrl" class="w-32 h-32 object-cover rounded-xl" />
          <button @click="imagePreviewUrl = null; selectedImage = null" class="absolute -top-2 -right-2 bg-pink-500 text-white rounded-full p-1 shadow-md hover:bg-pink-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" stroke-width="2"/></svg>
          </button>
        </div>
      </div>

      <!-- Input Area -->
      <div class="flex items-end gap-2 max-w-full">
        <button @click="triggerFileInput" v-if="!isRecording" class="p-3 bg-gradient-to-r from-pink-200 to-rose-200 rounded-full text-pink-600 active:scale-90 transition-all shrink-0 mb-0.5 shadow-md hover:shadow-lg hover:scale-105">
          <span class="text-xl">📎</span>
        </button>

        <div class="flex-1 relative bg-pink-50 rounded-3xl flex items-end p-1.5 shadow-inner border-2 border-pink-300 focus-within:border-pink-500 transition-all">
          <button @click="toggleEmoji" class="p-2 text-2xl active:scale-90 transition-transform shrink-0 hover:bg-pink-100 rounded-full">
            {{ showEmojiPicker ? '⌨️' : '😊' }}
          </button>

          <textarea v-if="!isRecording" v-model="newMessage" @input="handleTyping" 
                    placeholder="Ketik sesuatu yang lucu... 💕" rows="1"
                    class="flex-1 bg-transparent p-2.5 outline-none text-[15px] resize-none max-h-32 transition-all placeholder:text-pink-300 font-medium"></textarea>
          
          <div v-else class="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white p-3 rounded-2xl flex justify-between items-center text-sm shadow-xl mx-1 my-0.5">
            <div class="flex items-center gap-2 font-mono font-bold">
               <div class="relative">
                 <div class="w-3 h-3 bg-white rounded-full animate-ping absolute"></div>
                 <div class="w-3 h-3 bg-white rounded-full"></div>
               </div>
               {{ Math.floor(recordingTimer/60) }}:{{ (recordingTimer%60).toString().padStart(2,'0') }}
            </div>
            <button @click="stopRecording" class="bg-white/20 px-4 py-1.5 rounded-full font-black uppercase text-[10px] hover:bg-white/30 transition-all active:scale-95">
              ✨ Kirim ✨
            </button>
          </div>
          
          <div v-if="newMessage.length > 0 && !isRecording" class="px-2 text-pink-400">
            <span class="text-sm animate-pulse">💕</span>
          </div>
        </div>

        <button @click="sendMessage" v-if="(newMessage.length > 0 || imagePreviewUrl || isUploading) && !isRecording" 
                class="bg-gradient-to-r from-pink-500 to-rose-500 text-white p-4 rounded-full shadow-xl active:scale-90 transition-all shrink-0 mb-0.5 hover:shadow-2xl hover:scale-105">
          <span v-if="isUploading" class="animate-spin block">⏳</span>
          <span v-else class="text-xl">💕</span>
        </button>
        <button v-else-if="!isRecording" @click="startRecording" 
                class="bg-gradient-to-r from-pink-500 to-rose-500 text-white p-4 rounded-full shadow-xl active:scale-95 transition-all shrink-0 mb-0.5 hover:shadow-2xl hover:scale-105">
          <span class="text-xl">🎤</span>
        </button>
      </div>
      
      <!-- Cute Message -->
      <div class="text-center mt-2">
        <p class="text-[9px] text-pink-400 animate-pulse">
          💖 tekan 💕 untuk kirim love spesial! 💖
        </p>
      </div>
    </footer>

    <!-- Emoji Picker -->
    <div v-if="showEmojiPicker" class="absolute bottom-24 left-2 z-[100] shadow-2xl animate-slide-up">
      <EmojiPicker :native="true" @select="onSelectEmoji" class="emoji-picker-custom" />
    </div>

    <input type="file" id="file-input" class="hidden" accept="image/*" @change="handleImageUpload" />
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

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(236, 72, 153, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(236, 72, 153, 0);
  }
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-5px);
  }
}

@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
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

.animate-slide-up {
  animation: slide-up 0.2s ease-out;
}

.animate-pulse-ring {
  animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-bounce-slow {
  animation: bounce-slow 2s ease-in-out infinite;
}

/* Typing Dots */
.typing-dots {
  display: inline-flex;
  gap: 2px;
  margin-left: 4px;
}

.typing-dots span {
  width: 4px;
  height: 4px;
  background-color: #ec489a;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
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

/* Emoji Picker */
.emoji-picker-custom {
  --v3-emoji-picker-width: 300px;
  --v3-emoji-picker-height: 380px;
  border-radius: 2rem;
  border: 3px solid #f9a8d4;
  box-shadow: 0 20px 25px -5px rgba(236, 72, 153, 0.3);
}

/* Scrollbar */
#chat-container::-webkit-scrollbar { display: none; }
#chat-container { -ms-overflow-style: none; scrollbar-width: none; }

textarea { 
  line-height: 1.4;
  font-family: inherit;
}

* {
  -webkit-tap-highlight-color: transparent;
}

/* Hover Effects */
button {
  transition: all 0.2s ease;
}

button:active {
  transform: scale(0.95);
}
</style>