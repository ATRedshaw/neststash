// Initialize the database
let db;
const DB_NAME = 'NeststashDB';
const DB_VERSION = 1;
const STORE_NAME = 'items';
const SETTINGS_KEY = 'neststashSettings';

// Default settings
let appSettings = {
    currency: '£',
    defaultSort: {
        field: 'date',
        direction: 'desc'
    }
};

// Store the currently being edited item
let currentEditItem = null;

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const itemForm = document.getElementById('item-form');
const photoInput = document.getElementById('item-photo');
const takePhotoBtn = document.getElementById('take-photo');
const photoPreview = document.getElementById('photo-preview');
const itemsContainer = document.getElementById('items-container');
const searchInput = document.getElementById('search-input');

// Dropdown elements
const categoryInput = document.getElementById('item-category');
const shopInput = document.getElementById('item-shop');
const filterCategoryInput = document.getElementById('filter-category');
const filterShopInput = document.getElementById('filter-shop');
const categoryDropdown = document.getElementById('category-dropdown');
const shopDropdown = document.getElementById('shop-dropdown');
const filterCategoryDropdown = document.getElementById('filter-category-dropdown');
const filterShopDropdown = document.getElementById('filter-shop-dropdown');

// Filter and sort elements
const clearFiltersBtn = document.getElementById('clear-filters');
const sortButtons = document.querySelectorAll('.sort-btn');

// Modal elements
const itemModal = document.getElementById('item-modal');
const closeModalBtns = document.querySelectorAll('.modal .close');
const modalItemDetails = document.getElementById('modal-item-details');

// Settings elements
const openSettingsBtn = document.getElementById('open-settings');
const settingsModal = document.getElementById('settings-modal');
const currencySetting = document.getElementById('currency-setting');
const customCurrency = document.getElementById('custom-currency');
const defaultSortSetting = document.getElementById('default-sort');
const saveSettingsBtn = document.getElementById('save-settings');
const currencySymbolEl = document.getElementById('currency-symbol');

// Current filters and sort state
let currentFilters = {
    search: '',
    category: '',
    shop: ''
};

let currentSort = {
    field: 'date',
    direction: 'desc' // desc = newest first
};

// Initialize the app
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    // Load saved settings
    loadSettings();
    
    // Apply settings to UI
    applySettings();
    
    // Initialize IndexedDB
    initDB();

    // Set up event listeners
    setupEventListeners();
}

// Load saved settings from localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
        try {
            appSettings = JSON.parse(savedSettings);
            
            // Update current sort with default settings
            currentSort = {
                field: appSettings.defaultSort.field,
                direction: appSettings.defaultSort.direction
            };
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
}

// Apply settings to UI elements
function applySettings() {
    // Apply currency symbol
    currencySymbolEl.textContent = appSettings.currency;
    
    // Set currency dropdown
    if (appSettings.currency === '£' || appSettings.currency === '$' || 
        appSettings.currency === '€' || appSettings.currency === '¥') {
        currencySetting.value = appSettings.currency;
    } else {
        currencySetting.value = 'custom';
        customCurrency.value = appSettings.currency;
        customCurrency.style.display = 'inline-block';
    }
    
    // Set default sort dropdown
    defaultSortSetting.value = `${appSettings.defaultSort.field}-${appSettings.defaultSort.direction}`;
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
}

// Initialize IndexedDB
function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
        console.error('Database error:', event.target.error);
        alert('Error opening database. Please try again or use a different browser.');
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('Database opened successfully');
        
        // Load items when DB is ready
        loadItems();
        
        // Update dropdowns
        updateDropdownLists();
    };

    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            
            // Create indexes for searching and filtering
            store.createIndex('category', 'category', { unique: false });
            store.createIndex('name', 'name', { unique: false });
            store.createIndex('shop', 'shop', { unique: false });
            store.createIndex('price', 'price', { unique: false });
            store.createIndex('dateAdded', 'dateAdded', { unique: false });
            
            console.log('Object store created');
        }
    };
}

// Set up enhanced dropdowns
function setupDropdown(inputElement, dropdownElement, itemType, placeholder = 'No items yet') {
    const dropdownToggle = inputElement.nextElementSibling;
    
    // Toggle dropdown on click
    dropdownToggle.addEventListener('click', () => {
        const isActive = dropdownElement.classList.contains('active');
        closeAllDropdowns();
        
        if (!isActive) {
            dropdownElement.classList.add('active');
            populateDropdown(dropdownElement, inputElement.value, itemType);
        }
    });
    
    // Filter dropdown items as user types
    inputElement.addEventListener('input', () => {
        populateDropdown(dropdownElement, inputElement.value, itemType);
        if (!dropdownElement.classList.contains('active')) {
            dropdownElement.classList.add('active');
        }
    });
    
    // Close dropdown when clicking outside
    inputElement.addEventListener('blur', (e) => {
        // Small delay to allow for item selection
        setTimeout(() => {
            dropdownElement.classList.remove('active');
        }, 200);
    });
    
    // Handle dropdown item selection
    dropdownElement.addEventListener('click', (e) => {
        if (e.target.classList.contains('dropdown-item')) {
            inputElement.value = e.target.textContent;
            dropdownElement.classList.remove('active');
            
            // Trigger input event to apply filter if needed
            inputElement.dispatchEvent(new Event('input'));
        }
    });
    
    // Handle focus showing all options
    inputElement.addEventListener('focus', () => {
        populateDropdown(dropdownElement, inputElement.value, itemType);
        dropdownElement.classList.add('active');
    });
}

// Close all open dropdowns
function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-list').forEach(dropdown => {
        dropdown.classList.remove('active');
    });
}

// Populate a dropdown with data
function populateDropdown(dropdownElement, searchText, itemType) {
    if (!db) return;
    
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
        const items = request.result;
        let uniqueValues = [];
        
        if (itemType === 'category') {
            uniqueValues = [...new Set(items.map(item => item.category))].filter(Boolean);
        } else if (itemType === 'shop') {
            uniqueValues = [...new Set(items.map(item => item.shop))].filter(Boolean);
        }
        
        // Filter based on search text
        if (searchText) {
            const lowerSearch = searchText.toLowerCase();
            uniqueValues = uniqueValues.filter(value => 
                value.toLowerCase().includes(lowerSearch)
            );
        }
        
        // Sort values
        uniqueValues.sort();
        
        // Populate dropdown
        if (uniqueValues.length > 0) {
            dropdownElement.innerHTML = uniqueValues.map(value => 
                `<div class="dropdown-item">${value}</div>`
            ).join('');
        } else {
            dropdownElement.innerHTML = `<div class="dropdown-item disabled">No matching ${itemType}s</div>`;
        }
    };
}

// Update all dropdown lists
function updateDropdownLists() {
    // Setup enhanced dropdowns
    setupDropdown(categoryInput, categoryDropdown, 'category');
    setupDropdown(shopInput, shopDropdown, 'shop');
    setupDropdown(filterCategoryInput, filterCategoryDropdown, 'category');
    setupDropdown(filterShopInput, filterShopDropdown, 'shop');
}

// Set up event listeners
function setupEventListeners() {
    // Tab navigation
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Deactivate all tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Activate selected tab
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            // If switching to view-items tab, refresh items
            if (tabId === 'view-items') {
                loadItems();
                updateDropdownLists();
            }
        });
    });

    // Photo input preview
    photoInput.addEventListener('change', handlePhotoInput);
    
    // Take photo button (for mobile)
    takePhotoBtn.addEventListener('click', () => photoInput.click());
    
    // Form submission
    itemForm.addEventListener('submit', saveItem);
    
    // Search input
    searchInput.addEventListener('input', () => {
        currentFilters.search = searchInput.value;
        applyFiltersAndSort();
    });
    
    // Category filter
    filterCategoryInput.addEventListener('input', () => {
        currentFilters.category = filterCategoryInput.value;
        applyFiltersAndSort();
    });
    
    // Shop filter
    filterShopInput.addEventListener('input', () => {
        currentFilters.shop = filterShopInput.value;
        applyFiltersAndSort();
    });
    
    // Clear filters
    clearFiltersBtn.addEventListener('click', clearFilters);
    
    // Sort options
    sortButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.sort;
            let direction;
            
            // Toggle direction or set if different field
            if (currentSort.field === field) {
                direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                direction = 'asc'; // Default to ascending for new field
            }
            
            // Update sort state
            currentSort.field = field;
            currentSort.direction = direction;
            
            // Update buttons UI
            updateSortButtonsUI();
            
            // Apply filters and sort
            applyFiltersAndSort();
        });
    });
    
    // Update sort buttons UI initially
    updateSortButtonsUI();
    
    // Modal close buttons
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Find the parent modal
            const modal = btn.closest('.modal');
            modal.style.display = 'none';
            
            // Reset currentEditItem if closing the item modal
            if (modal === itemModal) {
                currentEditItem = null;
            }
        });
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === itemModal) {
            itemModal.style.display = 'none';
            currentEditItem = null;
        } else if (event.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-wrapper') && !e.target.classList.contains('dropdown-item')) {
            closeAllDropdowns();
        }
    });
    
    // Open settings modal
    openSettingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'block';
    });
    
    // Settings: Handle custom currency option
    currencySetting.addEventListener('change', () => {
        if (currencySetting.value === 'custom') {
            customCurrency.style.display = 'inline-block';
            customCurrency.focus();
        } else {
            customCurrency.style.display = 'none';
        }
    });
    
    // Save settings
    saveSettingsBtn.addEventListener('click', () => {
        // Get currency value
        let currencyValue = currencySetting.value;
        if (currencyValue === 'custom') {
            currencyValue = customCurrency.value || '£'; // Default to £ if empty
        }
        
        // Get default sort values
        const sortValue = defaultSortSetting.value.split('-');
        
        // Update settings
        appSettings.currency = currencyValue;
        appSettings.defaultSort = {
            field: sortValue[0],
            direction: sortValue[1]
        };
        
        // Save settings to localStorage
        saveSettings();
        
        // Apply settings to UI
        applySettings();
        
        // Update current sort if needed
        currentSort = {
            field: appSettings.defaultSort.field,
            direction: appSettings.defaultSort.direction
        };
        
        // Update sort buttons UI
        updateSortButtonsUI();
        
        // Reload items with new sort
        loadItems();
        
        // Close settings modal
        settingsModal.style.display = 'none';
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.textContent = 'Settings saved successfully!';
        document.body.appendChild(successMessage);
        
        // Remove success message after a delay
        setTimeout(() => {
            successMessage.remove();
        }, 3000);
    });
    
    // Set up global event handlers for save and cancel edit buttons
    document.addEventListener('click', function(e) {
        // Handle save edit button in modal
        if (e.target.classList.contains('save-edit-btn')) {
            e.preventDefault();
            saveEditedItem();
        }
        
        // Handle cancel edit button in modal
        if (e.target.classList.contains('cancel-edit-btn')) {
            e.preventDefault();
            cancelEdit();
        }
    });
}

// Update sort buttons UI
function updateSortButtonsUI() {
    sortButtons.forEach(btn => {
        const field = btn.dataset.sort;
        const directionEl = btn.querySelector('.sort-direction');
        
        // Remove active class from all buttons
        btn.classList.remove('active');
        directionEl.classList.remove('desc');
        
        // Add active class to current sort field
        if (field === currentSort.field) {
            btn.classList.add('active');
            
            if (currentSort.direction === 'desc') {
                directionEl.classList.add('desc');
            }
        }
    });
}

// Clear all filters
function clearFilters() {
    searchInput.value = '';
    filterCategoryInput.value = '';
    filterShopInput.value = '';
    
    currentFilters = {
        search: '',
        category: '',
        shop: ''
    };
    
    // Reset to default sort from settings
    currentSort = {
        field: appSettings.defaultSort.field,
        direction: appSettings.defaultSort.direction
    };
    
    // Update sort buttons UI
    updateSortButtonsUI();
    
    // Apply filters and sort
    loadItems();
}

// Handle photo input
function handlePhotoInput(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        photoPreview.innerHTML = '';
        const img = document.createElement('img');
        img.src = e.target.result;
        photoPreview.appendChild(img);
    };
    
    reader.readAsDataURL(file);
}

// Save item to IndexedDB
function saveItem(event) {
    event.preventDefault();
    
    // Validate required fields
    if (!categoryInput.value || !document.getElementById('item-name').value) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Get photo data
    let photoData = null;
    if (photoPreview.querySelector('img')) {
        photoData = photoPreview.querySelector('img').src;
    }
    
    // Create item object
    const item = {
        name: document.getElementById('item-name').value,
        category: categoryInput.value.trim(),
        shop: shopInput.value.trim(),
        price: document.getElementById('item-price').value ? parseFloat(document.getElementById('item-price').value) : 0,
        notes: document.getElementById('item-notes').value,
        photo: photoData,
        dateAdded: new Date().toISOString()
    };
    
    // Save to IndexedDB
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(item);
    
    request.onsuccess = () => {
        console.log('Item added successfully');
        
        // Update dropdowns with new values
        updateDropdownLists();
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.textContent = 'Item saved successfully!';
        itemForm.appendChild(successMessage);
        
        // Remove success message after a delay
        setTimeout(() => {
            successMessage.remove();
        }, 3000);
        
        // Reset form
        itemForm.reset();
        photoPreview.innerHTML = '';
        
        // Switch to view tab
        document.querySelector('[data-tab="view-items"]').click();
    };
    
    request.onerror = (event) => {
        console.error('Error adding item:', event.target.error);
        alert('Error saving item. Please try again.');
    };
}

// Load all items from IndexedDB
function loadItems() {
    // Get all items from IndexedDB
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
        const items = request.result;
        
        if (items.length === 0) {
            itemsContainer.innerHTML = `
                <div class="no-items-center">
                    <p class="no-items">No items found. Add some items to get started!</p>
                </div>
            `;
            return;
        }
        
        // Apply filters and sort to all items
        filterAndSortItems(items);
    };
    
    request.onerror = (event) => {
        console.error('Error loading items:', event.target.error);
        itemsContainer.innerHTML = `
            <div class="no-items-center">
                <p class="error">Error loading items. Please refresh the page.</p>
            </div>
        `;
    };
}

// Apply filters and sort to current items
function applyFiltersAndSort() {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
        const items = request.result;
        filterAndSortItems(items);
    };
}

// Filter and sort items then display them
function filterAndSortItems(items) {
    let filteredItems = items;
    
    // Apply filters
    if (currentFilters.search) {
        const searchTerm = currentFilters.search.toLowerCase();
        filteredItems = filteredItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            item.shop?.toLowerCase().includes(searchTerm) ||
            item.notes?.toLowerCase().includes(searchTerm) ||
            item.category.toLowerCase().includes(searchTerm)
        );
    }
    
    if (currentFilters.category) {
        filteredItems = filteredItems.filter(item => 
            item.category.toLowerCase() === currentFilters.category.toLowerCase()
        );
    }
    
    if (currentFilters.shop) {
        filteredItems = filteredItems.filter(item => 
            item.shop?.toLowerCase() === currentFilters.shop.toLowerCase()
        );
    }
    
    // Apply sort
    filteredItems.sort((a, b) => {
        let result = 0;
        
        // Handle special cases for each field type
        switch (currentSort.field) {
            case 'name':
            case 'category':
                result = (a[currentSort.field] || '').localeCompare(b[currentSort.field] || '');
                break;
            case 'shop':
                result = (a.shop || '').localeCompare(b.shop || '');
                break;
            case 'price':
                result = (a.price || 0) - (b.price || 0);
                break;
            case 'date':
                result = new Date(a.dateAdded) - new Date(b.dateAdded);
                break;
            default:
                result = new Date(a.dateAdded) - new Date(b.dateAdded);
        }
        
        // Reverse if descending
        return currentSort.direction === 'desc' ? -result : result;
    });
    
    // Display filtered and sorted items
    displayItems(filteredItems);
    
    // Show no results message if needed
    if (filteredItems.length === 0) {
        itemsContainer.innerHTML = `
            <div class="no-items-center">
                <p class="no-items">
                    No items match your search criteria.<br>
                    <button class="btn secondary" onclick="clearFilters()">Clear Filters</button>
                </p>
            </div>
        `;
    }
}

// Create a better placeholder image with an icon and text
function createPlaceholderImage(itemName) {
    // Extract first letter from item name or use default
    const firstLetter = itemName && itemName.length > 0 ? 
        itemName.charAt(0).toUpperCase() : 'I';
    
    // Create an SVG with a circle and the first letter
    return `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect width="200" height="200" fill="%23e9ecef"/%3E%3Ccircle cx="100" cy="80" r="40" fill="%236c757d"/%3E%3Cpath d="M100 140 a40 40 0 0 1 40 -30 a40 40 0 0 1 -80 0 a40 40 0 0 1 40 30" fill="%236c757d"/%3E%3Ctext x="100" y="180" text-anchor="middle" fill="%23495057" font-family="sans-serif" font-size="16" font-weight="bold"%3ENo Image%3C/text%3E%3C/svg%3E`;
}

// Display items in the grid
function displayItems(items) {
    itemsContainer.innerHTML = '';
    
    items.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        itemCard.dataset.id = item.id;
        
        // Create a better placeholder image
        const placeholderImage = createPlaceholderImage(item.name);
        
        // Format date for display
        const date = new Date(item.dateAdded);
        const formattedDate = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric'
        });
        
        itemCard.innerHTML = `
            <div class="item-image">
                <img src="${item.photo || placeholderImage}" alt="${item.name}">
            </div>
            <div class="item-info">
                <h3 class="item-name">${item.name}</h3>
                <span class="item-category">${item.category}</span>
                <div class="item-details">
                    <span class="item-shop">${item.shop || 'N/A'}</span>
                    <span class="item-price">${item.price ? appSettings.currency + item.price.toFixed(2) : 'No price'}</span>
                </div>
                <span class="item-date">${formattedDate}</span>
            </div>
        `;
        
        // Add click event to show details in modal
        itemCard.addEventListener('click', () => showItemDetails(item));
        
        itemsContainer.appendChild(itemCard);
    });
}

// Show item details in modal
function showItemDetails(item) {
    // Create a better placeholder image
    const placeholderImage = createPlaceholderImage(item.name);
    
    // Format date
    const date = new Date(item.dateAdded);
    const formattedDate = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Create the modal content with direct delete function calls
    modalItemDetails.innerHTML = `
        <div class="modal-item-image">
            <img src="${item.photo || placeholderImage}" alt="${item.name}">
        </div>
        <div class="modal-item-info">
            <h2>${item.name}</h2>
            <p><strong>Category:</strong> ${item.category}</p>
            <p><strong>Shop:</strong> ${item.shop || 'N/A'}</p>
            <p><strong>Price:</strong> ${item.price ? appSettings.currency + item.price.toFixed(2) : 'No price'}</p>
            <p><strong>Date Added:</strong> ${formattedDate}</p>
            <p><strong>Notes:</strong></p>
            <div class="item-notes">${item.notes || 'No notes'}</div>
        </div>
        <div class="modal-item-actions">
            <button class="btn edit-btn" id="edit-item-${item.id}">Edit Item</button>
            <button class="btn delete-btn" id="delete-item-${item.id}">Delete Item</button>
        </div>
    `;
    
    // Show the modal
    itemModal.style.display = 'block';
    
    // Directly attach event listeners with simple implementations
    document.getElementById(`edit-item-${item.id}`).onclick = function() {
        editItem(item.id);
    };
    
    document.getElementById(`delete-item-${item.id}`).onclick = function() {
        console.log('Delete button clicked for item:', item.id);
        deleteItem(item.id);
    };
}

// Edit item - Load item data into an edit form
function editItem(id) {
    // Get the item from IndexedDB
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
        const item = request.result;
        currentEditItem = item;
        
        // Create edit form in modal
        const placeholderImage = createPlaceholderImage(item.name);
        
        modalItemDetails.innerHTML = `
            <form id="edit-item-form">
                <div class="form-group">
                    <label for="edit-photo">Photo:</label>
                    <div class="photo-container">
                        <div id="edit-photo-preview">
                            <img src="${item.photo || placeholderImage}" alt="${item.name}">
                        </div>
                        <input type="file" id="edit-photo" accept="image/*" capture>
                        <button type="button" id="edit-take-photo" class="btn photo-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M9 3v3M15 3v3"/></svg>
                            Change Photo
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="edit-name">Item Name:</label>
                    <input type="text" id="edit-name" required value="${item.name}">
                </div>
                
                <div class="form-group">
                    <label for="edit-category">Category:</label>
                    <div class="dropdown-wrapper">
                        <input type="text" id="edit-category" class="dropdown-input" required value="${item.category}">
                        <button type="button" class="dropdown-toggle" tabindex="-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                        <div id="edit-category-dropdown" class="dropdown-list"></div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="edit-shop">Shop:</label>
                    <div class="dropdown-wrapper">
                        <input type="text" id="edit-shop" class="dropdown-input" value="${item.shop || ''}">
                        <button type="button" class="dropdown-toggle" tabindex="-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                        <div id="edit-shop-dropdown" class="dropdown-list"></div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="edit-price">Price:</label>
                    <div class="price-input">
                        <span class="currency">${appSettings.currency}</span>
                        <input type="number" id="edit-price" step="0.01" min="0" value="${item.price || ''}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="edit-notes">Notes:</label>
                    <textarea id="edit-notes">${item.notes || ''}</textarea>
                </div>
                
                <div class="modal-item-actions">
                    <button type="button" class="btn save-edit-btn">Save Changes</button>
                    <button type="button" class="btn secondary cancel-edit-btn">Cancel</button>
                </div>
            </form>
        `;
        
        // Set up event listeners for the edit form
        const editPhotoInput = document.getElementById('edit-photo');
        const editTakePhotoBtn = document.getElementById('edit-take-photo');
        const editPhotoPreview = document.getElementById('edit-photo-preview');
        const editCategoryInput = document.getElementById('edit-category');
        const editShopInput = document.getElementById('edit-shop');
        const editCategoryDropdown = document.getElementById('edit-category-dropdown');
        const editShopDropdown = document.getElementById('edit-shop-dropdown');
        const saveEditBtn = document.querySelector('.save-edit-btn');
        const cancelEditBtn = document.querySelector('.cancel-edit-btn');
        
        // Set up direct event handlers for save and cancel
        if (saveEditBtn) {
            saveEditBtn.onclick = function(e) {
                e.preventDefault();
                saveEditedItem();
                return false;
            };
        }
        
        if (cancelEditBtn) {
            cancelEditBtn.onclick = function(e) {
                e.preventDefault();
                cancelEdit();
                return false;
            };
        }
        
        // Set up dropdowns
        setupDropdown(editCategoryInput, editCategoryDropdown, 'category');
        setupDropdown(editShopInput, editShopDropdown, 'shop');
        
        // Photo input handling
        editPhotoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                editPhotoPreview.innerHTML = '';
                const img = document.createElement('img');
                img.src = e.target.result;
                editPhotoPreview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
        
        // Take photo button
        editTakePhotoBtn.addEventListener('click', () => {
            editPhotoInput.click();
        });
    };
    
    request.onerror = (event) => {
        console.error('Error getting item for edit:', event.target.error);
        alert('Error loading item for editing. Please try again.');
    };
}

// Save edited item
function saveEditedItem() {
    if (!currentEditItem) return;
    
    // Get values from edit form
    const editNameInput = document.getElementById('edit-name');
    const editCategoryInput = document.getElementById('edit-category');
    const editShopInput = document.getElementById('edit-shop');
    const editPriceInput = document.getElementById('edit-price');
    const editNotesInput = document.getElementById('edit-notes');
    const editPhotoPreview = document.getElementById('edit-photo-preview');
    
    // Validate required fields
    if (!editNameInput.value || !editCategoryInput.value) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Get photo data
    let photoData = null;
    if (editPhotoPreview.querySelector('img')) {
        photoData = editPhotoPreview.querySelector('img').src;
    }
    
    // Update item object
    const updatedItem = {
        ...currentEditItem,
        name: editNameInput.value,
        category: editCategoryInput.value.trim(),
        shop: editShopInput.value.trim(),
        price: editPriceInput.value ? parseFloat(editPriceInput.value) : 0,
        notes: editNotesInput.value,
        photo: photoData
    };
    
    // Save to IndexedDB
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(updatedItem);
    
    request.onsuccess = () => {
        console.log('Item updated successfully');
        
        // Reset current edit item
        currentEditItem = null;
        
        // Close modal
        itemModal.style.display = 'none';
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.textContent = 'Item updated successfully!';
        document.body.appendChild(successMessage);
        
        // Remove success message after a delay
        setTimeout(() => {
            successMessage.remove();
        }, 3000);
        
        // Refresh items
        loadItems();
        
        // Update dropdown lists
        updateDropdownLists();
    };
    
    request.onerror = (event) => {
        console.error('Error updating item:', event.target.error);
        alert('Error updating item. Please try again.');
    };
}

// Cancel edit
function cancelEdit() {
    // Show item details again
    if (currentEditItem) {
        showItemDetails(currentEditItem);
        currentEditItem = null;
    } else {
        // Close modal if no current edit item
        itemModal.style.display = 'none';
    }
}

// Delete item from IndexedDB - completely simplified version
function deleteItem(id) {
    console.log('DIRECT DELETE: Deleting item with ID:', id);
    
    // Simple sanity check
    if (!id || !db) {
        console.error('Cannot delete - invalid ID or DB not ready');
        return;
    }
    
    // Open a transaction and delete directly
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(Number(id));
    
    // Close modal immediately
    itemModal.style.display = 'none';
    
    // Refresh the items display
    console.log('Refreshing items after delete');
    loadItems();
    
    // Show a temporary success message
    const message = document.createElement('div');
    message.className = 'success-message';
    message.textContent = 'Item deleted!';
    document.body.appendChild(message);
    setTimeout(() => message.remove(), 2000);
}

// Add this function at the end of the file
function fixDeleteButtonIssue() {
    // First, let's make sure we remove any existing event listeners that might conflict
    document.querySelectorAll('.delete-btn').forEach(btn => {
        // Clone and replace the button to remove all event listeners
        const newBtn = btn.cloneNode(true);
        if (btn.parentNode) {
            btn.parentNode.replaceChild(newBtn, btn);
            
            // Add a direct event handler that will work on all devices
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const itemId = parseInt(this.dataset.id);
                console.log('Delete button clicked for item ID:', itemId);
                
                if (confirm('Are you sure you want to delete this item?')) {
                    deleteItem(itemId);
                }
            });
        }
    });
}

// A simpler approach to the delete button functionality
document.addEventListener('DOMContentLoaded', function() {
    // After the app is loaded, add a document-level event handler
    document.body.addEventListener('click', function(event) {
        // If we clicked a delete button
        if (event.target.classList.contains('delete-btn')) {
            event.preventDefault();
            event.stopPropagation();
            
            console.log('Delete button clicked via global handler');
            const itemId = parseInt(event.target.getAttribute('data-id'), 10);
            
            if (confirm('Are you sure you want to delete this item?')) {
                deleteItem(itemId);
            }
        }
        
        // If we clicked an edit button
        if (event.target.classList.contains('edit-btn')) {
            event.preventDefault();
            event.stopPropagation();
            
            console.log('Edit button clicked via global handler');
            const itemId = parseInt(event.target.getAttribute('data-id'), 10);
            editItem(itemId);
        }
    });
}); 