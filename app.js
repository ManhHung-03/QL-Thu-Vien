/**
 * Library Management System - Core Javascript Business Logic
 * Author: Antigravity AI
 */

// ==========================================
// 1. DATA MODELS & LOCAL STORAGE MANAGEMENT
// ==========================================

function formatDateVN(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}


const DEFAULT_BOOKS = [];
const DEFAULT_MEMBERS = [];
const DEFAULT_CHECKOUTS = [];
const DEFAULT_DISTRIBUTIONS = [];
const DEFAULT_RESERVATIONS = [];
const DEFAULT_NOTIFICATIONS = [];
const DEFAULT_AUDIT_LOGS = [];

// Helper to format dates
function getOffsetDate(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().split('T')[0];
}



const DEFAULT_RULES = {
    maxBorrow: 3
};

const DEFAULT_GENRES = ['Công nghệ', 'Văn học', 'Kinh tế', 'Khoa học', 'Kỹ năng sống'];
const DEFAULT_DEPARTMENTS = ['Phòng Kỹ thuật', 'Phòng Hành chính', 'Phòng Kế toán', 'Phòng Đào tạo', 'Phòng Nhân sự'];

// Database state loaded from localStorage or initialized with defaults
let db = {
    books: [],
    members: [],
    checkouts: [],
    distributions: [],
    reservations: [],
    notifications: [],
    auditLogs: [],
    rules: {},
    genres: [],
    departments: []
};

const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';

async function initDB(force = false) {
    // Show loading toast
    const loadingToastId = 'toast-loading-db';
    showToast('Đang kết nối tới cơ sở dữ liệu đám mây...', 'info');

    try {
        const response = await fetch(`${API_BASE_URL}/data`);
        if (!response.ok) throw new Error('API connection failed');

        const data = await response.json();

        // Check if MongoDB is empty but LocalStorage has data (Migration scenario)
        const hasLocalData = localStorage.getItem('lms_initialized') === 'true';
        if (data.books.length === 0 && hasLocalData && !force) {
            showToast('Đang đồng bộ dữ liệu cũ lên Cloud...', 'warning');

            // Read from local storage
            const localBooks = JSON.parse(localStorage.getItem('lms_books')) || [];
            const localCheckouts = JSON.parse(localStorage.getItem('lms_checkouts')) || [];
            const localDistributions = JSON.parse(localStorage.getItem('lms_distributions')) || [];
            const localRules = JSON.parse(localStorage.getItem('lms_rules')) || DEFAULT_RULES;
            const localGenres = JSON.parse(localStorage.getItem('lms_genres')) || DEFAULT_GENRES;
            const localDepts = JSON.parse(localStorage.getItem('lms_departments')) || DEFAULT_DEPARTMENTS;
            const localAuditLogs = JSON.parse(localStorage.getItem('lms_audit_logs')) || [];
            const localNotis = JSON.parse(localStorage.getItem('lms_notifications')) || [];

            // Push to backend
            await fetch(`${API_BASE_URL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    books: localBooks,
                    checkouts: localCheckouts,
                    distributions: localDistributions,
                    auditLogs: localAuditLogs,
                    notifications: localNotis,
                    rules: localRules,
                    genres: localGenres,
                    departments: localDepts
                })
            });

            showToast('Đồng bộ dữ liệu lên Cloud thành công!', 'success');
            // Re-fetch data after sync
            return initDB(force);
        }

        // Apply data from MongoDB to the global db object
        db.books = data.books || [];
        db.checkouts = data.checkouts || [];
        db.distributions = data.distributions || [];
        db.auditLogs = data.auditLogs || [];
        db.notifications = data.notifications || [];
        db.rules = data.rules || DEFAULT_RULES;
        db.genres = data.genres || DEFAULT_GENRES;
        db.departments = data.departments || DEFAULT_DEPARTMENTS;

        // Also save to localStorage as a cache/backup
        saveAllDBLocal();
        showToast('Tải dữ liệu từ Cloud thành công!', 'success');

    } catch (err) {
        console.error('Cannot connect to API, using LocalStorage fallback.', err);
        showToast('Mất kết nối server! Đang dùng dữ liệu ngoại tuyến.', 'error');

        // Fallback to local storage
        if (force || !localStorage.getItem('lms_initialized')) {
            localStorage.setItem('lms_books', JSON.stringify(DEFAULT_BOOKS));
            localStorage.setItem('lms_checkouts', JSON.stringify(DEFAULT_CHECKOUTS));
            localStorage.setItem('lms_distributions', JSON.stringify(DEFAULT_DISTRIBUTIONS));
            localStorage.setItem('lms_notifications', JSON.stringify(DEFAULT_NOTIFICATIONS));
            localStorage.setItem('lms_audit_logs', JSON.stringify(DEFAULT_AUDIT_LOGS));
            localStorage.setItem('lms_rules', JSON.stringify(DEFAULT_RULES));
            localStorage.setItem('lms_genres', JSON.stringify(DEFAULT_GENRES));
            localStorage.setItem('lms_departments', JSON.stringify(DEFAULT_DEPARTMENTS));
            localStorage.setItem('lms_initialized', 'true');
        }

        db.books = JSON.parse(localStorage.getItem('lms_books')) || [];
        db.checkouts = JSON.parse(localStorage.getItem('lms_checkouts')) || [];
        db.distributions = JSON.parse(localStorage.getItem('lms_distributions')) || [];
        db.auditLogs = JSON.parse(localStorage.getItem('lms_audit_logs')) || [];
        db.notifications = JSON.parse(localStorage.getItem('lms_notifications')) || [];
        db.rules = JSON.parse(localStorage.getItem('lms_rules')) || DEFAULT_RULES;
        db.genres = JSON.parse(localStorage.getItem('lms_genres')) || DEFAULT_GENRES;
        db.departments = JSON.parse(localStorage.getItem('lms_departments')) || DEFAULT_DEPARTMENTS;
    }

    // Trigger initial render updates if already on a specific tab
    if (currentTab === 'dashboard') loadDashboardStats();
    if (currentTab === 'books') renderBooks();
}

function saveDBLocal(key) {
    localStorage.setItem(`lms_${key}`, JSON.stringify(db[key]));
}

function saveAllDBLocal() {
    saveDBLocal('books');
    saveDBLocal('checkouts');
    saveDBLocal('distributions');
    saveDBLocal('notifications');
    saveDBLocal('auditLogs');
    saveDBLocal('rules');
    saveDBLocal('genres');
    saveDBLocal('departments');
}

function saveDB(key) {
    // Keep local backup updated
    saveDBLocal(key);

    // Optimistic sync to Cloud
    fetch(`${API_BASE_URL}/bulk/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db[key])
    }).catch(e => console.warn(`Cloud sync failed for ${key}`, e));
}

function saveAllDB() {
    saveAllDBLocal();
    ['books', 'checkouts', 'distributions', 'notifications', 'auditLogs', 'rules', 'genres', 'departments'].forEach(k => saveDB(k));
}

// Generate inline colored SVGs for book covers
function generateBookCover(title, author, genre) {
    const colors = {
        'Công nghệ': ['#4f46e5', '#06b6d4'],
        'Văn học': ['#ec4899', '#f43f5e'],
        'Kinh tế': ['#f59e0b', '#d97706'],
        'Khoa học': ['#10b981', '#059669'],
        'Kỹ năng sống': ['#8b5cf6', '#6366f1']
    };
    const color = colors[genre] || ['#64748b', '#334155'];

    const cleanTitle = title.replace(/[<>&"]/g, '');
    const cleanAuthor = author.replace(/[<>&"]/g, '');

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 180" width="120" height="180">
            <defs>
                <linearGradient id="grad-${cleanTitle.replace(/\s+/g, '')}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${color[0]};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${color[1]};stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="120" height="180" rx="6" fill="url(#grad-${cleanTitle.replace(/\s+/g, '')})" />
            <rect width="8" height="180" fill="rgba(0,0,0,0.2)" />
            <rect x="8" width="1" height="180" fill="rgba(255,255,255,0.15)" />
            
            <circle cx="64" cy="40" r="16" fill="rgba(255,255,255,0.1)" />
            <path d="M59 36h10v8H59z" fill="white" opacity="0.3"/>
            <path d="M56 40c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="white" stroke-width="1.5" fill="none" opacity="0.4"/>
            
            <text x="64" y="80" fill="white" font-family="'Outfit', sans-serif" font-weight="bold" font-size="8" text-anchor="middle">
                ${cleanTitle.substring(0, 16)}${cleanTitle.length > 16 ? '...' : ''}
            </text>
            <text x="64" y="95" fill="rgba(255,255,255,0.7)" font-family="'Inter', sans-serif" font-weight="500" font-size="5" text-anchor="middle" letter-spacing="1">
                ${genre.toUpperCase()}
            </text>
            
            <line x1="30" y1="110" x2="98" y2="110" stroke="rgba(255,255,255,0.2)" stroke-width="0.5" />
            
            <text x="64" y="145" fill="rgba(255,255,255,0.9)" font-family="'Inter', sans-serif" font-size="6" font-style="italic" text-anchor="middle">
                ${cleanAuthor.substring(0, 18)}${cleanAuthor.length > 18 ? '...' : ''}
            </text>
        </svg>
    `;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// Log actions
function addAuditLog(actor, action, type = 'info') {
    const log = {
        id: 'L' + String(Date.now()).substring(7),
        actor,
        action,
        time: new Date().toLocaleString(),
        type
    };
    db.auditLogs.unshift(log);
    saveDB('auditLogs');
    renderAuditLogs();
}



function addNotification(memberId, message, type = 'hệ thống') {
    const noti = {
        id: 'N' + String(Date.now()).substring(7),
        memberId,
        message,
        date: new Date().toISOString().split('T')[0],
        unread: true,
        type
    };
    db.notifications.unshift(noti);
    saveDB('notifications');
    renderNotifications();
}

// ==========================================
// 2. ROLE SYSTEM & INTERFACE STATE
// ==========================================

let currentRole = 'admin'; // Always admin
let currentUser = {
    id: 'ADMIN',
    name: 'Trương Thị Hoa',
    email: 'admin.hoa@thuvienso.vn',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=150&auto=format&fit=crop'
};
let currentTab = 'dashboard';

// Setup routing tab handlers
function setupTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = item.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Hide active tabs
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Show new tab
    const targetPage = document.getElementById(`tab-${tabName}`);
    const targetNavItem = document.querySelector(`.nav-item[data-tab="${tabName}"]`);

    if (targetPage && targetNavItem) {
        targetPage.classList.add('active');
        targetNavItem.classList.add('active');
        currentTab = tabName;

        // Update header title
        const titles = {
            'dashboard': 'Tổng quan báo cáo',
            'books': 'Tra cứu & Quản lý danh mục sách',
            'checkouts': 'Nghiệp vụ Mượn & Trả sách',
            'distributions': 'Nghiệp vụ Cấp phát sách',
            'categories': 'Quản lý Danh mục (Thể loại & Phòng ban)',
            'system-settings': 'Quản trị quy định & Sao lưu hệ thống'
        };
        document.getElementById('current-tab-title').innerText = titles[tabName] || 'Thư viện số';

        // Run tab specific loaders
        if (tabName === 'dashboard') {
            loadDashboardStats();
        } else if (tabName === 'books') {
            renderBooks();
            populateGenreDropdowns();
        } else if (tabName === 'checkouts') {
            renderCheckouts();
            populateCheckoutFormDropdowns();
        } else if (tabName === 'distributions') {
            renderDistributions();
            populateDistributionFormDropdowns();
        } else if (tabName === 'categories') {
            renderCategories();
        }

        // Close responsive sidebar
        document.getElementById('sidebar').classList.remove('open');
    }
}

function handleRoleChange(newRole) {
    // Keep it as admin always
    currentUser = {
        id: 'ADMIN',
        name: 'Trương Thị Hoa',
        email: 'admin.hoa@thuvienso.vn',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=150&auto=format&fit=crop'
    };

    // Update user profile display in sidebar
    if (document.getElementById('user-avatar')) {
        document.getElementById('user-avatar').src = currentUser.avatar;
    }
    if (document.getElementById('user-display-name')) {
        document.getElementById('user-display-name').innerText = currentUser.name;
    }

    const roleBadge = document.getElementById('user-role-label');
    if (roleBadge) {
        roleBadge.className = 'user-role-badge role-admin';
        roleBadge.innerText = 'Quản trị viên';
    }

    switchTab('dashboard');

    addAuditLog('Hệ thống', `Chuyển sang chạy thử với vai trò: ${newRole.toUpperCase()} (${currentUser.name})`, 'info');
    showToast(`Đã đổi vai trò: ${newRole === 'admin' ? 'Quản trị viên' : 'Thủ thư'}`, 'info');
}

// ==========================================
// 3. TOAST SYSTEM
// ==========================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-octagon';
    if (type === 'warning') iconName = 'alert-triangle';

    toast.innerHTML = `
        <div class="toast-icon"><i data-lucide="${iconName}"></i></div>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    // Animation in
    setTimeout(() => toast.classList.add('show'), 50);

    // Animation out
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================
// 4. MODULE: DASHBOARD REPORTS & CHART
// ==========================================
let genreChart = null;

function loadDashboardStats() {
    // 1. Tồn kho (stockCount): Sum of books quantity
    const stockCount = db.books.reduce((sum, book) => sum + (parseInt(book.quantity) || 0), 0);

    // 2. Đang cho mượn (borrowedCount): Sum of remaining borrowing quantity (quantity - returnedQuantity) in active checkouts
    const borrowedCount = db.checkouts
        .filter(c => c.returnDate === null)
        .reduce((sum, c) => sum + ((parseInt(c.quantity) || 0) - (parseInt(c.returnedQuantity) || 0)), 0);

    // 3. Đã cấp (distributedCount): Sum of distributed quantity
    const distributedCount = db.distributions.reduce((sum, d) => sum + (parseInt(d.quantity) || 0), 0);

    // 4. Tổng sách đã nhập (importedCount)
    const importedCount = stockCount + borrowedCount + distributedCount;

    // Injected into DOM elements
    if (document.getElementById('stat-total-imported')) {
        document.getElementById('stat-total-imported').innerText = importedCount;
    }
    if (document.getElementById('stat-total-stock')) {
        document.getElementById('stat-total-stock').innerText = stockCount;
    }
    if (document.getElementById('stat-total-borrowed')) {
        document.getElementById('stat-total-borrowed').innerText = borrowedCount;
    }
    if (document.getElementById('stat-total-distributed')) {
        document.getElementById('stat-total-distributed').innerText = distributedCount;
    }

    // Load Top lists
    renderTopBorrowedBooks();

    // Draw chart
    renderGenreDistributionChart();
}

function renderTopBorrowedBooks() {
    const list = document.getElementById('top-borrowed-books-list');
    if (!list) return;

    // Sort books by borrowedCount
    const sorted = [...db.books].sort((a, b) => b.borrowedCount - a.borrowedCount).slice(0, 4);

    list.innerHTML = sorted.map(b => `
        <li class="list-item">
            <div class="item-left">
                <i data-lucide="book" style="color: var(--primary);"></i>
                <div>
                    <span class="item-title">${b.title}</span>
                    <span class="item-subtitle">${b.genre} | ${formatDateVN(b.importDate) || 'Chưa rõ'}</span>
                </div>
            </div>
            <span class="item-right badge badge-info">${b.borrowedCount} lượt mượn</span>
        </li>
    `).join('');
    lucide.createIcons();
}



function renderGenreDistributionChart() {
    const canvas = document.getElementById('booksGenreChart');
    if (!canvas) return;

    // Count books per genre
    const genres = {};
    db.books.forEach(b => {
        genres[b.genre] = (genres[b.genre] || 0) + 1;
    });

    const labels = Object.keys(genres);
    const data = Object.values(genres);

    // Destroy previous chart to avoid overlay issues
    if (genreChart) {
        genreChart.destroy();
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? '#1e293b' : '#cbd5e1';
    const textColor = isDark ? '#f8fafc' : '#0f172a';

    genreChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Số đầu sách',
                data: data,
                backgroundColor: [
                    'rgba(79, 70, 229, 0.75)',  // Indigo
                    'rgba(168, 85, 247, 0.75)', // Purple
                    'rgba(245, 158, 11, 0.75)',  // Amber
                    'rgba(16, 185, 129, 0.75)',  // Emerald
                    'rgba(6, 182, 212, 0.75)'    // Cyan
                ],
                borderColor: [
                    '#4f46e5', '#a855f7', '#f59e0b', '#10b981', '#06b6d4'
                ],
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, stepSize: 1 },
                    beginAtZero: true
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            }
        }
    });
}

// ==========================================
// 5. MODULE: BOOK CATALOG & SEARCH
// ==========================================
function renderBooks() {
    const container = document.getElementById('books-list-container');
    if (!container) return;

    const searchQuery = document.getElementById('books-search-query').value.toLowerCase().trim();
    const filterGenre = document.getElementById('filter-genre').value;
    const filterStatus = document.getElementById('filter-status').value;
    const filterSource = document.getElementById('filter-source') ? document.getElementById('filter-source').value : '';

    // Filter logic
    const filtered = db.books.filter(b => {
        // 1. Search Query
        const matchSearch = b.title.toLowerCase().includes(searchQuery) ||
            (b.notes || '').toLowerCase().includes(searchQuery) ||
            b.genre.toLowerCase().includes(searchQuery);

        // 2. Genre Filter
        const matchGenre = filterGenre === '' || b.genre === filterGenre;

        // 3. Status Filter
        let currentStatus = 'Còn sách';
        if (b.quantity === 0) {
            const hasActiveCheckouts = db.checkouts.some(c => c.bookId === b.id && c.returnDate === null);
            currentStatus = hasActiveCheckouts ? 'Đang được mượn' : 'Hết sách';
        }
        const matchStatus = filterStatus === '' || currentStatus === filterStatus;

        // 4. Source Filter
        const matchSource = filterSource === '' || b.source === filterSource || (!b.source && filterSource === 'Được mua'); // default as Được mua for old data

        return matchSearch && matchGenre && matchStatus && matchSource;
    });

    filtered.sort((a, b) => new Date(a.importDate || 0) - new Date(b.importDate || 0));

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-muted);">
                <i data-lucide="book-x" style="width:48px; height:48px; margin-bottom:12px;"></i>
                <p>Không tìm thấy cuốn sách nào khớp với điều kiện.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = filtered.map(b => {
        let statusClass = 'status-available';
        let statusLabel = 'Còn sách';

        if (b.quantity === 0) {
            const hasActiveCheckouts = db.checkouts.some(c => c.bookId === b.id && c.returnDate === null);
            if (hasActiveCheckouts) {
                statusClass = 'status-borrowed';
                statusLabel = 'Đang được mượn';
            } else {
                statusClass = 'status-out';
                statusLabel = 'Hết sách';
            }
        }

        const coverSrc = b.cover || generateBookCover(b.title, '', b.genre);

        // Define action buttons based on Role
        let actionButtons = `
            <button class="book-action-btn" onclick="openBookDetailModal('${b.id}')">
                <i data-lucide="eye"></i>
                Chi tiết
            </button>
        `;

        if (currentRole === 'admin' || currentRole === 'librarian') {
            actionButtons += `
                <button class="book-action-btn" onclick="openEditBookModal('${b.id}')">
                    <i data-lucide="edit"></i>
                    Sửa
                </button>
                <button class="book-action-btn btn-delete-icon" onclick="deleteBook('${b.id}')">
                    <i data-lucide="trash-2"></i>
                    Xóa
                </button>
            `;
        }

        const dateText = b.importDate ? `Ngày nhập: ${formatDateVN(b.importDate)}` : 'Ngày nhập: --';
        const noteText = b.notes ? `Ghi chú: ${b.notes}` : 'Ghi chú: Không';

        return `
            <div class="book-card" id="book-card-${b.id}">
                <div class="book-cover-container">
                    <img src="${coverSrc}" class="book-cover-img" alt="${b.title}">
                    <span class="book-status-badge ${statusClass}">${statusLabel}</span>
                </div>
                <div class="book-info-body">
                    <h3 class="book-title" title="${b.title}">${b.title}</h3>
                    <div class="book-meta">
                        <span class="book-meta-item"><i data-lucide="tag" style="width:14px; height:14px;"></i>${b.genre}</span>
                        <span class="book-meta-item"><i data-lucide="download" style="width:14px; height:14px;"></i>${b.source || 'Được mua'}</span>
                        <span class="book-meta-item"><i data-lucide="calendar" style="width:14px; height:14px;"></i>${dateText}</span>
                        <span class="book-meta-item"><i data-lucide="layers" style="width:14px; height:14px;"></i>Tồn kho: ${b.quantity} cuốn</span>
                        <span class="book-meta-item" title="${noteText}"><i data-lucide="message-square" style="width:14px; height:14px;"></i>${noteText}</span>
                    </div>
                </div>
                <div class="book-footer-actions">
                    ${actionButtons}
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

function openBookDetailModal(id) {
    const b = db.books.find(book => book.id === id);
    if (!b) return;

    document.getElementById('detail-book-title').innerText = b.title;
    document.getElementById('detail-book-genre').innerText = b.genre;
    if (document.getElementById('detail-book-source')) {
        document.getElementById('detail-book-source').innerText = b.source || 'Được mua';
    }
    document.getElementById('detail-book-import-date').innerText = formatDateVN(b.importDate) || '--';
    document.getElementById('detail-book-qty').innerText = `${b.quantity} cuốn`;
    document.getElementById('detail-book-notes').innerText = b.notes || 'Không có';
    document.getElementById('detail-book-borrowed-count').innerText = `Đã được mượn ${b.borrowedCount || 0} lần`;

    const coverImg = document.getElementById('detail-book-cover');
    coverImg.src = b.cover || generateBookCover(b.title, '', b.genre);

    const badgeContainer = document.getElementById('detail-book-badge-container');
    badgeContainer.className = '';

    let statusClass = 'badge-success';
    let statusLabel = 'Còn sách trong kho';
    if (b.quantity === 0) {
        const hasActiveCheckouts = db.checkouts.some(c => c.bookId === b.id && c.returnDate === null);
        if (hasActiveCheckouts) {
            statusClass = 'badge-warning';
            statusLabel = 'Sách đang được mượn';
        } else {
            statusClass = 'badge-danger';
            statusLabel = 'Hết sách';
        }
    }
    badgeContainer.innerHTML = `<span class="badge ${statusClass}" style="width:100%; justify-content:center; padding:6px;">${statusLabel}</span>`;

    openModal('modal-book-detail');
}

// CRUD Book Operations
function openEditBookModal(id) {
    const b = db.books.find(book => book.id === id);
    if (!b) return;

    document.getElementById('book-modal-title').innerText = 'Chỉnh sửa thông tin sách';
    document.getElementById('form-book-id').value = b.id;
    document.getElementById('book-input-title').value = b.title;
    document.getElementById('book-input-genre').value = b.genre;
    if (document.getElementById('book-input-source')) {
        document.getElementById('book-input-source').value = b.source || 'Được mua';
    }
    document.getElementById('book-input-import-date').value = b.importDate || getOffsetDate(0);
    document.getElementById('book-input-quantity').value = b.quantity;
    document.getElementById('book-input-notes').value = b.notes || '';

    const coverPreview = document.getElementById('book-cover-upload-preview');
    if (b.cover) {
        coverPreview.src = b.cover;
        coverPreview.style.display = 'block';
    } else {
        coverPreview.style.display = 'none';
    }

    openModal('modal-book');
}

function deleteBook(id) {
    const b = db.books.find(book => book.id === id);
    if (!b) return;

    // Check if book is currently checked out
    const hasActiveCheckout = db.checkouts.some(c => c.bookId === id && c.returnDate === null);
    if (hasActiveCheckout) {
        showToast('Không thể xóa! Cuốn sách này hiện đang có phiếu mượn chưa trả.', 'error');
        return;
    }

    if (confirm(`Bạn chắc chắn muốn xóa cuốn sách "${b.title}" khỏi hệ thống?`)) {
        db.books = db.books.filter(book => book.id !== id);
        saveDB('books');
        addAuditLog(currentUser.name, `Đã xóa sách khỏi thư viện: ${b.title} (Mã: ${b.id})`, 'danger');
        showToast('Xóa sách thành công!', 'success');
        renderBooks();
    }
}

// Setup file upload cover image as Base64 string
function setupBookCoverUploader() {
    const zone = document.getElementById('cover-upload-zone');
    const fileInput = document.getElementById('book-input-cover-file');
    const preview = document.getElementById('book-cover-upload-preview');

    if (!zone || !fileInput || !preview) return;

    zone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                preview.src = event.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
}

// Save/Create Book handler
function setupBookFormHandler() {
    const form = document.getElementById('book-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const bookId = document.getElementById('form-book-id').value;
        const title = document.getElementById('book-input-title').value.trim();
        const genre = document.getElementById('book-input-genre').value;
        const source = document.getElementById('book-input-source') ? document.getElementById('book-input-source').value : 'Được mua';
        const importDate = document.getElementById('book-input-import-date').value;
        const quantity = parseInt(document.getElementById('book-input-quantity').value);
        const notes = document.getElementById('book-input-notes').value.trim();

        // Grab cover preview image source if it's base64 uploaded
        const preview = document.getElementById('book-cover-upload-preview');
        const coverData = (preview.style.display === 'block') ? preview.src : null;

        if (bookId) {
            // Edit Mode
            const bIndex = db.books.findIndex(b => b.id === bookId);
            if (bIndex > -1) {
                db.books[bIndex].title = title;
                db.books[bIndex].genre = genre;
                db.books[bIndex].source = source;
                db.books[bIndex].importDate = importDate;
                db.books[bIndex].quantity = quantity;
                db.books[bIndex].notes = notes;
                db.books[bIndex].cover = coverData;

                // update status label
                db.books[bIndex].status = quantity > 0 ? 'Còn sách' : 'Hết sách';

                saveDB('books');
                addAuditLog(currentUser.name, `Cập nhật thông tin sách: ${title} (Mã: ${bookId})`, 'success');
                showToast('Cập nhật sách thành công!', 'success');
            }
        } else {
            // Create Mode
            const newId = 'B' + String(Date.now()).substring(7);
            const newBook = {
                id: newId,
                title,
                genre,
                source,
                importDate,
                quantity,
                notes,
                cover: coverData,
                borrowedCount: 0,
                status: quantity > 0 ? 'Còn sách' : 'Hết sách'
            };
            db.books.push(newBook);
            saveDB('books');
            addAuditLog(currentUser.name, `Thêm sách mới vào thư viện: ${title} (Mã: ${newId})`, 'success');
            showToast('Thêm sách mới thành công!', 'success');
        }

        closeModal('modal-book');
        renderBooks();
    });
}



// ==========================================
// 7. MODULE: CHECKOUT (BORROWING) BUSINESS
// ==========================================
function populateCheckoutFormDropdowns() {
    const bookSelect = document.getElementById('checkout-book-id');
    if (!bookSelect) return;

    // Set default borrow date to today
    document.getElementById('checkout-date').value = getOffsetDate(0);

    // Fill book dropdown (Only in stock)
    const booksInStock = db.books.filter(b => b.quantity > 0);
    bookSelect.innerHTML = '<option value="">-- Chọn sách còn trong kho --</option>' +
        booksInStock.map(b => `<option value="${b.id}">${b.title} [Số lượng: ${b.quantity} cuốn]</option>`).join('');

    populateDepartmentDropdowns();
}

function renderCheckouts() {
    const tbody = document.getElementById('checkouts-table-body');
    if (!tbody) return;

    // Check totals
    const activeCheckouts = db.checkouts.filter(c => c.status !== 'Đã trả');
    document.getElementById('checkout-active-count').innerText = activeCheckouts.length;

    const searchQuery = (document.getElementById('checkouts-search-query')?.value || '').toLowerCase().trim();

    // Filter logic
    const filteredCheckouts = db.checkouts.filter(c => {
        if (!searchQuery) return true;
        const matchId = c.id.toLowerCase().includes(searchQuery);
        const matchName = c.memberName.toLowerCase().includes(searchQuery);
        const matchBook = c.bookTitle.toLowerCase().includes(searchQuery);
        return matchId || matchName || matchBook;
    });

    // Main checkout table
    if (filteredCheckouts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px;">Không có phiếu mượn nào được ghi nhận phù hợp.</td></tr>`;
        return;
    }

    // Render list (sorted by active/status first, then borrow date descending)
    const sorted = [...filteredCheckouts].sort((a, b) => {
        if (a.status !== 'Đã trả' && b.status === 'Đã trả') return -1;
        if (a.status === 'Đã trả' && b.status !== 'Đã trả') return 1;
        return new Date(b.borrowDate) - new Date(a.borrowDate);
    });

    tbody.innerHTML = sorted.map(c => {
        let badgeClass = 'badge-info';
        if (c.status === 'Đã trả') badgeClass = 'badge-success';

        let daysText = '';
        if (c.status === 'Đã trả') {
            const days = Math.ceil((new Date(c.returnDate || new Date()) - new Date(c.borrowDate)) / (1000 * 60 * 60 * 24));
            daysText = `Đã trả (${days} ngày)`;
        } else {
            const days = Math.ceil((new Date() - new Date(c.borrowDate)) / (1000 * 60 * 60 * 24));
            daysText = `${days} ngày (đang giữ)`;
        }

        let actionBtnHtml = '';
        if (c.status !== 'Đã trả') {
            actionBtnHtml = `
                <button class="btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="openReturnBookModal('${c.id}')">
                    <i data-lucide="check-square" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Trả sách
                </button>
            `;
        } else {
            actionBtnHtml = `<span style="font-size:0.8rem; color:var(--text-muted)">Hoàn thành</span>`;
        }

        const deptSuffix = (c.memberDepartment || c.memberPhone) ? ` <span style="font-size:0.75rem; color:var(--text-muted);">(${c.memberDepartment || c.memberPhone})</span>` : '';
        const qtyText = `${c.quantity || 1} (Đã trả ${c.returnedQuantity || 0})`;

        return `
            <tr>
                <td><b>${c.id}</b></td>
                <td>${c.memberName}${deptSuffix}</td>
                <td>${c.bookTitle}</td>
                <td>${qtyText}</td>
                <td>${formatDateVN(c.borrowDate)}</td>
                <td>${daysText}</td>
                <td><span class="badge ${badgeClass}">${c.status}</span></td>
                <td>${actionBtnHtml}</td>
            </tr>
        `;
    }).join('');
    lucide.createIcons();
}

function setupCheckoutFormHandler() {
    const form = document.getElementById('checkout-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const memberName = document.getElementById('checkout-reader-name').value.trim();
        const memberDepartment = document.getElementById('checkout-reader-department').value.trim();
        const bookId = document.getElementById('checkout-book-id').value;
        const borrowDate = document.getElementById('checkout-date').value;
        const borrowQuantity = parseInt(document.getElementById('checkout-quantity').value) || 1;
        const notes = document.getElementById('checkout-notes').value.trim();

        const book = db.books.find(b => b.id === bookId);
        if (!book) return;

        // BUSINESS RULE VALIDATIONS:
        // 1. Max borrow limit per reader name + department
        const activeCheckouts = db.checkouts.filter(c => c.memberName.toLowerCase() === memberName.toLowerCase() && (c.memberDepartment || c.memberPhone || '').toLowerCase() === memberDepartment.toLowerCase() && c.status !== 'Đã trả');
        const currentBorrowedCount = activeCheckouts.reduce((sum, c) => sum + (c.quantity - (c.returnedQuantity || 0)), 0);

        if (currentBorrowedCount + borrowQuantity > db.rules.maxBorrow) {
            showToast(`Mượn thất bại! Độc giả đã đạt giới hạn mượn tối đa (${db.rules.maxBorrow} cuốn). Bạn chỉ có thể mượn thêm ${Math.max(0, db.rules.maxBorrow - currentBorrowedCount)} cuốn.`, 'error');
            return;
        }

        // 2. Book stock quantity check
        if (book.quantity < borrowQuantity) {
            showToast(`Mượn thất bại! Sách chỉ còn ${book.quantity} cuốn trong kho.`, 'error');
            return;
        }

        // Process checkout
        const newCheckoutId = 'PM' + String(Date.now()).substring(7);
        const newCheckout = {
            id: newCheckoutId,
            memberName,
            memberDepartment,
            bookId,
            bookTitle: book.title,
            borrowDate,
            quantity: borrowQuantity,
            returnedQuantity: 0,
            returnEvents: [],
            returnDate: null,
            status: 'Đang mượn',
            notes
        };

        // Deduct book inventory
        book.quantity -= borrowQuantity;
        if (book.quantity === 0) {
            book.status = 'Đang được mượn';
        }
        book.borrowedCount = (book.borrowedCount || 0) + borrowQuantity;

        db.checkouts.push(newCheckout);
        saveAllDB();

        addAuditLog(currentUser.name, `Cho độc giả ${memberName} mượn ${borrowQuantity} cuốn sách "${book.title}" (Mã phiếu: ${newCheckoutId})`, 'success');
        showToast('Tạo phiếu mượn sách thành công!', 'success');

        // Reset form & reload
        form.reset();
        populateCheckoutFormDropdowns();
        renderCheckouts();
    });
}

// ==========================================
// 8. MODULE: RETURNS
// ==========================================
function renderReturns() {
    const tbody = document.getElementById('returns-table-body');
    if (!tbody) return;

    // Only display active loans
    const activeLoans = db.checkouts.filter(c => c.returnDate === null);

    if (activeLoans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted)">Không có cuốn sách nào đang được mượn.</td></tr>`;
        return;
    }

    tbody.innerHTML = activeLoans.map(c => {
        const deptSuffix = (c.memberDepartment || c.memberPhone) ? ` <span style="font-size:0.75rem; color:var(--text-muted);">(${c.memberDepartment || c.memberPhone})</span>` : '';
        return `
            <tr>
                <td><b>${c.id}</b></td>
                <td>${c.memberName}${deptSuffix}</td>
                <td>${c.bookTitle}</td>
                <td>${c.borrowDate}</td>
                <td>
                    <button class="btn-primary" style="padding:6px 12px; font-size:0.8rem;" onclick="openReturnBookModal('${c.id}')">
                        <i data-lucide="check-square" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i>
                        Xác nhận trả sách
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    lucide.createIcons();
}

function openReturnBookModal(checkoutId) {
    const c = db.checkouts.find(loan => loan.id === checkoutId);
    if (!c) return;

    document.getElementById('return-form-checkout-id').value = c.id;

    const deptSuffix = (c.memberDepartment || c.memberPhone) ? ` (${c.memberDepartment || c.memberPhone})` : '';
    document.getElementById('return-info-reader').innerText = `${c.memberName}${deptSuffix}`;
    document.getElementById('return-info-book').innerText = `${c.bookTitle} (Còn nợ: ${c.quantity - (c.returnedQuantity || 0)})`;
    document.getElementById('return-info-borrow-date').innerText = formatDateVN(c.borrowDate);

    // Set max quantity and default inputs
    const qtyInput = document.getElementById('return-quantity');
    qtyInput.max = c.quantity - (c.returnedQuantity || 0);
    qtyInput.value = qtyInput.max; // Default return all remaining

    document.getElementById('return-reader-name').value = c.memberName;

    populateDepartmentDropdowns();
    document.getElementById('return-reader-department').value = c.memberDepartment || '';

    // Set actual return date to today
    const returnDateInput = document.getElementById('return-date-input');
    returnDateInput.value = getOffsetDate(0);
    returnDateInput.max = getOffsetDate(0); // Can't select future date

    // Reset inputs
    document.getElementById('return-status-input').value = 'Bình thường';
    document.getElementById('return-notes').value = '';

    openModal('modal-return');
}

function setupReturnSubmitHandler() {
    const form = document.getElementById('return-submit-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const checkoutId = document.getElementById('return-form-checkout-id').value;
        const returnDate = document.getElementById('return-date-input').value;
        const bookCondition = document.getElementById('return-status-input').value;
        const returnQuantity = parseInt(document.getElementById('return-quantity').value);
        const returnerName = document.getElementById('return-reader-name').value.trim();
        const returnerDepartment = document.getElementById('return-reader-department').value.trim();
        const notes = document.getElementById('return-notes').value.trim();

        const cIndex = db.checkouts.findIndex(c => c.id === checkoutId);
        if (cIndex === -1) return;

        const checkout = db.checkouts[cIndex];
        const book = db.books.find(b => b.id === checkout.bookId);

        checkout.returnedQuantity = (checkout.returnedQuantity || 0) + returnQuantity;

        // Push return event
        checkout.returnEvents = checkout.returnEvents || [];
        checkout.returnEvents.push({
            date: returnDate,
            quantity: returnQuantity,
            returnerName: returnerName,
            returnerDepartment: returnerDepartment,
            condition: bookCondition,
            notes: notes
        });

        if (checkout.returnedQuantity >= checkout.quantity) {
            checkout.status = 'Đã trả';
            checkout.returnDate = returnDate; // mark fully returned date
        }

        // Adjust book inventory
        if (book) {
            if (bookCondition !== 'Mất sách') {
                book.quantity += returnQuantity;
                book.status = 'Còn sách';
            } else {
                book.status = book.quantity > 0 ? 'Còn sách' : 'Hết sách';
            }
        }

        saveAllDB();
        addAuditLog(currentUser.name, `Nhận trả ${returnQuantity} cuốn "${checkout.bookTitle}" (Phiếu: ${checkout.id}) từ ${returnerName}. Tình trạng: ${bookCondition}`, 'success');
        showToast('Nhận trả sách thành công!', 'success');

        closeModal('modal-return');

        // Refresh pages
        if (currentTab === 'checkouts') {
            renderCheckouts();
            populateCheckoutFormDropdowns();
        }
    });
}

// ==========================================
// 8.5. MODULE: DISTRIBUTIONS (CẤP PHÁT SÁCH)
// ==========================================
function populateDistributionFormDropdowns() {
    const bookSelect = document.getElementById('dist-book-id');
    if (!bookSelect) return;

    document.getElementById('dist-date').value = getOffsetDate(0);

    const booksInStock = db.books.filter(b => b.quantity > 0);
    bookSelect.innerHTML = '<option value="">-- Chọn sách còn trong kho --</option>' +
        booksInStock.map(b => `<option value="${b.id}">${b.title} [Số lượng: ${b.quantity} cuốn]</option>`).join('');

    populateDepartmentDropdowns();
}

function renderDistributions() {
    const tbody = document.getElementById('distributions-table-body');
    if (!tbody) return;

    const searchQuery = (document.getElementById('distributions-search-query')?.value || '').toLowerCase().trim();

    const filtered = db.distributions.filter(d => {
        if (!searchQuery) return true;
        const matchId = d.id.toLowerCase().includes(searchQuery);
        const matchReceiver = d.receiverName.toLowerCase().includes(searchQuery);
        const matchBook = d.bookTitle.toLowerCase().includes(searchQuery);
        return matchId || matchReceiver || matchBook;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px;">Không có lệnh cấp phát sách nào phù hợp.</td></tr>`;
        return;
    }

    const sorted = [...filtered].sort((a, b) => new Date(b.receiveDate) - new Date(a.receiveDate));

    tbody.innerHTML = sorted.map(d => `
        <tr>
            <td><b>${d.id}</b></td>
            <td>${d.bookTitle}</td>
            <td>${d.quantity}</td>
            <td>${d.receiverName}</td>
            <td>${d.receiverDepartment}</td>
            <td>${formatDateVN(d.receiveDate)}</td>
            <td>${d.notes || ''}</td>
        </tr>
    `).join('');
}

function setupDistributionSubmitHandler() {
    const form = document.getElementById('distribution-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const receiverName = document.getElementById('dist-receiver-name').value.trim();
        const receiverDepartment = document.getElementById('dist-receiver-department').value.trim();
        const bookId = document.getElementById('dist-book-id').value;
        const distQuantity = parseInt(document.getElementById('dist-quantity').value) || 1;
        const distDate = document.getElementById('dist-date').value;
        const notes = document.getElementById('dist-notes').value.trim();

        const book = db.books.find(b => b.id === bookId);
        if (!book) return;

        if (book.quantity < distQuantity) {
            showToast(`Cấp phát thất bại! Sách chỉ còn ${book.quantity} cuốn trong kho.`, 'error');
            return;
        }

        const newDistId = 'CP' + String(Date.now()).substring(7);
        const newDist = {
            id: newDistId,
            bookId,
            bookTitle: book.title,
            quantity: distQuantity,
            receiverName,
            receiverDepartment,
            receiveDate: distDate,
            notes
        };

        book.quantity -= distQuantity;
        if (book.quantity === 0) {
            book.status = 'Hết sách';
        }

        db.distributions.push(newDist);
        saveAllDB();

        addAuditLog(currentUser.name, `Cấp phát ${distQuantity} cuốn "${book.title}" cho ${receiverName} (${receiverDepartment})`, 'success');
        showToast('Tạo lệnh cấp phát sách thành công!', 'success');

        form.reset();
        populateDistributionFormDropdowns();
        renderDistributions();
    });
}

// ==========================================
// 11. SYSTEM NOTIFICATIONS SIMULATOR
// ==========================================
function renderNotifications() {
    const list = document.getElementById('noti-list');
    const badge = document.getElementById('noti-count');

    if (!list || !badge) return;

    let userNotis = db.notifications;
    const unreadCount = userNotis.filter(n => n.unread).length;

    badge.innerText = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';

    if (userNotis.length === 0) {
        list.innerHTML = `<li style="padding:20px; text-align:center; color:var(--text-muted); font-size:0.85rem">Không có thông báo mới</li>`;
        return;
    }

    list.innerHTML = userNotis.map(n => {
        let iconHtml = '<i data-lucide="info"></i>';
        let bgClass = 'bg-indigo';

        if (n.type === 'quá hạn') {
            iconHtml = '<i data-lucide="alert-triangle"></i>';
            bgClass = 'bg-amber';
        } else if (n.type === 'hạn trả') {
            iconHtml = '<i data-lucide="calendar"></i>';
            bgClass = 'bg-purple';
        }

        return `
            <li class="noti-item ${n.unread ? 'unread' : ''}" onclick="markNotiAsRead('${n.id}')">
                <div class="noti-icon-box ${bgClass}" style="width:28px; height:28px; border-radius:50%; color:inherit; display:flex; align-items:center; justify-content:center;">
                    ${iconHtml}
                </div>
                <div class="noti-content">
                    <span class="noti-text" style="font-size:0.8rem;">${n.message}</span>
                    <span class="noti-time" style="font-size:0.7rem">${n.date}</span>
                </div>
            </li>
        `;
    }).join('');
    lucide.createIcons();
}

function markNotiAsRead(id) {
    const noti = db.notifications.find(n => n.id === id);
    if (noti && noti.unread) {
        noti.unread = false;
        saveDB('notifications');
        renderNotifications();
    }
}

function setupNotificationsSimulator() {
    const simBtn = document.getElementById('sim-send-noti-btn');
    const clearBtn = document.getElementById('noti-clear-btn');
    const bellBtn = document.getElementById('notification-bell');

    if (!simBtn || !clearBtn || !bellBtn) return;

    // Toggle bell dropdown
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('notifications-dropdown').classList.toggle('show');
    });

    document.addEventListener('click', () => {
        document.getElementById('notifications-dropdown').classList.remove('show');
    });

    document.getElementById('notifications-dropdown').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Clear all
    clearBtn.addEventListener('click', () => {
        db.notifications.forEach(n => n.unread = false);
        saveDB('notifications');
        renderNotifications();
        showToast('Đã đánh dấu đọc tất cả thông báo.', 'success');
    });

    // Simulate notifications scheduler run
    simBtn.addEventListener('click', () => {
        addNotification('SYSTEM', 'Hệ thống hoạt động ổn định. Không có nhắc nhở trễ hạn vì ngày dự kiến trả đã được loại bỏ.', 'hệ thống');
        showToast('Đã mô phỏng gửi thông báo hệ thống!', 'success');
        addAuditLog('Hệ thống', 'Đã mô phỏng gửi thông báo cập nhật trạng thái hệ thống.', 'success');
    });
}

// ==========================================
// 12. AUDIT LOG MODULE
// ==========================================
function renderAuditLogs() {
    const container = document.getElementById('audit-log-container');
    const clearBtn = document.getElementById('clear-audit-logs-btn');

    if (!container || !clearBtn) return;

    clearBtn.onclick = () => {
        if (confirm('Bạn chắc chắn muốn xóa toàn bộ nhật ký hệ thống?')) {
            db.auditLogs = [];
            saveDB('auditLogs');
            addAuditLog(currentUser.name, 'Đã xóa toàn bộ nhật ký hoạt động hệ thống.', 'danger');
            renderAuditLogs();
        }
    };

    if (db.auditLogs.length === 0) {
        container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">Không có nhật ký hoạt động nào.</div>`;
        return;
    }

    container.innerHTML = db.auditLogs.map(l => {
        let classVal = 'info';
        if (l.type === 'success') classVal = 'success';
        if (l.type === 'warning') classVal = 'warning';
        if (l.type === 'danger') classVal = 'danger';

        return `
            <div class="log-item ${classVal}">
                <span class="log-message"><b>${l.actor}:</b> ${l.action}</span>
                <span class="log-time">${l.time}</span>
            </div>
        `;
    }).join('');
}

// ==========================================
// 12.5. MODULE: CATEGORIES & DEPARTMENTS MANAGEMENT
// ==========================================
function populateGenreDropdowns() {
    // 1. Filter genre dropdown
    const filterGenre = document.getElementById('filter-genre');
    if (filterGenre) {
        const currentVal = filterGenre.value;
        filterGenre.innerHTML = '<option value="">Tất cả Thể loại</option>' +
            db.genres.map(g => `<option value="${g}">${g}</option>`).join('');
        filterGenre.value = currentVal;
    }

    // 2. Book input form genre dropdown
    const bookGenre = document.getElementById('book-input-genre');
    if (bookGenre) {
        const currentVal = bookGenre.value;
        bookGenre.innerHTML = '<option value="">-- Chọn thể loại --</option>' +
            db.genres.map(g => `<option value="${g}">${g}</option>`).join('');
        bookGenre.value = currentVal;
    }
}

function populateDepartmentDropdowns() {
    // 1. Checkout form reader department dropdown
    const checkoutDept = document.getElementById('checkout-reader-department');
    if (checkoutDept) {
        const currentVal = checkoutDept.value;
        checkoutDept.innerHTML = '<option value="">-- Chọn phòng ban --</option>' +
            db.departments.map(d => `<option value="${d}">${d}</option>`).join('');
        checkoutDept.value = currentVal;
    }

    // 2. Distribution form department dropdown
    const distDept = document.getElementById('dist-receiver-department');
    if (distDept) {
        const currentVal = distDept.value;
        distDept.innerHTML = '<option value="">-- Chọn phòng ban --</option>' +
            db.departments.map(d => `<option value="${d}">${d}</option>`).join('');
        distDept.value = currentVal;
    }

    // 3. Return form department dropdown
    const returnDept = document.getElementById('return-reader-department');
    if (returnDept) {
        const currentVal = returnDept.value;
        returnDept.innerHTML = '<option value="">-- Chọn phòng ban --</option>' +
            db.departments.map(d => `<option value="${d}">${d}</option>`).join('');
        returnDept.value = currentVal;
    }
}

function renderCategories() {
    // 1. Render Genres Table
    const genresTbody = document.getElementById('genres-table-body');
    if (genresTbody) {
        if (db.genres.length === 0) {
            genresTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:16px; color:var(--text-muted);">Chưa có thể loại nào.</td></tr>';
        } else {
            genresTbody.innerHTML = db.genres.map((g, index) => {
                return `
                    <tr>
                        <td><b>${index + 1}</b></td>
                        <td>${g}</td>
                        <td style="text-align: center;">
                            <button class="btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="deleteGenre('${g}')">
                                <i data-lucide="trash-2" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Xóa
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 2. Render Departments Table
    const deptsTbody = document.getElementById('departments-table-body');
    if (deptsTbody) {
        if (db.departments.length === 0) {
            deptsTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:16px; color:var(--text-muted);">Chưa có phòng ban nào.</td></tr>';
        } else {
            deptsTbody.innerHTML = db.departments.map((d, index) => {
                return `
                    <tr>
                        <td><b>${index + 1}</b></td>
                        <td>${d}</td>
                        <td style="text-align: center;">
                            <button class="btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="deleteDepartment('${d}')">
                                <i data-lucide="trash-2" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Xóa
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    lucide.createIcons();
}

function deleteGenre(genreName) {
    // Check if any books are associated with this genre
    const hasBooks = db.books.some(b => b.genre === genreName);
    if (hasBooks) {
        showToast(`Không thể xóa thể loại "${genreName}" vì có sách đang thuộc thể loại này!`, 'error');
        return;
    }

    if (confirm(`Bạn chắc chắn muốn xóa thể loại "${genreName}"?`)) {
        db.genres = db.genres.filter(g => g !== genreName);
        saveAllDB();
        renderCategories();
        populateGenreDropdowns();
        showToast(`Đã xóa thể loại "${genreName}" thành công.`, 'success');
    }
}

function deleteDepartment(deptName) {
    if (confirm(`Bạn chắc chắn muốn xóa phòng ban "${deptName}"?`)) {
        db.departments = db.departments.filter(d => d !== deptName);
        saveAllDB();
        renderCategories();
        populateDepartmentDropdowns();
        showToast(`Đã xóa phòng ban "${deptName}" thành công.`, 'success');
    }
}

function setupCategoriesSubmitHandlers() {
    const addGenreForm = document.getElementById('add-genre-form');
    if (addGenreForm) {
        addGenreForm.onsubmit = (e) => {
            e.preventDefault();
            const genreInput = document.getElementById('new-genre-name');
            const genreName = genreInput.value.trim();
            if (!genreName) return;

            if (db.genres.includes(genreName)) {
                showToast(`Thể loại "${genreName}" đã tồn tại!`, 'warning');
                return;
            }

            db.genres.push(genreName);
            saveAllDB();
            genreInput.value = '';
            renderCategories();
            populateGenreDropdowns();
            showToast(`Đã thêm thể loại "${genreName}" thành công.`, 'success');
        };
    }

    const addDeptForm = document.getElementById('add-department-form');
    if (addDeptForm) {
        addDeptForm.onsubmit = (e) => {
            e.preventDefault();
            const deptInput = document.getElementById('new-dept-name');
            const deptName = deptInput.value.trim();
            if (!deptName) return;

            if (db.departments.includes(deptName)) {
                showToast(`Phòng ban "${deptName}" đã tồn tại!`, 'warning');
                return;
            }

            db.departments.push(deptName);
            saveAllDB();
            deptInput.value = '';
            renderCategories();
            populateDepartmentDropdowns();
            showToast(`Đã thêm phòng ban "${deptName}" thành công.`, 'success');
        };
    }
}

// ==========================================
// 13. SYSTEM RULES & DATABASE EXPORT/IMPORT
// ==========================================
function setupSystemSettingsHandler() {
    const rulesForm = document.getElementById('settings-rules-form');
    const exportBtn = document.getElementById('btn-export-db');
    const importBtn = document.getElementById('btn-trigger-import-db');
    const fileInput = document.getElementById('import-db-file-input');
    const resetFactoryBtn = document.getElementById('btn-reset-factory');

    if (!rulesForm || !exportBtn || !importBtn || !fileInput) return;

    // Load existing parameters into input fields
    document.getElementById('rules-max-borrow').value = db.rules.maxBorrow;

    rulesForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const maxBorrow = parseInt(document.getElementById('rules-max-borrow').value);

        db.rules = { maxBorrow };
        saveDB('rules');

        addAuditLog(currentUser.name, `Cập nhật quy định thư viện: Số sách mượn tối đa = ${maxBorrow}.`, 'warning');
        showToast('Lưu quy định thành công!', 'success');
    });

    // Factory Reset
    resetFactoryBtn.addEventListener('click', () => {
        if (confirm('CẢNH BÁO: Thao tác này sẽ xóa toàn bộ dữ liệu hiện tại và khôi phục về trạng thái mẫu ban đầu. Bạn có đồng ý?')) {
            initDB(true);
            showToast('Đã khôi phục dữ liệu mẫu gốc!', 'success');
            switchTab('dashboard');
        }
    });

    // Export Data (JSON File download)
    exportBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `lms_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        addAuditLog(currentUser.name, 'Xuất bản sao lưu dữ liệu thư viện (Backup JSON) thành công.', 'success');
        showToast('Xuất file sao lưu thành công!', 'success');
    });

    // Import Data
    importBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);

                // Validate parsed structure
                if (parsed.books && parsed.checkouts) {
                    db = {
                        books: parsed.books || [],
                        members: [],
                        checkouts: parsed.checkouts || [],
                        reservations: [],
                        notifications: parsed.notifications || [],
                        auditLogs: parsed.auditLogs || [],
                        rules: parsed.rules || DEFAULT_RULES
                    };
                    saveAllDB();
                    localStorage.setItem('lms_initialized', 'true');

                    addAuditLog('Hệ thống', `Khôi phục dữ liệu thành công từ tệp sao lưu: ${file.name}`, 'success');
                    showToast('Khôi phục cơ sở dữ liệu thành công!', 'success');

                    // Refresh current page
                    initDB();
                    switchTab(currentTab);
                } else {
                    showToast('Định dạng file sao lưu không hợp lệ!', 'error');
                }
            } catch (err) {
                showToast('Lỗi khi đọc file sao lưu JSON!', 'error');
                console.error(err);
            }
        };
        reader.readAsText(file);
    });
}

// ==========================================
// 14. GENERAL UTILITIES (MODAL CONTROLS, SEARCHES)
// ==========================================
function setupModalTriggers() {
    // Buttons to open modals
    const openAddBookBtn = document.getElementById('btn-open-add-book');
    if (openAddBookBtn) {
        openAddBookBtn.addEventListener('click', () => {
            document.getElementById('book-modal-title').innerText = 'Thêm sách mới';
            document.getElementById('form-book-id').value = '';
            document.getElementById('book-form').reset();
            if (document.getElementById('book-input-source')) {
                document.getElementById('book-input-source').value = 'Được mua';
            }
            document.getElementById('book-input-import-date').value = getOffsetDate(0); // Mặc định ngày hôm nay
            document.getElementById('book-cover-upload-preview').style.display = 'none';
            openModal('modal-book');
        });
    }

    // Close buttons logic
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-close-modal');
            closeModal(modalId);
        });
    });

    // Closing modals by clicking backdrop
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden'; // prevent double scrollbar
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

// Search and filter triggers
function setupSearchAndFilters() {
    // Books
    document.getElementById('books-search-query').addEventListener('input', renderBooks);
    document.getElementById('filter-genre').addEventListener('change', renderBooks);
    document.getElementById('filter-status').addEventListener('change', renderBooks);
    if (document.getElementById('filter-source')) {
        document.getElementById('filter-source').addEventListener('change', renderBooks);
    }

    // Checkouts
    const checkoutsSearch = document.getElementById('checkouts-search-query');
    if (checkoutsSearch) {
        checkoutsSearch.addEventListener('input', renderCheckouts);
    }

    // Distributions
    const distSearch = document.getElementById('distributions-search-query');
    if (distSearch) {
        distSearch.addEventListener('input', renderDistributions);
    }
}

// Theme Toggle logic (Light / Dark)
function setupThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');

    if (!themeBtn || !themeIcon) return;

    // Check system preference or localStorage
    const savedTheme = localStorage.getItem('lms_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('lms_theme', newTheme);
        updateThemeIcon(newTheme);

        // Redraw chart to adapt styling colors
        if (currentTab === 'dashboard') {
            renderGenreDistributionChart();
        }
    });
}

function updateThemeIcon(theme) {
    const themeIcon = document.getElementById('theme-icon');
    if (theme === 'dark') {
        themeIcon.setAttribute('data-lucide', 'sun');
    } else {
        themeIcon.setAttribute('data-lucide', 'moon');
    }
    lucide.createIcons();
}

// Responsive mobile menu toggle
function setupMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const trigger = document.getElementById('sidebar-toggle-btn');

    if (!sidebar || !trigger) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && e.target !== trigger) {
            sidebar.classList.remove('open');
        }
    });
}

// ==========================================
// 14b. EXCEL EXPORTS MODULE (POWERED BY EXCELJS)
// ==========================================
async function exportToExcel(filename, sheetName, reportTitle, headers, rows) {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);

        // Ensure grid lines are visible
        worksheet.views = [{ showGridLines: true }];

        // Setup page for A4 landscape printing, fitting width to 1 page
        worksheet.pageSetup.paperSize = 9; // A4
        worksheet.pageSetup.orientation = 'landscape';
        worksheet.pageSetup.fitToPage = true;
        worksheet.pageSetup.fitToWidth = 1;
        worksheet.pageSetup.fitToHeight = 0;
        worksheet.pageSetup.margins = {
            left: 0.25, right: 0.25,
            top: 0.5, bottom: 0.5,
            header: 0.2, footer: 0.2
        };

        // 1. REPORT TITLE ROW (Row 1)
        const titleRow = worksheet.addRow([reportTitle.toUpperCase()]);
        worksheet.mergeCells(1, 1, 1, headers.length);
        titleRow.height = 40;

        const titleCell = titleRow.getCell(1);
        titleCell.font = {
            name: 'Arial',
            size: 16,
            bold: true,
            color: { argb: 'FF4F46E5' } // Brand Indigo color
        };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        // 2. EMPTY SEPARATOR ROW (Row 2)
        worksheet.addRow([]);

        // 4. TABLE HEADER ROW (Row 4)
        const headerRow = worksheet.addRow(headers);
        headerRow.height = 30;

        headerRow.eachCell((cell) => {
            cell.font = {
                name: 'Arial',
                size: 11,
                bold: true,
                color: { argb: 'FF000000' } // Black text
            };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFFFF' } // White fill
            };
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'medium', color: { argb: 'FF1E1B4B' } }, // Indigo dark bottom border
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
        });

        // 5. DATA ROWS (Row 5+)
        rows.forEach((row, index) => {
            const dataRow = worksheet.addRow(row);
            dataRow.height = 24;

            // No zebra striping, just white background
            const rowBgColor = 'FFFFFFFF'; // White

            dataRow.eachCell((cell, colNumber) => {
                cell.font = {
                    name: 'Arial',
                    size: 10,
                    color: { argb: 'FF0F172A' } // Slate Dark Text
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: rowBgColor }
                };

                // Alignment based on column characteristics
                const headerName = headers[colNumber - 1].toLowerCase();
                if (
                    headerName.includes('stt') ||
                    headerName.includes('mã') ||
                    headerName.includes('ngày') ||
                    headerName.includes('lượng') ||
                    headerName.includes('mượn') ||
                    headerName.includes('trạng thái') ||
                    headerName.includes('tình trạng')
                ) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
                }

                // Grid borders (All Borders)
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
            });
        });

        // 6. AUTO-FIT COLUMN WIDTHS
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                // Calculate size based only on data & headers, skip Title rows
                if (rowNumber > 2) {
                    const cellLength = cell.value ? String(cell.value).length : 0;
                    if (cellLength > maxLength) {
                        maxLength = cellLength;
                    }
                }
            });
            // Give columns sufficient padding, but cap width to allow text wrapping for long texts
            column.width = Math.min(Math.max(maxLength + 4, 12), 45);
        });

        // 7. WRITE BUFFER AND TRIGGER DOWNLOAD
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (err) {
        console.error('Lỗi khi xuất file Excel:', err);
        showToast('Lỗi khi xuất file Excel!', 'error');
    }
}

function setupExcelExports() {
    // 1. Export Books
    const exportBooksBtn = document.getElementById('btn-export-books-excel');
    if (exportBooksBtn) {
        exportBooksBtn.addEventListener('click', async () => {
            const headers = ['STT', 'Tên sách', 'Thể loại', 'Nguồn gốc', 'Ngày nhập sách', 'Tổng số lượng đã nhập', 'Đã cho mượn', 'Số lượng tồn kho', 'Ghi chú'];
            const sortedBooks = [...db.books].sort((a, b) => new Date(a.importDate || 0) - new Date(b.importDate || 0));
            const rows = sortedBooks.map((b, index) => {
                // Tính số lượng sách đang cho mượn (chưa trả)
                const activeLoansCount = db.checkouts.filter(c => c.bookId === b.id && c.returnDate === null).length;

                // Tổng số lượng đã nhập = Tồn kho + Đang cho mượn
                const totalImported = b.quantity + activeLoansCount;

                // Ghi chú: Sử dụng ghi chú của sách hoặc để trống
                let notes = b.notes || '';

                return [
                    index + 1, // STT
                    b.title,
                    b.genre,
                    b.source || 'Được mua',
                    formatDateVN(b.importDate) || 'Chưa rõ',
                    totalImported,
                    activeLoansCount,
                    b.quantity,
                    notes
                ];
            });

            await exportToExcel(
                `danh_sach_sach_${new Date().toISOString().split('T')[0]}.xlsx`,
                'Danh sách Sách',
                'Báo cáo thống kê danh sách sách thư viện',
                headers,
                rows
            );
            showToast('Xuất Excel danh sách sách thành công!', 'success');
            addAuditLog(currentUser.name, 'Đã xuất file Excel danh sách sách.', 'success');
        });
    }

    // 2. Export Active Checkouts (Sách đang cho mượn)
    const exportActiveBtn = document.getElementById('btn-export-active-checkouts');
    if (exportActiveBtn) {
        exportActiveBtn.addEventListener('click', async () => {
            const activeLoans = db.checkouts.filter(c => c.status !== 'Đã trả');
            if (activeLoans.length === 0) {
                showToast('Không có dữ liệu sách đang cho mượn để xuất!', 'warning');
                return;
            }
            const headers = ['STT', 'Tên người mượn', 'Phòng ban', 'Tên sách', 'Số lượng sách mượn', 'Ngày mượn', 'Số ngày đã mượn', 'Ghi chú'];
            const rows = activeLoans.map((c, index) => {
                const days = Math.ceil((new Date() - new Date(c.borrowDate)) / (1000 * 60 * 60 * 24));
                return [
                    index + 1,
                    c.memberName,
                    c.memberDepartment || c.memberPhone || 'Không xác định',
                    c.bookTitle,
                    c.quantity,
                    formatDateVN(c.borrowDate),
                    `${days} ngày`,
                    c.notes || ''
                ];
            });

            await exportToExcel(
                `sach_dang_cho_muon_${new Date().toISOString().split('T')[0]}.xlsx`,
                'Sách Đang Mượn',
                'Báo cáo thống kê danh sách sách đang cho mượn',
                headers,
                rows
            );
            showToast('Xuất Excel sách đang cho mượn thành công!', 'success');
            addAuditLog(currentUser.name, 'Đã xuất file Excel danh sách sách đang cho mượn.', 'success');
        });
    }

    // 3. Export Returned Checkouts (Sách đã trả)
    const exportReturnedBtn = document.getElementById('btn-export-returned-checkouts');
    if (exportReturnedBtn) {
        exportReturnedBtn.addEventListener('click', async () => {
            const returnEventsFlat = [];
            db.checkouts.forEach(c => {
                if (c.returnEvents && c.returnEvents.length > 0) {
                    c.returnEvents.forEach(evt => {
                        returnEventsFlat.push({ checkout: c, event: evt });
                    });
                } else if (c.returnDate) {
                    // For backwards compatibility with old data
                    returnEventsFlat.push({
                        checkout: c,
                        event: {
                            date: c.returnDate,
                            quantity: c.returnedQuantity || c.quantity || 1,
                            returnerName: c.memberName,
                            returnerDepartment: c.memberDepartment,
                            condition: c.conditionOnReturn || 'Bình thường',
                            notes: c.notes || ''
                        }
                    });
                }
            });

            if (returnEventsFlat.length === 0) {
                showToast('Không có dữ liệu sách đã trả để xuất!', 'warning');
                return;
            }
            const headers = ['STT', 'Tên người trả', 'Phòng ban', 'Tên sách', 'Số lượng trả', 'Ngày trả', 'Tình trạng khi trả', 'Ghi chú'];
            const rows = returnEventsFlat.map((item, index) => {
                return [
                    index + 1,
                    item.event.returnerName || item.checkout.memberName,
                    item.event.returnerDepartment || item.checkout.memberDepartment || 'Không xác định',
                    item.checkout.bookTitle,
                    item.event.quantity || 1,
                    formatDateVN(item.event.date),
                    item.event.condition,
                    item.event.notes || ''
                ];
            });

            await exportToExcel(
                `sach_da_tra_${new Date().toISOString().split('T')[0]}.xlsx`,
                'Lịch Sử Trả Sách',
                'Báo cáo thống kê danh sách lịch sử trả sách',
                headers,
                rows
            );
            showToast('Xuất Excel sách đã trả thành công!', 'success');
            addAuditLog(currentUser.name, 'Đã xuất file Excel danh sách sách đã trả.', 'success');
        });
    }

    // 4. Export Distributions History (Lịch sử cấp phát sách)
    const exportDistributionsBtn = document.getElementById('btn-export-distributions-excel');
    if (exportDistributionsBtn) {
        exportDistributionsBtn.addEventListener('click', async () => {
            const sortedDistributions = [...db.distributions].sort((a, b) => new Date(b.receiveDate) - new Date(a.receiveDate));
            if (sortedDistributions.length === 0) {
                showToast('Không có dữ liệu cấp phát sách để xuất!', 'warning');
                return;
            }
            const headers = ['STT', 'Tên sách', 'Số lượng', 'Người nhận', 'Phòng ban', 'Ngày nhận', 'Ghi chú'];
            const rows = sortedDistributions.map((d, index) => {
                return [
                    index + 1,
                    d.bookTitle,
                    d.quantity,
                    d.receiverName,
                    d.receiverDepartment,
                    formatDateVN(d.receiveDate),
                    d.notes || ''
                ];
            });

            await exportToExcel(
                `lich_su_cap_phat_${new Date().toISOString().split('T')[0]}.xlsx`,
                'Lịch Sử Cấp Phát',
                'Báo cáo thống kê lịch sử cấp phát sách',
                headers,
                rows
            );
            showToast('Xuất Excel lịch sử cấp phát thành công!', 'success');
            addAuditLog(currentUser.name, 'Đã xuất file Excel lịch sử cấp phát sách.', 'success');
        });
    }
}

// ==========================================
// 14. LOGIN SYSTEM HANDLER
// ==========================================
function setupLoginHandler() {
    // Login functionality removed as requested
}

// ==========================================
// 15. INITIALIZATION DISPATCH
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize data
    initDB();

    // 2. Setup systems
    setupThemeToggle();
    setupMobileMenu();
    setupTabNavigation();
    setupModalTriggers();
    setupSearchAndFilters();
    setupExcelExports();
    setupCategoriesSubmitHandlers();
    setupLoginHandler();

    // Initial dropdown population
    populateGenreDropdowns();
    populateDepartmentDropdowns();

    // Forms
    setupBookFormHandler();
    setupBookCoverUploader();
    setupCheckoutFormHandler();
    setupReturnSubmitHandler();
    setupDistributionSubmitHandler();

    // Renders first page
    handleRoleChange('admin'); // default boot as admin

    // Auto-sync every 15 seconds
    setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/data`);
            if (!response.ok) return;
            const data = await response.json();

            // Silently update state
            db.books = data.books || [];
            db.checkouts = data.checkouts || [];
            db.distributions = data.distributions || [];
            db.auditLogs = data.auditLogs || [];
            db.notifications = data.notifications || [];
            db.rules = data.rules || db.rules;
            db.genres = data.genres || db.genres;
            db.departments = data.departments || db.departments;

            saveAllDBLocal(); // Update local cache

            // Re-render active tab seamlessly
            if (currentTab === 'dashboard') loadDashboardStats();
            else if (currentTab === 'books') renderBooks();
            else if (currentTab === 'checkouts') renderCheckouts();
            else if (currentTab === 'distributions') renderDistributions();
            else if (currentTab === 'members') renderMembers();
        } catch (err) {
            console.warn('Auto-sync failed:', err);
        }
    }, 15000);

    // Init icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});
