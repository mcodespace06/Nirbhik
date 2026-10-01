import { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  CheckCheck, 
  AlertTriangle, 
  MessageSquare, 
  FileText, 
  ShieldAlert, 
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface NotificationItem {
  id: string;
  userId?: string | null;
  channel: string;
  type: string;
  payload: {
    title?: string;
    message?: string;
    priority?: string;
    complaintId?: string;
    pseudonym?: string;
    [key: string]: any;
  };
  readAt?: string | null;
  createdAt: string;
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch notifications from server
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    // Setup SSE live notification stream
    const token = localStorage.getItem('cv_token');
    const eventSource = new EventSource(`/api/notifications/stream?token=${token}`);

    eventSource.addEventListener('notification', (e) => {
      try {
        const newNotif = JSON.parse(e.data);
        setNotifications((prev) => [newNotif, ...prev]);
        setUnreadCount((prev) => prev + 1);
      } catch {
        // ignore parse error
      }
    });

    return () => {
      eventSource.close();
    };
  }, [user]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('cv_token');
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = localStorage.getItem('cv_token');
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  if (!user) return null;

  const filteredList = notifications.filter((n) =>
    filter === 'UNREAD' ? !n.readAt : true
  );

  const getIcon = (type: string) => {
    switch (type) {
      case 'SLA_BREACH':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'SOS_ALERT':
        return <ShieldAlert className="w-4 h-4 text-red-600" />;
      case 'MESSAGE_RECEIVED':
        return <MessageSquare className="w-4 h-4 text-sky-600" />;
      default:
        return <FileText className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-4 pt-2 pb-1 border-b border-slate-100 flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`pb-1.5 font-bold transition-all border-b-2 ${
                filter === 'ALL'
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('UNREAD')}
              className={`pb-1.5 font-bold transition-all border-b-2 ${
                filter === 'UNREAD'
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {filteredList.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 px-4">
                <Bell className="w-7 h-7 mx-auto text-slate-300 mb-2 stroke-1" />
                <p className="font-medium">No notifications to show</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  You're all caught up with campus notices and alerts.
                </p>
              </div>
            ) : (
              filteredList.map((notif) => {
                const isUnread = !notif.readAt;
                const title = notif.payload?.title || notif.type.replace(/_/g, ' ');
                const message = notif.payload?.message || JSON.stringify(notif.payload);
                const timeAgo = formatTimeAgo(notif.createdAt);

                return (
                  <div
                    key={notif.id}
                    onClick={() => isUnread && handleMarkAsRead(notif.id)}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                      isUnread ? 'bg-sky-50/40 hover:bg-sky-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs shrink-0 mt-0.5">
                      {getIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs truncate ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                          {title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">{timeAgo}</span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                        {message}
                      </p>
                    </div>

                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-sky-600 mt-2 shrink-0"></span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
