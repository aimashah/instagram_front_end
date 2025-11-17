<template>
  <div class="center-box">
    <h2 style="text-align:center; margin-bottom:20px;">Signup</h2>

    <form @submit.prevent="signup">
      <input type="text" v-model="name" placeholder="Name" />
      <input type="email" v-model="email" placeholder="Email" />
      <input type="password" v-model="password" placeholder="Password" />

      <button type="submit">Signup</button>
    </form>

    <p style="text-align:center; margin-top:15px;">
      Already have an account?
      <router-link to="/login">Login</router-link>
    </p>
  </div>
</template>

<script>
import api from "../api/axios";

export default {
  data() {
    return {
      name: "",
      email: "",
      password: ""
    };
  },

  methods: {
    async signup() {
      try {
        const res = await api.post("/signup", {
          user: {
            name: this.name,
            email: this.email,
            password: this.password,
          },
        });

        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));

        alert("Signup successful!");
        this.$router.push("/");
      } catch (err) {
        alert(err.response?.data?.errors?.join("\n") || "Signup failed");
      }
    },
  },
};
</script>
