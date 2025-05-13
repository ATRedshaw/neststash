# Neststash

A Progressive Web App (PWA) for tracking home shopping items and furnishings. Keep track of items you're interested in while shopping for your home. **[Try it out](https://atredshaw.github.io/neststash/)**

## Overview

Neststash helps you organize your home shopping by letting you:

- Take photos and save details of items you like while shopping
- Categorize and organize items with custom categories and shops
- Track prices and add notes for future reference
- Search, filter and sort your saved items
- Works offline as a PWA - install to your device and use anywhere

## Key Features

### Item Management
- Add items with photos, names, categories, shops, prices and notes
- Built-in camera integration for taking photos directly in the app
- Image compression to optimize storage space
- Edit or delete items at any time

### Organization & Search
- Powerful search functionality to find specific items
- Filter by category, shop or other attributes
- Sort items by name, category, shop, price or date
- Customizable categories and shops

### Settings & Customization
- Choose your preferred currency symbol
- Set default sort order for items
- Adjust image compression quality
- Bulk compress existing images to save space

### Offline Functionality
- Full offline support via Service Worker caching
- Install as a PWA to your device's home screen
- All data stored locally in your browser
- Export/import data for backup or transfer

## Technical Details

### Architecture
- Pure vanilla JavaScript with modern ES6+ features
- IndexedDB for client-side data persistence
- Service Worker for offline functionality and caching
- Responsive CSS layout with CSS Grid and Flexbox

### Key Components
- `index.html` - Core app structure and UI components
- `app.js` - Application logic and data management
- `service-worker.js` - Offline caching and PWA functionality
- `styles.css` - Responsive styling and theme
- `manifest.json` - PWA configuration and metadata

### Security & Privacy
- All data stored locally in the browser
- No server-side components or data transmission
- No external dependencies or third-party services

## Getting Started

### Using the App
1. Visit [Neststash](https://atredshaw.github.io/neststash/)
2. Install to your device for offline use (optional)
3. Start adding items using the "Add Item" tab
4. View and manage items in the "View Items" tab