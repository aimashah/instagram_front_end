<template>
  <Navbar v-if="isLoggedIn" />
  <router-view />
</template>

<script>
import Navbar from "./components/Navbar.vue";

export default {
  components: { Navbar },
  computed: {
    isLoggedIn() {
      return !!localStorage.getItem("token");
    }
  }
}
</script>
