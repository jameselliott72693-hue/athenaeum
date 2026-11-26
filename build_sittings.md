# Building a sitting

A night's sittings file is `docket/YYYY-MM-DD.json`. Its text, quotations, and report are the night's own. Further encounters do not change that text. They only read an optional list of themes.

A weekly edition, when the docket is gathered by week instead of by night, uses this label:

`Week of <Monday> to <Sunday>`

For example: `Week of November 16 to November 22`. Put that label on the edition the way a night uses `date_long`. The sittings file is unchanged apart from the theme field below.

## Themes

Each sitting may carry:

```json
"themes": ["justice", "mercy"]
```

Use one, two, or three ids. The ids are only these:

| id | question |
| --- | --- |
| `justice` | Justice |
| `mortality` | Mortality |
| `freedom-order` | Freedom and order |
| `faith-doubt` | Faith and doubt |
| `duty` | Duty |
| `love` | Love |
| `truth` | Truth and lying |
| `power` | Power and corruption |
| `mercy` | Mercy |
| `good-life` | The good life |
| `dignity` | Human dignity |
| `exile` | Exile and home |
| `conscience` | Conscience |

Choose the eternal question under the story, not the news topic. A sitting about a trial may be `justice` and `mercy`. A sitting about a church and the state may be `faith-doubt` and `freedom-order`. Leave every other field as it was, including quotations.

If `themes` is absent, the page looks in `data/encounter-map.json` under `date/sitting_id`. That file is the backfill for nights published before the field existed. New editions should put `themes` on the sitting and do not need a map entry.

If both are missing, the page infers tags from the question. If that inference finds nothing, the Further encounters section is omitted. The sitting still reads as before.

Works for those tags live in `data/encounters.json`. Add a work there when the catalog should grow. Do not paste song lyrics, and do not paste a poem that is still in copyright. A public-domain poem may include its text only with the edition it was taken from.

## Podcast feed

When the edition has an audio file, commit `docket/audio/YYYY-MM-DD.mp3` and set `"audio": "audio/YYYY-MM-DD.mp3"` on that night in `docket/index.json`. Then regenerate the feed and the chapter file:

```
node scripts/build-podcast.js
```

Commit `docket/podcast.xml` and `docket/audio/YYYY-MM-DD.chapters.json` with the MP3. The script measures the file's duration and size. It does not invent either. Chapter markers follow the short edition: an introduction, then each sitting named in `short_edition.picks`, timed by the length of that sitting's text. To publish exact cue times instead, add `audio_chapters` to the sittings file, one row per part, with `id` and `start` in seconds. The intro id is `intro`. Run the same script again after replacing an MP3 or moving an audio night into `docket/archive.json`.
