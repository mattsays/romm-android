import json
import sys

# Load English file as reference
with open('en.json', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

en_keys = set(en_data.keys())

# Check each locale file
all_complete = True
for locale in ['de.json', 'es.json', 'fr.json', 'it.json', 'ja.json', 'nl.json', 'pt.json', 'ru.json']:
    try:
        with open(locale, 'r', encoding='utf-8') as f:
            locale_data = json.load(f)
        
        locale_keys = set(locale_data.keys())
        missing_keys = en_keys - locale_keys
        
        if missing_keys:
            print(f'{locale} still missing keys:')
            for key in sorted(missing_keys):
                print(f'  {key}')
            all_complete = False
        else:
            print(f'{locale} ✓ Complete')
    except Exception as e:
        print(f'Error reading {locale}: {e}')
        all_complete = False

if all_complete:
    print('\\n🎉 All locale files are now complete!')
else:
    print('\\n❌ Some locale files still have missing keys.')