**Input** — single-line text field for forms (login, add-site, search).

```jsx
<Input label="Site URL" placeholder="https://example.com" />
<Input label="Email" hint="We never share this" type="email" />
```

Pass `label` and/or `hint` to get the stacked field group, or use bare for inline use (e.g. inside a search pill). Square corners, hairline `--input` border.
