import { EventEmitter } from 'events';

class NotificationBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }

  emitNotification(userId: string, notification: any) {
    this.emit(`notification:${userId}`, notification);
    this.emit('notification:broadcast', notification);
  }
}

export const notificationBus = new NotificationBus();
