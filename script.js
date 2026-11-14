/**
 * Prime Cribs - Main Frontend Application Logic
 * Framework/Library: Vanilla ES6+ JavaScript, Supabase JS Client
 * Scope: Search, Filtering, Sorting, Favourites, Submission, Supabase Integration
 */

// ==========================================
// 1. CONFIGURATION & STATE MANAGEMENT
// ==========================================

// Replace these with your actual Supabase project URL and public ANON key.
// NEVER expose your service_role or secret keys here.
const SUPABASE_URL = 'https://djncwfwrjdvpcjwwzsui.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_4MqW4L4i0YSmEu5AsytG7A_LwK0RPGi';

// Initialize Supabase Client (Assumes supabase-js CDN script is loaded in index.html)
let supabaseClient = null;
if (window.supabase && SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.warn('Prime Cribs: Supabase client not initialized. Check your credentials or CDN link.');
}

// Application State
const state = {
    properties: [],
    filteredProperties: [],
    favourites: JSON.parse(localStorage.getItem('prime_cribs_favourites')) || [],
    currentPage: 1,
    itemsPerPage: 6,
    currentSort: 'newest',
    filters: {
        location: '',
        houseType: '',
        maxBudget: ''
    }
};

// Supported Locations for Validation & Dropdowns
const VALID_LOCATIONS = [
    'Nairobi',
    'Kahawa Wendani',
    'Kahawa Sukari',
    'Ruiru',
    'Kasarani',
    'Roysambu',
    'Zimmerman',
    'Githurai'
];


// ==========================================
// 2. DOM ELEMENT SELECTORS (Safeguarded)
// ==========================================

const getElements = () => ({
    searchForm: document.getElementById('search-form'),
    locationSelect: document.getElementById('filter-location'),
    houseTypeSelect: document.getElementById('filter-house-type'),
    budgetInput: document.getElementById('filter-budget'),
    sortSelect: document.getElementById('sort-select'),
    propertyGrid: document.getElementById('property-grid'),
    paginationContainer: document.getElementById('pagination-container'),
    submissionForm: document.getElementById('landlord-submission-form'),
    submissionStatus: document.getElementById('submission-status'),
    favouritesGrid: document.getElementById('favourites-grid'),
    toastContainer: document.getElementById('toast-container')
});


// ==========================================
// 3. INITIALIZATION & EVENT LISTENERS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Prime Cribs initialized.');
    initializeApp();
});

async function initializeApp() {
    setupEventListeners();
    await fetchApprovedProperties();
    renderFavouritesView();
}

function setupEventListeners() {
    const el = getElements();

    if (el.searchForm) {
        el.searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSearchSubmit(el);
        });
    }

    if (el.sortSelect) {
        el.sortSelect.addEventListener('change', (e) => {
            state.currentSort = e.target.value;
            applyFiltersAndSort();
        });
    }

    if (el.submissionForm) {
        el.submissionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handlePropertySubmission(e.target);
        });
    }

    // Live search inputs if present
    if (el.locationSelect) el.locationSelect.addEventListener('change', () => handleSearchSubmit(el));
    if (el.houseTypeSelect) el.houseTypeSelect.addEventListener('change', () => handleSearchSubmit(el));
}


// ==========================================
// 4. SUPABASE DATA FETCHING (SECURITY RULE: NO UNAPPROVED PROPERTIES)
// ==========================================

async function fetchApprovedProperties() {
    const el = getElements();
    if (!supabaseClient) {
        showToast('Database connection unavailable. Running in offline demo mode.', 'error');
        loadMockProperties();
        return;
    }

    try {
        // BUSINESS RULE: Unapproved properties must never appear in public search results.
        // We explicitly query where `is_approved` is true.
        const { data, error } = await supabaseClient
            .from('properties')
            .select('*')
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        state.properties = data || [];
        state.filteredProperties = [...state.properties];
        applyFiltersAndSort();

    } catch (err) {
        console.error('Error fetching properties from Supabase:', err.message);
        showToast('Failed to load live properties. Showing cached items.', 'error');
        loadMockProperties();
    }
}

function loadMockProperties() {
    // Fallback mock data matching Nairobi target regions if Supabase isn't connected yet
    state.properties = [
        {
            id: 'mock-1',
            title: 'Modern 1 Bedroom Apartment',
            location: 'Kahawa Wendani',
            house_type: '1 Bedroom',
            rent: 22000,
            bedrooms: 1,
            description: 'Spacious apartment near Kenyatta University gate with reliable borehole water and ample parking.',
            photo_url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80',
            whatsapp_number: '254712345678',
            is_approved: true
        },
        {
            id: 'mock-2',
            title: 'Executive 2 Bedroom Master Ensuite',
            location: 'Kasarani',
            house_type: '2 Bedroom',
            rent: 35000,
            bedrooms: 2,
            description: 'Secure gated community close to TRM mall with high-speed internet provisions and CCTV surveillance.',
            photo_url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80',
            whatsapp_number: '254723456789',
            is_approved: true
        },
        {
            id: 'mock-3',
            title: 'Cosy Bedsitter with Balcony',
            location: 'Roysambu',
            house_type: 'Bedsitter',
            rent: 13000,
            bedrooms: 0,
            description: 'Tiled floors, instant shower, rooftop drying area, and minutes away from superscosy spots along Outering road.',
            photo_url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=600&q=80',
            whatsapp_number: '254734567890',
            is_approved: true
        }
    ];
    state.filteredProperties = [...state.properties];
    applyFiltersAndSort();
}


// ==========================================
// 5. SEARCH, FILTERING & SORTING LOGIC
// ==========================================

function handleSearchSubmit(el) {
    state.filters.location = el.locationSelect ? el.locationSelect.value.trim().toLowerCase() : '';
    state.filters.houseType = el.houseTypeSelect ? el.houseTypeSelect.value.trim().toLowerCase() : '';
    state.filters.maxBudget = el.budgetInput ? parseFloat(el.budgetInput.value) || Infinity : Infinity;

    state.currentPage = 1;
    applyFiltersAndSort();
}

function applyFiltersAndSort() {
    // 1. Filter
    state.filteredProperties = state.properties.filter(property => {
        const matchesLocation = !state.filters.location || property.location.toLowerCase().includes(state.filters.location);
        const matchesType = !state.filters.houseType || property.house_type.toLowerCase() === state.filters.houseType;
        const matchesBudget = property.rent <= state.filters.maxBudget;

        // Security check reaffirmed on client-side render
        return matchesLocation && matchesType && matchesBudget && property.is_approved === true;
    });

    // 2. Sort
    state.filteredProperties.sort((a, b) => {
        if (state.currentSort === 'lowest-price') return a.rent - b.rent;
        if (state.currentSort === 'highest-price') return b.rent - a.rent;
        if (state.currentSort === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        return 0;
    });

    renderProperties();
    renderPagination();
}


// ==========================================
// 6. RENDER FUNCTIONS & UI UPDATES
// ==========================================

// ==========================================
// 6. RENDER FUNCTIONS & UI UPDATES
// ==========================================

function renderProperties() {
    const el = getElements();
    if (!el.propertyGrid) return;

    el.propertyGrid.innerHTML = '';

    if (state.filteredProperties.length === 0) {
        el.propertyGrid.innerHTML = `
            <div class="no-results-card" style="grid-column:1/-1;text-align:center;padding:3rem;">
                <h3>No matching properties found</h3>
                <p>Try adjusting your location criteria or budget.</p>
            </div>
        `;
        return;
    }

    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const paginatedItems = state.filteredProperties.slice(startIndex, endIndex);

    paginatedItems.forEach(property => {
        const isFav = state.favourites.includes(property.id);
        const card = document.createElement('div');
        card.className = 'property-card';

        const photo = property.photo_url || 'https://via.placeholder.com/400x300?text=Prime+Spaces';
        const whatsapp = String(property.whatsapp_number || '').replace(/\D/g, '');

        card.innerHTML = `
            <div class="property-image-wrapper" style="position:relative;">
                <img src="${escapeHTML(photo)}"
                     alt="${escapeHTML(property.title)}"
                     style="width:100%;height:200px;object-fit:cover;">

                <button class="fav-btn ${isFav ? 'active' : ''}"
                    onclick="toggleFavourite('${escapeHTML(property.id)}')"
                    aria-label="Save favourite">
                    ${isFav ? '❤️' : '🤍'}
                </button>
            </div>

            <div class="property-details" style="padding:1rem;">
                <span class="property-location">
                    📍 ${escapeHTML(property.location)}
                </span>

                <h3>${escapeHTML(property.title)}</h3>

                <p class="property-price">
                    KES ${Number(property.rent).toLocaleString()} / mo
                </p>

                <p class="property-meta">
                    🛏️ ${Number(property.bedrooms)} Bedrooms •
                    ${escapeHTML(property.house_type)}
                </p>

                <p class="property-desc">
                    ${escapeHTML(property.description || 'Contact landlord for details.')}
                </p>

                ${whatsapp ? `
                    <a href="https://wa.me/${whatsapp}"
                       target="_blank"
                       rel="noopener noreferrer"
                       class="whatsapp-btn">
                       Contact Landlord on WhatsApp
                    </a>
                ` : ''}
            </div>
        `;

        el.propertyGrid.appendChild(card);
    });
}


// ==========================================
// 7. PAGINATION
// ==========================================

function renderPagination() {
    const el = getElements();
    if (!el.paginationContainer) return;

    const totalPages = Math.ceil(
        state.filteredProperties.length / state.itemsPerPage
    );

    el.paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    for (let page = 1; page <= totalPages; page++) {
        const button = document.createElement('button');

        button.textContent = page;
        button.className = page === state.currentPage ? 'active' : '';

        button.addEventListener('click', () => {
            state.currentPage = page;
            renderProperties();
            renderPagination();
        });

        el.paginationContainer.appendChild(button);
    }
}


// ==========================================
// 8. FAVOURITES
// ==========================================

function toggleFavourite(propertyId) {
    const index = state.favourites.indexOf(propertyId);

    if (index === -1) {
        state.favourites.push(propertyId);
        showToast('Property added to favourites!', 'success');
    } else {
        state.favourites.splice(index, 1);
        showToast('Property removed from favourites.', 'success');
    }

    localStorage.setItem(
        'prime_cribs_favourites',
        JSON.stringify(state.favourites)
    );

    renderProperties();
    renderFavouritesView();
}

function renderFavouritesView() {
    const el = getElements();
    if (!el.favouritesGrid) return;

    el.favouritesGrid.innerHTML = '';

    const favouriteProperties = state.properties.filter(property =>
        state.favourites.includes(property.id)
    );

    if (favouriteProperties.length === 0) {
        el.favouritesGrid.innerHTML =
            '<p>You have not saved any properties yet.</p>';
        return;
    }

    favouriteProperties.forEach(property => {
        const card = document.createElement('div');
        card.className = 'property-card';

        card.innerHTML = `
            <img src="${escapeHTML(property.photo_url || '')}"
                 alt="${escapeHTML(property.title)}"
                 style="width:100%;height:180px;object-fit:cover;">

            <div class="property-details" style="padding:1rem;">
                <h3>${escapeHTML(property.title)}</h3>
                <p>📍 ${escapeHTML(property.location)}</p>
                <p>KES ${Number(property.rent).toLocaleString()} / mo</p>
                <button onclick="toggleFavourite('${escapeHTML(property.id)}')">
                    Remove Favourite ❤️
                </button>
            </div>
        `;

        el.favouritesGrid.appendChild(card);
    });
}


// ==========================================
// 9. PROPERTY SUBMISSION
// ==========================================

async function handlePropertySubmission(form) {
    if (!supabaseClient) {
        showToast('Database connection unavailable.', 'error');
        return;
    }

    const formData = new FormData(form);

    const property = {
        title: formData.get('title')?.trim(),
        location: formData.get('location')?.trim(),
        house_type: formData.get('house_type'),
        rent: Number(formData.get('rent')),
        bedrooms: Number(formData.get('bedrooms')),
        description: formData.get('description')?.trim() || '',
        photo_url: formData.get('photo_url')?.trim() || '',
        whatsapp_number: formData.get('whatsapp_number')?.trim(),
        is_approved: false
    };

    if (!property.title || !property.location ||
        !property.house_type || !property.whatsapp_number ||
        !Number.isFinite(property.rent) || property.rent <= 0 ||
        !Number.isInteger(property.bedrooms) || property.bedrooms < 0) {
        showToast('Please check all required property details.', 'error');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('properties')
            .insert([property]);

        if (error) throw error;

        showToast('Property submitted for approval!', 'success');

        form.reset();

        const el = getElements();
        if (el.submissionStatus) {
            el.submissionStatus.textContent =
                'Your property has been submitted and awaits approval.';
        }

    } catch (error) {
        console.error('Property submission error:', error);
        showToast('Unable to submit property. Please try again.', 'error');
    }
}


// ==========================================
// 10. NOTIFICATIONS & UTILITIES
// ==========================================

function showToast(message, type = 'success') {
    const el = getElements();

    if (!el.toastContainer) {
        console.log(message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    el.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}