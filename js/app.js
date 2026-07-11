(function() {
  
  // Elements that need to be accessed
  let loginPanel, dashboardShell, loginForm, loginError, logoutBtn, sidebar, toggleSidebarBtn, hamburgerBtn;

  // Initialize Application
  function init() {
    loginPanel = document.getElementById('login-panel');
    dashboardShell = document.getElementById('dashboard-shell');
    loginForm = document.getElementById('login-form');
    loginError = document.getElementById('login-error');
    logoutBtn = document.getElementById('logout-btn');
    sidebar = document.querySelector('aside');
    toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    hamburgerBtn = document.getElementById('hamburger-btn');

    checkAuthAndToggleView();

    window.addEventListener('auth_state_change', checkAuthAndToggleView);
    window.addEventListener('profile_update', updateHeaderProfileUI);

    if (loginForm) {
      loginForm.addEventListener('submit', handleLoginSubmit);
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.Auth.logout();
      });
    }

    if (toggleSidebarBtn && sidebar) {
      toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }

    if (hamburgerBtn && sidebar) {
      hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('active');
      });
      document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && sidebar.classList.contains('active')) {
          sidebar.classList.remove('active');
        }
      });
    }

    window.addEventListener('hashchange', handleRouting);

    setupSettingsPanel();

    window.addEventListener('leads_db_update', () => {
      if (window.Auth.isAuthenticated()) {
        updateDashboardHomeStats();
      }
    });
  }

  // Handle Login submission
  function handleLoginSubmit(e) {
    e.preventDefault();
    loginError.style.display = 'none';
    
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="animate-spin" data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i> Authenticating...`;
    
    if (window.lucide) window.lucide.createIcons();

    const username = document.getElementById('username').value;
    const passport = document.getElementById('password').value;

    window.Auth.login(username, passport)
      .then(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      })
      .catch((err) => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        if (window.lucide) window.lucide.createIcons();
        loginError.textContent = err.message;
        loginError.style.display = 'block';
      });
  }

  // Check auth token and show login/dashboard panels
  function checkAuthAndToggleView() {
    const isAuthed = window.Auth.isAuthenticated();

    if (isAuthed) {
      loginPanel.style.display = 'none';
      dashboardShell.classList.add('active');
      
      updateHeaderProfileUI();
      handleRouting();
      
      if (window.Notifications) window.Notifications.init();
      if (window.LeadsController) window.LeadsController.init();
      if (window.AnalyticsController) window.AnalyticsController.init();
      
      updateDashboardHomeStats();
    } else {
      dashboardShell.classList.remove('active');
      loginPanel.style.display = 'flex';
      
      if (loginForm) loginForm.reset();
      if (loginError) loginError.style.display = 'none';
    }
  }

  // Update profile labels in sidebar/header
  function updateHeaderProfileUI() {
    const user = window.Auth.getCurrentUser();
    if (!user) return;

    const avatars = document.querySelectorAll('.admin-avatar');
    avatars.forEach(av => {
      const parts = user.name.split(' ');
      av.textContent = parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
    });

    const names = document.querySelectorAll('.admin-name');
    names.forEach(n => n.textContent = user.name);

    const roles = document.querySelectorAll('.admin-role');
    roles.forEach(r => r.textContent = user.role);

    const setProfileName = document.getElementById('settings-profile-name');
    const setProfileEmail = document.getElementById('settings-profile-email');
    if (setProfileName) setProfileName.value = user.name;
    if (setProfileEmail) setProfileEmail.value = user.email;
  }

  // Hash Router switching tabs
  function handleRouting() {
    if (!window.Auth.isAuthenticated()) return;

    let hash = window.location.hash || '#dashboard';
    
    const validHashes = ['#dashboard', '#leads', '#analytics', '#settings'];
    if (!validHashes.includes(hash)) {
      hash = '#dashboard';
    }

    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
      const href = item.getAttribute('href');
      if (href === hash) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    const tabContents = document.querySelectorAll('.content-area .tab-content');
    tabContents.forEach(tab => {
      if ('#' + tab.id === hash) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    const headerTitle = document.getElementById('page-header-title');
    if (headerTitle) {
      const titles = {
        '#dashboard': 'Dashboard Overview',
        '#leads': 'Leads Database',
        '#analytics': 'Performance Analytics',
        '#settings': 'System Settings'
      };
      headerTitle.textContent = titles[hash] || 'Dashboard';
    }

    if (sidebar) sidebar.classList.remove('active');

    if (hash === '#analytics' && window.AnalyticsController) {
      window.AnalyticsController.renderAllCharts();
    }
  }

  // Aggregate stats on Dashboard Home (Asynchronous)
  async function updateDashboardHomeStats() {
    try {
      const leads = await window.API.getLeads();
      
      const totalLeads = leads.length;
      const newLeadsCount = leads.filter(l => l.status === 'new').length;

      const todayStr = new Date().toDateString();
      const todayLeadsCount = leads.filter(l => l.submittedOn && new Date(l.submittedOn).toDateString() === todayStr).length;

      const maleCount = leads.filter(l => l.gender && l.gender.toLowerCase() === 'male').length;
      const femaleCount = leads.filter(l => l.gender && l.gender.toLowerCase() === 'female').length;
      const totalGender = maleCount + femaleCount;
      let genderSplitText = '0% M / 0% F';
      if (totalGender > 0) {
        genderSplitText = `${Math.round((maleCount/totalGender)*100)}% M / ${Math.round((femaleCount/totalGender)*100)}% F`;
      }

      document.getElementById('stat-total-leads').textContent = totalLeads;
      document.getElementById('stat-today-leads').textContent = todayLeadsCount;
      document.getElementById('stat-gender-split').textContent = genderSplitText;
      document.getElementById('stat-new-leads').textContent = newLeadsCount;

      const recentLeadsTable = document.getElementById('recent-leads-body');
      if (recentLeadsTable) {
        const recent = leads.slice(0, 5);
        
        if (recent.length === 0) {
          recentLeadsTable.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No records.</td></tr>`;
        } else {
          recentLeadsTable.innerHTML = recent.map(l => {
            let badgeClass = 'badge-success';
            if (l.status === 'rejected') badgeClass = 'badge-danger';
            else if (l.status === 'contacted') badgeClass = 'badge';
            let badgeStyle = l.status === 'contacted' ? 'background: rgba(0, 163, 255, 0.15); color: var(--accent);' : '';

            return `
              <tr>
                <td class="lead-name-cell">${l.name}</td>
                <td>${l.email}</td>
                <td><span class="badge ${badgeClass}" style="${badgeStyle}">${l.status.toUpperCase()}</span></td>
                <td>${l.submittedOn ? new Date(l.submittedOn).toLocaleDateString() : '-'}</td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch(err) {
      console.error('Failed to aggregate dashboard metrics:', err);
    }
  }

  // Setup Settings Panel actions & variables
  function setupSettingsPanel() {
    const toggleSound = document.getElementById('settings-toggle-sound');
    const toggleToast = document.getElementById('settings-toggle-toast');

    let settings = { notifySound: true, notifyToast: true };
    try {
      const saved = localStorage.getItem('crm_settings');
      if (saved) settings = JSON.parse(saved);
    } catch(e) {}

    if (toggleSound) toggleSound.checked = settings.notifySound;
    if (toggleToast) toggleToast.checked = settings.notifyToast;

    const saveSettings = () => {
      const updated = {
        notifySound: toggleSound.checked,
        notifyToast: toggleToast.checked
      };
      localStorage.setItem('crm_settings', JSON.stringify(updated));
      if (window.Notifications) {
        window.Notifications.showToast('Settings Saved', 'Notification toggles updated successfully.', 'success');
      }
    };

    if (toggleSound) toggleSound.addEventListener('change', saveSettings);
    if (toggleToast) toggleToast.addEventListener('change', saveSettings);

    const profileForm = document.getElementById('settings-profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const updatedName = document.getElementById('settings-profile-name').value;
        const updatedEmail = document.getElementById('settings-profile-email').value;

        window.Auth.updateProfile({
          name: updatedName,
          email: updatedEmail
        });

        if (window.Notifications) {
          window.Notifications.showToast('Profile Updated', 'Administrator profile was saved.', 'success');
        }
      });
    }

    const passwordForm = document.getElementById('settings-password-form');
    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const currentPass = document.getElementById('settings-current-pwd').value;
        const newPass = document.getElementById('settings-new-pwd').value;

        const savedPassword = localStorage.getItem('crm_admin_password') || 'password123';
        if (currentPass !== savedPassword) {
          alert('Current password verification failed.');
          return;
        }

        localStorage.setItem('crm_admin_password', newPass);
        alert('Password updated successfully! Please use your new password next time you log in.');
        passwordForm.reset();
      });
    }

    // Supabase Credentials Settings Form
    const supabaseForm = document.getElementById('settings-supabase-form');
    if (supabaseForm) {
      document.getElementById('settings-supabase-url').value = localStorage.getItem('crm_supabase_url') || '';
      document.getElementById('settings-supabase-key').value = localStorage.getItem('crm_supabase_anon_key') || '';

      supabaseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = document.getElementById('settings-supabase-url').value.trim();
        const key = document.getElementById('settings-supabase-key').value.trim();

        if (url && key) {
          localStorage.setItem('crm_supabase_url', url);
          localStorage.setItem('crm_supabase_anon_key', key);
          if (window.Notifications) {
            window.Notifications.showToast('Database Configured', 'Connecting to Supabase cloud. Reloading app...', 'success');
          }
        } else {
          localStorage.removeItem('crm_supabase_url');
          localStorage.removeItem('crm_supabase_anon_key');
          if (window.Notifications) {
            window.Notifications.showToast('Database Reverted', 'Reverting to LocalStorage mode. Reloading app...', 'info');
          }
        }

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      });
    }

    // Database Actions (Asynchronous)
    const seedDbBtn = document.getElementById('settings-seed-db-btn');
    const wipeDbBtn = document.getElementById('settings-wipe-db-btn');

    if (seedDbBtn) {
      seedDbBtn.addEventListener('click', async () => {
        const isSb = window.API.isSupabaseActive();
        const dbName = isSb ? 'Supabase cloud database' : 'LocalStorage database';
        
        if (confirm(`Are you sure you want to reset the database and seed fresh dummy leads on your ${dbName}?`)) {
          try {
            await window.API.resetDatabase();
            if (window.Notifications) {
              window.Notifications.showToast('Database Reset', 'Fresh dummy records seeded successfully.', 'success');
              window.Notifications.clearHistory();
            }
            await updateDashboardHomeStats();
          } catch(err) {
            alert('Failed to reset database: ' + err.message);
          }
        }
      });
    }

    if (wipeDbBtn) {
      wipeDbBtn.addEventListener('click', async () => {
        const isSb = window.API.isSupabaseActive();
        const dbName = isSb ? 'Supabase cloud database' : 'LocalStorage database';

        if (confirm(`DANGER: Are you sure you want to wipe all records from your ${dbName}? This action is irreversible.`)) {
          try {
            if (isSb) {
              const supabase = window.API.getSupabaseClient();
              await supabase.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            } else {
              localStorage.setItem('wfh_leads_db', JSON.stringify([]));
            }
            window.dispatchEvent(new CustomEvent('leads_db_update', { detail: [] }));
            if (window.Notifications) {
              window.Notifications.showToast('Database Wiped', 'All lead records deleted.', 'danger');
            }
            await updateDashboardHomeStats();
          } catch (err) {
            alert('Failed to wipe database: ' + err.message);
          }
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
