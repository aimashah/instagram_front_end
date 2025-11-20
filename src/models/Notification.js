class Notification {
  constructor({
    id,
    userId,
    senderName,
    preview,
    createdAt,
  }) {
    this.id = id ?? `notification-${Date.now()}`;
    this.userId =
      userId !== null && userId !== undefined ? String(userId) : null;
    this.senderName = senderName || "New message";
    this.preview = Notification.formatPreview(preview ?? "");
    this.createdAt = createdAt || new Date().toISOString();
  }

  static formatPreview(text = "") {
    const normalized = text.trim();
    if (!normalized) {
      return "Sent you a message.";
    }
    return normalized.length > 80
      ? `${normalized.substring(0, 80)}…`
      : normalized;
  }

  static fromMessage(message, { userId, user } = {}) {
    const resolvedUserId =
      userId ??
      Notification.extractUserIdentifier(message);
    if (resolvedUserId === null || resolvedUserId === undefined) {
      return null;
    }

    const senderName =
      message?.sender?.name ||
      user?.name ||
      "New message";

    return new Notification({
      id: message?.id,
      userId: resolvedUserId,
      senderName,
      preview: message?.content || "",
      createdAt: message?.created_at,
    });
  }

  static extractUserIdentifier(message) {
    if (!message) {
      return null;
    }
    if (message.receiver_id !== null && message.receiver_id !== undefined) {
      return message.receiver_id;
    }
    if (message.sender_id !== null && message.sender_id !== undefined) {
      return message.sender_id;
    }
    return null;
  }
}

export default Notification;
