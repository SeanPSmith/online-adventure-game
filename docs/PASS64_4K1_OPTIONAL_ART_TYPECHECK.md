# Pass 64.4K.1 — Optional Demo Artwork Build Hotfix

Cause: The Pass 64.4J `InkspaceReaderLab.tsx` accesses `READER_DEMO.art.src`, `.alt`, and `.caption` even though the `ReaderDocument.art` field is optional. Pass 64.4K integrates the existing component and exposes this error during the project build.

Correction: In `ManuscriptLeaf`, narrow the optional illustration into `const artwork = leaf.art ? READER_DEMO.art : undefined` and render a figure only when it exists; every nested property access uses the narrowed object. Demo pagination, CSS, story and gameplay code are unchanged. No test contracts were weakened.

Install this overlay after Pass 64.4K. Run `./scripts/check-project.sh` from the project root before deploying. Verify both a sample spread with art and a spread without art; only illustrative spreads should show a `<figure>`.
