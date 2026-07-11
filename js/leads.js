(function() {
  let currentPage = 1;
  const itemsPerPage = 8;
  let selectedLeadIds = [];
  let cachedLeads = []; // Cache to allow fast synchronous filtering & sorting
  
  // State elements
  let elements = {};

  // Formats date string into readable text
  function formatDate(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Filtered Leads accumulator using cached leads list
  function getFilteredLeads() {
    let leads = [...cachedLeads];
    
    // 1. Search Query
    const searchVal = elements.searchInput.value.toLowerCase().trim();
    if (searchVal) {
      leads = leads.filter(l => 
        (l.name && l.name.toLowerCase().includes(searchVal)) ||
        (l.email && l.email.toLowerCase().includes(searchVal)) ||
        (l.mobile && l.mobile.toLowerCase().includes(searchVal)) ||
        (l.address && l.address.toLowerCase().includes(searchVal))
      );
    }

    // 2. Gender Filter
    const genderVal = elements.genderFilter.value;
    if (genderVal !== 'all') {
      leads = leads.filter(l => l.gender && l.gender.toLowerCase() === genderVal.toLowerCase());
    }

    // 3. Status Filter
    const statusVal = elements.statusFilter.value;
    if (statusVal !== 'all') {
      leads = leads.filter(l => l.status && l.status.toLowerCase() === statusVal.toLowerCase());
    }

    // 4. Date Filter
    const dateVal = elements.dateFilter.value;
    const now = new Date();
    if (dateVal === 'today') {
      leads = leads.filter(l => {
        if (!l.submittedOn) return false;
        const d = new Date(l.submittedOn);
        return d.toDateString() === now.toDateString();
      });
    } else if (dateVal === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      leads = leads.filter(l => l.submittedOn && new Date(l.submittedOn) >= oneWeekAgo);
    } else if (dateVal === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(now.getDate() - 30);
      leads = leads.filter(l => l.submittedOn && new Date(l.submittedOn) >= oneMonthAgo);
    }

    return leads;
  }

  const LeadsController = {
    init: function() {
      // Gather DOM Nodes
      elements = {
        tableBody: document.getElementById('leads-table-body'),
        searchInput: document.getElementById('leads-search'),
        genderFilter: document.getElementById('filter-gender'),
        statusFilter: document.getElementById('filter-status'),
        dateFilter: document.getElementById('filter-date'),
        selectAllCheckbox: document.getElementById('select-all-leads'),
        bulkActionsBar: document.getElementById('bulk-actions-bar'),
        bulkCount: document.getElementById('bulk-count'),
        bulkDeleteBtn: document.getElementById('bulk-delete-btn'),
        exportBtn: document.getElementById('export-csv-btn'),
        prevPageBtn: document.getElementById('prev-page-btn'),
        nextPageBtn: document.getElementById('next-page-btn'),
        pageInfo: document.getElementById('page-info'),
        modalOverlay: document.getElementById('modal-overlay'),
        modalTitle: document.getElementById('modal-title'),
        modalBody: document.getElementById('modal-body'),
        modalFooter: document.getElementById('modal-footer')
      };

      // Set up events
      elements.searchInput.addEventListener('input', () => { currentPage = 1; this.renderTable(); });
      elements.genderFilter.addEventListener('change', () => { currentPage = 1; this.renderTable(); });
      elements.statusFilter.addEventListener('change', () => { currentPage = 1; this.renderTable(); });
      elements.dateFilter.addEventListener('change', () => { currentPage = 1; this.renderTable(); });
      
      elements.selectAllCheckbox.addEventListener('change', (e) => {
        this.toggleSelectAll(e.target.checked);
      });

      elements.bulkDeleteBtn.addEventListener('click', () => {
        this.handleBulkDelete();
      });

      elements.exportBtn.addEventListener('click', () => {
        this.exportToCSV();
      });

      elements.prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          this.renderTable();
        }
      });

      elements.nextPageBtn.addEventListener('click', () => {
        const filtered = getFilteredLeads();
        if (currentPage * itemsPerPage < filtered.length) {
          currentPage++;
          this.renderTable();
        }
      });

      // Listen for global database changes (forces async fetch)
      window.addEventListener('leads_db_update', () => {
        this.fetchAndRenderTable();
      });

      // Initial render
      this.fetchAndRenderTable();
    },

    fetchAndRenderTable: async function() {
      if (!elements.tableBody) return;

      // Show loader spinner
      elements.tableBody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 3rem;">
            <i class="animate-spin" data-lucide="loader-2" style="animation: spin 1s linear infinite; display: inline-block; vertical-align: middle; margin-right: 0.5rem; width: 18px; height: 18px;"></i>
            Loading database records...
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();

      try {
        cachedLeads = await window.API.getLeads();
        this.renderTable();
      } catch (err) {
        elements.tableBody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align: center; color: var(--danger); padding: 3rem;">
              Failed to load records from database: ${err.message}
            </td>
          </tr>
        `;
      }
    },

    renderTable: function() {
      if (!elements.tableBody) return;

      const filteredLeads = getFilteredLeads();
      const totalItems = filteredLeads.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
      
      // Keep page in boundaries
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      // Slice for pagination
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
      const pageLeads = filteredLeads.slice(startIndex, endIndex);

      // Render table
      if (pageLeads.length === 0) {
        elements.tableBody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 3rem;">
              No leads found matching current criteria.
            </td>
          </tr>
        `;
        elements.selectAllCheckbox.checked = false;
        this.updateBulkBar();
      } else {
        elements.tableBody.innerHTML = pageLeads.map(lead => {
          const isSelected = selectedLeadIds.includes(lead.id);
          
          let statusBadgeClass = 'badge-success';
          if (lead.status === 'new') statusBadgeClass = 'badge-success';
          else if (lead.status === 'contacted') statusBadgeClass = 'badge'; 
          else if (lead.status === 'hired') statusBadgeClass = 'badge-success';
          else if (lead.status === 'rejected') statusBadgeClass = 'badge-danger';
          
          let badgeStyle = '';
          if (lead.status === 'contacted') {
            badgeStyle = 'background: rgba(0, 163, 255, 0.15); color: var(--accent);';
          }

          return `
            <tr data-lead-id="${lead.id}">
              <td>
                <input type="checkbox" class="row-checkbox" ${isSelected ? 'checked' : ''} data-id="${lead.id}">
              </td>
              <td class="lead-name-cell">${lead.name}</td>
              <td>${lead.gender}</td>
              <td>${lead.email}</td>
              <td>${lead.mobile}</td>
              <td>${lead.address || '-'}</td>
              <td>${lead.age}</td>
              <td>${formatDate(lead.submittedOn)}</td>
              <td>
                <span class="badge ${statusBadgeClass}" style="${badgeStyle}">${lead.status.toUpperCase()}</span>
              </td>
              <td class="actions-cell">
                <button class="btn-icon view-btn" title="View details" data-id="${lead.id}">
                  <i data-lucide="eye"></i>
                </button>
                <button class="btn-icon edit-btn" title="Edit details" data-id="${lead.id}">
                  <i data-lucide="edit-3"></i>
                </button>
                <button class="btn-icon delete-btn" title="Delete lead" data-id="${lead.id}">
                  <i data-lucide="trash-2"></i>
                </button>
              </td>
            </tr>
          `;
        }).join('');

        if (window.lucide) {
          window.lucide.createIcons();
        }

        const checkboxes = elements.tableBody.querySelectorAll('.row-checkbox');
        checkboxes.forEach(cb => {
          cb.addEventListener('change', (e) => {
            this.handleRowSelect(e.target.dataset.id, e.target.checked);
          });
        });

        // Add action button event listeners
        elements.tableBody.querySelectorAll('.view-btn').forEach(b => {
          b.addEventListener('click', () => this.openViewModal(b.dataset.id));
        });
        elements.tableBody.querySelectorAll('.edit-btn').forEach(b => {
          b.addEventListener('click', () => this.openEditModal(b.dataset.id));
        });
        elements.tableBody.querySelectorAll('.delete-btn').forEach(b => {
          b.addEventListener('click', () => this.confirmDeleteLead(b.dataset.id));
        });

        const allCheckedOnPage = pageLeads.every(lead => selectedLeadIds.includes(lead.id));
        elements.selectAllCheckbox.checked = allCheckedOnPage;
      }

      elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${totalItems} total)`;
      elements.prevPageBtn.disabled = currentPage === 1;
      elements.nextPageBtn.disabled = currentPage === totalPages;
      
      this.updateBulkBar();
    },

    toggleSelectAll: function(isChecked) {
      const filtered = getFilteredLeads();
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, filtered.length);
      const pageLeads = filtered.slice(startIndex, endIndex);

      pageLeads.forEach(lead => {
        this.handleRowSelect(lead.id, isChecked, false);
      });
      
      this.renderTable();
    },

    handleRowSelect: function(id, isChecked, triggerRender = true) {
      if (isChecked) {
        if (!selectedLeadIds.includes(id)) {
          selectedLeadIds.push(id);
        }
      } else {
        selectedLeadIds = selectedLeadIds.filter(lid => lid !== id);
      }

      if (triggerRender) {
        this.updateBulkBar();
        const pageCheckboxes = elements.tableBody.querySelectorAll('.row-checkbox');
        let allChecked = pageCheckboxes.length > 0;
        pageCheckboxes.forEach(cb => {
          if (!cb.checked) allChecked = false;
        });
        elements.selectAllCheckbox.checked = allChecked;
      }
    },

    updateBulkBar: function() {
      if (!elements.bulkActionsBar) return;
      
      if (selectedLeadIds.length > 0) {
        elements.bulkCount.textContent = `${selectedLeadIds.length} lead(s) selected`;
        elements.bulkActionsBar.classList.add('active');
      } else {
        elements.bulkActionsBar.classList.remove('active');
      }
    },

    handleBulkDelete: async function() {
      if (selectedLeadIds.length === 0) return;
      
      if (confirm(`Are you sure you want to delete ${selectedLeadIds.length} selected lead(s)?`)) {
        try {
          await window.API.deleteLeadsBulk(selectedLeadIds);
          const countDeleted = selectedLeadIds.length;
          selectedLeadIds = [];
          
          if (window.Notifications) {
            window.Notifications.showToast('Bulk Delete Completed', `Successfully deleted ${countDeleted} lead records`, 'success');
          }
          
          currentPage = 1;
          await this.fetchAndRenderTable();
        } catch (err) {
          alert('Failed to delete leads: ' + err.message);
        }
      }
    },

    confirmDeleteLead: async function(id) {
      try {
        const lead = await window.API.getLeadById(id);
        if (!lead) return;

        if (confirm(`Are you sure you want to delete lead: "${lead.name}"?`)) {
          await window.API.deleteLead(id);
          selectedLeadIds = selectedLeadIds.filter(lid => lid !== id);
          
          if (window.Notifications) {
            window.Notifications.showToast('Lead Deleted', `Lead record for ${lead.name} has been removed.`, 'info');
          }
          
          await this.fetchAndRenderTable();
        }
      } catch (err) {
        alert('Failed to delete lead: ' + err.message);
      }
    },

    openViewModal: async function(id) {
      const lead = await window.API.getLeadById(id);
      if (!lead) return;

      elements.modalTitle.textContent = 'Lead Details';
      
      let statusBadgeClass = 'badge-success';
      if (lead.status === 'rejected') statusBadgeClass = 'badge-danger';
      else if (lead.status === 'contacted') statusBadgeClass = 'badge';
      let badgeStyle = lead.status === 'contacted' ? 'background: rgba(0, 163, 255, 0.15); color: var(--accent);' : '';

      elements.modalBody.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
            <div>
              <h4 style="font-size: 1.25rem; color: #fff;">${lead.name}</h4>
              <p style="color: var(--text-muted); font-size: 0.85rem;">ID: ${lead.id}</p>
            </div>
            <span class="badge ${statusBadgeClass}" style="${badgeStyle}">${lead.status.toUpperCase()}</span>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label>GENDER</label>
              <p style="color: #fff; font-size: 0.95rem; margin-top: 0.25rem;">${lead.gender}</p>
            </div>
            <div>
              <label>AGE</label>
              <p style="color: #fff; font-size: 0.95rem; margin-top: 0.25rem;">${lead.age} years old</p>
            </div>
            <div>
              <label>EMAIL</label>
              <p style="color: #fff; font-size: 0.95rem; margin-top: 0.25rem; word-break: break-all;">${lead.email}</p>
            </div>
            <div>
              <label>MOBILE</label>
              <p style="color: #fff; font-size: 0.95rem; margin-top: 0.25rem;">${lead.mobile}</p>
            </div>
            <div style="grid-column: span 2;">
              <label>ADDRESS</label>
              <p style="color: #fff; font-size: 0.95rem; margin-top: 0.25rem;">${lead.address || '-'}</p>
            </div>
            <div style="grid-column: span 2;">
              <label>SUBMITTED ON</label>
              <p style="color: #fff; font-size: 0.95rem; margin-top: 0.25rem;">${formatDate(lead.submittedOn)}</p>
            </div>
          </div>
        </div>
      `;

      elements.modalFooter.innerHTML = `
        <button class="btn-secondary" id="close-view-modal">Close</button>
      `;

      elements.modalOverlay.classList.add('active');

      document.getElementById('close-view-modal').addEventListener('click', () => {
        elements.modalOverlay.classList.remove('active');
      });
    },

    openEditModal: async function(id) {
      const lead = await window.API.getLeadById(id);
      if (!lead) return;

      elements.modalTitle.textContent = 'Edit Lead Information';
      
      elements.modalBody.innerHTML = `
        <form id="edit-lead-form" style="display: flex; flex-direction: column; gap: 1rem;">
          <div class="form-group">
            <label for="edit-name">Full Name</label>
            <input type="text" id="edit-name" class="input-field" value="${lead.name}" required>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label for="edit-gender">Gender</label>
              <select id="edit-gender" class="filter-select" style="width:100%;">
                <option value="Male" ${lead.gender === 'Male' ? 'selected' : ''}>Male</option>
                <option value="Female" ${lead.gender === 'Female' ? 'selected' : ''}>Female</option>
                <option value="Other" ${lead.gender === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            <div class="form-group">
              <label for="edit-age">Age</label>
              <input type="number" id="edit-age" class="input-field" value="${lead.age}" required>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label for="edit-email">Email Address</label>
              <input type="email" id="edit-email" class="input-field" value="${lead.email}" required>
            </div>
            <div class="form-group">
              <label for="edit-mobile">Mobile Phone</label>
              <input type="text" id="edit-mobile" class="input-field" value="${lead.mobile}" required>
            </div>
          </div>

          <div class="form-group">
            <label for="edit-address">Home Address</label>
            <input type="text" id="edit-address" class="input-field" value="${lead.address || ''}">
          </div>

          <div class="form-group">
            <label for="edit-status">Status</label>
            <select id="edit-status" class="filter-select" style="width:100%;">
              <option value="new" ${lead.status === 'new' ? 'selected' : ''}>NEW</option>
              <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>CONTACTED</option>
              <option value="hired" ${lead.status === 'hired' ? 'selected' : ''}>HIRED</option>
              <option value="rejected" ${lead.status === 'rejected' ? 'selected' : ''}>REJECTED</option>
            </select>
          </div>
        </form>
      `;

      elements.modalFooter.innerHTML = `
        <button class="btn-secondary" id="cancel-edit-modal">Cancel</button>
        <button class="btn-primary" id="save-edit-modal">Save Changes</button>
      `;

      elements.modalOverlay.classList.add('active');

      const closeModal = () => elements.modalOverlay.classList.remove('active');

      document.getElementById('cancel-edit-modal').addEventListener('click', closeModal);
      
      document.getElementById('save-edit-modal').addEventListener('click', async () => {
        const form = document.getElementById('edit-lead-form');
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        const updatedData = {
          name: document.getElementById('edit-name').value,
          gender: document.getElementById('edit-gender').value,
          age: parseInt(document.getElementById('edit-age').value) || 25,
          email: document.getElementById('edit-email').value,
          mobile: document.getElementById('edit-mobile').value,
          address: document.getElementById('edit-address').value,
          status: document.getElementById('edit-status').value
        };

        try {
          await window.API.updateLead(id, updatedData);
          if (window.Notifications) {
            window.Notifications.showToast('Lead Updated', `Information for ${updatedData.name} saved successfully.`, 'success');
          }
          closeModal();
          await this.fetchAndRenderTable();
        } catch (err) {
          alert('Failed to update lead: ' + err.message);
        }
      });
    },

    exportToCSV: function() {
      const leads = getFilteredLeads();
      if (leads.length === 0) {
        alert('No data available to export.');
        return;
      }

      const headers = ['ID', 'Name', 'Gender', 'Email', 'Mobile', 'Address', 'Age', 'Submitted On', 'Status'];
      
      const rows = leads.map(l => [
        l.id,
        `"${(l.name || '').replace(/"/g, '""')}"`,
        l.gender,
        l.email,
        l.mobile,
        `"${(l.address || '').replace(/"/g, '""')}"`,
        l.age,
        l.submittedOn,
        l.status
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(e => e.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `crm_leads_export_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  window.LeadsController = LeadsController;
})();
