# Icons Needed for PWA

To complete the PWA setup, you need to create two icon files:

## Required Icons

1. **icon-192.png** (192x192 pixels)
2. **icon-512.png** (512x512 pixels)

Place these files in the `/static/` directory.

## Design Suggestions

The icon should represent GameTracker. Some ideas:

- 🎮 Game controller with a progress bar
- 📊 Chart/graph with game symbols
- ✅ Checkmark with game imagery
- 🎯 Target/bullseye symbol

### Quick Solution (Temporary)

For now, you can use a simple emoji-based icon:

1. Go to https://favicon.io/emoji-favicons/video-game/
2. Download the game controller emoji as a favicon
3. Resize to 192x192 and 512x512
4. Name them `icon-192.png` and `icon-512.png`
5. Place in `/static/` folder

### Professional Option

Use a tool like:
- Figma (free): Design custom icon
- Canva (free): Use game-themed templates
- DALL-E / Midjourney: Generate AI icon

## Icon Design Guidelines

- **Simple**: Works at small sizes (16px)
- **Recognizable**: Instantly identifiable
- **Consistent**: Matches app's blue theme (#2563eb)
- **Square**: 1:1 ratio with rounded corners
- **Maskable**: Safe area for iOS (80% of canvas)

## Testing

After adding icons:
1. Open DevTools → Application → Manifest
2. Check if icons load correctly
3. Try installing the PWA (should show your icon)
