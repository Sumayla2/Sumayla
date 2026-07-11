(function() {
  const TOKEN_KEY = 'crm_admin_session_token';
  const USER_KEY = 'crm_admin_user_profile';

  // Helper to create a fake JWT-like token (Header.Payload.Signature)
  function generateFakeJWT(username, role) {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({
      sub: username,
      role: role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiration
    }));
    const signature = "fake_signature_hash";
    return `${header}.${payload}.${signature}`;
  }

  // Helper to decode Base64 URL strings
  function decodeJWT(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payloadDecoded = atob(parts[1]);
      return JSON.parse(payloadDecoded);
    } catch (e) {
      return null;
    }
  }

  const Auth = {
    // Check if the current token is present and valid
    isAuthenticated: function() {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return false;

      const decoded = decodeJWT(token);
      if (!decoded) {
        this.logout();
        return false;
      }

      // Check expiry
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (decoded.exp < nowInSeconds) {
        this.logout();
        return false;
      }

      return true;
    },

    // Login function
    login: function(username, password) {
      return new Promise((resolve, reject) => {
        // Simulate a small API network delay for realism
        setTimeout(() => {
          if (username.trim().toLowerCase() === 'admin' && password === 'password123') {
            const token = generateFakeJWT('admin', 'administrator');
            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(USER_KEY, JSON.stringify({
              name: 'Alex Vance',
              username: 'admin',
              role: 'Senior Admin',
              email: 'alex.vance@wfhadmin.com',
              joined: '2026-01-10'
            }));
            
            // Fire custom event
            window.dispatchEvent(new CustomEvent('auth_state_change', { detail: { authenticated: true } }));
            resolve(true);
          } else {
            reject(new Error('Invalid username or password'));
          }
        }, 600);
      });
    },

    // Logout function
    logout: function() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.dispatchEvent(new CustomEvent('auth_state_change', { detail: { authenticated: false } }));
    },

    // Get current user profile information
    getCurrentUser: function() {
      const userData = localStorage.getItem(USER_KEY);
      if (!userData) return null;
      try {
        return JSON.parse(userData);
      } catch (e) {
        return null;
      }
    },

    // Update profile (Settings)
    updateProfile: function(profileData) {
      const current = this.getCurrentUser();
      if (!current) return false;
      const updated = { ...current, ...profileData };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('profile_update', { detail: updated }));
      return true;
    }
  };

  // Expose to window
  window.Auth = Auth;
})();
