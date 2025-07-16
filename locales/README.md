# Localization File Organization

Localization files have been reorganized by logical categories to improve maintainability and facilitate the addition of new translations.

## Supported Languages

The application currently supports the following languages:

- **English** (`en.json`) - Default language
- **Italian** (`it.json`) - Italiano
- **French** (`fr.json`) - Français
- **Spanish** (`es.json`) - Español  
- **German** (`de.json`) - Deutsch
- **Portuguese** (`pt.json`) - Português
- **Japanese** (`ja.json`) - 日本語
- **Russian** (`ru.json`) - Русский
- **Dutch** (`nl.json`) - Nederlands

## Structure

### 1. **Common & General**
Common terms used throughout the application:
- `ok`, `cancel`, `confirm`, `success`, `error`, `info`
- `loading`, `refreshing`, `back`, `goBack`
- `change`, `remove`, `delete`, `retry`, `notNow`

### 2. **Authentication & Login**
Everything related to authentication:
- Login/logout, username/password
- Error and success messages
- Connection verification and permissions
- Access denied

### 3. **Server Configuration**
RomM server configuration:
- Server URL and hints
- Connection configuration

### 4. **Navigation & UI**
Main navigation elements:
- App sections: Library, Platforms, Settings, Downloads
- Collection and Custom Collections

### 5. **Games & ROMs**
Everything related to games and ROMs:
- Game details, platforms
- Information (description, size, path)
- States and error messages
- Labels (NEW, HOT, RECENT)

### 6. **Collections**
Collection management:
- Loading and errors
- Collection types (franchise, genre, company, mode)

### 7. **Downloads**
Download system:
- Download states (pending, downloading, completed, failed, etc.)
- Actions (pause, resume, cancel, retry)
- Confirmation and error messages
- Download queue

### 8. **File Management**
File management:
- Existing file verification
- File deletion and verification
- Success/error messages for file operations

### 9. **Folder Management**
Folder management:
- Folder selection and configuration
- Platform folders
- Error and success messages
- Selection dialogs

### 10. **Settings - ROMs Folder**
Specific settings for the ROMs folder:
- Main ROMs folder configuration
- Descriptions and confirmations

### 11. **Settings - Platform Folders**
Settings for platform folders:
- Platform-specific folder configuration
- Addition, removal, confirmations
- Removal of all folders

### 12. **Settings - Other**
Other settings:
- Placeholder for future options

### 13. **Permissions**
Permission management:
- Permissions not granted
- Error messages for permissions

## Best Practices

### Adding New Languages

To add a new language to the localization system:

1. **Create the language file**: Copy an existing file (e.g., `en.json`) and rename it using the ISO 639-1 language code (e.g., `zh.json` for Chinese)
2. **Translate all keys**: Ensure all translation keys are properly translated while maintaining the same structure
3. **Preserve placeholders**: Keep interpolation variables like `{{username}}`, `{{count}}`, `{{platform}}` exactly as they are
4. **Test formatting**: Verify that text fits well in UI components, especially for languages with longer/shorter text
5. **Update documentation**: Add the new language to the "Supported Languages" section above
6. **Configure app**: Update the app's language detection/selection logic to include the new language

### Translation Guidelines

- **Maintain context**: Consider the UI context when translating (button text should be concise, error messages should be clear)
- **Cultural adaptation**: Adapt content to local conventions where appropriate
- **Consistency**: Use consistent terminology throughout the app (e.g., always use the same word for "ROM" or "Platform")
- **Pluralization**: Pay attention to plural forms, especially for count-based messages
- **Technical terms**: Some technical terms like "ROM", "URL" may remain untranslated depending on local conventions

### Adding New Translations

1. **Identify the category**: Find the most appropriate section for the new string
2. **Use descriptive names**: Key names should be self-explanatory
3. **Maintain consistency**: Use similar conventions to existing ones
4. **Add to all files**: Always add new keys to all language files
5. **Test translations**: Verify they work in the app context

### Naming Conventions

- **Actions**: `confirmDelete`, `downloadAll`, `selectFolder`
- **States**: `downloading`, `completed`, `failed`
- **Messages**: `errorDuringDownload`, `successMessage`
- **Titles**: `platformFolderTitle`, `changeFolderTitle`
- **Descriptions**: `platformFoldersDescription`
- **Collection types**: `collectiontype_*`

### Maintenance

- Maintain alphabetical order within each category
- Regularly check for duplicates
- Remove unused strings
- Document new categories if necessary

## Supported Files

- `it.json` - Italian
- `en.json` - English

Translations are automatically loaded by the `useTranslation` hook.