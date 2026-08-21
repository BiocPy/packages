import json
import csv
import sys

def main():
    errors = []

    # Load valid keywords
    valid_keywords = set()
    try:
        with open('data/keywords.csv', 'r') as f:
            reader = csv.reader(f)
            for row in reader:
                if row:
                    valid_keywords.add(row[0].strip())
    except Exception as e:
        print(f"Error reading keywords.csv: {e}")
        sys.exit(1)

    # Load packages
    try:
        with open('data/packages.json', 'r') as f:
            packages = json.load(f)
    except Exception as e:
        print(f"Error reading packages.json: {e}")
        sys.exit(1)

    required_keys = {'name', 'description', 'github_url', 'keywords'}
    valid_keys = required_keys.union({'tests_url', 'docs_url', 'doi', 'in_biocpy_environments'})

    for i, pkg in enumerate(packages):
        pkg_name = pkg.get('name', f"Package at index {i}")

        # Check required keys
        missing = required_keys - set(pkg.keys())
        if missing:
            errors.append(f"{pkg_name}: Missing required keys: {missing}")
        
        # Check for invalid keys
        invalid = set(pkg.keys()) - valid_keys
        if invalid:
            errors.append(f"{pkg_name}: Contains invalid keys: {invalid}")

        # Check keywords
        keywords = pkg.get('keywords', [])
        if not isinstance(keywords, list):
            errors.append(f"{pkg_name}: 'keywords' must be a list of strings")
        else:
            for kw in keywords:
                if kw not in valid_keywords:
                    errors.append(f"{pkg_name}: Invalid keyword '{kw}'. Must be one of the keywords defined in keywords.csv")
            if len(keywords) > 3:
                print(f"Warning: {pkg_name} has more than 3 keywords ({len(keywords)}). Maximum 3 recommended.")

    if errors:
        print("Validation Failed:")
        for err in errors:
            print(f" - {err}")
        sys.exit(1)
    else:
        print("Validation Passed! All packages and keywords are correctly formatted.")

if __name__ == "__main__":
    main()
