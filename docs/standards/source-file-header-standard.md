<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Source File Header Standard
Introduction:
Defines the ownership headers required for human-authored FlahaINTEL files.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Source file header standard

## Ownership identity

All newly created human-authored files must identify:

- Owner: Flaha Agri Tech
- Division: Precision Agriculture Division
- Copyright: © 2026–2027 Flaha Agri Tech. All rights reserved.
- Created by: Rafat Al Khashan

Each supported file must also include its title, a brief introduction describing its responsibility, created date, and last modified date. Use the native comment syntax of the file format so the header does not affect execution or rendered content.

## Required templates

### TypeScript and JavaScript

```typescript
/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: <File title>
 * Introduction:
 * <Brief description of the file responsibility.>
 *
 * Created by: Rafat Al Khashan
 * Created date: YYYY-MM-DD
 * Last modified: YYYY-MM-DD
 */
```

### Python

```python
"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: <File title>
Introduction:
<Brief description of the module responsibility.>

Created by: Rafat Al Khashan
Created date: YYYY-MM-DD
Last modified: YYYY-MM-DD
"""
```

### Markdown

```markdown
<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: <Document title>
Introduction:
<Brief description of the document.>

Created by: Rafat Al Khashan
Created date: YYYY-MM-DD
Last modified: YYYY-MM-DD
-->
```

### TOML, YAML, shell, and similar text formats

Use the same required fields with native `#` comments:

```text
# Flaha Agri Tech
# Precision Agriculture Division
# Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
#
# Title: <File title>
# Introduction:
# <Brief description of the file responsibility.>
#
# Created by: Rafat Al Khashan
# Created date: YYYY-MM-DD
# Last modified: YYYY-MM-DD
```

### PowerShell

Use a `<# ... #>` comment block containing the same ownership identity and required fields.

### CSS

Use a `/* ... */` comment block containing the same ownership identity and required fields.

## Application rules

- New human-authored files must comply immediately.
- Existing files do not require bulk modification.
- Do not modify existing files only to add a header unless a dedicated header-standard migration is explicitly approved.
- Do not create noisy commits solely to refresh `Last modified` dates.
- When materially editing an existing owned file that already has the standard header, update its `Last modified` date.
- Package README files must identify the owner, division, creator, and copyright shown above.
- JSON and JSON Schema files must remain valid JSON and must not receive comments.
- Generated files, binaries, lockfiles, database-generated migrations, third-party code, external fixtures, and formats without comment support are exempt.
- Ownership for exempt files may be documented in the containing README where appropriate.
- All future Codex work in this repository must apply this standard automatically.
