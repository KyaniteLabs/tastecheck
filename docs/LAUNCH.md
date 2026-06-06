# Launch kit — tastecheck

Draft copy for launch. Written to read human (ran against the humanize-copy kill-list:
no buzzwords, varied sentence length, a real stance, concrete specifics). Edit the
@handle, links, and any numbers before posting. Attach `docs/hero/five-systems.png` as
the lead image everywhere.

The one rule: **lead with the picture and the enemy, not the feature list.** People share
the before/after image; the repo link rides along.

---

## X / Twitter — main thread

**Tweet 1 (the hook + image)**
> Every AI builds the same website.
> Purple gradient. Inter. Centered hero. Three identical cards.
>
> Not because it's wrong — because it's the average of the web.
>
> So I built the thing that stops it. Same prompt, same model, one skill on 👇
> [attach docs/hero/five-systems.png]

**Tweet 2**
> The trick isn't cleaning up after the AI. It's refusing to let it guess.
>
> tastecheck's main skill *interviews you first*:
> "'modern' is a non-answer — name one site you'd be happy to resemble."
> "Pick a side: warm or cool. The middle is where generic lives."

**Tweet 3**
> Then 13 more skills do the craft, and every rule is checkable, not vibes:
> · pill button (9999px) → 6px
> · indigo→violet → one committed hue
> · #000 dark mode → #121212 + elevation by lightness
> · OKLCH palettes that actually pass contrast

**Tweet 4**
> Plain Markdown skills, no runtime. The installer links `~/.agents/skills` and mirrors
> into detected Claude Code, Codex, Gemini, Cursor, Kilocode, and Kimi skill dirs.
>
> One command:
> `git clone https://github.com/KyaniteLabs/tastecheck && ./tastecheck/install.sh`

**Tweet 5 (the flex + close)**
> Every other "fix AI design" repo is itself untested AI slop.
> This one ships a repeatable `npm test` gate plus browser QA notes and screenshots in the repo.
>
> MIT. Free. ⭐ it if you're tired of purple:
> https://github.com/KyaniteLabs/tastecheck

---

## Hacker News — Show HN

**Title:**
> Show HN: tastecheck – stops AI from building the same purple-gradient website

**First comment (post immediately after):**
> Every LLM, asked to "build a landing page" with no direction, returns the same thing:
> purple gradient, Inter, centered hero, three feature cards. It's not a bug — it's the
> model returning the statistical average of its training data. (Tailwind's creator
> actually apologized last year for making indigo the demo default and seeding half of it.)
>
> I got tired of redesigning the same generated page, so I made tastecheck. It's a set of
> 14 skills for AI coding agents. The part I think is actually new: the headline skill
> doesn't fix the output afterward — it interviews you *before* the build and forces the
> decisions the model would otherwise average away (reference instead of adjectives, one
> dominant color instead of five pastels, a real type pairing instead of Inter). It writes
> a DESIGN-SYSTEM.md + tokens, and the other skills build from that.
>
> The other thirteen are plain craft, each written to be checkable rather than "make it pop":
> OKLCH color with real contrast math, dark mode by surface-lightness, WCAG 2.2 fixes,
> responsive layout with container queries, the full component state matrix, etc.
>
> Two things I did differently from most skill repos: (1) it's plain Markdown with a
> canonical `~/.agents/skills` install path plus mirrors for detected agent homes; and
> (2) it ships a repeatable `npm test` gate plus browser QA notes, because an untested
> "anti-slop" pack would be pretty funny. Verification notes and screenshots are in the repo.
>
> MIT, no account, no SaaS: https://github.com/KyaniteLabs/tastecheck
> Genuinely curious whether the "interview-first" idea holds up for people building with
> other models — feedback welcome.

---

## Reddit — r/webdev (and r/ClaudeAI, r/programming with tweaked tone)

**Title:**
> I made a tool that stops AI from building the same purple-gradient website every time

**Body:**
> You've seen it: ask any AI to build a landing page and you get a purple gradient, Inter,
> a centered hero, and three identical cards. It happens because the model fills every
> unspecified choice with the most common pattern in its training data — and the average
> of the web is exactly that.
>
> tastecheck is my attempt at the fix. It's a set of skills for AI coding agents, and the
> main one is the part I'm proud of: instead of polishing the output afterward, it grills
> you *before* anything gets built — "name a site you'd be happy to resemble," "pick warm
> or cool, not both," "one dominant color, not five." It turns your answers into a design
> system the rest of the skills follow.
>
> The other skills are straight craft, all checkable: OKLCH color with contrast math, dark
> mode that isn't pure black, WCAG 2.2 fixes, container-query layouts, every component
> state, accessible forms, tasteful motion.
>
> [five-systems montage image]
>
> It's plain Markdown, MIT, and has a repeatable verification gate so it's not the usual
> untested "make it pop" repo. Repo: https://github.com/KyaniteLabs/tastecheck
>
> Would love feedback, especially from anyone building with Cursor/Codex/Gemini.

---

## Notes for posting
- **Image first.** The five-systems montage PNG is the asset (plus the live gallery). On X it's the whole tweet; on Reddit
  it goes in the body; on HN it lives in the repo README (HN is text).
- **HN timing:** weekday morning US Eastern; reply fast to the first comments.
- **Don't cross-post the same minute** — stagger by a few hours; let X/Reddit traction
  exist before HN.
- **Engage the purple-gradient crowd** — quote-reply to existing "AI purple problem" posts
  with the before/after; that's where the audience already is.
- **One stance to hold in replies:** "fix it before the model guesses, not after." That's
  the differentiator; keep returning to it.
