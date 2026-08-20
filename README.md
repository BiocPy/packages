# BiocPy Packages Discovery

This is a simple web application designed to help users discover and explore Python packages built for the BiocPy ecosystem. 

The application is completely static and built with Vanilla JavaScript, HTML, and CSS. It reads package information from a simple JSON file and filters from a CSV file. The site is automatically published via GitHub Actions to GitHub Pages.

## How to add or update a package

We welcome contributions from the community! If you have created or know of a package that should be part of the BiocPy ecosystem, you can add it to this directory.

To update the list of packages:

1. **Fork the repository** to your own GitHub account.
2. **Edit `data/packages.json`**:
   Add a new JSON object to the list. Please ensure the keys match exactly.
   ```json
   {
     "name": "YourPackageName",
     "description": "A short, concise description of your package.",
     "github_url": "https://github.com/YourOrg/YourPackageName",
     "keywords": ["core", "utilities"],
     "tests_url": "https://github.com/YourOrg/YourPackageName/actions"
   }
   ```
   *Note: You can specify up to 3 keywords per package. Ensure that your keywords are already present in `data/keywords.csv`.*
3. **Commit and Push**: Commit your changes to your fork.
4. **Create a Pull Request**: Submit a Pull Request back to this repository. Once reviewed and merged into the `main` branch, the GitHub Action will automatically redeploy the updated website!

## Adding new keywords

If your package doesn't fit into any of the existing categories, you can propose a new keyword:

1. Open `data/keywords.csv`.
2. Add a new line at the bottom with your keyword and a brief description:
   ```csv
   your-new-keyword,Brief description of what this category means
   ```
3. Use the new keyword in your package entry in `data/packages.json`.

## Local Development

If you want to run the web application locally to test your changes:

1. Clone the repository.
2. Open a terminal in this directory.
3. Start a local HTTP server:
   ```bash
   python -m http.server 8000
   ```
4. Open your browser and navigate to `http://localhost:8000`.
