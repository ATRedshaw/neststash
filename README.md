# Neststash - Home Shopping Tracker

A simple web application to help you track items you're interested in for your new house while shopping. **[Live Demo](https://atredshaw.github.io/neststash/)**

## Features

- Take photos of items you like
- Categorize items (furniture, appliances, decor, etc.)
- Add details like name, shop, price, and notes
- Search and filter your saved items
- Sort items by price
- Works offline (data is stored in your browser)

## How to Use

1. **Add Items**:
   - Click "Add Item" tab
   - Take or upload a photo of the item
   - Fill in the details (name, category, shop, price, notes)
   - Click "Save Item" to store it

2. **View Items**:
   - Click "View Items" tab to see all your saved items
   - Click on any item to view full details
   - Use the search box to find specific items
   - Filter by category using the dropdown
   - Sort by price (ascending or descending)
   
3. **Delete Items**:
   - Click on an item to open its details
   - Click the "Delete" button to remove it

## Technical Details & Infrastructure

- **Frontend**: Pure HTML/CSS/JavaScript with modern ES6 features
- **Data Storage**: IndexedDB for persistent client-side storage
- **Hosting**: Served via GitHub Pages static hosting
- **CI/CD**: Automatic deployment from GitHub repository
- **Architecture**: 100% client-side implementation with no server components
- **Dependencies**: Zero external libraries or frameworks required

## Getting Started

Use the app immediately in your browser:  
🌐 [Live Demo](https://atredshaw.github.io/neststash/)

For local development:
```bash
git clone https://github.com/atredshaw/neststash.git
cd neststash
# Open index.html in any modern web browser
```

## Browser Compatibility

Works in all modern browsers supporting IndexedDB:
- Chrome
- Firefox
- Safari
- Edge

## Privacy

All data is stored locally in your browser using IndexedDB. No information is ever transmitted to servers or third parties.