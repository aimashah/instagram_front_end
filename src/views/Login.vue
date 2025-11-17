<template>
  <div class="center-box">
    <h2 style="text-align:center; margin-bottom:15px;">Login</h2>

    <form @submit.prevent="login">
      <input v-model="email" type="email" placeholder="Email" />
      <input v-model="password" type="password" placeholder="Password" />

      <button type="submit">Login</button>
    </form>

    <p style="text-align:center; margin-top:10px;">
      Don't have an account?
      <router-link to="/signup">Signup</router-link>
    </p>
  </div>
</template>

<script>
import api from "../api/axios";

export default {
  data() {
    return {
      email: "",
      password: ""
    };
  },

  methods: {
    async login() {
      try {
        const res = await api.post("/login", {
          email: this.email,
          password: this.password
        });

        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));

        this.$router.push("/");
      } catch (error) {
        console.log(error.response?.data);
        alert("Invalid email or password");
      }
    }
  }
};
</script>
