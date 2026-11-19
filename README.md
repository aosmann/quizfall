# quizfall

Quizfall: a fast, colourful quiz for the EduGames portal. Four coloured answers (red triangle, blue diamond, yellow circle, green square), a countdown, points for speed and bonus points for answer streaks. Play solo against the clock, or run it live: the board shows the question, the whole class answers from their phones.

Play: https://aosmann.github.io/quizfall/

- **Scoring:** a right answer is worth `round(1000 × (1 − (seconds used / time limit) / 2))`, so 500–1000. Wrong or no answer: 0. From the 2nd right answer in a row: +100 per streak step, up to +500.
- Every question has 4 answers. When the bank gives 3, a 4th wrong answer is added from the same topic (same kind of question, never another question's right answer for the same text).
- Keys 1 · 2 · 3 · 4 answer, Enter / Space continues, Esc / P pauses (solo).
- No build step, no sound files (WebAudio). Works offline after the first visit (service worker) and installs on iPhone.

`questions.js` and `flags/` are the shared EduGames bank, byte-identical to the other games. Never edit them here. Romanian words for Quizfall's own screens live in `game.js`.

## EduGames contract (v1)

`game.json` settings: `level` (topic default), `count` (5 / 10 / 15 / 20, default 10) and `time` per question (10 / 20 / 30 s, default 20). It also declares `"multiplayer": {"live": true}`.

```
?topic=<id>&level=1-3&count=10&time=20&regions=eu,as&lang=ro&lock=1   (+ o_*, qset as usual)
```

With `topic` in the address the solo run starts at once, with no menu and no tutorial. Posts `edu-ready`, `edu-progress` after every answer (`score`, `right`, `asked`, `last`) and `edu-result` at the end; every result is also appended to `localStorage['edu-results']` (last 200). Extra result fields: `count`, `time`, `timeUsed`, `cause` (`end` | `quit`), `mode: 'solo'`.

## Live rounds (host + players)

The same repo has three views, chosen by the address:

| View | Address |
|---|---|
| Host (teacher board) | `?host=1&topic=…&level=…&count=10&time=20&seed=…&regions=…&lang=…` (+ `o_*`, `qset`) |
| Player (student phone) | `?player=1&lock=1&me=<id>&name=<name>&avatar=<absolute url>&lang=…` (`topic` optional) |
| Solo | neither `host` nor `player` |

The host builds the question list (`count` questions from `EduQ.stream`, seeded with `seed`) and is the only source of truth for scores and ranks. Players only need their identity; the host sends them every question.

### Messages (the portal only relays them)

| From → to | Message |
|---|---|
| host → portal | `{type:'edu-ready', game:'quizfall', host:true}` on load |
| player → portal | `{type:'edu-ready', game:'quizfall', player:true}` on load |
| portal → host | `{type:'edu-players', players:[{id, name, avatar}]}` whenever the list of connected students changes (send it once after the host's `edu-ready` too) |
| host → portal → every player | host posts `{type:'edu-bcast', data}`; the portal posts the same `{type:'edu-bcast', data}` to every player iframe |
| player → portal → host | player posts `{type:'edu-up', data}`; the portal posts `{type:'edu-up', from:{id, name, avatar}, data}` to the host iframe |
| host → portal | `{type:'edu-live-end', game, subject, topic, topicName, level, count, time, players, at, ranking:[{id, name, rank, score, right, asked, bestStreak}]}` when the podium shows |
| player → portal | `edu-progress` after every judged question, `edu-result` at the end (contract v1) |

`data` inside `edu-bcast` (host → players). `data.to`, when present, means "only for this player id"; the others ignore it.

| `data.k` | Fields |
|---|---|
| `lobby` | `info`, `n` (players connected) |
| `ready` | `i`, `total`, `info` (3 s "get ready" before each question) |
| `q` | `i`, `total`, `text`, `img`, `code`, `tag`, `choices` (4), `time` (s), `left` (ms), `endsAt` (host clock), `done` (only in a reply to `hello`: already answered), `info` |
| `reveal` | `i`, `total`, `correct`, `answer`, `counts` (4), `players`, `info`, `res: {<id>: {ok, pick, pts, base, bonus, total, streak, rank, ahead:{name, gap} or null}}` |
| `board` | same as `reveal`, plus `top` (top 5: `id, name, avatar, total, rank, move`) |
| `end` | `total`, `players`, `res: {<id>: {rank, total, right, asked, best}}`, `top` (top 3), `info` |

`info` = `{subject, topic, topicName, level, count, time}`.

`data` inside `edu-up` (player → host): `{a:'hello', me}` on load (repeated every 3 s until the host answers) and `{a:'answer', q, pick, ms, me}`. The host replies to `hello` with the current state, addressed with `to`, so late joiners and reloaded phones drop straight into the game.

`live-demo.html` is a working reference relay: it opens a host and three player iframes and passes messages exactly like the portal should. Try `live-demo.html?topic=capitals&level=1&count=5&time=20&players=3`.
