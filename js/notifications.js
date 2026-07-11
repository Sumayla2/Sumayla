(function() {
  const STORAGE_KEY = 'crm_notifications_history';
  let notifications = [];

  // Load notifications from LocalStorage
  function loadNotifications() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      const initial = [{
        id: 'notif_welcome',
        title: 'System Initialized',
        desc: 'Database loaded with default seeds successfully.',
        time: new Date().toISOString(),
        unread: true
      }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  // Save notifications to LocalStorage
  function saveNotifications() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    updateUI();
  }

  // Update Bell Badge and Dropdown List UI
  function updateUI() {
    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');
    
    if (!list) return;

    const unreadCount = notifications.filter(n => n.unread).length;
    
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.classList.add('active');
    } else {
      badge.classList.remove('active');
    }

    if (notifications.length === 0) {
      list.innerHTML = `
        <div class="notification-empty">
          No notifications yet.
        </div>
      `;
    } else {
      list.innerHTML = notifications.map(n => {
        const timeFormatted = formatTimeAgo(n.time);
        return `
          <div class="notification-item ${n.unread ? 'unread' : ''}" data-id="${n.id}">
            <div class="notification-item-content">
              <div class="notification-item-title">${n.title}</div>
              <div style="font-size: 0.775rem; color: var(--text-secondary); margin-bottom: 0.15rem;">${n.desc}</div>
              <div class="notification-item-time">${timeFormatted}</div>
            </div>
          </div>
        `;
      }).join('');

      list.querySelectorAll('.notification-item').forEach(el => {
        el.addEventListener('click', () => {
          Notifications.markAsRead(el.dataset.id);
        });
      });
    }
  }

  function formatTimeAgo(isoString) {
    const diffMs = Date.now() - new Date(isoString);
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return new Date(isoString).toLocaleDateString();
  }

  const Notifications = {
    init: function() {
      notifications = loadNotifications();
      
      const bellBtn = document.getElementById('notif-bell-btn');
      const dropdown = document.getElementById('notif-dropdown');
      const markAllReadBtn = document.getElementById('mark-all-read-btn');

      if (bellBtn && dropdown) {
        bellBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdown.classList.toggle('active');
        });

        document.addEventListener('click', () => {
          dropdown.classList.remove('active');
        });

        dropdown.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }

      if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', () => {
          this.markAllAsRead();
        });
      }

      const getSettings = () => {
        try {
          return JSON.parse(localStorage.getItem('crm_settings')) || { notifySound: true, notifyToast: true };
        } catch(e) {
          return { notifySound: true, notifyToast: true };
        }
      };

      const playBeep = () => {
        const set = getSettings();
        if (!set.notifySound) return;

        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
          
          gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.2);
        } catch (e) {
          // AudioContext blocked
        }
      };

      // 1. Check if Supabase mode is active
      if (window.API && window.API.isSupabaseActive()) {
        const supabase = window.API.getSupabaseClient();
        
        // Subscribe to database INSERT events on table 'leads'
        supabase
          .channel('schema-db-changes')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'leads' },
            payload => {
              const newLead = payload.new;
              
              if (notifications.some(n => n.id === 'new_lead_' + newLead.id)) return;

              this.handleNewLeadSubmission(newLead.id, newLead.name, playBeep, getSettings);
              
              // Force local UI refresh
              window.dispatchEvent(new CustomEvent('leads_db_update'));
            }
          )
          .subscribe();
          
        console.log('Realtime WebSocket connection listening to public.leads table.');
      } else {
        // 2. Fallback: LocalStorage Cross-Tab storage listener
        window.addEventListener('storage', (e) => {
          if (e.key === 'wfh_leads_sync_trigger' && e.newValue) {
            try {
              const data = JSON.parse(e.newValue);
              if (notifications.some(n => n.id === 'new_lead_' + data.id)) return;
              this.handleNewLeadSubmission(data.id, data.name, playBeep, getSettings);
              window.dispatchEvent(new CustomEvent('leads_db_update'));
            } catch(err) {}
          }
        });

        // 3. Fallback: Local event from the same window
        window.addEventListener('leads_db_added_locally', (e) => {
          const lead = e.detail;
          if (notifications.some(n => n.id === 'new_lead_' + lead.id)) return;
          this.handleNewLeadSubmission(lead.id, lead.name, playBeep, getSettings);
        });
      }

      setInterval(updateUI, 30000);
      updateUI();
    },

    handleNewLeadSubmission: function(id, name, playBeep, getSettings) {
      const newNotif = {
        id: 'new_lead_' + id,
        title: 'New Lead Submitted',
        desc: `${name} has applied via the public WFH survey.`,
        time: new Date().toISOString(),
        unread: true
      };

      notifications.unshift(newNotif);
      saveNotifications();

      if (getSettings().notifyToast) {
        this.showToast('New Submission', `${name} just completed the survey.`, 'success');
      }
      
      playBeep();
    },

    showToast: function(title, desc, type = 'info', duration = 5000) {
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          <div class="toast-desc">${desc}</div>
        </div>
        <button class="toast-close">&times;</button>
      `;

      container.appendChild(toast);

      toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.style.animation = 'fadeIn 0.2s ease reverse';
        setTimeout(() => toast.remove(), 200);
      });

      setTimeout(() => {
        if (toast.parentNode) {
          toast.style.animation = 'fadeIn 0.2s ease reverse';
          setTimeout(() => toast.remove(), 200);
        }
      }, duration);
    },

    markAsRead: function(id) {
      const notif = notifications.find(n => n.id === id);
      if (notif && notif.unread) {
        notif.unread = false;
        saveNotifications();
      }
    },

    markAllAsRead: function() {
      let modified = false;
      notifications.forEach(n => {
        if (n.unread) {
          n.unread = false;
          modified = true;
        }
      });
      if (modified) saveNotifications();
    },

    clearHistory: function() {
      notifications = [];
      saveNotifications();
    }
  };

  window.Notifications = Notifications;
})();
