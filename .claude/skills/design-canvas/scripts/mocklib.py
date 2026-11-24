"""Helpers for a design draft's build.py: turn a captured page into mock pages.

A build.py in the scratch folder imports this (sys.path.insert the scripts
folder), reads the captured pages, swaps in the new markup using the app's own
classes, and writes each variant to mock/<n>-<name>.html for shoot.mjs.

    import sys; sys.path.insert(0, "<repo>/.claude/skills/design-canvas/scripts")
    from mocklib import Page, svg, write
    p = Page("cap/admin.html")
    write("mock", "1-overview", p.with_main(p.nav() + new_markup, css=EXTRA_CSS))
"""
import os
import re


class Page:
    """A captured page split into what's before <main>, <main> itself and after it."""

    def __init__(self, path):
        src = open(path, encoding="utf-8").read()
        # Scripts would re-render or open tours over the mock; the stylesheet stays.
        self.src = re.sub(r"<script\b.*?</script>", "", src, flags=re.S)
        head, rest = self.src.split("<main", 1)
        attrs, rest = rest.split(">", 1)
        self.main, self.tail = rest.split("</main>", 1)
        self.head = head
        self.main_open = "<main" + attrs + ">"

    def find(self, pattern):
        """The first match of a regular expression in the page, or an error naming it."""
        m = re.search(pattern, self.src, flags=re.S)
        if not m:
            raise LookupError(f"not in the capture: {pattern}")
        return m.group(0)

    def nav(self):
        """The page's own tab switch (Admin, Orga), if it has one."""
        m = re.search(r'<nav class="organiser-switch".*?</nav>', self.main, flags=re.S)
        return m.group(0) if m else ""

    def with_main(self, body, css=""):
        """The whole page with <main>'s content replaced, extra CSS in <head>."""
        head = self.head.replace("</head>", css + "</head>", 1) if css else self.head
        return head + self.main_open + body + "</main>" + self.tail

    def edit(self, old, new, css=""):
        """The whole page with one exact piece replaced (it must be there)."""
        if old not in self.src:
            raise LookupError(f"not in the capture: {old[:80]}")
        out = self.src.replace(old, new, 1)
        return out.replace("</head>", css + "</head>", 1) if css else out


def svg(body):
    """An inline stroke icon in the app's style (24px, currentColor)."""
    return ('<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            + body + "</svg>")


def write(out_dir, name, html):
    os.makedirs(out_dir, exist_ok=True)
    open(os.path.join(out_dir, name + ".html"), "w", encoding="utf-8").write(html)
