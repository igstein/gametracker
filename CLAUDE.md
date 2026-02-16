# GameTracker — Concept Document (v2)

## 1. Vision & Goal

**GameTracker** is a minimalist, cross-platform game tracking app that helps you stay committed and finish the games you start. It tracks your playtime, compares it against community data from HowLongToBeat (HLTB), and visualizes your progress — so you always know how close you are to the finish line.

**Core principle:** Less backlog management, more motivation to keep playing.

**Platforms:** macOS, Linux (Fedora), iOS — one codebase as a Progressive Web App (PWA).

---

## 2. Features (MVP)

### 2.1 Game Management
- Search and add games via HLTB
- Cover images are automatically loaded from HLTB
- Manual playtime entry (hours & minutes — total time or per update)
- Status categories: **Playing** | **Backlog** | **Finished** | **Abandoned**

### 2.2 Priority System
Each game can be assigned a priority level, displayed as an icon next to the progress bar:

| Priority | Icon | Color | Detail |
|---|---|---|---|
| Must Play | ★ (Star) | Gold (#FFD700) | Filled star — your top priority |
| High | ● (Circle) | Silver (#A0AEC0) | Filled circle — play soon |
| Medium | ● (Circle) | Bronze (#CD7F32) | Filled circle — fun, but flexible |
| Low | ○ (Circle) | White + dark border (#374151) | Outline only — backlog filler |

Default priority for new games: **Medium**.

### 2.3 HLTB Integration
- Search games via the HLTB web endpoint
- Retrieve times: Main Story, Main + Extras, Completionist
- **Target time calculation:** Average of "Main Story" and "Main + Extras"
  - Example: Main Story = 30h, Main + Extras = 45h → Target = 37.5h
- Cover image URL extracted from HLTB data
- Fallback: Games can be added manually without HLTB data (custom target time)

### 2.4 Progress Bar
- Progress bar per game: your playtime vs. calculated target time
- Color coding based on completion percentage:
  - 🔴 **Red** (0–30%): Behind — motivates you to start/continue
  - 🟡 **Yellow/Orange** (31–70%): In progress — shows momentum
  - 🟢 **Green** (71–100%): Almost there or done — celebration effect
- Percentage displayed as text next to the bar

### 2.5 Game Journal (Private Notes)
- Dated journal entries per game (like a diary or blog post)
- Each entry has: date (auto), optional title, text content
- Displayed only on the game's detail page (not in the overview)
- Strictly private — visible only to the logged-in user, never shared
- Use case: "I need to go back to the Water Temple" or "Stuck at boss X, try fire magic next time"

### 2.6 "Next Up" Suggestions
- A dedicated section showing **3 recommended games** to play next
- Algorithm: From all games with status "Playing" or "Backlog", sort by **shortest remaining time** (`targetHours - playedHours`) and pick the top 3
- Motivation: "You only need 4 more hours to finish this one — go for it!"
- Displayed prominently on the main dashboard

### 2.7 List Views & Navigation
- Sidebar with filter categories: All, Playing, Backlog, Finished, Abandoned
- Sort by: Name, Progress (%), Priority, Last Played
- Main view as card grid or compact list (toggleable)

---

## 3. Tech Stack

| Component | Technology |
|---|---|
| App Type | Progressive Web App (PWA) |
| Framework | SvelteKit |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL + Realtime Sync) |
| Auth | Supabase Auth (email/password or magic link) |
| Offline | Service Worker + IndexedDB (local cache) |
| HLTB Data | Custom fetch service (server-side via SvelteKit API routes) |
| Hosting | Vercel or Netlify (free tier) |
| Platforms | macOS (Safari/Chrome), Linux (Firefox/Chrome), iOS (Safari) |

### Why This Stack?
- **SvelteKit:** Lightweight, fast, minimal boilerplate — perfect for a focused app
- **Supabase:** Free tier covers this project easily (500 MB DB, realtime sync, auth)
- **PWA:** One codebase, installable on all three platforms, works offline
- **Tailwind:** Rapid UI development, consistent design, dark mode built-in

---

## 4. Data Model (Supabase / PostgreSQL)

### games
```sql
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT NOT NULL,
    hltb_id INTEGER,
    cover_image_url TEXT,

    -- HLTB data
    main_story_hours DECIMAL,
    main_plus_extras_hours DECIMAL,
    completionist_hours DECIMAL,

    -- Target = average of main_story and main_plus_extras (computed in app)

    played_hours DECIMAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'backlog'
        CHECK (status IN ('playing', 'backlog', 'finished', 'abandoned')),
    priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('must_play', 'high', 'medium', 'low')),

    date_added TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_played TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### game_notes
```sql
CREATE TABLE game_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Row Level Security (RLS)
```sql
-- Users can only see and modify their own data
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own games" ON games
    FOR ALL USING (auth.uid() = user_id);

ALTER TABLE game_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes" ON game_notes
    FOR ALL USING (auth.uid() = user_id);
```

### Computed Values (App-Side)
```typescript
// Target hours: average of Main Story and Main + Extras
const targetHours = (game.main_story_hours + game.main_plus_extras_hours) / 2;

// Progress percentage
const progress = targetHours > 0 ? (game.played_hours / targetHours) * 100 : 0;

// Remaining hours (for "Next Up" sorting)
const remainingHours = Math.max(0, targetHours - game.played_hours);
```

---

## 5. HLTB Service

HowLongToBeat has no official public API. All community npm wrappers (`howlongtobeat-core`, `howlongtobeat`) are broken because HLTB rotates its search endpoint URL and auth token. Alternative APIs (RAWG, IGDB) were evaluated but lack usable completion time data. **We use a custom server-side scraper** based on the approach from the working Python library `howlongtobeatpy` (v1.0.20).

### How HLTB Search Works (Three-Step Process)
1. **Discover search endpoint**: GET `https://howlongtobeat.com/`, find `_app-*.js` script tags, fetch the script, regex-extract the POST endpoint path (e.g. `/api/search`)
2. **Get auth token**: GET `https://howlongtobeat.com/{search_path}/init?t={timestamp}` returns `{ token: "..." }`
3. **Search**: POST to `https://howlongtobeat.com/{search_path}` with headers (`x-auth-token`, random user-agent, referer) and JSON body containing `searchTerms`, `searchType: "games"`, etc.

Response JSON has `data[]` with fields: `game_id`, `game_name`, `game_image`, `comp_main` (seconds), `comp_plus` (seconds), `comp_100` (seconds).

### Implementation
- Custom scraper in `src/lib/services/hltb.ts` — no external HLTB dependencies
- HLTB requests are made **server-side** via SvelteKit API routes (`/api/hltb/search`)
- This avoids CORS issues and keeps the HLTB endpoint details hidden from the client
- Search queries use debouncing (500ms) to respect rate limits
- Discovered endpoint + auth token are cached briefly (~30 min) to avoid re-fetching on every search

### API Route (SvelteKit)
```
POST /api/hltb/search
Body: { "query": "Elden Ring" }
Response: [
    {
        "id": 68151,
        "title": "Elden Ring",
        "imageUrl": "https://howlongtobeat.com/games/68151_Elden_Ring.jpg",
        "mainStoryHours": 52.65,
        "mainPlusExtrasHours": 98.18,
        "completionistHours": 131.32
    }
]
```

### Important Notes
- The HLTB endpoint is **undocumented** and may change at any time
- The endpoint discovery + auth token approach mirrors how the maintained Python library works
- Fallback: Games can be added manually with a custom target time
- Cover images are referenced by URL (not stored in Supabase to save storage)
- Times from HLTB come in seconds and must be converted to hours
- No npm dependencies for HLTB — uses Node built-in `fetch` only

---

## 6. UI Concept

### Main Dashboard
```
┌──────────────┬─────────────────────────────────────────────────┐
│  Sidebar     │  Content                                        │
│              │                                                  │
│  🎮 All      │  NEXT UP                                        │
│  ▶ Playing   │  ┌─────────────────────────────────────────┐    │
│  📋 Backlog  │  │ 🖼 Hades (2.5h left) | 🖼 Celeste (3h) │    │
│  ✅ Finished │  └─────────────────────────────────────────┘    │
│  ❌ Abandoned│                                                  │
│              │  YOUR GAMES                                      │
│              │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐       │
│              │  │Cover │  │Cover │  │Cover │  │Cover │       │
│              │  │Zelda │  │Elden │  │Hades │  │FF XVI│       │
│              │  │★     │  │● pur │  │● yel │  │● blue│       │
│              │  │▓▓▓▓░░│  │▓▓░░░░│  │▓▓▓▓▓▓│  │▓░░░░░│       │
│              │  │ 65%  │  │ 32%  │  │ 95%  │  │ 12%  │       │
│              │  └──────┘  └──────┘  └──────┘  └──────┘       │
│  [+ Add Game]│                                                  │
└──────────────┴─────────────────────────────────────────────────┘
```

### Game Detail Page
```
┌──────────────────────────────────────────────────┐
│  [Cover]   The Legend of Zelda: TotK             │
│            Status: ▶ Playing                     │
│            Priority: ★ Must Play                 │
│                                                   │
│  My Time:       45.0 h                           │
│  Target:        68.5 h (HLTB avg.)              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  65.7%                  │
│                                                   │
│  HLTB Data:                                      │
│  Main Story:       52h                           │
│  Main + Extras:    85h                           │
│  Completionist:   189h                           │
│                                                   │
│  [Update Playtime]  [Change Status]              │
│                                                   │
│  ─── JOURNAL ──────────────────────────────────  │
│                                                   │
│  📝 Feb 12, 2026 — "Water Temple Strategy"       │
│  Need to find the boss key in B2. Try using      │
│  the hookshot on the crystal switch first.        │
│                                                   │
│  📝 Feb 8, 2026 — "Session Notes"                │
│  Finished Goron City questline. Next: head to    │
│  Zora's Domain for the water dungeon.            │
│                                                   │
│  [+ Add Journal Entry]                           │
└──────────────────────────────────────────────────┘
```

### Add Game Dialog
```
┌──────────────────────────────────────────────────┐
│  Search Game: [________________] 🔍              │
│                                                   │
│  Results:                                        │
│  ┌────┬─────────────────────────────────────┐    │
│  │ 🖼 │ Elden Ring                           │    │
│  │    │ Main: 53h | M+E: 98h | Target: 75h │    │
│  │    │                         [Add Game]  │    │
│  ├────┼─────────────────────────────────────┤    │
│  │ 🖼 │ Elden Ring: Shadow of the Erdtree   │    │
│  │    │ Main: 28h | M+E: 50h | Target: 39h │    │
│  │    │                         [Add Game]  │    │
│  └────┴─────────────────────────────────────┘    │
│                                                   │
│  [Add manually without HLTB]                     │
└──────────────────────────────────────────────────┘
```

---

## 7. Authentication & Privacy

- **Supabase Auth** with email/password or magic link (passwordless)
- **Row Level Security (RLS)** ensures users can only access their own data
- Game journal entries are strictly private — no sharing, no public profiles
- No social features, no leaderboards — this is a personal tool
- Optional: Anonymous sign-in for trying the app (data migrates on registration)

---

## 8. Offline & Sync Strategy

### Offline-First Approach
1. **Service Worker** caches the app shell for offline access
2. **IndexedDB** stores a local copy of the user's games and notes
3. On connectivity: Supabase Realtime syncs changes bidirectionally
4. Conflict resolution: Last-write-wins (sufficient for single-user)

### Sync Flow
```
Device A (MacBook)          Supabase Cloud          Device B (Linux PC)
     │                           │                        │
     │── Update playtime ──────>│                        │
     │                           │── Realtime push ─────>│
     │                           │                        │
     │                           │<── Add journal note ──│
     │<── Realtime push ────────│                        │
```

---

## 9. Development Roadmap

### Phase 1: Foundation (Week 1–2)
- [ ] Initialize SvelteKit project with TypeScript + Tailwind CSS
- [ ] Set up Supabase project (database, auth, RLS policies)
- [ ] Implement data model (games table, CRUD operations)
- [ ] Basic layout: sidebar navigation + game list view
- [ ] Add/edit game form (manual entry, no HLTB yet)
- [ ] Manual playtime input
- [ ] Status management (Playing / Backlog / Finished / Abandoned)

### Phase 2: HLTB Integration (Week 3–4)
- [ ] Implement HLTB search service (SvelteKit API route)
- [ ] Add Game dialog with HLTB search + debouncing
- [ ] Import HLTB data (times + cover image URL) on game add
- [ ] Target time calculation (avg. of Main Story & Main + Extras)
- [ ] Error handling & offline fallback (manual entry)

### Phase 3: Progress & Priority (Week 5–6)
- [ ] Progress bar component with color coding (red/yellow/green)
- [ ] Priority system (star + colored circles)
- [ ] Card grid view with cover + progress + priority
- [ ] "Next Up" section (3 games with shortest remaining time)
- [ ] Sorting and filtering (by name, progress, priority, last played)
- [ ] Game detail page

### Phase 4: Journal & Sync (Week 7–8)
- [ ] Game Journal: create, edit, delete dated entries
- [ ] Journal display on game detail page (chronological)
- [ ] Supabase Realtime sync between devices
- [ ] Service Worker for offline caching
- [ ] IndexedDB local cache layer

### Phase 5: PWA & Polish (Week 9–10)
- [ ] PWA manifest (icons, splash screen, install prompt)
- [ ] Responsive design (desktop + mobile/iOS)
- [ ] Dark mode / Light mode
- [ ] Keyboard shortcuts (N for new game, etc.)
- [ ] JSON export/import for backup
- [ ] Testing & bug fixing

---

## 10. Future Enhancements (Post-MVP)

- **macOS Widget:** Separate small Swift project that reads from Supabase and displays current game + progress bar as a native macOS widget
- **Statistics Dashboard:** Total playtime per month, completion rate, games finished over time
- **Rating System:** Personal 1–5 star rating after finishing a game
- **Genre Tags:** Categorize and filter games by genre
- **Reminders:** Notification: "You haven't played Game X in 14 days"
- **Platform Tags:** Track which platform you're playing on (PC, Switch, PS5, etc.)

---

## 11. Technical Risks & Mitigations

| Risk | Mitigation |
|---|---|
| HLTB endpoint changes | Manual entry as fallback; service layer abstracted; monitor community wrappers |
| HLTB blocks requests | Server-side requests via API routes; set proper headers; cache results |
| No HLTB data for niche games | Allow manual target time entry |
| Supabase free tier limits | 500 MB DB + 5 GB bandwidth is plenty for single user; monitor usage |
| PWA limitations on iOS | Safari supports PWA install; no push notifications on iOS (acceptable for MVP) |
| Offline sync conflicts | Last-write-wins strategy; single-user app makes conflicts unlikely |

---

## 12. Project Summary

| Aspect | Decision |
|---|---|
| App Type | Progressive Web App (PWA) |
| Frontend | SvelteKit + TypeScript + Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth + Realtime) |
| Platforms | macOS, Linux (Fedora 43), iOS |
| HLTB Integration | Server-side via SvelteKit API routes |
| Target Time | Average of Main Story & Main + Extras |
| Sync | Supabase Realtime (cross-device) |
| Privacy | RLS policies, private journal, no social features |
| Language (UI) | English |
| Future Widget | Separate Swift project for macOS |

---

*Created: February 2026*
*Last Updated: February 2026*
*Project: GameTracker — Cross-Platform PWA*
*Stack: SvelteKit / TypeScript / Tailwind / Supabase*
