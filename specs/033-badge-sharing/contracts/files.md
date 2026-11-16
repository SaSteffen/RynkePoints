# Contract: Shared files

What leaves the share sheet, as a file to share, save or copy. Layouts are in
[research R3](../research.md#r3-layouts).

| Format | Option | Type | Size (px) | Contents |
| --- | --- | --- | --- | --- |
| Story | — | PNG | 1080 × 1920 | white background with yellow glow, badge, name (≤ 2 lines), "erreicht am {date}", app mark and name; nothing outside 250…1670 px vertically except the background |
| Story | Glitzernd | MP4 | 1080 × 1920 | as above, animated: two shine sweeps and four twinkling stars over 5 s, 30 fps, seamless loop |
| GIF | — | GIF with transparency | 720 × 720 | the badge alone, no text, no mark, transparent elsewhere; the four stars twinkling over 5 s at 20 fps, looping, no shine sweep; fully transparent or opaque per pixel, so no soft shadow |
| Bild | — | PNG | 1080 × 1080 | as Story, square |
| Story | with a photo | PNG | 1080 × 1920 | the rider's photo filling the frame, cropped round its middle, with the badge at the rider's place; no text, no mark |
| Story | with a photo, Glitzernd | MP4 | 1080 × 1920 | as above, with the animated badge |

For every file:

- **Name**: `{app slug}-{badge id}-{story|image|sticker|photo}.{png|mp4|gif}` (FR-029).
- **No rider data**: no rider name, Strava photo or other rider detail. The badge's milestone shows as
  on the page (FR-018). No Strava mark (FR-030).
- **Still pictures**: no twinkling stars (FR-020).
- **Video**: H.264 in an MP4 container (`ftyp` brand `isom`, track codec `avc1`) (FR-024), for Story
  only. GIF is a looping GIF89a instead, made in the browser without a codec, so
  every browser offers it: 255 colours by median cut with an 8 × 8
  ordered dither, and without the shine, which would make the file several times larger.
- **System share**: `{ files: [file], text: shareText }`. Save and copy carry the file only.
