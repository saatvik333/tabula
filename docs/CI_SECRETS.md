# CI Secrets for Automated Releases

To automate signing/publishing on GitHub Releases, add these repository secrets:

## Firefox AMO signing (optional)
- AMO_JWT_ISSUER: Your AMO API key (issuer)
- AMO_JWT_SECRET: Your AMO API secret

The workflow uses `web-ext sign` to sign the build in `dist/`. Ensure your manifest has `browser_specific_settings.gecko.id` set to your add-on ID, or let AMO assign one on the first manual upload.

## Chrome Web Store publish (optional)
- CHROME_CLIENT_ID
- CHROME_CLIENT_SECRET
- CHROME_REFRESH_TOKEN
- CHROME_EXTENSION_ID

The workflow uses `chrome-webstore-upload-cli` to upload and publish the zip named `tabula-${version}-chrome.zip`.

## Notes
- The workflow triggers on tag push and on GitHub Release published. On release, it will attach packaged zips to the Release automatically.
- Without secrets, the pipeline still builds and uploads artifacts; signing/publishing steps are skipped.
- Bump `version` in `manifest.json` before creating a release tag.
