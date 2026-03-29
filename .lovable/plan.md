

## Plan: Add flexible genre_category column

### Problem
The `story_category` enum (`ufo`, `paranormal`, `true_crime`, `cryptid`, `conspiracy`, `unresolved`, `weird_news`) only covers paranormal niches. To support any genre (fitness, nutrition, local news, etc.), we need a free-text category field.

### Migration

A single SQL migration that:

1. **Adds `genre_category text null`** to `story_cards` — stores the real category for any niche
2. **Adds `genre_category text null`** to `sources` — lets each source define its category label

No changes to existing columns, RLS policies, or functions.

```sql
ALTER TABLE public.story_cards ADD COLUMN genre_category text NULL;
ALTER TABLE public.sources ADD COLUMN genre_category text NULL;
```

### How it works going forward
- Paranormal content continues using the existing `category` enum as before
- Non-paranormal sources set `category = 'weird_news'` (fallback) and `genre_category = 'fitness'` (real value)
- Edge functions and UI can be updated later to read `genre_category` when present

### No other changes
- No RLS changes
- No function changes
- No frontend changes

