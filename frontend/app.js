// Global variables
let adminToken = '';
let socket = null;
const API_BASE = '';

// Navigation logic and app initialization for ResolveIt

document.addEventListener('DOMContentLoaded', () => {
  // Mark JS as loaded
  const jsStatus = document.getElementById('jsStatus');
  if (jsStatus) {
    jsStatus.textContent = 'Loaded ✓';
    jsStatus.classList.remove('text-yellow-600');
    jsStatus.classList.add('text-green-600');
  }

  // Navigation button event listeners
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sectionId = btn.getAttribute('data-section');
      showSection(sectionId);
    });
  });

  // Show home section by default
    showSection('homeSection');

  // Attach user registration form handler
    const userRegForm = document.getElementById('userRegForm');
    if (userRegForm) {
        userRegForm.addEventListener('submit', handleUserRegistration);
    }

  // Attach case registration form handler
    const caseRegForm = document.getElementById('caseRegForm');
    if (caseRegForm) {
        caseRegForm.addEventListener('submit', handleCaseRegistration);
    }

  // Load users for party dropdown
  loadUsersForCase();

  // Handle courtPending checkbox
    const courtPending = document.getElementById('courtPending');
    if (courtPending) {
        courtPending.addEventListener('change', function() {
            const courtDetails = document.getElementById('courtDetails');
            if (this.checked) {
                courtDetails.classList.remove('hidden');
            } else {
                courtDetails.classList.add('hidden');
            }
        });
    }

  // Admin login form handler
  const adminLoginForm = document.getElementById('adminLoginForm');
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', handleAdminLogin);
  }

  // Filter event listeners
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) statusFilter.addEventListener('change', loadCases);
    const typeFilter = document.getElementById('typeFilter');
  if (typeFilter) typeFilter.addEventListener('change', loadCases);

  // Real-time updates (if socket.io is available)
  if (typeof io !== 'undefined') {
    connectWebSocket();
  }

  // Add event listeners for witness modal and form

  // Witness modal close button
  const closeWitnessModal = document.getElementById('closeWitnessModal');
  if (closeWitnessModal) {
    closeWitnessModal.addEventListener('click', () => {
      document.getElementById('witnessModal').classList.add('hidden');
    });
  }

  // Witness form submission
  const witnessForm = document.getElementById('witnessForm');
  if (witnessForm) {
    witnessForm.addEventListener('submit', handleWitnessFormSubmit);
  }

  // Only declare casesTableBody once
  const casesTableBody = document.getElementById('casesTableBody');
  if (casesTableBody) {
    casesTableBody.addEventListener('click', function (e) {
      // Nominate Witnesses button
      const btn = e.target.closest('.nominate-witness-btn');
      if (btn) {
        const caseId = btn.getAttribute('data-case-id');
        if (caseId) openWitnessModal(caseId);
        return;
      }
      // Create Panel button
      const panelBtn = e.target.closest('.create-panel-btn');
      if (panelBtn) {
        const caseId = panelBtn.getAttribute('data-case-id');
        if (caseId) openPanelModal(caseId);
        return;
      }
      // Generate Agreement button
      const agreementBtn = e.target.closest('.generate-agreement-btn');
      if (agreementBtn) {
        const caseId = agreementBtn.getAttribute('data-case-id');
        if (caseId) openAgreementModal(caseId);
        return;
      }
      // Mark Resolved button
      const markResolvedBtn = e.target.closest('.mark-resolved-btn');
      if (markResolvedBtn) {
        const caseId = markResolvedBtn.getAttribute('data-case-id');
        if (caseId) markCaseResolved(caseId);
        return;
      }
    });
  }

  // Panel modal close button
  const closePanelModal = document.getElementById('closePanelModal');
  if (closePanelModal) {
    closePanelModal.addEventListener('click', () => {
      document.getElementById('panelModal').classList.add('hidden');
    });
  }

  // Panel member add button
  const addPanelMemberBtn = document.getElementById('addPanelMemberBtn');
  if (addPanelMemberBtn) {
    addPanelMemberBtn.addEventListener('click', addPanelMember);
  }

  // Panel form submission
  const panelForm = document.getElementById('panelForm');
  if (panelForm) {
    panelForm.addEventListener('submit', handlePanelFormSubmit);
  }

  // Agreement modal close button
  const closeAgreementModal = document.getElementById('closeAgreementModal');
  if (closeAgreementModal) {
    closeAgreementModal.addEventListener('click', () => {
      document.getElementById('agreementModal').classList.add('hidden');
    });
  }

  // Download agreement button
  const downloadAgreementBtn = document.getElementById('downloadAgreementBtn');
  if (downloadAgreementBtn) {
    downloadAgreementBtn.addEventListener('click', downloadAgreement);
  }

  // Attach logout button event listener
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
});

function showSection(sectionId) {
  document.querySelectorAll('.app-section').forEach(section => {
    if (section.id === sectionId) {
      section.classList.remove('hidden');
    } else {
      section.classList.add('hidden');
    }
  });
}

// Notification system
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
  if (!container) return;
    const notification = document.createElement('div');
    const bgColor = {
        'success': 'bg-green-500',
        'error': 'bg-red-500',
        'warning': 'bg-yellow-500',
        'info': 'bg-blue-500'
    }[type] || 'bg-blue-500';
  notification.className = `${bgColor} text-white px-4 py-2 rounded shadow`;
  notification.textContent = message;
    container.appendChild(notification);
    setTimeout(() => {
    if (notification.parentNode) notification.remove();
  }, 4000);
}

// User Registration Logic
async function handleUserRegistration(e) {
  e.preventDefault();
  const form = e.target;

  // Collect form data
  const name = form.userName.value.trim();
  const age = parseInt(form.userAge.value);
  const gender = form.userGender.value;
  const street = form.userStreet.value.trim();
  const city = form.userCity.value.trim();
  const zip = form.userZip.value.trim();
  const email = form.userEmail.value.trim();
  const phone = form.userPhone.value.trim();
  const photoFile = form.userPhoto.files[0];

  // Basic validation
  if (!name || !age || !gender || !street || !city || !zip || !email || !phone || !photoFile) {
    showNotification('Please fill all fields and select a photo.', 'error');
            return;
        }
        
  try {
    // 1. Upload photo file
    const photoForm = new FormData();
    photoForm.append('proof', photoFile);
    const uploadRes = await fetch('/api/upload-proof', {
      method: 'POST',
      body: photoForm
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.files || !uploadData.files[0]) {
      throw new Error(uploadData.error || 'Photo upload failed');
    }
    const photoPath = uploadData.files[0];

    // 2. Register user
    const userData = {
      name,
      age,
      gender,
      address: { street, city, zip },
      email,
      phone,
      photo: photoPath
    };
    const regRes = await fetch('/api/register-user', {
            method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const regData = await regRes.json();
    if (!regRes.ok) {
      throw new Error(regData.error || 'Registration failed');
    }
    showNotification('User registered successfully!', 'success');
    form.reset();
  } catch (err) {
    showNotification(err.message, 'error');
  }
}

// Case Registration Logic
async function handleCaseRegistration(e) {
    e.preventDefault();
  const form = e.target;

  // Collect form data
  const caseType = form.caseType.value;
  const issueDescription = form.issueDescription.value.trim();
  const partyId = form.partyId.value;
  const oppositePartyName = form.oppositePartyName.value.trim();
  const oppositePartyContact = form.oppositePartyContact.value.trim();
  const oppositePartyAddress = form.oppositePartyAddress.value.trim();
  const proofFiles = form.proofFiles.files;
  const isCourtPending = form.courtPending.checked;
  const caseNumber = form.caseNumber.value.trim();
  const courtName = form.courtName.value.trim();

  // Basic validation
  if (!caseType || !issueDescription || !partyId || !oppositePartyName || !oppositePartyContact || !oppositePartyAddress) {
    showNotification('Please fill all required fields.', 'error');
    return;
  }

  let proofPaths = [];
  if (proofFiles && proofFiles.length > 0) {
    // Upload proof files
    const proofForm = new FormData();
    for (let i = 0; i < proofFiles.length; i++) {
      proofForm.append('proof', proofFiles[i]);
    }
    try {
      const uploadRes = await fetch('/api/upload-proof', {
        method: 'POST',
        body: proofForm
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.files) {
        throw new Error(uploadData.error || 'Proof upload failed');
      }
      proofPaths = uploadData.files;
    } catch (err) {
      showNotification('Proof upload failed: ' + err.message, 'error');
      return;
    }
  }

  // Prepare case data
    const caseData = {
    caseType,
    issueDescription,
    partyId,
        oppositeParty: {
      name: oppositePartyName,
      contact: oppositePartyContact,
      address: oppositePartyAddress
    },
    proof: proofPaths,
    courtPending: isCourtPending ? {
            isPending: true,
      caseNumber,
      courtOrPoliceName: courtName
        } : {
            isPending: false
        }
    };

    try {
    const regRes = await fetch('/api/register-case', {
            method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(caseData)
        });
    const regData = await regRes.json();
    if (!regRes.ok) {
      throw new Error(regData.error || 'Case registration failed');
    }
        showNotification('Case registered successfully!', 'success');
    form.reset();
        document.getElementById('courtDetails').classList.add('hidden');
    loadUsersForCase(); // Refresh users list
  } catch (err) {
    showNotification(err.message, 'error');
    }
}

// Handle admin login
async function handleAdminLogin(e) {
    e.preventDefault();
  const form = e.target;
  const username = form.adminUsername.value.trim();
  const password = form.adminPassword.value;
  try {
    const res = await fetch('/api/admin-login', {
            method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Login failed');
    }
    adminToken = data.token;
            showNotification('Login successful!', 'success');
    document.getElementById('adminLoginForm').classList.add('hidden');
            document.getElementById('adminDashboard').classList.remove('hidden');
            loadCases();
  } catch (err) {
    showNotification(err.message, 'error');
  }
}

// Logout logic
function handleLogout() {
    adminToken = '';
  document.getElementById('adminLoginForm').classList.remove('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    showNotification('Logged out successfully', 'info');
}

// Load cases for admin dashboard
async function loadCases() {
    if (!adminToken) return;
  const status = document.getElementById('statusFilter')?.value || '';
  const caseType = document.getElementById('typeFilter')?.value || '';
  let url = '/api/cases?';
  if (status) url += `status=${encodeURIComponent(status)}&`;
  if (caseType) url += `caseType=${encodeURIComponent(caseType)}&`;
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const cases = await res.json();
        renderCasesTable(cases);
        showNotification(`Loaded ${cases.length} cases`, 'success');
  } catch (err) {
    showNotification('Failed to load cases', 'error');
  }
}

// Update case status
async function updateCaseStatus(caseId, newStatus) {
    if (!adminToken) {
        showNotification('Admin authentication required', 'error');
        return;
    }

    try {
        await apiCall(`/api/case/${caseId}/workflow-status`, {
            method: 'PATCH',
            data: { status: newStatus }
        });

        showNotification(`Case status updated to ${newStatus}`, 'success');
        loadCases(); // Refresh the table
        loadDashboardStats(); // Refresh stats
    } catch (error) {
        console.error('Failed to update case status:', error);
    }
}

// WebSocket connection
function connectWebSocket() {
    try {
        socket = io();
        socket.on('connect', () => {
            socket.emit('joinDashboard');
        });
        socket.on('caseStatusUpdate', (data) => {
            showNotification(`Case ${data.caseId.substring(0, 8)} status updated to: ${data.status}`, 'info');
      if (adminToken) loadCases();
    });
    socket.on('disconnect', () => {});
  } catch (error) {
    // Ignore if socket.io is not available
  }
}

// Load users for party dropdown in case registration
async function loadUsersForCase() {
  const partySelect = document.getElementById('partyId');
  if (!partySelect) return;
  partySelect.innerHTML = '<option value="">Loading users...</option>';
  try {
    const res = await fetch('/api/users');
    const users = await res.json();
    partySelect.innerHTML = '<option value="">Select User</option>';
    users.forEach(user => {
      const option = document.createElement('option');
      option.value = user._id;
      option.textContent = `${user.name} (${user.email})`;
      partySelect.appendChild(option);
    });
  } catch (err) {
    partySelect.innerHTML = '<option value="">Failed to load users</option>';
  }
}

// Show witness modal for a case
function openWitnessModal(caseId) {
  document.getElementById('witnessCaseId').value = caseId;
  document.getElementById('witnessForm').reset();
  document.getElementById('witnessModal').classList.remove('hidden');
}

// Handle witness form submission
async function handleWitnessFormSubmit(e) {
  e.preventDefault();
  const caseId = document.getElementById('witnessCaseId').value;
  const name = document.getElementById('witnessName').value.trim();
  const contact = document.getElementById('witnessContact').value.trim();
  const role = document.getElementById('witnessRole').value.trim();
  const nominatedBy = document.getElementById('witnessNominatedBy').value;
  if (!name || !contact || !role || !nominatedBy) {
    showNotification('Please fill all witness fields.', 'error');
    return;
  }
  const witnesses = [{ name, contact, role, nominatedBy }];
  try {
    const res = await fetch(`/api/case/${caseId}/witnesses`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ witnesses })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add witness');
    showNotification('Witness added successfully!', 'success');
    document.getElementById('witnessModal').classList.add('hidden');
                loadCases();
  } catch (err) {
    showNotification(err.message, 'error');
  }
}

// Panel members array (in-memory for modal)
let panelMembers = [];

function openPanelModal(caseId) {
  document.getElementById('panelCaseId').value = caseId;
  document.getElementById('panelForm').reset();
  panelMembers = [];
  renderPanelMembersList();
  document.getElementById('panelModal').classList.remove('hidden');
}

function addPanelMember(e) {
  e.preventDefault();
  const name = document.getElementById('panelMemberName').value.trim();
  const expertise = document.getElementById('panelMemberExpertise').value.trim();
  const contact = document.getElementById('panelMemberContact').value.trim();
  if (!name || !expertise || !contact) {
    showNotification('Please fill all panel member fields.', 'error');
    return;
  }
  panelMembers.push({ name, expertise, contact });
  renderPanelMembersList();
  document.getElementById('panelMemberName').value = '';
  document.getElementById('panelMemberExpertise').value = '';
  document.getElementById('panelMemberContact').value = '';
}

function renderPanelMembersList() {
  const list = document.getElementById('panelMembersList');
  list.innerHTML = panelMembers.map(m => `<li>${m.name} (${m.expertise}, ${m.contact})</li>`).join('');
}

async function handlePanelFormSubmit(e) {
  e.preventDefault();
  const caseId = document.getElementById('panelCaseId').value;
  if (panelMembers.length < 3) {
    showNotification('Panel must have at least 3 members.', 'error');
    return;
  }
  // Validate required expertise
  const expertiseTypes = panelMembers.map(m => m.expertise.toLowerCase());
  const hasLawyer = expertiseTypes.some(exp => exp.includes('lawyer'));
  const hasReligiousScholar = expertiseTypes.some(exp => exp.includes('religious') || exp.includes('scholar'));
  const hasCommunityMember = expertiseTypes.some(exp => exp.includes('community'));
  if (!hasLawyer || !hasReligiousScholar || !hasCommunityMember) {
    showNotification('Panel must include at least one lawyer, one religious scholar, and one community member.', 'error');
    return;
  }
  try {
    const res = await fetch(`/api/case/${caseId}/panel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ panel: panelMembers })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create panel');
    showNotification('Panel created successfully!', 'success');
    document.getElementById('panelModal').classList.add('hidden');
    loadCases();
  } catch (err) {
    showNotification(err.message, 'error');
  }
}

// Open agreement modal and pre-fill template
function openAgreementModal(caseId) {
  document.getElementById('agreementCaseId').value = caseId;
  // You can fetch agreement data from backend if needed, here we use a template
  const template = `This agreement is made between the parties involved in case ID: ${caseId} on ${new Date().toLocaleDateString()}.

The parties have agreed to the following terms as a result of the mediation process:

[Insert agreement terms here]

Signed by both parties and the mediation panel.`;
  document.getElementById('agreementText').value = template;
  document.getElementById('agreementModal').classList.remove('hidden');
}

// Download agreement as text file
function downloadAgreement(e) {
  e.preventDefault();
  const caseId = document.getElementById('agreementCaseId').value;
  const text = document.getElementById('agreementText').value;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agreement_case_${caseId}.txt`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

// Mark case as resolved
async function markCaseResolved(caseId) {
  try {
    const res = await fetch(`/api/case/${caseId}/workflow-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'Resolved' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to mark as resolved');
    showNotification('Case marked as resolved!', 'success');
    loadCases();
  } catch (err) {
    showNotification(err.message, 'error');
  }
}

// Update renderCasesTable to include Mark Resolved button
function renderCasesTable(cases) {
  const tbody = document.getElementById('casesTableBody');
  if (!tbody) return;
  if (!Array.isArray(cases) || cases.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-center text-gray-500">No cases found</td></tr>';
    return;
  }
  tbody.innerHTML = cases.map(caseItem => {
    const statusColors = {
      'Queued': 'bg-yellow-100 text-yellow-800',
      'Awaiting Response': 'bg-blue-100 text-blue-800',
      'Accepted': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800',
      'Panel Created': 'bg-purple-100 text-purple-800',
      'Mediation in Progress': 'bg-indigo-100 text-indigo-800',
      'Resolved': 'bg-green-100 text-green-800',
      'Unresolved': 'bg-red-100 text-red-800'
    };
    const statusClass = statusColors[caseItem.status] || 'bg-gray-100 text-gray-800';
    let actions = `
      <button type="button" class="nominate-witness-btn bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 text-xs" data-case-id="${caseItem._id}">Nominate Witnesses</button>
      <button type="button" class="create-panel-btn bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 text-xs" data-case-id="${caseItem._id}">Create Panel</button>
    `;
    if (caseItem.status && caseItem.status.toLowerCase() === 'resolved') {
      actions += `
        <button type="button" class="generate-agreement-btn bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 text-xs mt-1" data-case-id="${caseItem._id}">Generate Agreement</button>
      `;
    } else if (caseItem.status && caseItem.status.toLowerCase() !== 'unresolved') {
      actions += `
        <button type="button" class="mark-resolved-btn bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 text-xs mt-1" data-case-id="${caseItem._id}">Mark Resolved</button>
      `;
    }
    return `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-2 text-xs">${caseItem._id.substring(0, 8)}...</td>
        <td class="px-4 py-2">${caseItem.caseType}</td>
        <td class="px-4 py-2">${caseItem.party?.name || 'N/A'}</td>
        <td class="px-4 py-2"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${caseItem.status}</span></td>
        <td class="px-4 py-2">${new Date(caseItem.createdAt).toLocaleDateString()}</td>
        <td class="px-4 py-2 flex flex-col gap-2">${actions}</td>
      </tr>
    `;
  }).join('');
}

// Make functions globally available
window.showSection = showSection;
window.showNotification = showNotification;
window.loadUsers = loadUsers;
window.handleLogout = handleLogout;
window.loadCases = loadCases;
window.updateCaseStatus = updateCaseStatus;
window.openWitnessModal = openWitnessModal;
