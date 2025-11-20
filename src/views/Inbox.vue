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
          <div class="user-list-row">
            <span class="user-name">{{ user.name }}</span>
            <span
              v-if="getUnreadCount(user.id)"
              class="user-unread-badge"
            >
              {{ getUnreadCount(user.id) }}
            </span>
          </div>
          <span class="user-email">{{ user.email }}</span>
        </li>
      </ul>
    </aside>

    <section class="conversation">
      <div v-if="error" class="alert error">{{ error }}</div>
      <div
        v-if="latestNotification"
        class="notification-banner"
      >
        <div>
          <p class="notification-title">
            New message from <strong>{{ latestNotification.senderName }}</strong>
          </p>
          <p class="notification-preview">
            {{ latestNotification.preview }}
          </p>
        </div>
        <button
          type="button"
          class="notification-action"
          @click="openNotificationThread(latestNotification.userId)"
        >
          View
        </button>
      </div>

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
import Notification from "../models/Notification";
import NotificationController from "../controllers/NotificationController";

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
      unreadCounts: {},
      latestNotification: null,
      notificationController: null,
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
            this.markThreadRead(this.receiverId);
          }
        } else {
          this.activeUser = null;
        }
      },
    },
    users() {
      this.initializeUnreadCounts(this.users);
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

    this.initializeNotificationController();
    this.fetchUsers();
    this.subscribeToMessages();
  },
  beforeUnmount() {
    this.teardownSubscription();
    if (this.notificationController) {
      this.notificationController.destroy();
      this.notificationController = null;
    }
  },
  methods: {
    initializeNotificationController() {
      if (this.notificationController) {
        this.notificationController.destroy();
      }
      this.notificationController = new NotificationController({
        displayDuration: 5000,
        onShow: (notification) => {
          this.latestNotification = notification;
        },
        onClear: () => {
          this.latestNotification = null;
        },
      });
    },
    async fetchUsers() {
      this.usersLoading = true;
      this.usersError = "";
      try {
        const { data } = await api.get("/users");
        this.users = data;
        this.initializeUnreadCounts(data);

        if (!this.$route.query.receiverId && data.length > 0) {
          this.$router.replace({
            path: "/inbox",
            query: { receiverId: data[0].id },
          });
        }
        await this.fetchNotifications();
      } catch (error) {
        this.usersError =
          error.response?.data?.error || "Unable to load users at the moment.";
      } finally {
        this.usersLoading = false;
      }
    },
    async fetchNotifications() {
      if (!this.currentUser) return;
      try {
        const { data } = await api.get("/notifications");
        this.consumeNotifications(data);
      } catch (error) {
        console.error("Unable to load notifications right now.", error);
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
        await this.markThreadRead(this.receiverId);
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
      this.markThreadRead(id);
    },
    initializeUnreadCounts(users = []) {
      if (!Array.isArray(users)) return;
      const nextCounts = { ...this.unreadCounts };
      users.forEach((user) => {
        if (!user) return;
        const id = String(user.id);
        if (user.unread_count !== undefined && user.unread_count !== null) {
          nextCounts[id] = user.unread_count;
        } else if (nextCounts[id] === undefined) {
          nextCounts[id] = 0;
        }
      });
      this.unreadCounts = nextCounts;
    },
    findUserById(userId) {
      if (userId === null || userId === undefined) return null;
      const id = String(userId);
      return (
        this.users.find((user) => String(user.id) === id) || null
      );
    },
    getUnreadCount(userId) {
      if (userId === null || userId === undefined) return 0;
      const id = String(userId);
      return this.unreadCounts[id] || 0;
    },
    setUnreadCount(userId, count) {
      if (userId === null || userId === undefined) return;
      const id = String(userId);
      this.unreadCounts = {
        ...this.unreadCounts,
        [id]: Math.max(0, count || 0),
      };
    },
    incrementUnreadCount(userId) {
      if (userId === null || userId === undefined) return;
      const id = String(userId);
      const currentCount = Number(this.unreadCounts[id] || 0);
      this.setUnreadCount(id, currentCount + 1);
    },
    async markThreadRead(userId) {
      if (!userId || !this.currentUser) return;
      const id = String(userId);
      this.setUnreadCount(id, 0);
      this.notificationController?.clearByUserId(id);
      try {
        await api.post("/messages/mark_read", { receiver_id: id });
      } catch (error) {
        console.error("Unable to mark messages as read right now.", error);
      }
    },
    getCounterpartId(message) {
      if (!message || !this.currentUser) return null;
      const currentId = String(this.currentUser.id);
      if (String(message.sender_id) === currentId) {
        return message.receiver_id ? String(message.receiver_id) : null;
      }
      return message.sender_id ? String(message.sender_id) : null;
    },
    showNotificationForMessage(message) {
      if (!this.notificationController) return;
      const userId = this.getCounterpartId(message);
      if (!userId) return;
      const user = this.findUserById(userId);
      const notification = Notification.fromMessage(message, {
        userId,
        user,
      });
      if (!notification) return;
      this.notificationController.show(notification);
    },
    consumeNotifications(notifications = []) {
      if (!Array.isArray(notifications)) return;
      const unreadTallies = {};
      let latestNotification = null;

      notifications.forEach((notification) => {
        if (!notification || notification.read_at) return;
        const message = notification.message;
        if (!message) return;
        const userId = this.getCounterpartId(message);
        if (!userId) return;
        const id = String(userId);
        unreadTallies[id] = (unreadTallies[id] || 0) + 1;

        const candidateTimestamp =
          notification.created_at ||
          notification.createdAt ||
          message.created_at ||
          new Date().toISOString();
        if (
          !latestNotification ||
          new Date(candidateTimestamp) > new Date(latestNotification.createdAt)
        ) {
          const user = this.findUserById(userId) || message?.sender || null;
          latestNotification = new Notification({
            id: notification.id,
            userId,
            senderName: user?.name || message?.sender?.name || "New message",
            preview: notification.preview || message?.content || "",
            createdAt: candidateTimestamp,
          });
        }
      });

      if (Object.keys(unreadTallies).length || Object.keys(this.unreadCounts).length) {
        const nextCounts = { ...this.unreadCounts };
        Object.keys(nextCounts).forEach((id) => {
          nextCounts[id] = unreadTallies[id] || 0;
        });
        Object.keys(unreadTallies).forEach((id) => {
          if (!(id in nextCounts)) {
            nextCounts[id] = unreadTallies[id];
          }
        });
        this.unreadCounts = nextCounts;
      }

      if (latestNotification && this.notificationController) {
        this.notificationController.show(latestNotification);
      }
    },
    openNotificationThread(userId) {
      if (!userId) return;
      const user = this.findUserById(userId);
      if (user) {
        this.selectUser(user);
      } else {
        this.$router.push({
          path: "/inbox",
          query: { receiverId: String(userId) },
        });
      }
      this.markThreadRead(userId);
    },
    subscribeToMessages() {
      if (!this.$cable || !this.currentUser) return;
      this.teardownSubscription();

      this.subscription = this.$cable.subscriptions.create(
        { channel: "MessageChannel", user_id: this.currentUser.id },
        {
          received: (data) => {
            const isToCurrentUser =
              this.currentUser &&
              String(data.receiver_id) === String(this.currentUser.id);

            if (this.isMessageInActiveThread(data)) {
              this.upsertMessage(data);
              if (isToCurrentUser) {
                this.markThreadRead(this.receiverId);
              }
              return;
            }

            if (isToCurrentUser) {
              const counterpartId = this.getCounterpartId(data);
              this.incrementUnreadCount(counterpartId);
              this.showNotificationForMessage(data);
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

.user-list-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.user-unread-badge {
  min-width: 22px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #ff5c5c;
  color: #fff;
  font-size: 11px;
  text-align: center;
  font-weight: 600;
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

.notification-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin: 12px 16px 0;
  padding: 12px 16px;
  border-radius: 10px;
  background: #1f4a8a;
  color: #fff;
}

.notification-title {
  margin: 0 0 4px;
  font-size: 14px;
}

.notification-preview {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

.notification-action {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: #fff;
  color: #1f4a8a;
  cursor: pointer;
  font-weight: 600;
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
