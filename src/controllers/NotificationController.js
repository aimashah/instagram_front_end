class NotificationController {
  constructor({
    displayDuration = 5000,
    onShow = () => {},
    onClear = () => {},
  } = {}) {
    this.displayDuration = displayDuration;
    this.onShow = onShow;
    this.onClear = onClear;
    this.currentNotification = null;
    this.timer = null;
  }

  show(notification) {
    if (!notification) return;
    this.currentNotification = notification;
    this.onShow(notification);
    this.restartTimer();
  }

  restartTimer() {
    this.clearTimer();
    if (!this.displayDuration) return;
    this.timer = setTimeout(() => {
      this.clear();
    }, this.displayDuration);
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  clear() {
    const hadNotification = Boolean(this.currentNotification);
    this.currentNotification = null;
    this.clearTimer();
    if (hadNotification) {
      this.onClear();
    }
  }

  clearByUserId(userId) {
    if (!this.currentNotification || userId === null || userId === undefined) {
      return;
    }
    if (String(this.currentNotification.userId) === String(userId)) {
      this.clear();
    }
  }

  destroy() {
    this.clearTimer();
    this.currentNotification = null;
  }
}

export default NotificationController;
