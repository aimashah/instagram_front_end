<template>
  <div class="feed-container">

    <div v-for="post in posts" :key="post.id" class="post-card">
      
      <div class="post-header">
        <strong>{{ post.user.name }}</strong>
      </div>

      <img v-if="post.image_url" :src="post.image_url" class="post-image" />

      <p class="caption">{{ post.caption }}</p>

      <!-- LIKE BUTTON -->
      <button class="like-btn" @click="toggleLike(post)">
      <span :class="post.liked ? 'liked' : ''">❤️</span>
        {{ post.likes_count }} Likes
      </button>

      <p class="likes-count">{{ post.likes_count }} likes</p>

       <!-- Users who liked the post -->
      <p v-if="post.users_who_liked && post.users_who_liked.length > 0">
        Liked by: {{ post.users_who_liked.join(', ') }}
      </p>


      <!-- COMMENTS SECTION -->
      <div class="comments-box">
      <p v-for="c in post.comments" :key="c.id" class="comment-line">
      <strong>{{ c.user.name }}</strong> <span>{{ c.text }}</span>
      </p>
     </div>
      <!-- Share BUTTON -->
      <button class="share-btn" @click="sharePost(post)">🔄 Share</button>
      <p v-if="post.shares.length > 0" class="shared-by">
      Shared by: {{ post.shares.join(", ") }}
      </p>
      <button class="message-btn" @click="openChat(post.user.id)">
        💬 Message {{ post.user.name }}
      </button>
      <!-- ADD COMMENT -->
      <form @submit.prevent="addComment(post)" class="comment-form">
        <input 
          v-model="post.newComment" 
          placeholder="Add a comment..." 
          class="comment-input"
        />
        <button class="comment-btn">Post</button>
      </form>

    </div>
  </div>
</template>
<script>
import api from "../api/axios";

export default {
  data() {
    return {
      posts: []
    };
  },

  async mounted() {
    const res = await api.get("/posts");
    this.posts = res.data.map(p => ({
      ...p,
      newComment: "",
      comments: p.comments || [],
      liked: p.liked || false,
      likes_count: p.likes_count || 0,
      shares: p.shares || []
    }));
  },
   methods: {
    async toggleLike(post) {
      try {
        const res = await api.post(`/posts/${post.id}/like`);
        post.liked = res.data.liked;
        post.likes_count = res.data.likes_count;
        post.users_who_liked = res.data.users_who_liked;
      } catch (error) {
        console.error("Error toggling like:", error.response?.data || error);
      }
    },

  async sharePost(post) {
  try {
    const res = await api.post(`/posts/${post.id}/share`);
    alert("Post shared!");
  } catch (error) {
    console.error("Error sharing post:", error.response?.data || error);
  }
},
  openChat(userId) {
    this.$router.push({ path: "/inbox", query: { receiverId: userId } });
  },
  async addComment(post) {
  if (!post.newComment.trim()) return;  // Check if comment is not empty

  try {
    const res = await api.post(`/posts/${post.id}/comments`, {
      text: post.newComment
    });

    // After adding the comment, push it to the post's comments array
    post.comments.push(res.data);  // Add the new comment to the array

    // Reset the comment input field
    post.newComment = "";
  } catch (error) {
    console.error("Error adding comment:", error.response?.data || error);
  }
}
}
}
</script>

<style>
.feed-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px;
}

.post-card {
  width: 420px;
  background: #fff;
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 25px;
  box-shadow: 0px 2px 6px rgba(0,0,0,0.10);
}

.post-header {
  font-size: 15px;
  margin-bottom: 8px;
}

.post-image {
  width: 100%;
  border-radius: 8px;
  margin-top: 10px;
}

.caption {
  margin-top: 10px;
  font-size: 14px;
}

.liked {
  color: red;
}
.like-btn {
  width: 100%;
  padding: 8px;
  background: #f7f7f7;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.like-btn:hover {
  background: #eee;
}


.likes-count {
  font-size: 13px;
  margin-top: 5px;
}

.comments-box {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.comment-line {
  font-size: 13px;
  margin-bottom: 6px;
}


.comment-form {
  display: flex;
  margin-top: 10px;
}

.comment-input {
  flex: 1;
  padding: 6px;
  border-radius: 5px;
  border: 1px solid #ddd;
}

.comment-btn {
  margin-left: 5px;
  padding: 6px 12px;
  background: #333;
  color: white;
  border: none;
  border-radius: 6px;
}

.message-btn {
  width: 100%;
  margin-top: 10px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fefefe;
  cursor: pointer;
}

.message-btn:hover {
  background: #f5f5f5;
}
</style>
