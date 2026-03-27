<script setup>
import { 
  collection, addDoc, query, orderBy, onSnapshot, 
  serverTimestamp, doc, getDoc, updateDoc, where, deleteDoc 
} from "firebase/firestore";
import { getMessaging, getToken } from "firebase/messaging"; // Tambahan FCM
import { ref, onMounted, nextTick } from 'vue';

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

// State Preview Gambar
const selectedImage = ref(null);
const imagePreviewUrl = ref(null);

// State View Foto
const showImageViewer = ref(false);
const currentImageViewUrl = ref("");

// State Voice Note
const isRecording = ref(false);
const recordingTimer = ref(0);
let mediaRecorder = null;
let audioChunks = [];
let timerInterval = null;

// Reference untuk scroll ke pesan
const messageRefs = ref({});

// --- AUDIO NOTIFIKASI ---
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3";

// --- LOGIKA NOTIFIKASI (FCM) ---
const setupNotifications = async (user) => {
  if (process.server) return; // Jangan jalankan di server

  try {
    const messaging = getMessaging();
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const token = await getToken(messaging, { 
        vapidKey: 'BHXeJv7ukgU-Q6T4TWqHmhabFH5r6aLMoPgnydVi1kHedmLkM6wEMo31v6HxO7FBD6QJvDbfz6orSULjWwbs2s0' 
      });

      if (token) {
        console.log("Token FCM Berhasil Didapat:", token);
        // Simpan token ke Firestore agar server tahu harus kirim notif ke mana
        await updateDoc(doc($db, "users", user.uid), {
          fcmToken: token
        });
      }
    } else {
      console.log("Izin notifikasi ditolak.");
    }
  } catch (error) {
    console.error("Gagal setting notifikasi:", error);
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

// --- SCROLL KE PESAN YANG DIREPLY ---
const scrollToMessage = (messageId) => {
  const element = document.getElementById(`msg-${messageId}`);
  if (element) {
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'nearest'
    });
    element.classList.add('highlight-message');
    setTimeout(() => {
      element.classList.remove('highlight-message');
    }, 1000);
  }
};

// --- VIEW FOTO ---
const openImageViewer = (imageUrl) => {
  currentImageViewUrl.value = imageUrl;
  showImageViewer.value = true;
};

const closeImageViewer = () => {
  showImageViewer.value = false;
  currentImageViewUrl.value = "";
};

// --- FUNGSI REPLY ---
const setReplyTarget = (msg) => {
  replyTarget.value = msg;
  nextTick(() => {
    const textarea = document.querySelector('textarea');
    if (textarea) textarea.focus();
  });
};

// --- LOGIKA REAL-TIME ---
onMounted(() => {
  $auth.onAuthStateChanged(async (user) => {
    if (!user) return navigateTo('/login');
    currentUser.value = user;

    // Jalankan Setup Notifikasi
    setupNotifications(user);

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
      
      messages.value = allMsgs.filter(m => 
        (m.senderId === user.uid && m.receiverId === friendId) ||
        (m.senderId === friendId && m.receiverId === user.uid)
      );

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const msg = change.doc.data();
          
          if (!isInitialLoad && msg.senderId === friendId && msg.receiverId === user.uid) {
              new Audio(NOTIFICATION_SOUND).play().catch(() => {});
          }

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
  const reply = replyTarget.value ? { 
    text: replyTarget.value.text || (replyTarget.value.imageUrl ? "📷 Foto" : (replyTarget.value.audioUrl ? "🎙️ Pesan Suara" : "Media")), 
    senderId: replyTarget.value.senderId,
    messageId: replyTarget.value.id
  } : null;
  
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
    if (currentUser.value) {
      await updateDoc(doc($db, "users", currentUser.value.uid), { typingTo: null });
    }
    scrollToBottom();
  }
};

const deleteMessage = async (msgId) => {
  if (confirm("Hapus pesan ini untuk semua orang?")) {
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

const triggerFileInput = () => {
  const input = document.getElementById('file-input');
  if (input) input.click();
};

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
  } catch (err) { alert("Izin mic ditolak"); }
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
  <div class="fixed inset-0 flex flex-col bg-gradient-to-b from-pink-50 via-rose-50 to-pink-100 h-[100dvh] w-full overflow-hidden" @click="closePicker">
    
    <!-- Header Estetik -->
    <header class="bg-white/90 backdrop-blur-md border-b border-pink-200 px-5 py-4 flex items-center shrink-0 z-50 shadow-sm">
      <button @click="navigateTo('/')" class="mr-3 p-1 active:scale-95 transition-transform">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M15 19l-7-7 7-7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="flex items-center gap-3 flex-1">
        <div class="relative">
          <div class="w-11 h-11 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full flex items-center justify-center text-white font-medium text-lg shadow-md overflow-hidden">
            <img v-if="friendPhoto" :src="friendPhoto" class="w-full h-full object-cover" />
            <span v-else class="text-xl tracking-wide">{{ friendName.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full" :class="friendStatus === 'Online' ? 'bg-emerald-400 ring-2 ring-white' : 'bg-gray-300 ring-2 ring-white'"></div>
        </div>
        <div class="flex-1">
          <h1 class="font-semibold text-base text-gray-800 tracking-wide">{{ friendName }}</h1>
          <p class="text-[10px] font-medium" :class="isFriendTyping ? 'text-pink-500' : (friendStatus === 'Online' ? 'text-emerald-500' : 'text-gray-400')">
            {{ isFriendTyping ? 'mengetik...' : (friendStatus === 'Online' ? 'online' : 'offline') }}
          </p>
        </div>
      </div>
    </header>

    <!-- Image Viewer Modal -->
    <div v-if="showImageViewer" class="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center" @click="closeImageViewer">
      <div class="relative max-w-full max-h-full p-4">
        <img :src="currentImageViewUrl" class="max-w-full max-h-[90vh] object-contain rounded-2xl" />
        <button @click.stop="closeImageViewer" class="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white text-xl">
          ✕
        </button>
      </div>
    </div>

    <!-- Chat Area -->
    <main id="chat-container" class="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-8">
      <div v-for="msg in messages" :key="msg.id" :id="`msg-${msg.id}`" :ref="el => messageRefs[msg.id] = el"
           :class="msg.senderId === currentUser?.uid ? 'flex justify-end' : 'flex justify-start'"
           class="message-item">
        <div class="max-w-[80%] relative group">
          
          <!-- Bubble Chat Estetik - Pink Solid -->
          <div :class="[
            msg.senderId === currentUser?.uid 
              ? 'bg-pink-500 text-white rounded-3xl rounded-br-md' 
              : 'bg-white/95 text-gray-800 rounded-3xl rounded-bl-md shadow-sm',
            'px-5 py-3'
          ]">
            
            <!-- Reply Preview dengan Klik -->
            <div v-if="msg.replyTo" 
                 @click="scrollToMessage(msg.replyTo.messageId)"
                 class="mb-2 p-2 rounded-xl bg-black/10 cursor-pointer hover:bg-black/20 transition-all">
              <div class="flex items-center gap-1 text-[10px] font-medium opacity-80 mb-0.5">
                <span>💬</span>
                <span>{{ msg.replyTo.senderId === currentUser?.uid ? 'Kamu' : friendName }}</span>
              </div>
              <p class="text-[11px] truncate italic">“{{ msg.replyTo.text || 'Media' }}”</p>
            </div>

            <!-- Image Message dengan Klik untuk View -->
            <img v-if="msg.imageUrl" 
                 :src="msg.imageUrl" 
                 @click="openImageViewer(msg.imageUrl)"
                 class="rounded-xl max-h-64 w-full object-cover mb-1 cursor-pointer hover:opacity-90 transition-opacity" />
            
            <!-- Audio Message -->
            <div v-if="msg.audioUrl" class="flex items-center gap-2 py-1">
              <span class="text-xl">🎙️</span>
              <audio :src="msg.audioUrl" controls class="h-8 w-40 rounded-full"></audio>
            </div>

            <!-- Text Message -->
            <p v-if="msg.text" class="text-[14px] leading-relaxed font-normal tracking-wide break-words">{{ msg.text }}</p>
            
            <!-- Time & Status -->
            <div class="text-[9px] mt-1.5 flex justify-end gap-1 font-medium tracking-wide">
               <span class="opacity-70">{{ msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...' }}</span>
               <span v-if="msg.senderId === currentUser?.uid" class="opacity-70">{{ msg.isRead ? '✓✓' : '✓' }}</span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="absolute -bottom-6 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" :class="msg.senderId === currentUser?.uid ? 'right-0' : 'left-0'">
            <button @click="setReplyTarget(msg)" class="text-[9px] bg-white rounded-full px-2.5 py-0.5 shadow-sm font-medium text-pink-500 hover:bg-pink-50 transition-all">
              💬 balas
            </button>
            <button v-if="msg.senderId === currentUser?.uid" @click="deleteMessage(msg.id)" class="text-[9px] bg-white rounded-full px-2.5 py-0.5 shadow-sm font-medium text-rose-400 hover:bg-rose-50 transition-all">
              🗑️
            </button>
          </div>
        </div>
      </div>
      
      <!-- Typing Indicator -->
      <div v-if="isFriendTyping" class="flex justify-start">
        <div class="bg-white/90 backdrop-blur rounded-2xl rounded-tl-md px-4 py-2.5 shadow-sm">
          <div class="flex gap-1.5">
            <span class="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style="animation-delay: 0s"></span>
            <span class="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
            <span class="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></span>
          </div>
        </div>
      </div>
    </main>

    <!-- Input Area -->
    <footer class="p-3 bg-white/95 backdrop-blur-md border-t border-pink-100 shrink-0 relative" @click.stop>
      
      <!-- Reply Preview dengan Klik -->
      <div v-if="replyTarget" 
           @click="scrollToMessage(replyTarget.id)"
           class="mb-2 bg-pink-50 rounded-xl p-2.5 flex justify-between items-center border border-pink-200 cursor-pointer hover:bg-pink-100 transition-all">
        <div class="flex-1">
          <p class="font-medium text-xs text-pink-600">💬 Membalas {{ replyTarget.senderId === currentUser?.uid ? 'pesanmu' : friendName }}</p>
          <p class="truncate text-xs text-gray-500 italic mt-0.5">{{ replyTarget.text || (replyTarget.imageUrl ? '📷 Foto' : (replyTarget.audioUrl ? '🎙️ Pesan Suara' : 'Media')) }}</p>
        </div>
        <button @click.stop="replyTarget = null" class="p-1.5 bg-white rounded-full shadow-sm hover:bg-pink-100 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M6 18L18 6M6 6l12 12" stroke-width="2"/>
          </svg>
        </button>
      </div>

      <!-- Image Preview -->
      <div v-if="imagePreviewUrl" class="absolute bottom-20 left-3 p-2 bg-white rounded-xl shadow-lg border border-pink-200">
        <div class="relative">
          <img :src="imagePreviewUrl" class="w-20 h-20 object-cover rounded-lg" />
          <button @click="imagePreviewUrl = null; selectedImage = null" class="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M6 18L18 6M6 6l12 12" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="flex items-end gap-2 max-w-full">
        <!-- Attach Button -->
        <button @click="triggerFileInput" v-if="!isRecording" class="p-2.5 bg-pink-100 rounded-full text-pink-500 active:scale-95 transition-all shrink-0 hover:bg-pink-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" stroke-width="2"/>
          </svg>
        </button>

        <!-- Input Field -->
        <div class="flex-1 relative bg-pink-50 rounded-2xl flex items-end p-1.5 border border-pink-200">
          <button @click="toggleEmoji" class="p-1.5 text-lg active:scale-95 transition-transform shrink-0 hover:bg-pink-100 rounded-full">
            {{ showEmojiPicker ? '⌨️' : '😊' }}
          </button>

          <textarea v-if="!isRecording" v-model="newMessage" @input="handleTyping" 
                    placeholder="Ketik pesan..." rows="1"
                    class="flex-1 bg-transparent p-2 outline-none text-sm resize-none max-h-28 font-normal tracking-wide"
                    style="line-height: 1.4"></textarea>
          
          <!-- Recording UI -->
          <div v-else class="flex-1 bg-gradient-to-r from-pink-400 to-rose-400 text-white p-2 rounded-xl flex justify-between items-center text-xs shadow-md mx-1">
            <div class="flex items-center gap-2 font-mono">
               <span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
               🎤 {{ Math.floor(recordingTimer/60) }}:{{ (recordingTimer%60).toString().padStart(2,'0') }}
            </div>
            <button @click="stopRecording" class="bg-white/20 px-3 py-1 rounded-full font-medium text-[10px] hover:bg-white/30">
              Kirim
            </button>
          </div>
        </div>

        <!-- Send Button -->
        <button @click="sendMessage" v-if="(newMessage.length > 0 || imagePreviewUrl) && !isRecording" 
                class="bg-pink-500 text-white p-3 rounded-full shadow-md active:scale-95 transition-all shrink-0 hover:bg-pink-600">
          <span v-if="isUploading" class="inline-block animate-spin">⏳</span>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 rotate-45 -translate-x-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
          </svg>
        </button>
        
        <!-- Voice Button -->
        <button v-else-if="!isRecording" @click="startRecording" 
                class="bg-pink-500 text-white p-3 rounded-full shadow-md active:scale-95 transition-all shrink-0 hover:bg-pink-600">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" stroke-width="2"/>
          </svg>
        </button>
      </div>

      <!-- Emoji Picker -->
      <div v-if="showEmojiPicker" class="absolute bottom-20 left-0 z-[100]">
        <EmojiPicker :native="true" @select="onSelectEmoji" class="emoji-picker-custom shadow-xl" />
      </div>
    </footer>

    <input type="file" id="file-input" class="hidden" accept="image/*" @change="handleImageUpload" />
  </div>
</template>

<style scoped>
/* Font Estetik */
@import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600&display=swap');

* {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

/* Animasi Ringan */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes highlight {
  0% {
    background-color: rgba(236, 72, 153, 0.2);
    transform: scale(1);
  }
  50% {
    background-color: rgba(236, 72, 153, 0.4);
    transform: scale(1.02);
  }
  100% {
    background-color: transparent;
    transform: scale(1);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}

.animate-bounce {
  animation: bounce 0.5s ease-in-out infinite;
}

.highlight-message {
  animation: highlight 0.6s ease-out;
}

/* Emoji Picker */
.emoji-picker-custom {
  --v3-emoji-picker-width: 290px;
  --v3-emoji-picker-height: 360px;
  border-radius: 1rem;
  border: 1px solid #fbc4d0;
}

/* Hide Scrollbar */
#chat-container::-webkit-scrollbar {
  display: none;
}

#chat-container {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Textarea */
textarea {
  line-height: 1.4;
  font-family: inherit;
}

textarea:focus {
  outline: none;
}

/* Active States */
.active\:scale-95:active {
  transform: scale(0.95);
}

/* Tap Highlight Remove */
* {
  -webkit-tap-highlight-color: transparent;
}

/* Smooth Transitions */
.transition-all {
  transition-duration: 0.15s;
}

/* Message Item Hover */
.message-item:hover .group-hover\:opacity-100 {
  opacity: 1;
}

/* Bubble Text Style */
.bg-pink-500 {
  background-color: #ec489a;
}

.bg-pink-500:hover {
  background-color: #db2777;
}
</style>