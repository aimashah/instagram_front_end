<template>
  <div class="navbar">
    <h2 style="cursor:pointer" @click="$router.push('/')">Instagram Lite</h2>

    <div>
      <router-link to="/">Home</router-link>
      <router-link to="/create-post">Create Post</router-link>

      <button @click="logout" style="width:auto; padding:6px 12px; margin-left:10px; background:#ff3b3b;">
        Logout
      </button>
    </div>
  </div>
</template>

<script>
export default {
  methods: {
    logout() {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      this.$router.push("/login");
    }
  }
}
</script>
