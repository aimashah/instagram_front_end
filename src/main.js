import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import cable from "./api/actioncable";
import "./style.css";

const app = createApp(App);
app.config.globalProperties.$cable = cable;
app.use(router).mount("#app");
