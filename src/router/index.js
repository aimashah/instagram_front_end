import { createRouter, createWebHistory } from "vue-router";

import Login from "../views/Login.vue";
import Signup from "../views/Signup.vue";
import Feed from "../views/Feed.vue";
import CreatePost from "../views/CreatePost.vue";
import Inbox from "../views/Inbox.vue";

const routes = [
  { path: "/login", component: Login },
  { path: "/signup", component: Signup },
  { path: "/inbox", component: Inbox, meta: { requiresAuth: true } },

  {
    path: "/",
    component: Feed,
    meta: { requiresAuth: true },
  },
  {
    path: "/create-post",
    component: CreatePost,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// PROTECT ROUTES
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("token");

  if (to.meta.requiresAuth && !token) {
    next("/login"); // redirect to login if not authenticated
  } else {
    next();
  }
});

export default router;
