/**
 * ==========================================
 * PRIME SPACES
 * MAIN FRONTEND APPLICATION
 * ==========================================
 *
 * Connected to the live Supabase database.
 * Displays approved landlord properties only.
 *
 * Features:
 * - Live property listings
 * - Multiple landlord photos
 * - Rent and sale listings
 * - Location and property type search
 * - Bedrooms and property details
 * - Sorting
 * - Favourites
 * - WhatsApp contact
 * - Empty and error messages
 */

// ==========================================
// 1. SUPABASE CONFIGURATION
// ==========================================

const SUPABASE_URL =
    'https://djncwfwrjdvpcjwwzsui.supabase.co';

const SUPABASE_ANON_KEY =
    'sb_publishable_4MqW4L4i0YSmEu5AsytG7A_LwK0RPGi';

let supabaseClient = null;

if (window.supabase) {
    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );
} else {
    console.error('Supabase library was not loaded.');
}

// ==========================================
// 2. APPLICATION STATE
// ==========================================

const state = {
    properties: [],
    filteredProperties: [],
    favourites: [],
    currentSort: 'newest',
    loading: false,

    filters: {
        listingType: 'Rent',
        location: '',
        houseType: ''
    }
};

// Load saved favourites

try {
    state.favourites = JSON.parse(
        localStorage.getItem('prime_cribs_favourites') || '[]'
    );

    if (!Array.isArray(state.favourites)) {
        state.favourites = [];
    }
} catch (error) {
    state.favourites = [];
}

// ==========================================
// 3. PAGE ELEMENTS
// ==========================================

function getElements() {
    return {
        listingType: document.getElementById('listingType'),
        location: document.getElementById('location'),
        houseType: document.getElementById('houseType'),

        propertyGrid: document.getElementById('property-grid'),
        propertySection: document.getElementById('properties'),

        favouritesGrid: document.getElementById('favourites-grid'),
        sortSelect: document.getElementById('sort-select')
    };
}

// ==========================================
// 4. START APPLICATION
// ==========================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('Prime Spaces initialized.');

    setupSearchListeners();
    fetchApprovedProperties();
});

// ==========================================
// 5. SEARCH LISTENERS
// ==========================================

function setupSearchListeners() {
    const el = getElements();

    if (el.listingType) {
        el.listingType.addEventListener('change', searchHouses);
    }

    if (el.location) {
        el.location.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                searchHouses();
            }
        });
    }

    if (el.houseType) {
        el.houseType.addEventListener('change', searchHouses);
    }

    if (el.sortSelect) {
        el.sortSelect.addEventListener('change', function (event) {
            state.currentSort = event.target.value;
            applyFiltersAndSort();
        });
    }
}

// ==========================================
// 6. FETCH APPROVED PROPERTIES FROM SUPABASE
// ==========================================

async function fetchApprovedProperties() {
    const el = getElements();

    if (!supabaseClient) {
        showMessage('Database connection unavailable. Please refresh the page.');
        return;
    }

    state.loading = true;

    if (el.propertyGrid) {
        el.propertyGrid.innerHTML = `
            <div class="search-status"
                 style="grid-column:1/-1;text-align:center;padding:35px;">
                <h3>Loading available properties...</h3>
                <p>Please wait while we load the latest listings.</p>
            </div>
        `;
    }

    try {
        const { data, error } = await supabaseClient
            .from('properties')
            .select('*')
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        // Only approved database listings are displayed.
        // No demonstration or sample properties are added.

        state.properties = Array.isArray(data) ? data : [];

        state.loading = false;

        console.log(
            'Approved Prime Spaces properties:',
            state.properties.length
        );

        applyFiltersAndSort();
        renderFavouritesView();

    } catch (error) {
        state.loading = false;

        console.error('Supabase property loading error:', error);

        if (el.propertyGrid) {
            el.propertyGrid.innerHTML = `
                <div class="no-results-card"
                     style="grid-column:1/-1;text-align:center;padding:35px;">
                    <h3>Unable to load properties</h3>
                    <p>${escapeHTML(error.message || 'Please check your database connection and permissions.')}</p>
                </div>
            `;
        }
    }
}

// ==========================================
// 7. SEARCH FUNCTION
// ==========================================

function searchHouses() {
    const el = getElements();

    state.filters.listingType =
        el.listingType ? el.listingType.value.trim() : 'Rent';

    state.filters.location =
        el.location ? el.location.value.trim() : '';

    state.filters.houseType =
        el.houseType ? el.houseType.value.trim() : '';

    if (state.loading) {
        showMessage('Loading properties. Please wait.');
        return;
    }

    applyFiltersAndSort();
}

window.searchHouses = searchHouses;

// ==========================================
// 8. NORMALIZE VALUES
// ==========================================

function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ');
}

function normalizeListingType(value) {
    const type = normalize(value);

    if (
        type === 'rent' ||
        type === 'for rent' ||
        type === 'rental'
    ) {
        return 'rent';
    }

    if (
        type === 'sale' ||
        type === 'for sale'
    ) {
        return 'sale';
    }

    return type;
}

// ==========================================
// 9. NORMALIZE PROPERTY TYPES
// ==========================================

function normalizeHouseType(value) {
    const type = normalize(value);

    const aliases = {
        'bedsitter': 'bedsitter',
        'bed sitter': 'bedsitter',
        'studio': 'studio',

        'one bedroom': 'one bedroom',
        '1 bedroom': 'one bedroom',

        'two bedroom': 'two bedroom',
        '2 bedroom': 'two bedroom',

        'three bedroom': 'three bedroom',
        '3 bedroom': 'three bedroom',

        'shop': 'shop',
        'shops': 'shop',

        'office': 'office',
        'office space': 'office',

        'apartment': 'apartment',
        'apartments': 'apartment',

        'house': 'house',
        'houses': 'house',

        'commercial': 'commercial',
        'commercial property': 'commercial'
    };

    return aliases[type] || type;
}

// ==========================================
// 10. GET PROPERTY LISTING TYPE
// ==========================================

function getPropertyListingType(property) {
    const savedType = normalizeListingType(
        property.listing_type ||
        property.listed_type ||
        ''
    );

    if (savedType === 'rent' || savedType === 'sale') {
        return savedType;
    }

    // Fallback for older records with no listing_type.
    if (
        property.sell_price !== null &&
        property.sell_price !== undefined &&
        property.sell_price !== ''
    ) {
        return 'sale';
    }

    return 'rent';
}

// ==========================================
// 11. GET PROPERTY PRICE
// ==========================================

function getPropertyPrice(property) {
    const listingType = getPropertyListingType(property);

    const rawPrice = listingType === 'sale'
        ? property.sell_price
        : property.rent;

    const price = Number(rawPrice);

    return Number.isFinite(price) ? price : 0;
}

// ==========================================
// 12. GET PROPERTY PHOTOS
// ==========================================

function getPropertyPhotos(property) {
    let photos = [];

    // Handle photo_urls stored as an array.

    if (Array.isArray(property.photo_urls)) {
        photos = property.photo_urls;
    }

    // Handle photo_urls stored as JSON text or comma-separated text.

    else if (typeof property.photo_urls === 'string') {
        const savedPhotos = property.photo_urls.trim();

        if (savedPhotos) {
            try {
                const parsed = JSON.parse(savedPhotos);

                photos = Array.isArray(parsed)
                    ? parsed
                    : [parsed];

            } catch (error) {
                photos = savedPhotos.split(',');
            }
        }
    }

    // Add the main photo if it is not already included.

    if (property.photo_url) {
        photos.unshift(property.photo_url);
    }

    // Remove duplicates and empty values.

    photos = [...new Set(
        photos
            .map(photo => String(photo || '').trim())
            .filter(Boolean)
    )];

    // Convert storage object paths into public image URLs.

    return photos.map(function (photo) {
        if (/^https?:\/\//i.test(photo)) {
            return photo;
        }

        if (supabaseClient) {
            const cleanPath = photo.replace(/^\/+/, '');

            const { data } = supabaseClient.storage
                .from('property-photos')
                .getPublicUrl(cleanPath);

            return data.publicUrl;
        }

        return '';
    }).filter(Boolean);
}

// ==========================================
// 13. FILTER AND SORT PROPERTIES
// ==========================================

function applyFiltersAndSort() {
    const requestedListingType =
        normalizeListingType(state.filters.listingType);

    const requestedLocation =
        normalize(state.filters.location);

    const requestedHouseType =
        normalizeHouseType(state.filters.houseType);

    state.filteredProperties = state.properties.filter(
        function (property) {
            if (property.is_approved !== true) {
                return false;
            }

            const propertyListingType =
                getPropertyListingType(property);

            const matchesListingType =
                !requestedListingType ||
                propertyListingType === requestedListingType;

            const propertyLocation =
                normalize(property.location);

            const matchesLocation =
                !requestedLocation ||
                propertyLocation.includes(requestedLocation);

            const propertyTypes = [
                property.house_type,
                property.property_category,
                property.type_of_house
            ].filter(Boolean);

            const matchesHouseType =
                !requestedHouseType ||
                propertyTypes.some(function (type) {
                    const normalizedType = normalizeHouseType(type);

                    return (
                        normalizedType === requestedHouseType ||
                        normalizedType.includes(requestedHouseType) ||
                        requestedHouseType.includes(normalizedType)
                    );
                });

            return (
                matchesListingType &&
                matchesLocation &&
                matchesHouseType
            );
        }
    );

    // Sorting

    state.filteredProperties.sort(function (a, b) {
        const priceA = getPropertyPrice(a);
        const priceB = getPropertyPrice(b);

        if (state.currentSort === 'lowest-price') {
            return priceA - priceB;
        }

        if (state.currentSort === 'highest-price') {
            return priceB - priceA;
        }

        if (state.currentSort === 'newest') {
            return new Date(b.created_at || 0) -
                   new Date(a.created_at || 0);
        }

        return 0;
    });

    renderProperties();
}

// ==========================================
// 14. WHATSAPP NUMBER FORMATTING
// ==========================================

function formatWhatsAppNumber(number) {
    let digits = String(number || '').replace(/\D/g, '');

    // Convert Kenyan numbers to international format.

    if (digits.startsWith('0') && digits.length === 10) {
        digits = '254' + digits.substring(1);
    } else if (
        (digits.startsWith('7') || digits.startsWith('1')) &&
        digits.length === 9
    ) {
        digits = '254' + digits;
    }

    return digits;
}

// ==========================================
// 15. DISPLAY PROPERTY LISTINGS
// ==========================================

function renderProperties() {
    const el = getElements();

    if (!el.propertyGrid) {
        console.error('Property grid not found.');
        return;
    }

    el.propertyGrid.innerHTML = '';

    if (state.filteredProperties.length === 0) {
        el.propertyGrid.innerHTML = `
            <div class="no-results-card"
                 style="grid-column:1/-1;text-align:center;padding:45px 20px;">

                <div style="font-size:42px;">🏠</div>

                <h3>No properties found</h3>

                <p style="margin-top:10px;line-height:1.6;">
                    There are currently no approved properties matching
                    your search. Try another location or property type.
                </p>

                <button type="button"
                    onclick="resetSearch()"
                    style="margin-top:20px;padding:13px 25px;border:none;border-radius:7px;background:#f4a62a;color:#102b50;font-weight:bold;cursor:pointer;">

                    Clear Search

                </button>

            </div>
        `;

        return;
    }

    state.filteredProperties.forEach(function (property) {
        const card = document.createElement('div');

        card.className = 'property';

        const propertyId = String(property.id);

        const isFavourite =
            state.favourites.includes(propertyId);

        const photos = getPropertyPhotos(property);

        const title = escapeHTML(
            property.title || 'Available Property'
        );

        const location = escapeHTML(
            property.location || 'Location not specified'
        );

        const houseType = escapeHTML(
            property.house_type ||
            property.property_category ||
            'Property'
        );

        const description = escapeHTML(
            property.description ||
            'Contact the landlord for more information.'
        );

        const listingType =
            getPropertyListingType(property);

        const price = getPropertyPrice(property);

        const priceLabel = price > 0
            ? 'KSh ' + price.toLocaleString('en-KE')
            : 'Contact for price';

        const priceSuffix =
            listingType === 'sale' ? '' : ' / month';

        const bedrooms = property.bedrooms;

        const bedroomDetails =
            bedrooms !== null &&
            bedrooms !== undefined &&
            bedrooms !== ''
                ? `<p>🛏️ ${escapeHTML(bedrooms)} Bedrooms</p>`
                : '';

        const whatsapp = formatWhatsAppNumber(
            property.whatsapp_number
        );

        // Display landlord-uploaded photographs.

        const photoGallery = photos.length > 0
            ? `
                <div class="prime-photo-gallery"
                     style="width:100%;">

                    <img
                        src="${escapeHTML(photos[0])}"
                        alt="${title}"
                        loading="lazy"
                        style="width:100%;height:210px;object-fit:cover;"
                        onerror="this.style.display='none';"
                    >

                    ${
                        photos.length > 1
                            ? `
                                <div style="display:flex;gap:5px;overflow-x:auto;padding:5px;">
                                    ${photos.slice(1).map(function (photo) {
                                        return `
                                            <img
                                                src="${escapeHTML(photo)}"
                                                alt="${title}"
                                                loading="lazy"
                                                style="width:75px;height:60px;object-fit:cover;border-radius:5px;flex-shrink:0;"
                                                onerror="this.style.display='none';"
                                            >
                                        `;
                                    }).join('')}
                                </div>
                            `
                            : ''
                    }

                </div>
            `
            : `
                <div style="height:210px;background:#e9eef5;display:flex;align-items:center;justify-content:center;color:#52647c;">
                    <div style="text-align:center;">
                        <div style="font-size:40px;">🏠</div>
                        <p>Photos unavailable</p>
                    </div>
                </div>
            `;

        card.innerHTML = `
            ${photoGallery}

            <div class="property-info">

                <span class="property-tag">
                    ${listingType === 'sale' ? 'FOR SALE' : 'FOR RENT'}
                </span>

                <button
                    type="button"
                    onclick="toggleFavourite('${escapeHTML(propertyId)}')"
                    aria-label="Save favourite"
                    style="float:right;border:none;background:transparent;font-size:21px;cursor:pointer;">

                    ${isFavourite ? '❤️' : '🤍'}

                </button>

                <h3>${title}</h3>

                <p>📍 ${location}</p>

                <p class="price">
                    ${priceLabel}${priceSuffix}
                </p>

                <p>🏠 ${houseType}</p>

                ${bedroomDetails}

                <p>${description}</p>

                ${
                    whatsapp
                        ? `
                            <a
                                href="https://wa.me/${escapeHTML(whatsapp)}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="whatsapp-btn">

                                Contact Landlord on WhatsApp

                            </a>
                        `
                        : ''
                }

            </div>
        `;

        el.propertyGrid.appendChild(card);
    });
}

// ==========================================
// 16. RESET SEARCH
// ==========================================

function resetSearch() {
    const el = getElements();

    if (el.listingType) {
        el.listingType.value = 'Rent';
    }

    if (el.location) {
        el.location.value = '';
    }

    if (el.houseType) {
        el.houseType.value = '';
    }

    state.filters.listingType = 'Rent';
    state.filters.location = '';
    state.filters.houseType = '';

    state.currentSort = 'newest';

    if (el.sortSelect) {
        el.sortSelect.value = 'newest';
    }

    if (state.loading) {
        showMessage('Loading properties. Please wait.');
        return;
    }

    applyFiltersAndSort();
}

window.resetSearch = resetSearch;

// ==========================================
// 17. FAVOURITES
// ==========================================

function toggleFavourite(propertyId) {
    const index = state.favourites.indexOf(propertyId);

    if (index === -1) {
        state.favourites.push(propertyId);
        showToast('Property added to favourites!');
    } else {
        state.favourites.splice(index, 1);
        showToast('Property removed from favourites.');
    }

    localStorage.setItem(
        'prime_cribs_favourites',
        JSON.stringify(state.favourites)
    );

    renderProperties();
    renderFavouritesView();
}

window.toggleFavourite = toggleFavourite;

// ==========================================
// 18. DISPLAY SAVED FAVOURITES
// ==========================================

function renderFavouritesView() {
    const el = getElements();

    if (!el.favouritesGrid) {
        return;
    }

    el.favouritesGrid.innerHTML = '';

    const favouriteProperties = state.properties.filter(
        function (property) {
            return state.favourites.includes(String(property.id));
        }
    );

    if (favouriteProperties.length === 0) {
        el.favouritesGrid.innerHTML = `
            <p>You have not saved any properties yet.</p>
        `;

        return;
    }

    favouriteProperties.forEach(function (property) {
        const card = document.createElement('div');

        card.className = 'property';

        const photos = getPropertyPhotos(property);

        const photoHTML = photos.length > 0
            ? `
                <img
                    src="${escapeHTML(photos[0])}"
                    alt="${escapeHTML(property.title || 'Property')}"
                    loading="lazy"
                    style="width:100%;height:160px;object-fit:cover;"
                    onerror="this.style.display='none';"
                >
            `
            : '';

        const price = getPropertyPrice(property);

        card.innerHTML = `
            ${photoHTML}

            <div class="property-info">

                <h3>${escapeHTML(property.title || 'Property')}</h3>

                <p>📍 ${escapeHTML(property.location || '')}</p>

                <p>
                    ${price > 0
                        ? 'KSh ' + price.toLocaleString('en-KE')
                        : 'Contact for price'}
                </p>

                <button
                    type="button"
                    onclick="toggleFavourite('${escapeHTML(property.id)}')">

                    Remove Favourite ❤️

                </button>

            </div>
        `;

        el.favouritesGrid.appendChild(card);
    });
}

// ==========================================
// 19. TOAST NOTIFICATIONS
// ==========================================

function showToast(message) {
    let toast = document.getElementById('prime-toast');

    if (!toast) {
        toast = document.createElement('div');

        toast.id = 'prime-toast';

        toast.style.cssText = `
            position:fixed;
            bottom:25px;
            left:50%;
            transform:translateX(-50%);
            background:#102b50;
            color:white;
            padding:14px 22px;
            border-radius:8px;
            z-index:9999;
            font-size:14px;
            box-shadow:0 4px 15px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.display = 'block';

    clearTimeout(toast.hideTimer);

    toast.hideTimer = setTimeout(function () {
        toast.style.display = 'none';
    }, 2500);
}

// ==========================================
// 20. GENERAL MESSAGE
// ==========================================

function showMessage(message) {
    const el = getElements();

    if (el.propertyGrid) {
        el.propertyGrid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:35px 20px;">
                <p>${escapeHTML(message)}</p>
            </div>
        `;
    }
}

// ==========================================
// 21. HTML SECURITY
// ==========================================

function escapeHTML(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        function (character) {
            return ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[character];
        }
    );
}

// ==========================================
// 22. APPLICATION READY
// ==========================================

console.log('Prime Spaces live property application ready.');
