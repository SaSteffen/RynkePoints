# Contract: HTTP route

## `GET /privacy`

- Public: no session needed, none read. Renews an existing session like any
  other page.
- `200`, `text/html`, in the language resolved for the request
  (`Content-Language`), with the language switcher returning to `/privacy`.
- The controller's lines from `PRIVACY_CONTROLLER` in
  `<p class="privacy-controller">`, separated by `<br>`, and `CONTACT_EMAIL` as a
  `mailto:` link.
- Every page's footer: `<a href="/privacy">` with `privacy.link`.
