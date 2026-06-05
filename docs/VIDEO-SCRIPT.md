# Demo video script — tastecheck (~45s)

Goal: one screen-capture that makes the before/after undeniable and shows the *interview*
(the novel part). Silent-friendly with on-screen captions; add VO if you want. Vertical
(9:16) for X/Reddit/TikTok; also export 16:9 for the repo.

Format: real terminal + browser. No slides. The whole point is "this is real, watch."

---

## Shot list

**0:00–0:05 — The enemy (cold open, no intro)**
- Caption: **"Every AI builds this site."**
- Screen: a Claude Code / Cursor prompt: `build me a SaaS landing page`
- Cut to the rendered result: purple gradient, Inter, centered hero, 3 emoji cards.
- Caption: **"Purple gradient. Inter. Three cards. Every. Single. Time."**

**0:05–0:12 — Name the cause**
- Caption: **"It's not broken. It's the average of the web."**
- Quick flash: 3 other AI-generated pages side by side, all purple/centered/identical.
- Caption: **"So fix it *before* the AI guesses."**

**0:12–0:30 — The interview (the hook — let this breathe)**
- Type: `/designsystem` (or just "make me a landing page" and let it trigger).
- Show the agent pushing back, line by line (caption each as it appears):
  - *"'Modern' is a non-answer. Name one site you'd be happy to resemble."*
  - User types: `a Criterion DVD case`
  - *"Pick a side — warm or cool? Don't say both."* → `warm`
  - *"One dominant color. Not five pastels."* → `oxblood`
  - *"Display face — not Inter."* → `Fraunces`
- Caption: **"It refuses to build until you've made real decisions."**

**0:30–0:40 — The payoff**
- Show the agent building, then the rendered result: the warm editorial page (the
  "after" from the gallery — oxblood, Fraunces, real numbers, flat).
- Split-screen the two side by side. Hold for 3 seconds.
- Caption: **"Same prompt. Same model. One skill on."**

**0:40–0:45 — CTA**
- Terminal: `git clone https://github.com/KyaniteLabs/tastecheck && ./tastecheck/install.sh`
- Caption: **"Works with any AI coding agent. MIT. Link in bio."**
- End card: `tastecheck` wordmark + repo URL.

---

## Production notes
- **Lead with the result, not your face.** First 2 seconds decide the scroll.
- The interview section is the share-driver — caption every pushback line clearly; that's
  the "whoa, it talks back" moment.
- Keep the split-screen reveal on screen long enough to screenshot (people will).
- Export a 3–5s silent GIF of *just* the before→after split for embedding in posts.
- Music: low, neutral; let captions carry it (most watch muted).
- Re-use the real gallery page (`demos/gallery.html`) for the "after" if a live build is
  slow to capture — it's the same committed direction.
