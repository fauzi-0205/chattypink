<script setup>
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, onMounted } from 'vue';

const { $auth, $db } = useNuxtApp();
const currentUser = ref(null);
const loading = ref(true);
const saving = ref(false);

// State Form Profil
const profile = ref({
  displayName: "",
  status: "",
  photoURL: ""
});

onMounted(() => {
  $auth.onAuthStateChanged(async (user) => {
    if (!user) return navigateTo('/login');
    currentUser.value = user;
    
    // Ambil data user dari Firestore
    const docSnap = await getDoc(doc($db, "users", user.uid));
    if (docSnap.exists()) {
      const data = docSnap.data();
      profile.value = {
        displayName: data.displayName || "",
        status: data.status || "Halo! Saya menggunakan Chat App",
        photoURL: data.photoURL || ""
      };
    }
    loading.value = false;
  });
});

// Fungsi Ganti Foto via Cloudinary
const handlePhotoUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  saving.value = true;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'preset_toko'); // Pastikan preset benar

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/dazzpveus/upload`, { 
      method: 'POST', 
      body: formData 
    });
    const data = await res.json();
    if (data.secure_url) {
      profile.value.photoURL = data.secure_url;
      // Langsung update di Firestore
      await updateDoc(doc($db, "users", currentUser.value.uid), {
        photoURL: data.secure_url
      });
    }
  } catch (err) {
    alert("Gagal upload foto");
  } finally {
    saving.value = false;
  }
};

// Fungsi Simpan Nama & Status
const saveProfile = async () => {
  if (!profile.value.displayName.trim()) return alert("Nama tidak boleh kosong");
  
  saving.value = true;
  try {
    await updateDoc(doc($db, "users", currentUser.value.uid), {
      displayName: profile.value.displayName,
      status: profile.value.status
    });
    alert("Profil berhasil diperbarui! ✨");
  } catch (err) {
    alert("Gagal menyimpan perubahan");
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#F7F9FB] font-sans">
    <header class="bg-white border-b px-4 py-4 flex items-center sticky top-0 z-50">
      <button @click="navigateTo('/')" class="mr-4 p-1 active:scale-90 transition-transform">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M15 19l-7-7 7-7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <h1 class="font-black text-lg text-gray-800">Pengaturan Profil</h1>
    </header>

    <main v-if="!loading" class="p-6 max-w-md mx-auto space-y-8">
      
      <div class="flex flex-col items-center">
        <div class="relative group">
          <div class="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl bg-blue-100 flex items-center justify-center">
            <img v-if="profile.photoURL" :src="profile.photoURL" class="w-full h-full object-cover" />
            <span v-else class="text-4xl font-black text-blue-500">{{ profile.displayName.charAt(0).toUpperCase() }}</span>
          </div>
          <label class="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full text-white shadow-lg cursor-pointer active:scale-90 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke-width="2"/>
              <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" stroke-width="2"/>
            </svg>
            <input type="file" class="hidden" accept="image/*" @change="handlePhotoUpload" />
          </label>
        </div>
        <p class="mt-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Ketuk ikon kamera untuk ganti foto</p>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-[11px] font-black text-gray-400 uppercase mb-1 ml-1">Nama Tampilan</label>
          <input v-model="profile.displayName" type="text" 
                 class="w-full bg-white border-none p-4 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-400 outline-none font-bold text-gray-700" 
                 placeholder="Masukkan namamu...">
        </div>

        <div>
          <label class="block text-[11px] font-black text-gray-400 uppercase mb-1 ml-1">Status / Bio</label>
          <textarea v-model="profile.status" rows="2"
                    class="w-full bg-white border-none p-4 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-400 outline-none font-medium text-gray-600 resize-none" 
                    placeholder="Ceritakan sedikit tentangmu..."></textarea>
        </div>
      </div>

      <button @click="saveProfile" :disabled="saving"
              class="w-full bg-blue-600 text-white p-4 rounded-2xl font-black shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2">
        <span v-if="saving" class="animate-spin inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span>
        {{ saving ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN ✨' }}
      </button>

      <button @click="$auth.signOut(); navigateTo('/login')" 
              class="w-full bg-red-50 text-red-500 p-4 rounded-2xl font-bold border border-red-100 active:bg-red-100 transition-colors">
        Keluar dari Akun 🚪
      </button>

    </main>

    <div v-else class="h-screen flex items-center justify-center bg-white">
      <div class="animate-bounce text-4xl">⚙️</div>
    </div>
  </div>
</template>