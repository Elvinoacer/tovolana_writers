### How to Run or Update from Terminal

    # Generate or update PLATFORM_CODEBASE.md
    npm run codebase:export

    # Or run directly
    ./scripts/export-codebase.ts

    # Export to a custom Markdown path
    npm run codebase:export -- --out docs/SNAPSHOT.md



    ### 2. How to Use the Reusable Script

Resume with -c (or command below):
agy --conversation=c8f1ca7a-4a33-4ea5-8aa7-fe582e74e19a

    You can run the bundler in any terminal session.

    #### Option A: Interactive Mode (Prompt for file)
    Run without arguments and the script will prompt you:
    ```bash
    npm run bundle

    Enter the relative file path to bundle (e.g., app/explore/page.tsx): app/explore/page.tsx

#### Option B: Real-Time Watch Mode (Replaces on every save)

Pass the target path directly as an argument. By default, it watches the entry file and all its imported dependencies in real-time, automatically re-compiling and
replacing one_file_code.md whenever you save changes:

    npm run bundle -- app/explore/page.tsx

(Shorthands like npm run bundle -- app/explore or npm run bundle -- explore also work).

#### Option C: Single Export (No Watch)

If you just want to export once and immediately exit:

    npm run bundle:once -- app/explore/page.tsx

#### Option D: Filter for Components Only

To only include React JSX/TSX subcomponents (skipping backend lib/ modules):

    npm run bundle -- app/explore/page.tsx --components-only
