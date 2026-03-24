<script setup>
import { ref } from 'vue';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const email = ref("");
const password = ref("");
const isLoginMode = ref(true);
const showPassword = ref(false);
const isLoading = ref(false);

const registerUser = async () => {
  const { $auth, $db } = useNuxtApp();
  isLoading.value = true;
  try {
    const res = await createUserWithEmailAndPassword($auth, email.value, password.value);
    
    await setDoc(doc($db, "users", res.user.uid), {
      uid: res.user.uid,
      email: res.user.email,
      displayName: email.value.split('@')[0],
      status: "online",
      createdAt: serverTimestamp()
    });

    alert("🎉 Akun berhasil dibuat! Selamat datang! 🎉");
    navigateTo('/');
  } catch (error) {
    alert("😢 Error: " + error.message);
  } finally {
    isLoading.value = false;
  }
};

const loginUser = async () => {
  const { $auth } = useNuxtApp();
  isLoading.value = true;
  try {
    await signInWithEmailAndPassword($auth, email.value, password.value);
    alert("✨ Berhasil Login! Selamat datang kembali! ✨");
    navigateTo('/');
  } catch (error) {
    alert("😢 Error: " + error.message);
  } finally {
    isLoading.value = false;
  }
};

const toggleMode = () => {
  isLoginMode.value = !isLoginMode.value;
  email.value = "";
  password.value = "";
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
    <!-- Background Animasi -->
    <div class="absolute inset-0 bg-gradient-to-br from-pink-100 via-rose-100 to-purple-100">
      <div class="absolute inset-0">
        <div class="absolute top-10 left-10 animate-bounce-slow">
          <span class="text-4xl">🐱</span>
        </div>
        <div class="absolute top-20 right-20 animate-float">
          <span class="text-3xl">🌸</span>
        </div>
        <div class="absolute bottom-10 left-1/4 animate-pulse-slow">
          <span class="text-5xl">💕</span>
        </div>
        <div class="absolute bottom-20 right-10 animate-spin-slow">
          <span class="text-3xl">✨</span>
        </div>
        <div class="absolute top-1/2 left-10 animate-bounce">
          <span class="text-2xl">🐰</span>
        </div>
        <div class="absolute bottom-1/3 right-20 animate-float-delay">
          <span class="text-4xl">🎀</span>
        </div>
      </div>
    </div>

    <!-- Kartu Login -->
    <div class="relative z-10 w-full max-w-md">
      <div class="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 transform transition-all duration-500 hover:scale-105">
        
        <!-- Header dengan Animasi -->
        <div class="text-center mb-8">
          <div class="inline-block animate-bounce mb-3">
            <div class="bg-gradient-to-r from-pink-500 to-rose-500 rounded-full p-4 shadow-lg">
              <span class="text-4xl">💬</span>
            </div>
          </div>
          <h1 class="text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
            Chatty Pink!
          </h1>
          <p class="text-gray-500 mt-2 text-sm">
            {{ isLoginMode ? 'Ayo ngobrol seru! 💖' : 'Gabung jadi teman baru! 🎀' }}
          </p>
        </div>

        <!-- Form -->
        <div class="space-y-5">
          <div class="relative group">
            <label class="block text-sm font-medium text-pink-600 mb-2 ml-1">
              📧 Email
            </label>
            <input 
              v-model="email" 
              type="email" 
              placeholder="nama@email.com" 
              class="w-full p-3 border-2 border-pink-200 rounded-2xl focus:border-pink-500 focus:ring-2 focus:ring-pink-300 outline-none transition-all duration-300 bg-white/50"
            />
            <div class="absolute right-3 top-10 text-pink-300 group-focus-within:text-pink-500 transition-colors">
              💌
            </div>
          </div>
          
          <div class="relative group">
            <label class="block text-sm font-medium text-pink-600 mb-2 ml-1">
              🔐 Password
            </label>
            <div class="relative">
              <input 
                v-model="password" 
                :type="showPassword ? 'text' : 'password'" 
                placeholder="Min. 6 karakter" 
                class="w-full p-3 border-2 border-pink-200 rounded-2xl focus:border-pink-500 focus:ring-2 focus:ring-pink-300 outline-none transition-all duration-300 bg-white/50 pr-12"
              />
              <button 
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-pink-400 hover:text-pink-600 transition-colors"
              >
                {{ showPassword ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>

          <!-- Tombol Aksi -->
          <div class="flex gap-3 pt-4">
            <button 
              v-if="isLoginMode"
              @click="loginUser" 
              :disabled="isLoading"
              class="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white py-3 rounded-2xl font-bold hover:from-pink-600 hover:to-rose-600 transition-all duration-300 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
            >
              <span class="relative z-10 flex items-center justify-center gap-2">
                <span v-if="isLoading" class="animate-spin">⏳</span>
                <span v-else>✨</span>
                {{ isLoading ? 'Memproses...' : 'Login' }}
              </span>
              <div class="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
            </button>
            
            <button 
              v-if="!isLoginMode"
              @click="registerUser" 
              :disabled="isLoading"
              class="flex-1 bg-gradient-to-r from-pink-400 to-pink-500 text-white py-3 rounded-2xl font-bold hover:from-pink-500 hover:to-pink-600 transition-all duration-300 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
            >
              <span class="relative z-10 flex items-center justify-center gap-2">
                <span v-if="isLoading" class="animate-spin">⏳</span>
                <span v-else>🎀</span>
                {{ isLoading ? 'Memproses...' : 'Daftar' }}
              </span>
              <div class="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
            </button>
          </div>

          <!-- Tombol Switch Mode -->
          <div class="text-center pt-4">
            <button 
              @click="toggleMode"
              class="text-pink-500 hover:text-pink-700 text-sm font-medium transition-colors duration-300 flex items-center justify-center gap-1 mx-auto group"
            >
              <span class="group-hover:translate-x-1 transition-transform">🔄</span>
              {{ isLoginMode ? 'Belum punya akun? Daftar yuk!' : 'Sudah punya akun? Login aja!' }}
            </button>
          </div>
        </div>

        <!-- Footer Lucu -->
        <div class="mt-8 pt-4 border-t-2 border-pink-100 text-center">
          <p class="text-xs text-pink-400 flex items-center justify-center gap-1">
            <span>🐣</span>
            Yuk ngobrol seru!
            <span>💬</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes bounce-slow {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-15px);
  }
}

@keyframes float-delay {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-15px);
  }
}

@keyframes pulse-slow {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-bounce-slow {
  animation: bounce-slow 3s ease-in-out infinite;
}

.animate-float {
  animation: float 4s ease-in-out infinite;
}

.animate-float-delay {
  animation: float 5s ease-in-out infinite;
  animation-delay: 1s;
}

.animate-pulse-slow {
  animation: pulse-slow 2s ease-in-out infinite;
}

.animate-spin-slow {
  animation: spin-slow 8s linear infinite;
}
</style>