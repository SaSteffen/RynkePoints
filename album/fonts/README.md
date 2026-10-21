# Album fonts

The season album (feature 021, research R13, FR-055) is set in Nunito, under the
SIL Open Font License 1.1 ([`OFL.txt`](OFL.txt)), so the printed PDF can embed
it.

The three files are static instances of the variable font
`ofl/nunito/Nunito[wght].ttf` in [google/fonts](https://github.com/google/fonts)
(commit `47d54ca1ebb14fd864695f1d39dc734f39017c33`), made with fontTools'
`varLib.instancer` at the weights the album uses and saved as WOFF2, all
glyphs kept:

| File | Weight |
|------|--------|
| `Nunito-Regular.woff2` | 400 |
| `Nunito-Bold.woff2` | 700 |
| `Nunito-Black.woff2` | 900 |

```python
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

for weight, name in [(400, "Regular"), (700, "Bold"), (900, "Black")]:
    font = instantiateVariableFont(
        TTFont("Nunito[wght].ttf"), {"wght": weight}, updateFontNames=True
    )
    font.flavor = "woff2"  # needs the brotli module
    font.save(f"Nunito-{name}.woff2")
```

## Schoolbell

The owner's name on the cover is set in Schoolbell by Font Diner, under the
Apache License 2.0 ([`Schoolbell-LICENSE.txt`](Schoolbell-LICENSE.txt)), which
allows embedding it in the PDF. `Schoolbell-Regular.woff2` is
`apache/schoolbell/Schoolbell-Regular.ttf` from the same google/fonts commit,
saved as WOFF2 with fontTools, all glyphs kept:

```python
from fontTools.ttLib import TTFont

font = TTFont("Schoolbell-Regular.ttf")
font.flavor = "woff2"  # needs the brotli module
font.save("Schoolbell-Regular.woff2")
```
