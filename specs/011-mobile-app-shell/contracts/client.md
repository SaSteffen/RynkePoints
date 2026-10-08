# Contract: Client Scripts

**Feature**: [../spec.md](../spec.md) | **Research**: R6, R8, R11

Changes to feature 010's `contracts/client.md`. The scripts still hold no text,
no dependencies and no bundling. `sw.js` is unchanged.

## Head scheme script (new, inline in every page)

It runs before `<style>` and `<body>`, so the page never paints in the wrong scheme
(FR-032a):

```js
try {
  const s = localStorage.getItem("rp-scheme");
  if (s === "light" || s === "dark") {
    document.documentElement.dataset.scheme = s;
    // one theme-color for the fixed scheme (R12)
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
      m.removeAttribute("media");
      m.content = s === "dark" ? "#1a110e" : "#fff8f6";
    }
  }
} catch {}
```

It comes after the two `theme-color` meta tags in `<head>`
([pages.md](pages.md)), so they already exist when it runs. It lives in `html.ts`;
a test checks every page has it before `<style>`, and that its two colours equal
the `surface` tokens. `localStorage` failures, such as some private modes, leave
System.

## `public/app.js` (changed)

### Scheme picker (new)

On a page with `input[name=scheme]`:

- it checks the radio that matches the stored value, or `system`;
- on `change` it stores the value (`system` removes the key);
- it then sets or removes `dataset.scheme` and updates `theme-color` the same way
  the head script does.

Nothing is sent to the server.

### Refresh after a minute away (new, FR-009)

```text
visibilitychange → hidden:  hiddenAt = Date.now()
visibilitychange → visible: if nav.app-nav exists and Date.now() - hiddenAt > 60000 → location.reload()
```

It does nothing on public pages, so a half-filled consent form is never lost.

### Notifications switch (changed from 010)

The markup inside `#notifications` is now:

- the same six `p[data-state]` paragraphs;
- `<button type="button" role="switch" data-action="toggle" aria-checked="false" aria-label="{notifications.switch}" hidden>`, which replaces the
  `data-action="on"` and `"off"` buttons.

`show(state, checked)` shows exactly one state paragraph and handles the switch:

| state | switch |
|---|---|
| `on` | shown, `aria-checked="true"` |
| `off` | shown, `aria-checked="false"` |
| `failed` | shown, keeps the value it had before the attempt |
| `blocked`, `needsHomeScreen`, `unsupported` | hidden |

A click runs 010's "on" flow when `aria-checked` is `false`, and the "off" flow
otherwise. The permission is still asked inside the tap. Server calls and the
sign-out endpoint handling are unchanged.

### Install hint (changed)

As in 010. When it shows `#install`, it also unhides a parent
`section#settings-app` if there is one, and hides it again with the hint.
