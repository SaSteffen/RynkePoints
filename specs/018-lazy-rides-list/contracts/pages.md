# Contract: Rides Markup

**Feature**: [../spec.md](../spec.md) | **Research**: R6, R7

Changes to `section#rides` of `/me/rides` (feature 011 contracts/pages.md).
Nothing changes for 20 rides or fewer, the waiting state or an empty season.

With more than 20 rides (a pager is shown):

```html
<section id="rides" data-lazy>
<h2>Deine Fahrten</h2>
<p class="rides-position">Fahrten 21–40 von 87</p>
<p class="rides-total" hidden>87 Fahrten in dieser Saison</p>
<p class="rides-newest" hidden><a class="tap" href="/me/rides">Zu den neuesten Fahrten</a></p>
<ol class="ride-list" data-more="/me/rides/more?after=2026-09-16T08%3A00%3A00Z~8000040">
<li class="ride-card …">…</li>
…</ol>
<div class="rides-more" hidden><p class="rides-status" role="status" data-loading="Ältere Fahrten werden geladen …" data-failed="Ältere Fahrten konnten nicht geladen werden." data-added="Weitere Fahrten geladen"></p><button type="button" class="button-outlined" data-retry hidden>Erneut versuchen</button></div>
<nav class="pager" aria-label="Seiten">…</nav>
</section>
```

- `data-lazy` marks the section the script turns into a continuous list.
- `p.rides-newest` only on page 2 and later.
- `data-more` only when older rides follow the last card on this page.
- `p.rides-position`, the cards and `nav.pager` are unchanged.
- Without the script, everything hidden stays hidden.
