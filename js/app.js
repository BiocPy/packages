let packagesData = [];
let keywordsData = [];
let activeFilters = new Set();
let searchQuery = '';
let filterLogic = 'AND';
let currentPage = 1;
let itemsPerPage = 20;
let currentSort = 'alphabetical';
let targetPackage = null;
let searchTimeout = null;


function parseURL() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('package')) targetPackage = params.get('package');
}

async function init() {
    try {
        const [packagesResponse, keywordsResponse] = await Promise.all([
            fetch('data/packages.json'),
            fetch('data/keywords.csv')
        ]);

        if (!packagesResponse.ok || !keywordsResponse.ok) {
            throw new Error('Failed to load data');
        }

        packagesData = await packagesResponse.json();
        // Always sort alphabetically by package name
        packagesData.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

        const csvText = await keywordsResponse.text();
        keywordsData = parseCSV(csvText);

        parseURL();
        // Pre-calculate counts to sort keywords from highest to lowest
        const initialTagCounts = {};
        packagesData.forEach(pkg => {
            pkg.keywords.forEach(kw => {
                initialTagCounts[kw] = (initialTagCounts[kw] || 0) + 1;
            });
        });

        // Sort keywords globally by count (desc), then alphabetically
        keywordsData.sort((a, b) => {
            const countA = initialTagCounts[a.keyword] || 0;
            const countB = initialTagCounts[b.keyword] || 0;
            if (countB !== countA) {
                return countB - countA;
            }
            return a.keyword.localeCompare(b.keyword);
        });

        document.getElementById('loader').style.display = 'none';
        document.getElementById('packages-list').style.display = 'flex';

        // Event listeners for search and logic toggle
        document.getElementById('search-input').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchQuery = e.target.value.toLowerCase().trim();
                currentPage = 1;
                renderPackages();
            }, 300);
        });

        const toggleOptions = document.querySelectorAll('.toggle-option');
        toggleOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                // Update UI
                toggleOptions.forEach(opt => opt.classList.remove('active'));
                e.target.classList.add('active');

                // Update Logic
                filterLogic = e.target.getAttribute('data-value');
                currentPage = 1;
                renderPackages();
            });
        });

        document.getElementById('clear-filters-btn').addEventListener('click', () => {
            activeFilters.clear();
            currentPage = 1;
            renderTagStats();
            renderFilters();
            renderPackages();
        });

        renderTagStats();
        renderFilters();
        renderPackages();
    } catch (error) {
        console.error('Error initializing app:', error);
        document.getElementById('package-count').innerText = 'Error loading data';
        document.getElementById('loader').style.display = 'none';
    }
}

function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    // skip header
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const [keyword, ...descParts] = lines[i].split(',');
        if (keyword) {
            result.push({
                keyword: keyword.trim(),
                description: descParts.join(',').trim()
            });
        }
    }
    return result;
}

function renderTagStats() {
    const container = document.getElementById('tag-stats');
    container.innerHTML = '';

    // Calculate counts
    const tagCounts = {};
    packagesData.forEach(pkg => {
        pkg.keywords.forEach(kw => {
            tagCounts[kw] = (tagCounts[kw] || 0) + 1;
        });
    });

    keywordsData.forEach(({ keyword, description }) => {
        const count = tagCounts[keyword] || 0;
        if (count === 0) return; // Hide zero counts if any

        const block = document.createElement('div');
        block.className = 'tag-stat-block';
        block.title = description;
        if (activeFilters.has(keyword)) {
            block.classList.add('active');
        }

        block.innerHTML = `
            <div class="tag-stat-num">${count}</div>
            <div class="tag-stat-name">${keyword}</div>
        `;

        block.addEventListener('click', () => {
            toggleFilter(keyword);
        });

        container.appendChild(block);
    });
}

function toggleFilter(keyword) {
    if (activeFilters.has(keyword)) {
        activeFilters.delete(keyword);
    } else {
        activeFilters.add(keyword);
    }
    currentPage = 1;
    renderTagStats(); // Re-render to update active classes
    renderFilters();  // Re-render pills
    renderPackages();
}

function renderFilters() {
    const filtersContainer = document.getElementById('keyword-filters');
    filtersContainer.innerHTML = '';

    keywordsData.forEach(({ keyword, description }) => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        if (activeFilters.has(keyword)) {
            btn.classList.add('active');
        }
        btn.innerText = keyword;
        btn.title = description;

        btn.addEventListener('click', () => {
            toggleFilter(keyword);
        });

        filtersContainer.appendChild(btn);
    });

    const clearBtn = document.getElementById('clear-filters-btn');
    if (activeFilters.size > 0) {
        clearBtn.style.display = 'block';
    } else {
        clearBtn.style.display = 'none';
    }
}

// Store fetched pypi metadata to avoid re-fetching on filter
const pypiCache = {};

async function fetchPyPIForVisible(visiblePackages) {
    for (const pkg of visiblePackages) {
        if (!pypiCache[pkg.name]) {
            try {
                // BiocPy packages on PyPI are mostly the same name as the github repo, except some might be different, but we try:
                const response = await fetch(`https://pypi.org/pypi/${pkg.name}/json`);
                if (response.ok) {
                    const data = await response.json();
                    let author = data.info.author || data.info.maintainer;
                    if (!author && data.info.author_email) {
                        const emailMatch = data.info.author_email.match(/^([^<]+)\s*</);
                        if (emailMatch) {
                            author = emailMatch[1].trim();
                        } else {
                            author = data.info.author_email.trim();
                        }
                    }

                    pypiCache[pkg.name] = {
                        version: data.info.version || 'v?',
                        author: author || 'BiocPy'
                    };
                    // Update DOM element directly if it exists
                    const versionEl = document.getElementById(`pypi-version-${pkg.name}`);
                    const authorEl = document.getElementById(`pypi-author-${pkg.name}`);
                    if (versionEl) {
                        versionEl.innerHTML = `
                            <a href="https://pypi.org/project/${pkg.name}/" target="_blank" class="pypi-link hover-link" onclick="event.stopPropagation()">
                                <i data-feather="tag" width="12" height="12"></i> ${pypiCache[pkg.name].version}
                            </a>
                            <button class="copy-install-btn" onclick="copyInstallCommand('pip install ${pkg.name}', this); event.stopPropagation();" title="Copy pip install command">
                                <i data-feather="clipboard" width="12" height="12"></i>
                            </button>
                        `;
                    }
                    if (authorEl) authorEl.innerHTML = `<i data-feather="user" width="12" height="12"></i> ${pypiCache[pkg.name].author}`;
                    if (window.feather) window.feather.replace();
                }
            } catch (e) {
                console.warn(`Could not fetch PyPI data for ${pkg.name}`);
            }
        }
    }
}

function renderPackages() {
        const listContainer = document.getElementById('packages-list');
    const noResults = document.getElementById('no-results');
    const countDisplay = document.getElementById('package-count');

    listContainer.innerHTML = '';

    // Filter packages based on active keywords and search query
    const filteredPackages = packagesData.filter(pkg => {
        // 1. Text Search Filter
        if (searchQuery) {
            const matchName = pkg.name.toLowerCase().includes(searchQuery);
            const matchDesc = pkg.description.toLowerCase().includes(searchQuery);
            if (!matchName && !matchDesc) {
                return false;
            }
        }

        // 2. Keyword Filter
        if (activeFilters.size === 0) return true;

        if (filterLogic === 'AND') {
            // MUST have ALL active keywords
            for (const activeKw of activeFilters) {
                if (!pkg.keywords.includes(activeKw)) {
                    return false;
                }
            }
            return true;
        } else {
            // MUST have ANY of the active keywords
            for (const activeKw of activeFilters) {
                if (pkg.keywords.includes(activeKw)) {
                    return true;
                }
            }
            return false;
        }
    });

    countDisplay.innerText = `Showing ${filteredPackages.length} package${filteredPackages.length !== 1 ? 's' : ''}`;

    const paginationContainer = document.getElementById('pagination-controls');

    if (filteredPackages.length === 0) {
        listContainer.style.display = 'none';
        noResults.style.display = 'block';
        paginationContainer.style.display = 'none';
        return;
    }

    // Apply Sorting
    filteredPackages.sort((a, b) => {
        if (currentSort === 'core') {
            const aCore = a.keywords.includes('core');
            const bCore = b.keywords.includes('core');
            if (aCore && !bCore) return -1;
            if (!aCore && bCore) return 1;
            return a.name.localeCompare(b.name);
        } else {
            // Default: alphabetical
            return a.name.localeCompare(b.name);
        }
    });

    // Check if we need to force pagination to a specific package
    if (targetPackage) {
        const pkgIndex = filteredPackages.findIndex(p => p.name.toLowerCase() === targetPackage.toLowerCase());
        if (pkgIndex !== -1 && itemsPerPage !== 'all') {
            currentPage = Math.floor(pkgIndex / itemsPerPage) + 1;
        }
    }

    listContainer.style.display = 'flex';
    noResults.style.display = 'none';

    // Pagination slicing
    let packagesToRender = filteredPackages;
    if (itemsPerPage !== 'all') {
        const startIndex = (currentPage - 1) * itemsPerPage;
        packagesToRender = filteredPackages.slice(startIndex, startIndex + itemsPerPage);
    }

    packagesToRender.forEach(pkg => {
        const row = document.createElement('div');
        row.className = 'package-row';
        row.id = `pkg-${pkg.name.toLowerCase()}`;

        // Toggle expanded view (for install command)
        row.addEventListener('click', (e) => {
            // Prevent expanding if clicking on a link or button
            if (e.target.closest('a') || e.target.closest('button')) return;
            
            // Collapse any other currently expanded row
            const currentlyExpanded = document.querySelector('.package-row.expanded');
            if (currentlyExpanded && currentlyExpanded !== row) {
                currentlyExpanded.classList.remove('expanded');
            }

            const isExpanded = row.classList.toggle('expanded');
            
            // Sync active state to URL
            const url = new URL(window.location);
            if (isExpanded) {
                url.searchParams.set('package', pkg.name);
            } else {
                url.searchParams.delete('package');
            }
            window.history.replaceState({}, '', url);
        });

        const keywordsHtml = pkg.keywords.map(kw => {
            const extraClass = kw === 'core' ? ' core-tag' : '';
            return `<span class="keyword-tag${extraClass}">${kw}</span>`;
        }).join('');

        const pypiData = pypiCache[pkg.name] || { version: '...', author: '...' };

        let testsBadgeHtml = '';
        if (pkg.tests_url) {
            // Extract owner/repo from github_url
            const ownerRepo = pkg.github_url.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
            // Extract the workflow filename from tests_url (e.g. run-tests.yml or pypi-test.yml)
            let workflowName = 'run-tests.yml'; // fallback
            const match = pkg.tests_url.match(/workflows\/([^/?#]+)/);
            if (match) workflowName = match[1];

            testsBadgeHtml = `
            <a href="${pkg.tests_url}" target="_blank" rel="noopener noreferrer" class="icon-link" style="width:auto; padding: 0 4px; background:transparent;" title="Tests" onclick="event.stopPropagation()">
                <img src="https://img.shields.io/github/actions/workflow/status/${ownerRepo}/${workflowName}?label=tests&style=flat-square" alt="Tests" class="github-badge" onerror="this.style.display='none'">
            </a>`;
        }

        let doiHtml = '';
        if (pkg.doi) {
            doiHtml = `
            <a href="${pkg.doi}" target="_blank" rel="noopener noreferrer" class="icon-link" title="View Publication (DOI)" onclick="event.stopPropagation()">
                <i data-feather="book-open" width="16" height="16"></i>
            </a>`;
        }

        let docsHtml = '';
        if (pkg.docs_url) {
            docsHtml = `<a href="${pkg.docs_url}" target="_blank" rel="noopener noreferrer" class="icon-link" title="Documentation" onclick="event.stopPropagation()"><i data-feather="book" width="16" height="16"></i></a>`;
        } else {
            docsHtml = `<span class="icon-link disabled" title="No Documentation Available"><i data-feather="book" width="16" height="16"></i></span>`;
        }

        row.innerHTML = `
            <div class="package-row-header">
                <div class="package-title">
                    ${pkg.name}
                    ${pkg.in_biocpy_environments ? `<span class="env-badge" title="Included in BiocPy Environments"><i data-feather="check-circle" width="10" height="10"></i> Env</span>` : ''}
                </div>
                <div class="package-pypi-meta" id="pypi-version-${pkg.name}">
                    <a href="https://pypi.org/project/${pkg.name}/" target="_blank" class="pypi-link hover-link" onclick="event.stopPropagation()">
                        <i data-feather="tag" width="12" height="12"></i> ${pypiData.version}
                    </a>
                    <button class="copy-install-btn" onclick="copyInstallCommand('pip install ${pkg.name}', this); event.stopPropagation();" title="Copy pip install command">
                        <i data-feather="clipboard" width="12" height="12"></i>
                    </button>
                </div>
                <div class="package-pypi-meta" id="pypi-author-${pkg.name}">
                    <i data-feather="user" width="12" height="12"></i> ${pypiData.author}
                </div>
                <div class="package-keywords">
                    ${keywordsHtml}
                </div>
                <div class="package-links">
                    ${testsBadgeHtml}
                    ${doiHtml}
                    ${docsHtml}
                    <a href="${pkg.github_url}" target="_blank" rel="noopener noreferrer" class="icon-link" title="View Source Code" onclick="event.stopPropagation()">
                        <i data-feather="github" width="16" height="16"></i>
                    </a>
                </div>
            </div>
            <div class="package-desc">${pkg.description}</div>
            <div class="package-install-cmd">
                <div class="install-cmd-box">
                    <code>pip install ${pkg.name}</code>
                    <button class="copy-cmd-btn" onclick="copyInstallCommand('pip install ${pkg.name}', this); event.stopPropagation();" title="Copy">
                        <i data-feather="clipboard" width="14" height="14"></i>
                    </button>
                </div>
            </div>
        `;

        listContainer.appendChild(row);
    });

    // Re-initialize feather icons for newly added elements
    if (window.feather) {
        window.feather.replace();
    }
    
    renderPagination(filteredPackages.length);
    fetchPyPIForVisible(packagesToRender);
    
    // Scroll and highlight target package
    if (targetPackage) {
        // Need to wrap in setTimeout to ensure DOM has fully painted
        setTimeout(() => {
            const targetRow = document.getElementById(`pkg-${targetPackage.toLowerCase()}`);
            if (targetRow) {
                targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetRow.classList.add('expanded');
                targetRow.classList.add('highlight-pulse');
                
                // Remove highlight class after animation finishes (2s)
                setTimeout(() => {
                    targetRow.classList.remove('highlight-pulse');
                }, 2000);
            }
            // Clear target package so it doesn't trigger on subsequent paginations
            targetPackage = null;
                    }, 100);
    }
}

function renderPagination(totalItems) {
    const paginationContainer = document.getElementById('pagination-controls');
    
    if (itemsPerPage === 'all' || totalItems <= itemsPerPage) {
        paginationContainer.style.display = 'none';
        return;
    }

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    paginationContainer.style.display = 'flex';

    let html = `<div class="pagination-buttons">`;
    
    // Prev button
    html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">Prev</button>`;

    // Page numbers
    // Show a window of pages for very large lists
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="changePage(1)">1</button>`;
        if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
        html += `<button class="pagination-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }

    // Next button
    html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Next</button>`;
    html += `</div>`;

    // Items per page selector
    html += `
        <div class="items-per-page">
            <label for="per-page-select">Per page:</label>
            <select id="per-page-select" class="per-page-select" onchange="changeItemsPerPage(this.value)">
                <option value="10" ${itemsPerPage === 10 ? 'selected' : ''}>10</option>
                <option value="20" ${itemsPerPage === 20 ? 'selected' : ''}>20</option>
                <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                <option value="all" ${itemsPerPage === 'all' ? 'selected' : ''}>All</option>
            </select>
        </div>
    `;

    paginationContainer.innerHTML = html;
}

window.changePage = function(page) {
    currentPage = page;
    renderPackages();
    // Smooth scroll back to top of the package list
    document.querySelector('.controls-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.changeItemsPerPage = function(val) {
    itemsPerPage = val === 'all' ? 'all' : parseInt(val, 10);
    currentPage = 1;
    renderPackages();
};

// Global copy to clipboard function
window.copyInstallCommand = function (text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = `<i data-feather="check" width="12" height="12" style="color: #10b981;"></i>`;
        if (window.feather) window.feather.replace();

        setTimeout(() => {
            btnElement.innerHTML = originalHtml;
            if (window.feather) window.feather.replace();
        }, 2000);
    });
}

document.addEventListener('DOMContentLoaded', init);
