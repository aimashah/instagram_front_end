<template>
  <div class="center-box" style="width:400px;">
    <h2 style="text-align:center; margin-bottom:15px;">Create Post</h2>

    <form @submit.prevent="createPost">
      <input v-model="caption" type="text" placeholder="Caption" />
      <input type="file" @change="e => image = e.target.files[0]" />
      <button>Create</button>
    </form>
  </div>
</template>

<script>
import api from "../api/axios";

export default {
  data() {
    return { caption: "", image: null };
  },
  methods: {
    onFileChange(e) {
      this.image = e.target.files[0];
    },
    async createPost() {
  const formData = new FormData();
  formData.append("caption", this.caption);
  formData.append("image", this.image);  // <-- must be the actual File object

  try {
    const res = await api.post("/posts", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    console.log(res.data);
  } catch (err) {
    console.error(err.response?.data || err);
  }
}
  }
};
</script>
