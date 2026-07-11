(function() {
  const LOCAL_STORAGE_KEY = 'wfh_leads_db';
  
  // Settings key names
  const SB_URL_KEY = 'crm_supabase_url';
  const SB_KEY_KEY = 'crm_supabase_anon_key';

  let supabaseClient = null;

  // 1. Load keys and check if Supabase is configured
  const savedUrl = localStorage.getItem(SB_URL_KEY);
  const savedKey = localStorage.getItem(SB_KEY_KEY);

  if (savedUrl && savedKey && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(savedUrl, savedKey);
      console.log('Supabase Cloud Database connected successfully.');
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
    }
  }

  // Helper: map database fields (Postgres snake_case to JS camelCase)
  function mapFromDB(lead) {
    if (!lead) return null;
    return {
      id: lead.id,
      name: lead.name,
      gender: lead.gender,
      email: lead.email,
      mobile: lead.mobile,
      address: lead.address,
      age: lead.age,
      submittedOn: lead.submitted_on || lead.submittedOn,
      status: lead.status
    };
  }

  // Seed data generator helper for LocalStorage fallback
  function generateSeedData() {
    const firstNames = ['John', 'Sarah', 'Liam', 'Emma', 'Noah', 'Olivia', 'Ethan', 'Sophia', 'Mason', 'Ava', 'Lucas', 'Isabella', 'Logan', 'Mia', 'Oliver', 'Charlotte', 'Aiden', 'Amelia', 'James', 'Harper'];
    const lastNames = ['Smith', 'Jenkins', 'Carter', 'Davis', 'Peterson', 'Martinez', 'Hunt', 'Taylor', 'Miller', 'Anderson', 'Wilson', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Martin', 'Garcia', 'Clark', 'Robinson'];
    const genders = ['Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female', 'Male', 'Female'];
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
    const states = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];
    const streets = ['Oak St', 'Pine St', 'Maple Ave', 'Cedar Rd', 'Elm St', 'Main St', 'Broadway', 'Washington St', 'Park Ave', 'View Rd'];
    
    const leads = [];
    const now = new Date();
    
    for (let i = 0; i < 18; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      const name = `${firstName} ${lastName}`;
      const gender = genders[i % genders.length];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domains[i % domains.length]}`;
      const mobile = `+1 (${Math.floor(200 + Math.random() * 800)}) 555-${Math.floor(1000 + Math.random() * 9000)}`;
      const age = Math.floor(20 + Math.random() * 40);
      const address = `${Math.floor(100 + Math.random() * 9000)} ${streets[i % streets.length]}, ${states[i % states.length]}`;
      
      const submissionDate = new Date();
      let daysAgo = 0;
      if (i > 2) {
        daysAgo = Math.floor(Math.random() * 25) + 1;
      }
      submissionDate.setDate(now.getDate() - daysAgo);
      submissionDate.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60));
      
      const statuses = ['new', 'contacted', 'hired', 'rejected'];
      const status = i < 4 ? 'new' : statuses[Math.floor(Math.random() * statuses.length)];

      leads.push({
        id: 'lead_' + Math.random().toString(36).substr(2, 9),
        name: name,
        gender: gender,
        email: email,
        mobile: mobile,
        address: address,
        age: age,
        submittedOn: submissionDate.toISOString(),
        status: status
      });
    }

    return leads.sort((a, b) => new Date(b.submittedOn) - new Date(a.submittedOn));
  }

  // Load local database helper
  function loadLocalDatabase() {
    let data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) {
      const seed = generateSeedData();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(data);
  }

  // Save local database helper
  function saveLocalDatabase(leads) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(leads));
    window.dispatchEvent(new CustomEvent('leads_db_update', { detail: leads }));
  }

  // API Methods
  const API = {
    isSupabaseActive: function() {
      return supabaseClient !== null;
    },

    getSupabaseClient: function() {
      return supabaseClient;
    },

    // GET all leads
    getLeads: async function() {
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('leads')
          .select('*')
          .order('submitted_on', { ascending: false });
        
        if (error) {
          console.error('Error fetching leads from Supabase:', error.message);
          throw error;
        }
        return data.map(mapFromDB);
      } else {
        // Fallback: LocalStorage
        return Promise.resolve(loadLocalDatabase());
      }
    },

    // GET a single lead by ID
    getLeadById: async function(id) {
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('leads')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) {
          console.error('Error fetching lead from Supabase:', error.message);
          return null;
        }
        return mapFromDB(data);
      } else {
        const db = loadLocalDatabase();
        return Promise.resolve(db.find(l => l.id === id) || null);
      }
    },

    // POST a new lead
    addLead: async function(leadData) {
      if (supabaseClient) {
        // Map keys to match PostgreSQL snake_case
        const dbPayload = {
          name: leadData.name,
          gender: leadData.gender || 'Other',
          email: leadData.email,
          mobile: leadData.mobile,
          address: leadData.address || '',
          age: parseInt(leadData.age) || 25,
          status: 'new'
        };

        const { data, error } = await supabaseClient
          .from('leads')
          .insert([dbPayload])
          .select()
          .single();

        if (error) {
          console.error('Error inserting lead into Supabase:', error.message);
          throw error;
        }
        
        return mapFromDB(data);
      } else {
        const db = loadLocalDatabase();
        if (!leadData.name || !leadData.email || !leadData.mobile) {
          throw new Error('Name, Email, and Mobile are required fields');
        }

        const newLead = {
          id: 'lead_' + Math.random().toString(36).substr(2, 9),
          name: leadData.name,
          gender: leadData.gender || 'Other',
          email: leadData.email,
          mobile: leadData.mobile,
          address: leadData.address || '',
          age: parseInt(leadData.age) || 25,
          submittedOn: leadData.submittedOn || new Date().toISOString(),
          status: 'new'
        };

        db.unshift(newLead);
        saveLocalDatabase(db);
        
        // Dispatch localStorage cross-tab trigger
        localStorage.setItem('wfh_leads_sync_trigger', JSON.stringify({
          id: newLead.id,
          name: newLead.name,
          timestamp: Date.now()
        }));

        // Dispatch local event for same-tab updates
        window.dispatchEvent(new CustomEvent('leads_db_added_locally', { detail: newLead }));

        return Promise.resolve(newLead);
      }
    },

    // PUT updates to a lead
    updateLead: async function(id, updatedFields) {
      if (supabaseClient) {
        // Prepare snake_case payload
        const dbPayload = {};
        if (updatedFields.name !== undefined) dbPayload.name = updatedFields.name;
        if (updatedFields.gender !== undefined) dbPayload.gender = updatedFields.gender;
        if (updatedFields.email !== undefined) dbPayload.email = updatedFields.email;
        if (updatedFields.mobile !== undefined) dbPayload.mobile = updatedFields.mobile;
        if (updatedFields.address !== undefined) dbPayload.address = updatedFields.address;
        if (updatedFields.age !== undefined) dbPayload.age = parseInt(updatedFields.age);
        if (updatedFields.status !== undefined) dbPayload.status = updatedFields.status;

        const { data, error } = await supabaseClient
          .from('leads')
          .update(dbPayload)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Error updating lead in Supabase:', error.message);
          throw error;
        }
        return mapFromDB(data);
      } else {
        const db = loadLocalDatabase();
        const index = db.findIndex(l => l.id === id);
        
        if (index === -1) {
          throw new Error('Lead not found');
        }

        db[index] = {
          ...db[index],
          ...updatedFields,
          id: id
        };

        saveLocalDatabase(db);
        return Promise.resolve(db[index]);
      }
    },

    // DELETE a lead
    deleteLead: async function(id) {
      if (supabaseClient) {
        const { error } = await supabaseClient
          .from('leads')
          .delete()
          .eq('id', id);
        
        if (error) {
          console.error('Error deleting lead from Supabase:', error.message);
          throw error;
        }
        return true;
      } else {
        const db = loadLocalDatabase();
        const initialLength = db.length;
        const filteredDb = db.filter(l => l.id !== id);
        
        if (filteredDb.length === initialLength) {
          return Promise.resolve(false);
        }

        saveLocalDatabase(filteredDb);
        return Promise.resolve(true);
      }
    },

    // Bulk delete leads
    deleteLeadsBulk: async function(ids) {
      if (supabaseClient) {
        const { error } = await supabaseClient
          .from('leads')
          .delete()
          .in('id', ids);
        
        if (error) {
          console.error('Error bulk deleting from Supabase:', error.message);
          throw error;
        }
        return true;
      } else {
        const db = loadLocalDatabase();
        const filteredDb = db.filter(l => !ids.includes(l.id));
        saveLocalDatabase(filteredDb);
        return Promise.resolve(true);
      }
    },

    // Reset Database (seeds data)
    resetDatabase: async function() {
      if (supabaseClient) {
        // Wipe all rows first
        const { error: deleteError } = await supabaseClient
          .from('leads')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Wipes all records safely
          
        if (deleteError) throw deleteError;

        // Generate seeds
        const seeds = generateSeedData();
        const dbPayloads = seeds.map(s => ({
          name: s.name,
          gender: s.gender,
          email: s.email,
          mobile: s.mobile,
          address: s.address,
          age: s.age,
          status: s.status,
          submitted_on: s.submittedOn
        }));

        const { data, error } = await supabaseClient
          .from('leads')
          .insert(dbPayloads)
          .select();

        if (error) throw error;
        return data.map(mapFromDB);
      } else {
        const seed = generateSeedData();
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(seed));
        window.dispatchEvent(new CustomEvent('leads_db_update', { detail: seed }));
        return Promise.resolve(seed);
      }
    }
  };

  // Expose to window object
  window.API = API;
})();
