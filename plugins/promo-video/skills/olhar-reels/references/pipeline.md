# Olhar Factual Reels: commands and formats

All paths are relative to the pipeline root (`of_vlog/videos`). The Python scripts run
with `~/.cache/tts-eval/venv/bin/python` (`$PY` below). The Node scripts use
`/usr/bin/chromium-browser`.

## Commands

| Step | Command | Writes |
|---|---|---|
| Extract | `node driver/extract.mjs story <url> data/<slug>.json` | `{url, title, summary, image, articles[], page, lenses:{Esquerda,Centro,Direita:{head, bullets[]}}}`; each article string is `"<Outlet>· <Lean> <Tone> <headline>"` |
| Capture | `node driver/capture.mjs <slug> <url> phone` | `studio/public/site/<slug>/phone-{full,head,cov,ficha,sides,blind,lens-left,lens-center,lens-right}.jpg` + `parts.json` |
| Main photo | on the story page: `document.querySelector('main figure img').currentSrc` and its `figcaption` ("IMAGEM VIA …"); `curl -fsSL -o studio/public/site/<slug>/photo.<ext> <src>` (webp: `magick photo.webp photo.jpg`) | `studio/public/site/<slug>/photo.jpg`. Not `extract.mjs`'s `image`: that is the share card, with a bias bar that can be stale |
| Candidates | `$PY voices/lexicon_test.py --words voices/words-<date>.json --out pronuncia-<date> edge:pt-BR-FranciscaNeural` | `voices/pronuncia-<date>/edge-pt-BR-FranciscaNeural/<word-slug>-<n>.mp3` (n = 1-based index into `spellings`) + `index.html` |
| Screen | `$PY -I <skill>/scripts/screen_spellings.py voices/words-<date>.json voices/pronuncia-<date> edge:pt-BR-FranciscaNeural --round <date>` | prints the `review_pronunciations` payload (JSON) |
| Narrate | `$PY voices/narrate.py projects/reels-<slug> edge:pt-BR-FranciscaNeural [--only id,id] [--dry-run]` | `studio/public/vo/reels-<slug>/edge-pt-BR-FranciscaNeural/<id>.wav`, `studio/src/data/reels-<slug>__edge-pt-BR-FranciscaNeural.json` |
| Registry | `cd studio && node gen-registry.mjs` | `src/registry.gen.ts` |
| Anchors / times | `cd studio && npx esbuild times.tsx --bundle --platform=node --outfile=/tmp/times.cjs && node /tmp/times.cjs "reels-<slug>--"` | prints `{total, scenes, mids}`; throws `no word X in id` for a bad anchor |
| Bundle | `cd studio && npx remotion bundle src/index.ts --out-dir build` | `studio/build/`, shared by every render (`BUILD=build2` for a second one) |
| Stills | `cd studio && ./stills.sh reels-<slug>--edge-pt-BR-FranciscaNeural ../review/reels-<slug>-v1.jpg <t1> <t2> …` | contact sheet |
| Render | `./render.sh reels-<slug>--edge-pt-BR-FranciscaNeural reels/<date>/reels-<descr>--francisca [<id> <name> …]` | `out/raw/…mp4` → `finish.sh` (H.264 yuv420p BT.709, -14 LUFS) → `out/reels/<date>/…mp4` |
| Thumbnail | `cd studio && npx remotion still build thumb-reels-<slug> ../out/reels/<date>/reels-<descr>--francisca.jpg --image-format=jpeg --jpeg-quality=90 --browser-executable=/usr/bin/chromium-browser` | the cover, same name as the mp4. Needs the `<Still>` in `src/Root.tsx` and a fresh bundle |

Typical times on this machine (CPU only):

- Whisper inside `narrate.py`: about 2–3 min per video.
- A render: about 4 min.
- A candidate round: under 1.5 min.

Never run two bundles, two renders, or two Claude batches over the same tree at once: they
share `studio/build/`, `src/registry.gen.ts`, `src/of/parts.ts` and the lexicon.

## script.md

```
# Reels — <title> (Olhar Factual, <dd/mm/aaaa>)
## Gancho
z1: Trump abandonou a Ucrânia?
z2: Zelensky foi a Oslo | tentar se reaproximar dos Estados Unidos.
## Fato
z3: …
## Esquerda
z4: Na esquerda, | a "guinada" de Trump a favor de Putin | dá ao Kremlin um gosto de vitória.
## Centro
z5: No centro, | …
## Direita
z6: Na direita, | …
## Chamada
z8: Abandono ou estratégia? | Compare os três lados no Olhar Factual. | Link na bio.
```

- **Lines:** each one is `id: text`. Headings are ignored.
- **Caption breaks:** `|` forces one.
- **Shown vs spoken:** `{45%|quarenta e cinco por cento}` shows the first and speaks the
  second. Use it for numbers, percentages and odd acronyms (`{PEC|péc}`).
- **Lexicon words:** don't respell them in the script. The lexicon handles them.

## Config (`studio/src/videos/reels<Name>.tsx`)

The types are in `studio/src/of/reelsStory.tsx`. The model is `reelsZelensky.tsx`:

```ts
export const reelsZelensky = reelsStory({
  section: 'Mundo',
  music: {src: 'One_Sly_Move.mp3', from: 86, bed: 0.2, duck: 0.06},
  credit: 'Música: “One Sly Move”, Kevin MacLeod (incompetech.com) · CC BY 4.0',
  hook: {question: 'Trump abandonou a Ucrânia?', qLine: 'z1', promise: '…', pLine: 'z2',
         photo: {src: 'site/zelensky/photo.jpg', credit: 'Estadão'}},   // frame 0 to 5 s at most
  sections: [
    {first: 'z3', blocks: [{kind: 'site', slug: 'zelensky', part: 'phone-head', line: 'z3', off: -0.3}, …]},
    {side: 'left', first: 'z4', blocks: [{kind: 'terms', line: 'z4', off: 0.2, terms: […]},
      {kind: 'clip', line: 'z4', word: 'kremlin', outlet: 'Folha de S.Paulo', lean: 'Centro-esquerda', side: 'left', headline: '…'}]},
    {side: 'center', first: 'z5', blocks: […]},
    {side: 'right', first: 'z6', blocks: […]},
  ],
  cta: {line: 'z8', bias: [40, 27, 33]},   // the line must contain "compare"; bias = the site's live %
});
```

- **Block kinds:** `terms | clip | quote | items | count | site | stamp | title`.
- **Timing:** each block enters at `{line, word?, off?}`.
- **Music:** in `studio/public/music/`, Kevin MacLeod, CC BY 4.0. Vary it across the
  batch.
- **Registering a capture:** add an import of `public/site/<slug>/parts.json` to
  `studio/src/of/parts.ts`, plus its key in `ALL`.
- **`hook.photo`** is optional; videos without it keep the plain hook. If the code doesn't
  support it yet, add it to `reelsStory.tsx` and `Hook` in `reels.tsx` the first time.

## Thumbnail (`thumb-reels-<slug>`)

- A one-frame `<Still id="thumb-reels-<slug>" width={1080} height={1920}>` in
  `studio/src/Root.tsx`, rendering the shared `Thumb` from `studio/src/of/thumb.tsx`.
- Props: `{photo, credit, kicker, punch, highlight, call, clips}`.
  - `punch` is the hook in 2–5 words; `highlight` is the word in it shown in crimson.
  - `call` is one sentence from what the video says, the one that makes people watch.
  - `clips` holds two `{outlet, side, headline}`, from opposite sides, with the video's
    headlines.
- Layout, top to bottom: the blurred photo as background, the framed photo with its credit,
  the two clips, the kicker, the punch line, the call.
- Everything stays between y 250 and 1600. The bottom 320 px stay empty for the app's view
  counter. No captions.

## legendas-dos-posts.md

```
# Textos para os posts (Facebook Reels) — <dd/mm/aaaa>

Voz: Francisca. Dados do Olhar Factual de <dd/mm/aaaa>. O crédito da música é obrigatório
(licença CC BY 4.0). <election note when it applies>

---

## <story title>
Capa: `reels-<descr>--francisca.jpg`
Arquivo: `reels-<descr>--francisca.mp4`

<hook line + one emoji>
<2–3 lines: the fact, then how left / centre / right framed it>

Compare os três lados: 🔗 link na bio.

#OlharFactual #<topic tags> #Notícias

Música: “<track>”, Kevin MacLeod (incompetech.com) · CC BY 4.0

---
```

`Capa:` goes **above** `Arquivo:`. The Reel Desk panel copies everything below the
`Arquivo:` line as the post text.

## Pronunciation files

`voices/words-<date>.json`:

```json
{"Luchsinger": {"target": "LUK (som de U) + singer",
                "line": "A entrevista de Roberta {} à CNN dividiu a imprensa.",
                "spellings": ["Luchsinger", "Luk-sínguer", "Luksínguer", "Luc Sínguer"]}}
```

`review_pronunciations` payload (what `screen_spellings.py` prints):

```json
{"round": "2026-10-23",
 "words": [{"word": "Luchsinger", "target": "…", "line": "…", "voice": "edge:pt-BR-FranciscaNeural",
            "lexicon_key": "edge", "story_url": "https://olhar-factual.hexhound.dev/historia/…",
            "clips": [{"n": 2, "spelling": "Luk-sínguer", "file": "/abs/…/luchsinger-2.mp3",
                       "heard": "Luchsinger", "score": 0.94}]}]}
```

`pronunciations/history.jsonl` has one verdict per line:

```json
{"at": "2026-10-21T22:40:00-03:00", "round": "2026-10-21c", "word": "Luchsinger", "voice": "edge:pt-BR-FranciscaNeural",
 "lexicon_key": "edge", "spelling": "Luk-sínguer", "ok": true, "target": "…", "line": "…", "note": "", "story_url": "…"}
```
