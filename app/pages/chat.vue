<script setup>
import { collection, query, where, onSnapshot } from "firebase/firestore";

const { $auth, $db } = useNuxtApp();
const route = useRoute();

const users = ref([]);
const currentUser = ref(null);

onMounted(() => {
  $auth.onAuthStateChanged((user) => {
    if (!user) return navigateTo('/login');
    currentUser.value = user;

    // Ambil daftar user lain untuk sidebar
    const q = query(collection($db, "users"), where("uid", "!=", user.uid));
    onSnapshot(q, (snapshot) => {
      users.value = snapshot.docs.map(doc => doc.data());
    });
  });
});

const logout = async () => {
  await $auth.signOut();
  navigateTo('/login');
};
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Sidebar -->
    <div class="w-full md:w-80 bg-gray-100 border-r flex flex-col transition-all duration-300"
         :class="route.params.id ? 'hidden md:flex' : 'flex'">
      
      <!-- Sidebar Header -->
      <div class="p-4 bg-white border-b flex justify-between items-center">
        <h2 class="font-bold text-lg text-gray-800">Chats</h2>
        <button @click="logout" class="text-sm text-red-500">Logout</button>
      </div>

      <!-- User List -->
      <div class="flex-1 overflow-y-auto">
        <div v-for="user in users" :key="user.uid" 
             @click="navigateTo(`/chat/${user.uid}`)"
             class="flex items-center p-3 cursor-pointer hover:bg-white transition border-b"
             :class="{ 'bg-blue-100': route.params.id === user.uid }">
          <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold shrink-0">
            {{ user.displayName?.charAt(0).toUpperCase() }}
          </div>
          <div class="ml-3 overflow-hidden">
            <p class="font-medium text-gray-800 truncate">{{ user.displayName }}</p>
            <p class="text-xs text-green-500">● {{ user.status }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Chat Area -->
    <div class="flex-1 relative flex flex-col bg-gray-50"
         :class="!route.params.id ? 'hidden md:flex' : 'flex'">
      
      <!-- Render Child Page (chat/[id].vue) -->
      <NuxtPage />

      <!-- Placeholder for Desktop if no chat selected -->
      <div v-if="!route.params.id" class="absolute inset-0 flex items-center justify-center text-gray-400">
        <p>Pilih chat untuk memulai</p>
      </div>
    </div>
  </div>
</template>
