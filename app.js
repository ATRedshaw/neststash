// Initialize the database
let db;
const DB_NAME = 'NeststashDB';
const DB_VERSION = 1;
const STORE_NAME = 'items';
const SETTINGS_KEY = 'neststashSettings';
const APP_VERSION_KEY = 'neststashVersion';
const CURRENT_VERSION = 'neststash-v2'; // Must match the version in service-worker.js

// Cache for items and dropdown values
let itemsCache = [];
let categoriesCache = [];
let shopsCache = [];
let cacheDirty = true;

// Default settings
let appSettings = {
    currency: '£',
    defaultSort: {
        field: 'date',
        direction: 'desc'
    },
    imageCompression: {
        quality: 0.7
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
const loadingSpinner = document.getElementById('loading-spinner');

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
    // Check for app updates
    checkForUpdates();
    
    // Load saved settings
    loadSettings();
    
    // Apply settings to UI
    applySettings();
    
    // Initialize IndexedDB
    initDB();

    // Set up event listeners
    setupEventListeners();
}

// Check if the app needs an update
async function checkForUpdates() {
    // Only check if service workers are supported
    if ('serviceWorker' in navigator) {
        try {
            // Get the last stored version
            const storedVersion = localStorage.getItem(APP_VERSION_KEY);
            
            // Check the current service worker version
            const response = await fetch('/neststash/app-version');
            const currentVersion = await response.text();
            
            // Store the current version
            localStorage.setItem(APP_VERSION_KEY, currentVersion);
            
            // If versions don't match, show update notification
            if (storedVersion && storedVersion !== currentVersion) {
                showUpdateNotification();
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
        }
    }
}

// Show update notification
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="update-content">
            <p>A new version of Neststash is available!</p>
            <div class="update-actions">
                <button id="update-now" class="btn primary">Update Now</button>
                <button id="update-later" class="btn secondary">Later</button>
            </div>
        </div>
    `;
    document.body.appendChild(notification);
    
    // Handle update now button
    document.getElementById('update-now').addEventListener('click', () => {
        updateApplication();
        notification.remove();
    });
    
    // Handle update later button
    document.getElementById('update-later').addEventListener('click', () => {
        notification.remove();
    });
}

// Update the application
function updateApplication() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
            if (registration && registration.waiting) {
                // Send message to service worker to skip waiting
                registration.waiting.postMessage({ action: 'skipWaiting' });
            }
            
            // Force reload from server
            window.location.reload(true);
        });
    } else {
        // Fallback for browsers without service worker support
        window.location.reload(true);
    }
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
    
    // Set image compression settings
    const imageQualityInput = document.getElementById('image-quality');
    const qualityValueSpan = document.getElementById('quality-value');
    
    if (imageQualityInput && qualityValueSpan) {
        imageQualityInput.value = appSettings.imageCompression.quality;
        qualityValueSpan.textContent = `${Math.round(appSettings.imageCompression.quality * 100)}%`;
    }
    
    // Set bulk compression slider to default
    const bulkCompressionSlider = document.getElementById('bulk-compression-level');
    const bulkCompressionValue = document.getElementById('bulk-compression-value');
    if (bulkCompressionSlider && bulkCompressionValue) {
        bulkCompressionSlider.value = appSettings.imageCompression.quality;
        bulkCompressionValue.textContent = `${Math.round(appSettings.imageCompression.quality * 100)}%`;
    }
    
    // Also update quality sliders for any existing photo inputs
    const itemPhotoQuality = document.getElementById('item-photo-quality');
    const itemQualityValue = document.getElementById('item-quality-value');
    if (itemPhotoQuality && itemQualityValue) {
        itemPhotoQuality.value = appSettings.imageCompression.quality;
        itemQualityValue.textContent = `${Math.round(appSettings.imageCompression.quality * 100)}%`;
    }
    
    const editPhotoQuality = document.getElementById('edit-photo-quality');
    const editQualityValue = document.getElementById('edit-quality-value');
    if (editPhotoQuality && editQualityValue) {
        editPhotoQuality.value = appSettings.imageCompression.quality;
        editQualityValue.textContent = `${Math.round(appSettings.imageCompression.quality * 100)}%`;
    }
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
        refreshCacheAndUI();
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

// Refresh cache and update UI
function refreshCacheAndUI() {
    if (!db) return;
    
    // Show loading spinner if in view-items tab
    if (document.querySelector('.tab-btn[data-tab="view-items"]').classList.contains('active')) {
        loadingSpinner.classList.add('active');
    }
    
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
        // Update caches
        itemsCache = request.result;
        categoriesCache = [...new Set(itemsCache.map(item => item.category))].filter(Boolean).sort();
        shopsCache = [...new Set(itemsCache.map(item => item.shop))].filter(Boolean).sort();
        cacheDirty = false;
        
        // Update UI
        loadItems();
        updateDropdownLists();
    };
    
    request.onerror = (event) => {
        console.error('Error refreshing cache:', event.target.error);
        // Hide loading spinner in case of error
        loadingSpinner.classList.remove('active');
    };
}

// Optimize image data before storing
function optimizeImageData(dataUrl, showPreview = false, quality = null) {
    return new Promise((resolve) => {
        if (!dataUrl || !dataUrl.startsWith('data:image')) {
            resolve({ optimizedDataUrl: dataUrl, originalSize: 0, optimizedSize: 0 });
            return;
        }
        
        // Use provided quality or default from settings
        const compressionQuality = quality !== null ? quality : appSettings.imageCompression.quality;
        
        // Calculate original size (approximate)
        const originalSize = Math.round(dataUrl.length * 0.75);
        
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions while maintaining aspect ratio
            if (width > height && width > MAX_WIDTH) {
                height = Math.round(height * (MAX_WIDTH / width));
                width = MAX_WIDTH;
            } else if (height > MAX_HEIGHT) {
                width = Math.round(width * (MAX_HEIGHT / height));
                height = MAX_HEIGHT;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Use provided quality or default from settings
            const optimizedDataUrl = canvas.toDataURL('image/jpeg', compressionQuality);
            const optimizedSize = Math.round(optimizedDataUrl.length * 0.75);
            
            // Show file size info if needed
            if (showPreview) {
                const container = showPreview === 'edit' ? 
                    document.getElementById('edit-photo-preview') : 
                    document.getElementById('photo-preview');
                
                if (container) {
                    // Look for existing size info element for this container
                    let sizeInfoId = showPreview === 'edit' ? 'edit-size-info' : 'add-size-info';
                    let sizeInfo = document.getElementById(sizeInfoId);
                    
                    // Create if it doesn't exist
                    if (!sizeInfo) {
                        sizeInfo = document.createElement('div');
                        sizeInfo.className = 'file-size-info';
                        sizeInfo.id = sizeInfoId;
                        container.parentNode.insertBefore(sizeInfo, container.nextSibling);
                    }
                    
                    const originalKB = (originalSize / 1024).toFixed(1);
                    const optimizedKB = (optimizedSize / 1024).toFixed(1);
                    
                    // Calculate savings percentage, ensure it's never negative
                    let savingsPercent = Math.round((1 - (optimizedSize / originalSize)) * 100);
                    savingsPercent = Math.max(0, savingsPercent); // Ensure it's never negative
                    
                    // Special handling for 100% quality
                    if (compressionQuality >= 0.99) {
                        savingsPercent = 0; // At 100% quality, there are no savings
                    }
                    
                    sizeInfo.innerHTML = `
                        <span>Size: ${optimizedKB} KB</span>
                        <div class="file-size-bar">
                            <div class="file-size-fill" style="width: ${100 - savingsPercent}%"></div>
                        </div>
                        <span>Saved: ${savingsPercent}%</span>
                    `;
                    
                    // Make sure it's visible if display was set to none
                    sizeInfo.style.display = 'block';
                }
            }
            
            resolve({ 
                optimizedDataUrl, 
                originalSize, 
                optimizedSize,
                compressionQuality
            });
        };
        
        img.onerror = function() {
            // If there's an error, just return the original
            resolve({ 
                optimizedDataUrl: dataUrl, 
                originalSize: originalSize, 
                optimizedSize: originalSize,
                compressionQuality 
            });
        };
        
        img.src = dataUrl;
    });
}

// Set up enhanced dropdowns
function setupDropdown(inputElement, dropdownElement, itemType, placeholder = 'No items yet') {
    if (!inputElement || !dropdownElement) return;
    
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

// Use cache to populate dropdowns instead of DB query
function populateDropdown(dropdownElement, searchText, itemType) {
    if (!dropdownElement) return;
    
    let uniqueValues = [];
    
    // Use cached values instead of querying the database each time
    if (itemType === 'category') {
        uniqueValues = [...categoriesCache];
    } else if (itemType === 'shop') {
        uniqueValues = [...shopsCache];
    }
    
    // Filter based on search text
    if (searchText) {
        const lowerSearch = searchText.toLowerCase();
        uniqueValues = uniqueValues.filter(value => 
            value.toLowerCase().includes(lowerSearch)
        );
    }
    
    // Populate dropdown
    if (uniqueValues.length > 0) {
        dropdownElement.innerHTML = uniqueValues.map(value => 
            `<div class="dropdown-item">${value}</div>`
        ).join('');
    } else {
        dropdownElement.innerHTML = `<div class="dropdown-item disabled">No matching ${itemType}s</div>`;
    }
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
            const currentActiveTab = document.querySelector('.tab-btn.active').dataset.tab;
            
            // Reset form if switching away from add-item tab
            if (currentActiveTab === 'add-item' && tabId !== 'add-item') {
                resetItemForm();
            }
            
            // Deactivate all tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Activate selected tab
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            // If switching to view-items tab, show loading spinner and load items
            if (tabId === 'view-items') {
                // Show loading spinner
                loadingSpinner.classList.add('active');
                
                // Add a overlay for better visibility while loading
                document.getElementById('items-container').innerHTML = '';
                
                // Load items with slight delay to allow UI to update
                setTimeout(() => {
                    loadItems();
                }, 50);
            }
        });
    });

    // Photo input preview
    photoInput.addEventListener('change', handlePhotoInput);
    
    // Take photo button (for mobile)
    takePhotoBtn.addEventListener('click', () => photoInput.click());
    
    // Form submission
    itemForm.addEventListener('submit', saveItem);
    
    // Create debounced search and filter functions
    const debouncedApplyFilters = debounce(() => {
        applyFiltersAndSort();
    }, 300);
    
    // Search input with debounce
    searchInput.addEventListener('input', () => {
        currentFilters.search = searchInput.value;
        debouncedApplyFilters();
    });
    
    // Category filter with debounce
    filterCategoryInput.addEventListener('input', () => {
        currentFilters.category = filterCategoryInput.value;
        debouncedApplyFilters();
    });
    
    // Shop filter with debounce
    filterShopInput.addEventListener('input', () => {
        currentFilters.shop = filterShopInput.value;
        debouncedApplyFilters();
    });
    
    // Sort buttons
    sortButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.sort;
            
            // If already sorting by this field, toggle direction
            if (currentSort.field === field) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                // Otherwise, sort by this field in ascending order
                currentSort.field = field;
                currentSort.direction = 'asc';
            }
            
            // Update UI
            updateSortButtonsUI();
            
            // Apply sort
            applyFiltersAndSort();
        });
    });
    
    // Clear filters button
    clearFiltersBtn.addEventListener('click', clearFilters);
    
    // Modal close buttons
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            modal.style.display = 'none';
            
            // Reset currentEditItem if closing the item modal
            if (modal === itemModal) {
                cleanupEditForm();
            }
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === itemModal) {
            itemModal.style.display = 'none';
            cleanupEditForm();
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
    
    // Settings button
    openSettingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'block';
    });
    
    // Currency setting
    currencySetting.addEventListener('change', () => {
        if (currencySetting.value === 'custom') {
            customCurrency.style.display = 'inline-block';
            customCurrency.focus();
        } else {
            customCurrency.style.display = 'none';
            appSettings.currency = currencySetting.value;
        }
    });
    
    // Custom currency input
    customCurrency.addEventListener('input', () => {
        if (customCurrency.value) {
            appSettings.currency = customCurrency.value;
        }
    });
    
    // Image quality slider
    const imageQualityInput = document.getElementById('image-quality');
    const qualityValueSpan = document.getElementById('quality-value');
    
    if (imageQualityInput && qualityValueSpan) {
        imageQualityInput.addEventListener('input', () => {
            const quality = parseFloat(imageQualityInput.value);
            appSettings.imageCompression.quality = quality;
            qualityValueSpan.textContent = `${Math.round(quality * 100)}%`;
            
            // If a photo is in the preview, update the compression preview
            const previewImg = photoPreview.querySelector('img');
            if (previewImg) {
                optimizeImageData(previewImg.src, true);
            }
        });
    }
    
    // Default sort setting
    defaultSortSetting.addEventListener('change', () => {
        const [field, direction] = defaultSortSetting.value.split('-');
        appSettings.defaultSort = { field, direction };
    });
    
    // Save settings button
    saveSettingsBtn.addEventListener('click', () => {
        // Save settings
        saveSettings();
        
        // Apply settings
        applySettings();
        
        // Close modal
        settingsModal.style.display = 'none';
        
        // Show success message
        showMessage('Settings saved successfully!');
        
        // Update currency symbol in UI
        currencySymbolEl.textContent = appSettings.currency;
    });
    
    // Export data button
    document.getElementById('export-data').addEventListener('click', exportData);
    
    // Import data input
    document.getElementById('import-data').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            importData(file);
        }
    });
    
    // Bulk compression slider
    const bulkCompressionSlider = document.getElementById('bulk-compression-level');
    const bulkCompressionValue = document.getElementById('bulk-compression-value');
    
    if (bulkCompressionSlider && bulkCompressionValue) {
        bulkCompressionSlider.addEventListener('input', () => {
            const quality = parseFloat(bulkCompressionSlider.value);
            bulkCompressionValue.textContent = `${Math.round(quality * 100)}%`;
        });
    }
    
    // Bulk compression button
    const runBulkCompressionBtn = document.getElementById('run-bulk-compression');
    if (runBulkCompressionBtn) {
        runBulkCompressionBtn.addEventListener('click', () => {
            // Get the selected quality
            const bulkQuality = parseFloat(bulkCompressionSlider.value);
            
            // Run bulk compression
            bulkCompressImages(bulkQuality);
            
            // Close settings modal
            settingsModal.style.display = 'none';
        });
    }
    
    // Refresh app button
    const refreshAppBtn = document.getElementById('refresh-app');
    if (refreshAppBtn) {
        refreshAppBtn.addEventListener('click', () => {
            // Show confirmation dialog
            if (confirm('This will refresh the application to get the latest features. Your data will remain intact. Continue?')) {
                // Save any unsaved settings first
                saveSettings();
                
                // Show loading message
                showMessage('Refreshing application...');
                
                // Update the application
                updateApplication();
            }
        });
    }
    
    // Delete all items button
    const deleteAllItemsBtn = document.getElementById('delete-all-items');
    if (deleteAllItemsBtn) {
        deleteAllItemsBtn.addEventListener('click', () => {
            // Close the settings modal first
            settingsModal.style.display = 'none';
            
            // Create a custom confirmation modal
            const confirmationModal = document.createElement('div');
            confirmationModal.className = 'modal';
            confirmationModal.style.display = 'block';
            
            confirmationModal.innerHTML = `
                <div class="modal-content danger-confirmation">
                    <span class="close">&times;</span>
                    <h2>⚠️ Warning: Destructive Action</h2>
                    <p>You are about to delete <strong>ALL</strong> items from your inventory. This action cannot be undone.</p>
                    <p>Are you absolutely sure you want to continue?</p>
                    <div class="confirmation-actions">
                        <button id="confirm-delete-all" class="btn danger">Yes, Delete Everything</button>
                        <button id="cancel-delete-all" class="btn secondary">Cancel</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(confirmationModal);
            
            // Handle confirmation modal actions
            const closeBtn = confirmationModal.querySelector('.close');
            const confirmBtn = document.getElementById('confirm-delete-all');
            const cancelBtn = document.getElementById('cancel-delete-all');
            
            // Close button
            closeBtn.addEventListener('click', () => {
                confirmationModal.remove();
            });
            
            // Cancel button
            cancelBtn.addEventListener('click', () => {
                confirmationModal.remove();
            });
            
            // Confirm delete button
            confirmBtn.addEventListener('click', () => {
                // Close modal
                confirmationModal.remove();
                
                // Call function to delete all items
                deleteAllItems();
            });
            
            // Also close on outside click
            confirmationModal.addEventListener('click', (e) => {
                if (e.target === confirmationModal) {
                    confirmationModal.remove();
                }
            });
        });
    }
    
    // Also apply filters and sort initially
    applyFiltersAndSort();

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
    
    reader.onload = async (e) => {
        photoPreview.innerHTML = '';
        const img = document.createElement('img');
        img.src = e.target.result;
        
        // Handle image loading errors
        img.onerror = function() {
            const placeholderImage = createPlaceholderImage('Image');
            this.src = placeholderImage;
            showMessage('Error loading image. Using placeholder instead.', true);
        };
        
        photoPreview.appendChild(img);
        
        // Show compression controls
        const compressionControls = document.getElementById('photo-compression-controls');
        compressionControls.style.display = 'block';
        
        // Set initial value from settings
        const photoQualitySlider = document.getElementById('item-photo-quality');
        const photoQualityValue = document.getElementById('item-quality-value');
        photoQualitySlider.value = appSettings.imageCompression.quality;
        photoQualityValue.textContent = `${Math.round(appSettings.imageCompression.quality * 100)}%`;
        
        // Setup compression preview
        photoQualitySlider.addEventListener('input', async () => {
            const quality = parseFloat(photoQualitySlider.value);
            photoQualityValue.textContent = `${Math.round(quality * 100)}%`;
            
            // Update compression preview
            await optimizeImageData(e.target.result, true, quality);
        });
        
        // Generate initial preview with default quality
        if (e.target.result.startsWith('data:image')) {
            await optimizeImageData(e.target.result, true, appSettings.imageCompression.quality);
        }
    };
    
    reader.onerror = () => {
        showMessage('Error reading image file', true);
    };
    
    reader.readAsDataURL(file);
}

// Function to reset the add item form
function resetItemForm() {
    // Reset normal form fields
    itemForm.reset();
    photoPreview.innerHTML = '';
    
    // Reset compression controls
    const compressionControls = document.getElementById('photo-compression-controls');
    compressionControls.style.display = 'none';
    
    // Reset slider to default from settings
    const photoQualitySlider = document.getElementById('item-photo-quality');
    const photoQualityValue = document.getElementById('item-quality-value');
    if (photoQualitySlider && photoQualityValue) {
        photoQualitySlider.value = appSettings.imageCompression.quality;
        photoQualityValue.textContent = `${Math.round(appSettings.imageCompression.quality * 100)}%`;
    }
    
    // Remove any file size info
    const sizeInfo = document.getElementById('add-size-info');
    if (sizeInfo) sizeInfo.remove();
}

// Function to show a loading indicator with custom message
function showLoadingIndicator(message = 'Loading...') {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `<div class="spinner"></div><span>${message}</span>`;
    document.body.appendChild(loadingIndicator);
    return loadingIndicator;
}

// Save item with optimized image handling
async function saveItem(event) {
    event.preventDefault();
    
    // Validate required fields
    if (!categoryInput.value || !document.getElementById('item-name').value) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Show loading indicator
    const loadingIndicator = showLoadingIndicator('Saving item...');
    
    try {
        // Get and optimize photo data
        let photoData = null;
        if (photoPreview.querySelector('img')) {
            const imgSrc = photoPreview.querySelector('img').src;
            
            // Get the user-selected quality from the slider
            const photoQualitySlider = document.getElementById('item-photo-quality');
            const selectedQuality = photoQualitySlider ? parseFloat(photoQualitySlider.value) : appSettings.imageCompression.quality;
            
            const optimizedResult = await optimizeImageData(imgSrc, false, selectedQuality);
            photoData = optimizedResult.optimizedDataUrl;
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
            
            // Mark cache as dirty
            cacheDirty = true;
            
            // Show success message using the showMessage helper function
            showMessage('Item saved successfully!');
            
            // Reset form
            resetItemForm();
            
            // Update cache and UI
            refreshCacheAndUI();
            
            // Switch to view tab
            document.querySelector('[data-tab="view-items"]').click();
        };
        
        request.onerror = (event) => {
            console.error('Error adding item:', event.target.error);
            showMessage('Error saving item. Please try again.', true);
        };
    } catch (error) {
        console.error('Error saving item:', error);
        showMessage('Error saving item. Please try again.', true);
    } finally {
        // Remove loading indicator
        loadingIndicator.remove();
    }
}

// Load items from cache
function loadItems() {
    // Clear existing content from the items container first
    itemsContainer.innerHTML = '';
    
    // Ensure the loading spinner is visible while loading
    loadingSpinner.classList.add('active');
    
    if (cacheDirty) {
        refreshCacheAndUI();
        return;
    }
    
    if (itemsCache.length === 0) {
        // Hide loading spinner
        loadingSpinner.classList.remove('active');
        
        itemsContainer.innerHTML = `
            <div class="no-items-center">
                <p class="no-items">No items found. Add some items to get started!</p>
            </div>
        `;
        return;
    }
    
    // Apply filters and sort
    filterAndSortItems(itemsCache);
}

// Apply filters and sort to cached items
function applyFiltersAndSort() {
    if (cacheDirty) {
        refreshCacheAndUI();
        return;
    }
    
    // Show loading spinner when filtering/sorting
    loadingSpinner.classList.add('active');
    
    // Clear the items container to avoid showing stale content
    itemsContainer.innerHTML = '';
    
    // Use a small timeout to allow the UI to update
    setTimeout(() => {
        filterAndSortItems(itemsCache);
    }, 50);
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
    
    // Hide loading spinner after items are displayed
    loadingSpinner.classList.remove('active');
    
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
                <img src="${item.photo || placeholderImage}" alt="${item.name}" onerror="this.src='${placeholderImage}'; this.onerror=null;">
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
            <img src="${item.photo || placeholderImage}" alt="${item.name}" onerror="this.src='${placeholderImage}'; this.onerror=null;">
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
            <button class="btn edit-btn" id="edit-item-${item.id}" data-id="${item.id}">Edit Item</button>
            <button class="btn delete-btn" id="delete-item-${item.id}" data-id="${item.id}">Delete Item</button>
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
    // Find item by ID
    const item = itemsCache.find(item => item.id === id);
    if (!item) return;
    
    // Store current item for editing
    currentEditItem = item;
    
    // Update modal content with edit form
    modalItemDetails.innerHTML = `
        <form id="edit-item-form">
            <div class="form-group">
                <label for="edit-item-photo">Photo</label>
                <div class="photo-container">
                    <input type="file" id="edit-item-photo" accept="image/*" capture>
                    <button type="button" id="edit-take-photo" class="btn photo-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M9 3v3M15 3v3"/></svg>
                        Change Photo
                    </button>
                    <div id="edit-photo-preview"></div>
                    <div id="edit-compression-controls" class="compression-controls" style="display: none;">
                        <label for="edit-photo-quality">Compression: <span id="edit-quality-value">50%</span></label>
                        <div class="range-with-value">
                            <input type="range" id="edit-photo-quality" min="0.1" max="1.0" step="0.1" value="0.5">
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label for="edit-item-name">Item Name</label>
                <input type="text" id="edit-item-name" required value="${escapeHtml(item.name)}">
            </div>
            
            <div class="form-group">
                <label for="edit-item-category">Category</label>
                <div class="dropdown-wrapper">
                    <input type="text" id="edit-item-category" class="dropdown-input" required value="${escapeHtml(item.category)}">
                    <button type="button" class="dropdown-toggle" tabindex="-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    <div id="edit-category-dropdown" class="dropdown-list"></div>
                </div>
            </div>
            
            <div class="form-group">
                <label for="edit-item-shop">Shop</label>
                <div class="dropdown-wrapper">
                    <input type="text" id="edit-item-shop" class="dropdown-input" value="${escapeHtml(item.shop || '')}">
                    <button type="button" class="dropdown-toggle" tabindex="-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    <div id="edit-shop-dropdown" class="dropdown-list"></div>
                </div>
            </div>
            
            <div class="form-group">
                <label for="edit-item-price">Price</label>
                <div class="price-input">
                    <span class="currency">${appSettings.currency}</span>
                    <input type="number" id="edit-item-price" step="0.01" min="0" value="${item.price || ''}">
                </div>
            </div>
            
            <div class="form-group">
                <label for="edit-item-notes">Notes</label>
                <textarea id="edit-item-notes">${escapeHtml(item.notes || '')}</textarea>
            </div>
            
            <div class="modal-item-actions">
                <button type="button" class="btn save-edit-btn primary">Save Changes</button>
                <button type="button" class="btn cancel-edit-btn">Cancel</button>
                <button type="button" class="btn delete-btn" data-id="${item.id}">Delete</button>
            </div>
        </form>
    `;
    
    // Show the modal
    itemModal.style.display = 'block';
    
    // Add photo preview if available
    const editPhotoPreview = document.getElementById('edit-photo-preview');
    if (item.photo) {
        const img = document.createElement('img');
        img.src = item.photo;
        img.onerror = function() {
            this.src = createPlaceholderImage(item.name);
        };
        editPhotoPreview.appendChild(img);
        
        // Show compression controls
        const compressionControls = document.getElementById('edit-compression-controls');
        compressionControls.style.display = 'block';
        
        // Set initial value from settings
        const photoQualitySlider = document.getElementById('edit-photo-quality');
        const photoQualityValue = document.getElementById('edit-quality-value');
        photoQualitySlider.value = appSettings.imageCompression.quality;
        photoQualityValue.textContent = `${Math.round(appSettings.imageCompression.quality * 100)}%`;
        
        // Show file size info if enabled
        optimizeImageData(item.photo, 'edit', appSettings.imageCompression.quality);
        
        // Add event listener for quality changes
        photoQualitySlider.addEventListener('input', () => {
            const quality = parseFloat(photoQualitySlider.value);
            photoQualityValue.textContent = `${Math.round(quality * 100)}%`;
            
            // Update preview with new quality
            optimizeImageData(item.photo, 'edit', quality);
        });
    } else {
        const placeholderImg = document.createElement('img');
        placeholderImg.src = createPlaceholderImage(item.name);
        editPhotoPreview.appendChild(placeholderImg);
    }
    
    // Set up enhanced dropdowns for edit form
    setupDropdown(
        document.getElementById('edit-item-category'), 
        document.getElementById('edit-category-dropdown'), 
        'category'
    );
    
    setupDropdown(
        document.getElementById('edit-item-shop'), 
        document.getElementById('edit-shop-dropdown'), 
        'shop'
    );
    
    // Handle photo change
    const editPhotoInput = document.getElementById('edit-item-photo');
    const editTakePhotoBtn = document.getElementById('edit-take-photo');
    
    editPhotoInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            editPhotoPreview.innerHTML = '';
            const img = document.createElement('img');
            img.src = e.target.result;
            editPhotoPreview.appendChild(img);
            
            // Show compression controls
            const compressionControls = document.getElementById('edit-compression-controls');
            compressionControls.style.display = 'block';
            
            // Set initial value from settings
            const photoQualitySlider = document.getElementById('edit-photo-quality');
            const photoQualityValue = document.getElementById('edit-quality-value');
            photoQualitySlider.value = appSettings.imageCompression.quality;
            photoQualityValue.textContent = `${Math.round(appSettings.imageCompression.quality * 100)}%`;
            
            // Setup compression preview
            photoQualitySlider.addEventListener('input', () => {
                const quality = parseFloat(photoQualitySlider.value);
                photoQualityValue.textContent = `${Math.round(quality * 100)}%`;
                
                // Update compression preview
                optimizeImageData(e.target.result, 'edit', quality);
            });
            
            // Show file size info if enabled
            optimizeImageData(e.target.result, 'edit', appSettings.imageCompression.quality);
        };
        
        reader.onerror = () => {
            showMessage('Error reading image file', true);
        };
        
        reader.readAsDataURL(file);
    });
    
    editTakePhotoBtn.addEventListener('click', () => {
        editPhotoInput.click();
    });
    
    // Fix delete button issue
    fixDeleteButtonIssue();
}

// Cleanup function for edit form
function cleanupEditForm() {
    // Reset compression controls
    const compressionControls = document.getElementById('edit-compression-controls');
    if (compressionControls) {
        compressionControls.style.display = 'none';
    }
    
    // Reset slider to default from settings
    const photoQualitySlider = document.getElementById('edit-photo-quality');
    const photoQualityValue = document.getElementById('edit-quality-value');
    if (photoQualitySlider && photoQualityValue) {
        photoQualitySlider.value = appSettings.imageCompression.quality;
        photoQualityValue.textContent = `${Math.round(appSettings.imageCompression.quality * 100)}%`;
    }
    
    // Remove any file size info
    const sizeInfo = document.getElementById('edit-size-info');
    if (sizeInfo) sizeInfo.remove();
    
    // Reset current edit item
    currentEditItem = null;
}

// Update cancel edit to use cleanup function
function cancelEdit() {
    // Store current item temporarily
    const item = currentEditItem;
    
    // Clean up edit form
    cleanupEditForm();
    
    // Show item details again if we had an item
    if (item) {
        showItemDetails(item);
    } else {
        // Close modal if no current edit item
        itemModal.style.display = 'none';
    }
}

async function saveEditedItem() {
    if (!currentEditItem) return;
    
    // Show loading indicator
    const loadingIndicator = showLoadingIndicator('Saving changes...');
    
    try {
        // Get values from edit form
        const editNameInput = document.getElementById('edit-item-name');
        const editCategoryInput = document.getElementById('edit-item-category');
        const editShopInput = document.getElementById('edit-item-shop');
        const editPriceInput = document.getElementById('edit-item-price');
        const editNotesInput = document.getElementById('edit-item-notes');
        const editPhotoPreview = document.getElementById('edit-photo-preview');
        
        // Validate required fields
        if (!editNameInput.value || !editCategoryInput.value) {
            alert('Please fill in all required fields');
            loadingIndicator.remove();
            return;
        }
        
        // Get current photo or new photo if changed
        let photoData = currentEditItem.photo;
        
        // Check if photo has been changed
        if (editPhotoPreview.querySelector('img')) {
            const currentImgSrc = editPhotoPreview.querySelector('img').src;
            
            // Only update if it's different from the original
            if (currentImgSrc !== photoData) {
                // Get the selected quality from the slider
                const photoQualitySlider = document.getElementById('edit-photo-quality');
                const selectedQuality = photoQualitySlider ? parseFloat(photoQualitySlider.value) : appSettings.imageCompression.quality;
                
                const optimizedResult = await optimizeImageData(currentImgSrc, false, selectedQuality);
                photoData = optimizedResult.optimizedDataUrl;
            }
        } else {
            photoData = null;
        }
        
        // Update the item object
        const updatedItem = {
            ...currentEditItem,
            name: editNameInput.value,
            category: editCategoryInput.value.trim(),
            shop: editShopInput.value.trim(),
            price: editPriceInput.value ? parseFloat(editPriceInput.value) : 0,
            notes: editNotesInput.value,
            photo: photoData
        };
        
        // Update in IndexedDB
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(updatedItem);
        
        request.onsuccess = () => {
            console.log('Item updated successfully');
            
            // Mark cache as dirty to reload
            cacheDirty = true;
            
            // Close the modal
            itemModal.style.display = 'none';
            
            // Clean up edit form
            cleanupEditForm();
            
            // Show success message
            showMessage('Item updated successfully!');
            
            // Refresh items
            refreshCacheAndUI();
        };
        
        request.onerror = (event) => {
            console.error('Error updating item:', event.target.error);
            showMessage('Error updating item. Please try again.', true);
        };
    } catch (error) {
        console.error('Error saving edited item:', error);
        showMessage('Error updating item. Please try again.', true);
    } finally {
        // Remove loading indicator
        loadingIndicator.remove();
    }
}

// Delete item from IndexedDB
function deleteItem(id) {
    console.log('DIRECT DELETE: Deleting item with ID:', id);
    
    // Simple sanity check
    if (!id || !db) {
        console.error('Cannot delete - invalid ID or DB not ready');
        showMessage('Error: Cannot delete item', true);
        return;
    }
    
    // Show loading indicator
    const loadingIndicator = showLoadingIndicator('Deleting item...');
    
    // Open a transaction and delete directly
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(Number(id));
    
    request.onsuccess = () => {
        // Close modal immediately
        itemModal.style.display = 'none';
        
        // Mark cache as dirty
        cacheDirty = true;
        
        // Show a temporary success message
        showMessage('Item deleted successfully');
        
        // Refresh cache and UI
        refreshCacheAndUI();
        
        // Remove loading indicator
        loadingIndicator.remove();
    };
    
    request.onerror = (event) => {
        console.error('Error deleting item:', event.target.error);
        showMessage('Error deleting item. Please try again.', true);
        loadingIndicator.remove();
    };
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

// Export data to JSON file
function exportData() {
    if (!db) {
        alert('Database not ready. Please try again.');
        return;
    }

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
        const items = request.result;
        const data = {
            items: items,
            settings: appSettings,
            exportDate: new Date().toISOString()
        };

        // Create and download the file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `neststash-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Show success message
        showMessage('Data exported successfully!');
    };

    request.onerror = () => {
        showMessage('Error exporting data. Please try again.', true);
    };
}

// Import data from JSON file
function importData(file) {
    if (!file) return;
    
    // Show loading indicator
    const loadingIndicator = showLoadingIndicator('Importing data...');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate the data structure
            if (!data.items || !Array.isArray(data.items)) {
                throw new Error('Invalid data format');
            }

            // Confirm with user
            if (!confirm(`This will import ${data.items.length} items. Existing items will be preserved. Continue?`)) {
                loadingIndicator.remove();
                return;
            }

            // Import items
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // Add each item
            data.items.forEach(item => {
                // Remove id to ensure new id is generated
                delete item.id;
                store.add(item);
            });

            transaction.oncomplete = () => {
                // Mark cache as dirty
                cacheDirty = true;
                
                showMessage('Data imported successfully!');
                
                // Refresh cache and UI
                refreshCacheAndUI();
                
                // Remove loading indicator
                loadingIndicator.remove();
            };

            transaction.onerror = (error) => {
                console.error('Import transaction error:', error);
                showMessage('Error importing data. Please try again.', true);
                loadingIndicator.remove();
            };

        } catch (error) {
            console.error('Import error:', error);
            showMessage('Invalid file format. Please select a valid backup file.', true);
            loadingIndicator.remove();
        }
    };

    reader.onerror = () => {
        showMessage('Error reading file. Please try again.', true);
        loadingIndicator.remove();
    };

    reader.readAsText(file);
}

// Helper function to show messages
function showMessage(message, isError = false) {
    const messageEl = document.createElement('div');
    messageEl.className = `success-message ${isError ? 'error' : ''}`;
    messageEl.textContent = message;
    document.body.appendChild(messageEl);
    setTimeout(() => messageEl.remove(), 3000);
}

// Debounce helper function to prevent excessive calls
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Update search and filters with debouncing
const debouncedSearch = debounce(() => {
    applyFiltersAndSort();
}, 300);

searchInput.addEventListener('input', () => {
    currentFilters.search = searchInput.value;
    debouncedSearch();
});

// Apply similar debouncing to other filter inputs
// ... existing code ...

// Bulk compression function to compress all images
async function bulkCompressImages(targetQuality) {
    if (!db) {
        showMessage('Database not ready. Please try again.', true);
        return;
    }

    // Confirm with user
    if (!confirm(`This will compress ALL images to ${Math.round(targetQuality * 100)}% quality. This process cannot be undone and may reduce image quality. Continue?`)) {
        return;
    }

    // Close the settings modal
    settingsModal.style.display = 'none';
    
    // Show loading indicator with clear message
    const loadingIndicator = showLoadingIndicator('Compressing all images...');

    try {
        // First get all items with photos
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const allItems = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });

        // Filter items with photos
        const itemsWithPhotos = allItems.filter(item => item.photo && item.photo.startsWith('data:image'));
        
        if (itemsWithPhotos.length === 0) {
            showMessage('No images found to compress.', true);
            
            // Remove loading indicator
            loadingIndicator.remove();
            return;
        }

        // Process each item
        let processed = 0;
        let compressed = 0;
        
        // Set minimum compression benefit threshold - only compress if we save at least 15%
        const MIN_COMPRESSION_BENEFIT = 0.15; // 15% reduction threshold
        
        for (const item of itemsWithPhotos) {
            // Update loading message to show progress
            const progressMessage = `Compressing image ${processed + 1} of ${itemsWithPhotos.length}...`;
            loadingIndicator.querySelector('span').textContent = progressMessage;
            
            // Optimize the image
            const result = await optimizeImageData(item.photo, false, targetQuality);
            
            // Calculate the percentage of size reduction
            const reductionPercentage = 1 - (result.optimizedSize / result.originalSize);
            
            // Only update if it reduced the size by at least the minimum threshold
            if (reductionPercentage >= MIN_COMPRESSION_BENEFIT) {
                // Create a new transaction for each update to avoid transaction timeout issues
                const updateTransaction = db.transaction([STORE_NAME], 'readwrite');
                const updateStore = updateTransaction.objectStore(STORE_NAME);
                
                // Update the item with the compressed image
                item.photo = result.optimizedDataUrl;
                compressed++;
                
                // Save the updated item
                await new Promise((resolve, reject) => {
                    const updateRequest = updateStore.put(item);
                    updateRequest.onsuccess = () => resolve();
                    updateRequest.onerror = (event) => reject(event.target.error);
                });
            }
            
            processed++;
        }
        
        // Mark cache as dirty to trigger a refresh
        cacheDirty = true;
        
        // Show a success message with stats
        showMessage(`Compression complete: ${compressed} of ${processed} images compressed.`);
        
        // Refresh the UI with the updated images
        refreshCacheAndUI();
    } catch (error) {
        console.error('Error during bulk compression:', error);
        showMessage('Error compressing images. Please try again.', true);
    } finally {
        // Remove loading indicator
        loadingIndicator.remove();
    }
}

// Function to delete all items
function deleteAllItems() {
    if (!db) {
        showMessage('Database not ready. Please try again.', true);
        return;
    }
    
    // Show loading indicator
    const loadingIndicator = showLoadingIndicator('Deleting all items...');
    
    try {
        // Create a transaction
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Clear the object store
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
            // Mark cache as dirty
            cacheDirty = true;
            
            // Show success message
            showMessage('All items have been deleted successfully');
            
            // Refresh cache and UI
            refreshCacheAndUI();
            
            // Remove loading indicator
            loadingIndicator.remove();
        };
        
        clearRequest.onerror = (event) => {
            console.error('Error deleting all items:', event.target.error);
            showMessage('Error deleting items. Please try again.', true);
            loadingIndicator.remove();
        };
    } catch (error) {
        console.error('Error during deleteAllItems:', error);
        showMessage('Error deleting items. Please try again.', true);
        loadingIndicator.remove();
    }
}

// ... existing code ... 