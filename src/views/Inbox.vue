<template>
  <div class="inbox-page">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h3>Inbox</h3>
        <p v-if="usersLoading">Loading people…</p>
        <p v-else-if="usersError" class="text-error">{{ usersError }}</p>
        <p v-else-if="!users.length" class="text-muted">
          Invite more people to start chatting.
        </p>
      </div>

      <ul class="user-list" v-if="users.length">
        <li
          v-for="user in users"
          :key="user.id"
          :class="{ active: isActiveUser(user) }"
          @click="selectUser(user)"
        >
          <span class="user-name">{{ user.name }}</span>
          <span class="user-email">{{ user.email }}</span>
        </li>
      </ul>
    </aside>

    <section class="conversation">
      <div v-if="error" class="alert error">{{ error }}</div>

      <div v-if="!activeUser" class="placeholder">
        Select someone from the list to start a conversation.
      </div>

      <div v-else class="conversation-body">
        <header class="conversation-header">
          <div>
            <h3>{{ activeUser.name }}</h3>
            <small>{{ activeUser.email }}</small>
          </div>
        </header>

        <div v-if="loading" class="alert info">Loading messages...</div>

        <div v-else class="messages">
          <div
            v-for="message in messages"
            :key="message.id"
            :class="[
              'message',
              { 'message-self': isOwnMessage(message), 'message-pending': message.status === 'sending', 'message-error': message.status === 'failed' }
            ]"
          >
            <p class="message-meta">
              <strong>{{ message.sender?.name || "Unknown" }}</strong>
              <span>{{ formatTimestamp(message.created_at) }}</span>
            </p>
            <p>{{ message.content }}</p>
            <small v-if="message.status === 'sending'" class="message-status">Sending…</small>
            <small v-else-if="message.status === 'failed'" class="message-status error">Failed to send</small>
          </div>
        </div>

        <form @submit.prevent="sendMessage" class="composer">
          <input
            v-model="newMessage"
            placeholder="Write a message"
            autocomplete="off"
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </section>
  </div>
</template>

<script>
import api from "../api/axios";

export default {
  data() {
    return {
      users: [],
      usersLoading: false,
      usersError: "",
      messages: [],
      newMessage: "",
      receiverId: null,
      activeUser: null,
      loading: false,
      error: "",
      subscription: null,
    };
  },
  computed: {
    currentUser() {
      try {
        return JSON.parse(localStorage.getItem("user")) || null;
      } catch (err) {
        return null;
      }
    },
  },
  watch: {
    "$route.query.receiverId": {
      immediate: true,
      handler(value) {
        const nextId = value ? String(value) : null;
        if (nextId === this.receiverId) return;

        this.receiverId = nextId;
        this.messages = [];
        if (this.receiverId) {
          this.syncActiveUser();
          if (this.activeUser) {
            this.fetchMessages();
          }
        } else {
          this.activeUser = null;
        }
      },
    },
    users() {
      this.syncActiveUser();
      if (this.receiverId && this.activeUser && this.messages.length === 0) {
        this.fetchMessages();
      }
    },
  },
  mounted() {
    if (!this.currentUser) {
      this.$router.push("/login");
      return;
    }

    this.fetchUsers();
    this.subscribeToMessages();
  },
  beforeUnmount() {
    this.teardownSubscription();
  },
  methods: {
    async fetchUsers() {
      this.usersLoading = true;
      this.usersError = "";
      try {
        const { data } = await api.get("/users");
        this.users = data;

        if (!this.$route.query.receiverId && data.length > 0) {
          this.$router.replace({
            path: "/inbox",
            query: { receiverId: data[0].id },
          });
        }
      } catch (error) {
        this.usersError =
          error.response?.data?.error || "Unable to load users at the moment.";
      } finally {
        this.usersLoading = false;
      }
    },
    async fetchMessages() {
      if (!this.receiverId) return;
      this.loading = true;
      this.error = "";
      try {
        const { data } = await api.get("/messages", {
          params: { receiver_id: this.receiverId },
        });
        this.messages = data.map((message) => ({
          ...message,
          status: "sent",
        }));
      } catch (error) {
        this.error =
          error.response?.data?.error || "Error fetching messages. Try again.";
      } finally {
        this.loading = false;
      }
    },
    async sendMessage() {
      if (!this.newMessage.trim() || !this.receiverId) return;
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        sender_id: this.currentUser.id,
        receiver_id: this.receiverId,
        sender: { id: this.currentUser.id, name: this.currentUser.name },
        receiver: this.activeUser,
        content: this.newMessage,
        created_at: new Date().toISOString(),
        status: "sending",
      };
      this.messages.push(optimisticMessage);
      const pendingText = this.newMessage;
      this.newMessage = "";

      try {
        const { data } = await api.post("/messages", {
          message: {
            receiver_id: this.receiverId,
            content: pendingText,
          },
        });

        this.replaceMessage(tempId, data);
      } catch (error) {
        this.markMessageFailed(tempId);
        this.error =
          error.response?.data?.error || "Error sending message. Try again.";
      }
    },
    selectUser(user) {
      if (!user) return;
      const id = String(user.id);
      if (id === this.receiverId) return;
      this.$router.push({ path: "/inbox", query: { receiverId: id } });
    },
    subscribeToMessages() {
      if (!this.$cable || !this.currentUser) return;
      this.teardownSubscription();

      this.subscription = this.$cable.subscriptions.create(
        { channel: "MessageChannel", user_id: this.currentUser.id },
        {
          received: (data) => {
            if (this.isMessageInActiveThread(data)) {
              this.upsertMessage(data);
            }
          },
        }
      );
    },
    teardownSubscription() {
      if (this.subscription) {
        this.subscription.unsubscribe();
        this.subscription = null;
      }
    },
    syncActiveUser() {
      if (!this.receiverId) {
        this.activeUser = null;
        return;
      }

      this.activeUser =
        this.users.find(
          (user) => String(user.id) === String(this.receiverId)
        ) || null;
    },
    isActiveUser(user) {
      return String(user.id) === String(this.receiverId);
    },
    replaceMessage(tempId, newMessage) {
      const tempIndex = this.messages.findIndex((msg) => msg.id === tempId);
      if (tempIndex !== -1) {
        this.messages.splice(tempIndex, 1);
      }
      this.upsertMessage(newMessage);
    },
    markMessageFailed(tempId) {
      const message = this.messages.find((msg) => msg.id === tempId);
      if (message) {
        message.status = "failed";
      }
    },
    upsertMessage(incoming) {
      const id = incoming.id;
      const index = this.messages.findIndex((msg) => msg.id === id);
      if (index === -1) {
        this.messages.push({ ...incoming, status: "sent" });
      } else {
        this.messages.splice(index, 1, { ...incoming, status: "sent" });
      }
    },
    isOwnMessage(message) {
      if (!this.currentUser) return false;
      return String(message.sender_id) === String(this.currentUser.id);
    },
    isMessageInActiveThread(message) {
      if (!this.currentUser || !this.receiverId || !message) return false;
      const currentId = String(this.currentUser.id);
      const targetId = String(this.receiverId);
      const senderId = String(message.sender_id);
      const receiverId = String(message.receiver_id);

      const involvesCurrentUser =
        senderId === currentId || receiverId === currentId;
      const involvesTarget =
        senderId === targetId || receiverId === targetId;

      return involvesCurrentUser && involvesTarget;
    },
    formatTimestamp(timestamp) {
      if (!timestamp) return "";
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    },
  },
};
</script>

<style scoped>
.inbox-page {
  display: flex;
  height: calc(100vh - 70px);
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  overflow: hidden;
  margin: 20px;
  background: #fff;
}

.sidebar {
  width: 260px;
  border-right: 1px solid #e5e5e5;
  background: #fafafa;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e5e5e5;
}

.text-error {
  color: #b00020;
  font-size: 13px;
}

.text-muted {
  color: #777;
  font-size: 13px;
}

.user-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}

.user-list li {
  padding: 12px 16px;
  border-bottom: 1px solid #eaeaea;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-list li:hover {
  background: #f0f0f0;
}

.user-list li.active {
  background: #dfe9ff;
}

.user-name {
  font-weight: 600;
}

.user-email {
  font-size: 12px;
  color: #666;
}

.conversation {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.conversation-body {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.conversation-header {
  padding: 16px;
  border-bottom: 1px solid #e5e5e5;
  background: #fff;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fdfdfd;
}

.message {
  background: #f1f1f1;
  padding: 10px 14px;
  border-radius: 10px;
  width: fit-content;
  max-width: 70%;
}

.message-self {
  background: #d1e7ff;
  margin-left: auto;
}

.message-pending {
  opacity: 0.7;
}

.message-error {
  background: #ffe5e5;
}

.message-status {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: #555;
}

.message-status.error {
  color: #b00020;
}

.message-meta {
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  color: #555;
}

.composer {
  display: flex;
  gap: 10px;
  padding: 16px;
  border-top: 1px solid #e5e5e5;
  background: #fff;
}

.composer input {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #ccc;
}

.composer button {
  padding: 0 18px;
  border: none;
  background: #333;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
}

.alert {
  padding: 10px;
  border-radius: 6px;
  margin: 15px;
  font-size: 14px;
}

.alert.error {
  background: #ffe5e5;
  color: #a40000;
}

.alert.info {
  background: #eef4ff;
  color: #1f4a8a;
}

.placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #777;
  padding: 20px;
}
@media (max-width: 768px) {
  .inbox-page {
    flex-direction: column;
    height: auto;
  }

  .sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #e5e5e5;
  }

  .messages {
    max-height: 50vh;
  }
}
</style>
