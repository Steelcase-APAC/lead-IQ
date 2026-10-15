// Steelcase APAC Lease-IQ - Sales Radar & Executive Dashboard Controller
// 10 Core Capabilities, Dual-Layer Parser Support, and PlannerHub Minimalist Outlines

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================
  // 1. APPLICATION STATE
  // =========================================================
  const state = {
    theme: localStorage.getItem('cre_theme') || 'light',
    activeView: 'analytics', // 'analytics' (default home page) | 'radar' | 'scoping' | 'relationship' | 'tracker' | 'hubs' | 'coverage'
    activeCountry: 'ALL',
    radarViewMode: 'table', // 'table' (default in Sales Radar) | 'card'
    radarSort: 'heat', // 'heat' | 'recency' | 'size' | 'company'
    analyticsTimelineMode: 'deal', // 'deal' | 'found'
    analyticsHubMetric: 'deals', // 'deals' | 'sqft'
    filters: {
      search: '',
      submarket: 'ALL',
      dealType: 'ALL',
      window: 'ALL',
      sizeTier: 'ALL',
      status: 'ALL'
    },
    leads: (typeof window !== 'undefined' && Array.isArray(window.INITIAL_LEADS_DATA) && window.INITIAL_LEADS_DATA.length) 
           ? [...window.INITIAL_LEADS_DATA] 
           : (typeof INITIAL_LEADS_DATA !== 'undefined' && Array.isArray(INITIAL_LEADS_DATA) ? [...INITIAL_LEADS_DATA] : []),
    filteredLeads: [],
    tracker: (typeof window !== 'undefined' && Array.isArray(window.INITIAL_TRACKER_DATA) && window.INITIAL_TRACKER_DATA.length)
           ? [...window.INITIAL_TRACKER_DATA]
           : (typeof INITIAL_TRACKER_DATA !== 'undefined' && Array.isArray(INITIAL_TRACKER_DATA) ? [...INITIAL_TRACKER_DATA] : []),
    filteredTracker: [],
    snapshots: (typeof window !== 'undefined' && Array.isArray(window.INITIAL_SNAPSHOTS_DATA) && window.INITIAL_SNAPSHOTS_DATA.length)
           ? [...window.INITIAL_SNAPSHOTS_DATA]
           : (typeof INITIAL_SNAPSHOTS_DATA !== 'undefined' && Array.isArray(INITIAL_SNAPSHOTS_DATA) ? [...INITIAL_SNAPSHOTS_DATA] : []),
    sources: (typeof window !== 'undefined' && Array.isArray(window.INITIAL_SOURCES_DATA) && window.INITIAL_SOURCES_DATA.length)
           ? [...window.INITIAL_SOURCES_DATA]
           : (typeof INITIAL_SOURCES_DATA !== 'undefined' && Array.isArray(INITIAL_SOURCES_DATA) ? [...INITIAL_SOURCES_DATA] : []),
    metrics: (typeof window !== 'undefined' && window.INITIAL_METRICS && Object.keys(window.INITIAL_METRICS).length)
           ? window.INITIAL_METRICS
           : (typeof INITIAL_METRICS !== 'undefined' ? INITIAL_METRICS : {}),
    userStatuses: JSON.parse(localStorage.getItem('cre_user_statuses') || '{}'),
    userNotes: JSON.parse(localStorage.getItem('cre_user_notes') || '{}'),
    charts: {},
    activeDossierCompany: null
  };

  // If leads empty on init, immediately auto-fetch from /api/sync
  if (state.leads.length === 0) {
    fetch('/api/sync')
      .then(res => res.json())
      .then(data => {
        if (data && data.leads && data.leads.length > 0) {
          state.leads = data.leads;
          state.tracker = data.tracker || state.tracker;
          state.snapshots = data.snapshots || state.snapshots;
          state.sources = data.sources || state.sources;
          state.metrics = data.metrics || state.metrics;
          applyUserOverrides();
          populateSubmarketsDropdown();
          filterAndSortLeads();
        }
      })
      .catch(err => console.warn('Sync fallback error:', err));
  }

  // Apply user status overrides to leads and tracker
  function applyUserOverrides() {
    state.leads.forEach(lead => {
      const customStatus = state.userStatuses[lead.company];
      if (customStatus) {
        lead.trackerStatus = customStatus;
        // Recalculate heat score modifier
        const baseScore = lead.heatScore - (lead.heatScoreBreakdown ? lead.heatScoreBreakdown.statusPts : 0);
        let newStatusPts = 5;
        let newStatusReason = 'Monitored account (+5)';
        if (customStatus === 'Active') {
          newStatusPts = 15;
          newStatusReason = 'Active sales priority (+15)';
        } else if (customStatus === 'Engaged') {
          newStatusPts = -20;
          newStatusReason = 'Already in active sales discussions (-20)';
        }
        lead.heatScore = Math.max(0, Math.min(100, baseScore + newStatusPts));
        if (lead.heatScoreBreakdown) {
          lead.heatScoreBreakdown.statusPts = newStatusPts;
          lead.heatScoreBreakdown.statusReason = newStatusReason;
          lead.heatScoreBreakdown.totalScore = lead.heatScore;
        }
      }
      if (state.userNotes[lead.company]) {
        lead.trackerNotes = state.userNotes[lead.company];
      }
    });

    state.tracker.forEach(t => {
      if (state.userStatuses[t.company]) {
        t.status = state.userStatuses[t.company];
      }
      if (state.userNotes[t.company]) {
        t.notes = state.userNotes[t.company];
      }
    });
  }
  applyUserOverrides();

  // =========================================================
  // 2. DOM ELEMENT REFERENCES
  // =========================================================
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const btnSyncRefresh = document.getElementById('btnSyncRefresh');
  const syncIcon = document.getElementById('syncIcon');
  const syncTimestamp = document.getElementById('syncTimestamp');
  const btnExportCsv = document.getElementById('btnExportCsv');

  // Navigation
  const countrySelect = document.getElementById('countrySelect');
  const headerMarketFlag = document.getElementById('headerMarketFlag');
  const tabAnalyticsBtn = document.getElementById('tabAnalyticsBtn');
  const navRadarDropdownWrap = document.getElementById('navRadarDropdownWrap');
  const tabRadarDropdownBtn = document.getElementById('tabRadarDropdownBtn');
  const radarDropdownIcon = document.getElementById('radarDropdownIcon');
  const radarDropdownLabel = document.getElementById('radarDropdownLabel');
  const radarDropdownBadge = document.getElementById('radarDropdownBadge');
  const navRadarDropdownMenu = document.getElementById('navRadarDropdownMenu');
  const dropCountAll = document.getElementById('dropCountAll');
  const dropCount060 = document.getElementById('dropCount060');
  const dropCount1Yr = document.getElementById('dropCount1Yr');
  const dropCount2Yr = document.getElementById('dropCount2Yr');
  const dropCount3Yr = document.getElementById('dropCount3Yr');
  const tabTrackerBtn = document.getElementById('tabTrackerBtn');
  const tabHubsBtn = document.getElementById('tabHubsBtn');
  const tabCoverageBtn = document.getElementById('tabCoverageBtn');
  const tabTrackerCount = document.getElementById('tabTrackerCount');
  const tabHubsCount = document.getElementById('tabHubsCount');

  // Views
  const viewRadar = document.getElementById('viewRadar');
  const viewAnalytics = document.getElementById('viewAnalytics');
  const viewTracker = document.getElementById('viewTracker');
  const viewHubs = document.getElementById('viewHubs');
  const viewCoverage = document.getElementById('viewCoverage');
  const radarViewHeading = document.getElementById('radarViewHeading');

  // Scorecards
  const kpiUniqueCompanies = document.getElementById('kpiUniqueCompanies');
  const kpiCompaniesSub = document.getElementById('kpiCompaniesSub');
  const kpiTotalSqFt = document.getElementById('kpiTotalSqFt');
  const kpiHighPriority = document.getElementById('kpiHighPriority');
  const kpiHighPriorityBar = document.getElementById('kpiHighPriorityBar');
  const kpiHighPrioritySub = document.getElementById('kpiHighPrioritySub');
  const kpiMultiTenantHubs = document.getElementById('kpiMultiTenantHubs');
  const kpiActiveMarkets = document.getElementById('kpiActiveMarkets');
  const kpiMarketBreakdown = document.getElementById('kpiMarketBreakdown');

  // Filter Bar
  const globalSearchInput = document.getElementById('globalSearchInput');
  const filterSubmarket = document.getElementById('filterSubmarket');
  const filterDealType = document.getElementById('filterDealType');
  const filterWindow = document.getElementById('filterWindow');
  const filterSizeTier = document.getElementById('filterSizeTier');
  const filterStatus = document.getElementById('filterStatus');
  const btnResetFilters = document.getElementById('btnResetFilters');

  // Radar Controls & Containers
  const radarVisibleCount = document.getElementById('radarVisibleCount');
  const radarTotalCount = document.getElementById('radarTotalCount');
  const activeFilterBadge = document.getElementById('activeFilterBadge');
  const radarSortSelect = document.getElementById('radarSortSelect');
  const btnRadarCardView = document.getElementById('btnRadarCardView');
  const btnRadarTableView = document.getElementById('btnRadarTableView');
  const radarCardsGrid = document.getElementById('radarCardsGrid');
  const radarTableContainer = document.getElementById('radarTableContainer');
  const radarTableBody = document.getElementById('radarTableBody');
  const radarEmptyState = document.getElementById('radarEmptyState');

  // Analytics Controls & Chart Canvases
  const btnTimelineDealDate = document.getElementById('btnTimelineDealDate');
  const btnTimelineFoundDate = document.getElementById('btnTimelineFoundDate');
  const chartTimelineTitle = document.getElementById('chartTimelineTitle');
  const chartTimelineSub = document.getElementById('chartTimelineSub');
  const btnHubDeals = document.getElementById('btnHubDeals');
  const btnHubSqft = document.getElementById('btnHubSqft');
  const timelineCanvas = document.getElementById('timelineChart');
  const submarketCanvas = document.getElementById('submarketChart');
  const dealTypeCanvas = document.getElementById('dealTypeChart');
  const sizeHistogramCanvas = document.getElementById('sizeHistogramChart');

  // Tracker Elements
  const kpiTrackerTotal = document.getElementById('kpiTrackerTotal');
  const kpiTrackerActive = document.getElementById('kpiTrackerActive');
  const kpiTrackerWatch = document.getElementById('kpiTrackerWatch');
  const kpiTrackerEngaged = document.getElementById('kpiTrackerEngaged');
  const deltaFeedCount = document.getElementById('deltaFeedCount');
  const deltaFeedList = document.getElementById('deltaFeedList');
  const trackerTableBody = document.getElementById('trackerTableBody');

  // Hubs Elements
  const hubsCountPill = document.getElementById('hubsCountPill');
  const hubsCatalogGrid = document.getElementById('hubsCatalogGrid');

  // Coverage Elements
  const gaugeBuildingRate = document.getElementById('gaugeBuildingRate');
  const gaugeBuildingBar = document.getElementById('gaugeBuildingBar');
  const gaugeSizeRate = document.getElementById('gaugeSizeRate');
  const gaugeSizeBar = document.getElementById('gaugeSizeBar');
  const gaugeTypeRate = document.getElementById('gaugeTypeRate');
  const gaugeTypeBar = document.getElementById('gaugeTypeBar');
  const gaugeSourcesCount = document.getElementById('gaugeSourcesCount');
  const sourcesSearchInput = document.getElementById('sourcesSearchInput');
  const sourcesTableBody = document.getElementById('sourcesTableBody');

  // Dossier Modal Elements
  const company360Modal = document.getElementById('company360Modal');
  const modal360CloseBtn = document.getElementById('modal360CloseBtn');
  const dossierCompanyTitle = document.getElementById('dossierCompanyTitle');
  const dossierMarketSub = document.getElementById('dossierMarketSub');
  const dossierStatusBadge = document.getElementById('dossierStatusBadge');
  const dossierCountryBadge = document.getElementById('dossierCountryBadge');
  const dossierSectorBadge = document.getElementById('dossierSectorBadge');
  const dossierHeatScoreBadge = document.getElementById('dossierHeatScoreBadge');
  const dossierPitchText = document.getElementById('dossierPitchText');
  const btnCopyDossierPitch = document.getElementById('btnCopyDossierPitch');
  const dossierDealsCount = document.getElementById('dossierDealsCount');
  const dossierDealsList = document.getElementById('dossierDealsList');
  const dossierSnapshotsCount = document.getElementById('dossierSnapshotsCount');
  const dossierSnapshotsList = document.getElementById('dossierSnapshotsList');
  const dossierStatusSelect = document.getElementById('dossierStatusSelect');
  const dossierNotesInput = document.getElementById('dossierNotesInput');
  const btnSaveDossierNotes = document.getElementById('btnSaveDossierNotes');

  const toastContainer = document.getElementById('toastContainer');

  // =========================================================
  // 3. THEME MANAGEMENT
  // =========================================================
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    themeIcon.textContent = t === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('cre_theme', t);
    // Refresh chart theme
    if (state.charts.timeline) renderAllCharts();
  }
  applyTheme(state.theme);
  themeToggleBtn.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.theme);
  });

  // Toast Notification Helper
  function showToast(message, icon = '✓') {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  // Country Flag helper
  const COUNTRY_FLAGS = {
    'China': '🇨🇳', 'India': '🇮🇳', 'Japan': '🇯🇵', 'Korea': '🇰🇷',
    'South Korea': '🇰🇷', 'Malaysia': '🇲🇾', 'Sri Lanka': '🇱🇰', 'ALL': '🌐'
  };

  // =========================================================
  // 4. FILTERING & SEARCH ENGINE
  // =========================================================
  function populateSubmarketsDropdown() {
    const marketLeads = state.activeCountry === 'ALL'
      ? state.leads
      : state.leads.filter(l => l.country === state.activeCountry);

    const submarkets = new Set();
    marketLeads.forEach(l => {
      if (l.submarket && l.submarket !== 'ALL') submarkets.add(l.submarket);
      if (l.city && l.city !== l.country) submarkets.add(l.city);
    });

    const sorted = Array.from(submarkets).sort();
    const currentVal = filterSubmarket.value;
    filterSubmarket.innerHTML = '<option value="ALL">All Submarkets & Hubs</option>';
    sorted.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      filterSubmarket.appendChild(opt);
    });

    if (sorted.includes(currentVal)) {
      filterSubmarket.value = currentVal;
    } else {
      filterSubmarket.value = 'ALL';
      state.filters.submarket = 'ALL';
    }
  }

  function filterAndSortLeads() {
    const query = state.filters.search.toLowerCase().trim();
    const selSubmarket = state.filters.submarket;
    const selDealType = state.filters.dealType;
    const selWindow = state.filters.window;
    const selSizeTier = state.filters.sizeTier;
    const selStatus = state.filters.status;

    state.filteredLeads = state.leads.filter(lead => {
      // 1. Country Filter
      if (state.activeCountry !== 'ALL' && lead.country !== state.activeCountry) {
        return false;
      }

      // 2. Search Query
      if (query) {
        const hay = `${lead.company} ${lead.building || ''} ${lead.market || ''} ${lead.submarket || ''} ${lead.city || ''} ${lead.signal || ''} ${lead.sector || ''} ${lead.dealType || ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }

      // 3. Submarket Filter
      if (selSubmarket !== 'ALL') {
        const subMatch = (lead.submarket && lead.submarket.toLowerCase() === selSubmarket.toLowerCase()) ||
                         (lead.city && lead.city.toLowerCase() === selSubmarket.toLowerCase());
        if (!subMatch) return false;
      }

      // 4. Deal Type Filter
      if (selDealType !== 'ALL' && lead.dealType !== selDealType) {
        return false;
      }

      // 5. Fit-out Window Filter
      if (selWindow !== 'ALL' && lead.fitoutWindow !== selWindow) {
        return false;
      }

      // 6. Size Tier Filter
      if (selSizeTier !== 'ALL' && lead.sizeTier !== selSizeTier) {
        return false;
      }

      // 7. Tracker Status Filter
      if (selStatus !== 'ALL' && lead.trackerStatus !== selStatus) {
        return false;
      }

      return true;
    });

    // Sort
    const sortMode = state.radarSort;
    state.filteredLeads.sort((a, b) => {
      if (sortMode === 'heat') {
        return b.heatScore - a.heatScore;
      }
      if (sortMode === 'recency') {
        return (a.daysAgo || 999) - (b.daysAgo || 999);
      }
      if (sortMode === 'size') {
        return (b.areaSqFt || 0) - (a.areaSqFt || 0);
      }
      if (sortMode === 'company') {
        return a.company.localeCompare(b.company);
      }
      return 0;
    });

    // Update Counts & Badges
    radarVisibleCount.textContent = state.filteredLeads.length.toLocaleString();
    const relevantTotalLeads = state.activeCountry === 'ALL'
      ? state.leads
      : state.leads.filter(l => l.country === state.activeCountry);

    radarTotalCount.textContent = relevantTotalLeads.length.toLocaleString();

    const countAll = relevantTotalLeads.length;
    const count060 = relevantTotalLeads.filter(l => l.fitoutWindow === '0–60 Days' || l.fitoutWindow === 'Prime (0-60d)').length;
    const count1Yr = relevantTotalLeads.filter(l => l.fitoutWindow === '1 Year' || l.fitoutWindow === '1-Year: Scoping & Probing').length;
    const count2Yr = relevantTotalLeads.filter(l => l.fitoutWindow === '2 Years' || l.fitoutWindow === '2-Year: Relationship Building').length;
    const count3Yr = relevantTotalLeads.filter(l => l.fitoutWindow === '3 Years & Above' || l.fitoutWindow === 'Pre-Lease Pipeline').length;

    if (dropCountAll) dropCountAll.textContent = countAll.toLocaleString();
    if (dropCount060) dropCount060.textContent = count060.toLocaleString();
    if (dropCount1Yr) dropCount1Yr.textContent = count1Yr.toLocaleString();
    if (dropCount2Yr) dropCount2Yr.textContent = count2Yr.toLocaleString();
    if (dropCount3Yr) dropCount3Yr.textContent = count3Yr.toLocaleString();

    updateRadarDropdownUI(state.filters.window, { countAll, count060, count1Yr, count2Yr, count3Yr });

    const flag = COUNTRY_FLAGS[state.activeCountry] || '🌐';
    activeFilterBadge.textContent = state.activeCountry === 'ALL' ? '🌐 All Markets' : `${flag} ${state.activeCountry}`;

    // Render Views
    renderExecutiveScorecards();
    if (state.activeView === 'radar') {
      renderRadarView();
    } else if (state.activeView === 'analytics') {
      renderAllCharts();
    } else if (state.activeView === 'tracker') {
      renderTrackerView();
    } else if (state.activeView === 'hubs') {
      renderHubsView();
    } else if (state.activeView === 'coverage') {
      renderCoverageView();
    }
  }

  // =========================================================
  // 5. EXECUTIVE SCORECARDS
  // =========================================================
  function renderExecutiveScorecards() {
    const relevantLeads = state.activeCountry === 'ALL'
      ? state.leads
      : state.leads.filter(l => l.country === state.activeCountry);

    // Dedup unique companies by (Company + Country)
    const uniqueAccountSet = new Set(relevantLeads.map(l => `${l.company}___${l.country}`));
    kpiUniqueCompanies.textContent = uniqueAccountSet.size.toLocaleString();
    kpiCompaniesSub.textContent = state.activeCountry === 'ALL'
      ? 'Deduplicated across 6 APAC markets'
      : `Deduplicated accounts in ${state.activeCountry}`;

    // Partial Disclosed Footprint Total
    const totalSqFt = relevantLeads.reduce((sum, l) => sum + (l.areaSqFt || 0), 0);
    if (totalSqFt >= 1000000) {
      kpiTotalSqFt.textContent = `${(totalSqFt / 1000000).toFixed(1)}M sq ft`;
    } else if (totalSqFt > 0) {
      kpiTotalSqFt.textContent = `${Math.round(totalSqFt).toLocaleString()} sq ft`;
    } else {
      kpiTotalSqFt.textContent = 'Undisclosed';
    }

    // High Priority Radar (Heat >= 70 or Prime window)
    const highPri = relevantLeads.filter(l => l.heatScore >= 70 || l.fitoutWindow === '0–60 Days' || l.fitoutWindow === 'Prime (0-60d)').length;
    kpiHighPriority.textContent = highPri.toLocaleString();
    const pct = relevantLeads.length > 0 ? Math.round((highPri / relevantLeads.length) * 100) : 0;
    kpiHighPriorityBar.style.width = `${pct}%`;
    kpiHighPrioritySub.textContent = `${pct}% prime fit-out window (0–60d)`;

    // Multi-Tenant Hubs (buildings with >= 2 tenants in this market)
    const bldgCounts = {};
    relevantLeads.forEach(l => {
      if (l.building) bldgCounts[l.building] = (bldgCounts[l.building] || 0) + 1;
    });
    const multiBldgs = Object.values(bldgCounts).filter(c => c >= 2).length;
    kpiMultiTenantHubs.textContent = multiBldgs.toLocaleString();

    // Market summary badge
    if (state.activeCountry === 'ALL') {
      kpiActiveMarkets.textContent = '6 Markets';
      kpiMarketBreakdown.textContent = 'CN · IN · JP · KR · MY · LK';
    } else {
      const subCount = new Set(relevantLeads.map(l => l.submarket || l.city)).size;
      kpiActiveMarkets.textContent = `${relevantLeads.length} Deals`;
      kpiMarketBreakdown.textContent = `Across ${subCount} submarkets`;
    }
  }

  // =========================================================
  // 6. VIEW 1: 🔥 SALES RADAR (HOT LIST)
  // =========================================================
  function renderRadarView() {
    if (state.filteredLeads.length === 0) {
      radarCardsGrid.style.display = 'none';
      radarTableContainer.style.display = 'none';
      radarEmptyState.style.display = 'block';
      return;
    }
    radarEmptyState.style.display = 'none';

    if (state.radarViewMode === 'card') {
      radarCardsGrid.style.display = 'grid';
      radarTableContainer.style.display = 'none';
      renderRadarCards();
    } else {
      radarCardsGrid.style.display = 'none';
      radarTableContainer.style.display = 'block';
      renderRadarTable();
    }
  }

  function getFitoutWindowClass(w) {
    if (!w) return 'settled';
    if (w.includes('0–60') || w.includes('0-60') || w.includes('Prime')) return 'prime';
    if (w.includes('1 Year') || w.includes('Scoping') || w.includes('1-Year') || w.includes('1-Yr')) return 'scoping';
    if (w.includes('2 Years') || w.includes('Relationship') || w.includes('2-Year') || w.includes('2-Yr')) return 'relationship';
    if (w.includes('3 Years') || w.includes('3+ Years') || w.includes('Above') || w.includes('Pipeline')) return 'longrange';
    if (w.includes('Active')) return 'active';
    return 'settled';
  }

  function renderRadarCards() {
    radarCardsGrid.innerHTML = '';
    const frag = document.createDocumentFragment();

    state.filteredLeads.forEach(lead => {
      const card = document.createElement('article');
      card.className = 'sales-radar-card';

      // Heat Score Badge Class
      const heatClass = lead.heatScore >= 75 ? 'heat-score-badge heat-high' : 'heat-score-badge';
      const windowClass = getFitoutWindowClass(lead.fitoutWindow);
      const isSizeDisclosed = lead.isSizeDisclosed && lead.areaSqFt;

      const breakdown = lead.heatScoreBreakdown || {};
      const tooltipText = `Heat Score ${lead.heatScore}/100 Breakdown:
• Recency: +${breakdown.recencyPts || 0} (${breakdown.recencyReason || 'Recency'})
• Size: +${breakdown.sizePts || 0} (${breakdown.sizeReason || 'Size'})
• Deal Type: +${breakdown.typePts || 0} (${breakdown.typeReason || 'Type'})
• Sales Status: ${breakdown.statusPts >= 0 ? '+' : ''}${breakdown.statusPts || 0} (${breakdown.statusReason || 'Status'})`;

      card.innerHTML = `
        <div class="card-top-row">
          <div style="display: flex; gap: 6px; align-items: center;">
            <span class="${heatClass}" title="${tooltipText}">
              🔥 ${lead.heatScore}/100
            </span>
            <span class="window-pill ${windowClass}">
              ${lead.fitoutWindow}
            </span>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <span class="badge-clean">${lead.flag} ${lead.country}</span>
            <span class="badge-clean" style="font-size: 10px;">${lead.sector}</span>
          </div>
        </div>

        <div class="card-company-header">
          <h4 data-company="${escapeHtml(lead.company)}">${escapeHtml(lead.company)}</h4>
          <div class="card-building-loc">
            <span>📍 ${escapeHtml(lead.submarket || lead.city)}</span>
            ${lead.building ? `<strong>· ${escapeHtml(lead.building)}</strong>` : ''}
            ${lead.isMultiTenantHub ? `<span class="hub-cluster-pill" title="${lead.buildingTenantCount} moving tenants in this building!">🏢 Multi-Tenant Hub (${lead.buildingTenantCount} tenants)</span>` : ''}
          </div>
        </div>

        <div class="card-meta-chips">
          <span class="chip-tag tag-deal-type">${escapeHtml(lead.dealType)}</span>
          <span class="chip-tag ${isSizeDisclosed ? 'size-disclosed' : 'size-undisclosed'}" title="${isSizeDisclosed ? 'Disclosed area' : 'Size genuinely not stated in source news'}">
            ${isSizeDisclosed ? `📐 ${lead.areaFormatted}` : '📐 Not disclosed'}
          </span>
          <span class="chip-tag" style="font-family: 'JetBrains Mono', monospace;">
            💰 ${escapeHtml(lead.dealValue)}
          </span>
          <span class="chip-tag" style="font-size: 10.5px;">
            🕒 ${escapeHtml(lead.dealQuarter || lead.dealDate)}
          </span>
        </div>

        <div class="card-signal-snippet">
          <strong style="color: var(--text-primary); display: block; margin-bottom: 2px;">Signal:</strong>
          ${escapeHtml(lead.signal)}
          ${lead.timing ? `<div style="margin-top: 4px; font-weight: 600; color: var(--accent-blue);">Strategy: ${escapeHtml(lead.timing)}</div>` : ''}
        </div>

        <!-- Suggested Opening Line (The core question: What do I say?) -->
        <div class="opening-pitch-container">
          <div class="opening-pitch-top">
            <span class="opening-pitch-label">🎯 Suggested Opening Line</span>
            <button class="btn-copy-script" data-pitch="${escapeHtml(lead.suggestedOpeningLine)}" title="Copy sales pitch to clipboard">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copy Script</span>
            </button>
          </div>
          <p class="opening-pitch-text">"${escapeHtml(lead.suggestedOpeningLine)}"</p>
        </div>

        <!-- Action Bar -->
        <div class="card-action-bar">
          <div class="card-action-bar-left">
            <button class="btn-card-action btn-open-dossier" data-company="${escapeHtml(lead.company)}">
              🏢 360 View
            </button>
            <a href="${escapeHtml(lead.sourceUrl || '#')}" target="_blank" rel="noopener noreferrer" class="btn-card-action" title="Verify via ${escapeHtml(lead.source)}">
              🔗 ${escapeHtml(lead.source ? (lead.source.length > 18 ? lead.source.substring(0, 16) + '...' : lead.source) : 'Source')} ↗
            </a>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <select class="card-status-select" data-company="${escapeHtml(lead.company)}">
              <option value="Active" ${lead.trackerStatus === 'Active' ? 'selected' : ''}>🟢 Active</option>
              <option value="Watch" ${lead.trackerStatus === 'Watch' ? 'selected' : ''}>🟡 Watch</option>
              <option value="Engaged" ${lead.trackerStatus === 'Engaged' ? 'selected' : ''}>🟣 Engaged</option>
            </select>
          </div>
        </div>
      `;

      frag.appendChild(card);
    });

    radarCardsGrid.appendChild(frag);

    // Attach card event listeners
    attachCardListeners(radarCardsGrid);
  }

  function renderRadarTable() {
    radarTableBody.innerHTML = '';
    const frag = document.createDocumentFragment();

    state.filteredLeads.forEach(lead => {
      const tr = document.createElement('tr');
      const isSizeDisclosed = lead.isSizeDisclosed && lead.areaSqFt;
      const windowClass = getFitoutWindowClass(lead.fitoutWindow);

      tr.innerHTML = `
        <td>
          <span class="heat-score-badge ${lead.heatScore >= 75 ? 'heat-high' : ''}" style="font-size: 10.5px; padding: 2px 5px;">
            🔥 ${lead.heatScore}
          </span>
        </td>
        <td>
          <strong class="company-link" data-company="${escapeHtml(lead.company)}" style="cursor: pointer; color: var(--text-primary);">
            ${escapeHtml(lead.company)}
          </strong>
        </td>
        <td>${lead.flag} ${lead.country}</td>
        <td>
          <span>${escapeHtml(lead.submarket || lead.city)}</span>
          ${lead.building ? `<br><small style="color: var(--text-muted);">${escapeHtml(lead.building)}</small>` : ''}
          ${lead.isMultiTenantHub ? `<span class="hub-cluster-pill" style="font-size: 9px; padding: 1px 3px;">🏢 Hub</span>` : ''}
        </td>
        <td><span class="chip-tag tag-deal-type" style="font-size: 10px;">${escapeHtml(lead.dealType)}</span></td>
        <td>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; ${isSizeDisclosed ? 'color: var(--accent-blue); font-weight: 700;' : 'color: var(--text-muted);'}">
            ${isSizeDisclosed ? lead.areaFormatted : 'Not disclosed'}
          </span>
        </td>
        <td><span class="window-pill ${windowClass}" style="font-size: 10px;">${lead.fitoutWindow}</span></td>
        <td style="max-width: 280px; font-size: 11.5px; line-height: 1.35;">
          ${escapeHtml(lead.signal)}
        </td>
        <td>
          <select class="card-status-select" data-company="${escapeHtml(lead.company)}" style="font-size: 10.5px; padding: 2px;">
            <option value="Active" ${lead.trackerStatus === 'Active' ? 'selected' : ''}>Active</option>
            <option value="Watch" ${lead.trackerStatus === 'Watch' ? 'selected' : ''}>Watch</option>
            <option value="Engaged" ${lead.trackerStatus === 'Engaged' ? 'selected' : ''}>Engaged</option>
          </select>
        </td>
        <td>
          <button class="btn-card-action btn-open-dossier" data-company="${escapeHtml(lead.company)}" style="padding: 2px 6px; font-size: 11px;">
            360 ↗
          </button>
        </td>
      `;

      frag.appendChild(tr);
    });

    radarTableBody.appendChild(frag);
    attachCardListeners(radarTableBody);
  }

  function attachCardListeners(container) {
    // 1. Copy script buttons
    container.querySelectorAll('.btn-copy-script').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pitch = btn.getAttribute('data-pitch');
        navigator.clipboard.writeText(pitch).then(() => {
          const originalText = btn.innerHTML;
          btn.classList.add('copied');
          btn.innerHTML = `<span>✓ Copied!</span>`;
          showToast('Suggested opening script copied to clipboard!', '📋');
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = originalText;
          }, 2000);
        });
      });
    });

    // 2. Open 360 Dossier
    container.querySelectorAll('.btn-open-dossier, .card-company-header h4, .company-link').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const comp = el.getAttribute('data-company');
        openCompanyDossier(comp);
      });
    });

    // 3. Status Change Dropdown
    container.querySelectorAll('.card-status-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        e.stopPropagation();
        const comp = sel.getAttribute('data-company');
        const newStatus = sel.value;
        updateCompanyStatus(comp, newStatus);
      });
    });
  }

  function updateCompanyStatus(company, newStatus) {
    state.userStatuses[company] = newStatus;
    localStorage.setItem('cre_user_statuses', JSON.stringify(state.userStatuses));
    applyUserOverrides();
    showToast(`Updated status of ${company} to ${newStatus}`, '✓');
    filterAndSortLeads();
  }

  // =========================================================
  // 7. VIEW 2: 📊 PIPELINE & ANALYTICS CHARTS
  // =========================================================
  function renderAllCharts() {
    renderTimelineChart();
    renderSubmarketChart();
    renderDealTypeChart();
    renderSizeHistogramChart();
  }

  function getChartColors() {
    const isDark = state.theme === 'dark';
    return {
      text: isDark ? '#a1a1aa' : '#52525b',
      grid: isDark ? '#27272a' : '#e4e4e7',
      primary: isDark ? '#ffffff' : '#000000',
      accent: '#2563eb',
      accentSubtle: isDark ? '#1e3a8a' : '#bfdbfe',
      types: {
        'Relocation': '#2563eb',
        'Expansion': '#10b981',
        'Renewal': '#8b5cf6',
        'New Setup': '#f59e0b',
        'Own-use Purchase': '#ec4899',
        'Pre-lease': '#06b6d4',
        'Government Tender': '#64748b',
        'Consolidation': '#f97316',
        'Unstated': '#71717a'
      }
    };
  }

  function renderTimelineChart() {
    if (!timelineCanvas) return;
    if (state.charts.timeline) state.charts.timeline.destroy();

    const colors = getChartColors();
    const mode = state.analyticsTimelineMode; // 'deal' or 'found'
    const leads = state.filteredLeads;

    // Group deals by quarter/time bucket and deal type
    const quarterMap = {};
    const dealTypes = ['Relocation', 'Expansion', 'Renewal', 'New Setup', 'Pre-lease', 'Own-use Purchase', 'Unstated'];

    leads.forEach(l => {
      let q = l.dealQuarter || '2026-Q3';
      if (mode === 'found') {
        const d = l.dateFound ? l.dateFound.substring(0, 7) : '2026-10';
        q = d;
      }
      if (!quarterMap[q]) {
        quarterMap[q] = {};
        dealTypes.forEach(t => { quarterMap[q][t] = 0; });
      }
      const t = l.dealType && quarterMap[q][l.dealType] !== undefined ? l.dealType : 'Unstated';
      quarterMap[q][t] = (quarterMap[q][t] || 0) + 1;
    });

    // Sort quarters chronologically
    const sortedQuarters = Object.keys(quarterMap).sort();

    const datasets = dealTypes.map(type => ({
      label: type,
      data: sortedQuarters.map(q => quarterMap[q][type] || 0),
      backgroundColor: colors.types[type] || '#71717a',
      borderRadius: 2
    }));

    chartTimelineTitle.textContent = mode === 'deal'
      ? 'Deal Velocity by Transaction Quarter'
      : 'Intelligence Capture Timeline by Month Found';
    chartTimelineSub.textContent = `Stacked breakdown across ${leads.length} filtered deals`;

    state.charts.timeline = new Chart(timelineCanvas, {
      type: 'bar',
      data: {
        labels: sortedQuarters,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: colors.text, boxWidth: 10, font: { size: 10.5, family: 'Inter' } }
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: colors.text, font: { size: 10, family: 'JetBrains Mono' } }
          },
          y: {
            stacked: true,
            grid: { color: colors.grid },
            ticks: { color: colors.text, font: { size: 10, family: 'JetBrains Mono' } }
          }
        }
      }
    });
  }

  function renderSubmarketChart() {
    if (!submarketCanvas) return;
    if (state.charts.submarket) state.charts.submarket.destroy();

    const colors = getChartColors();
    const metric = state.analyticsHubMetric; // 'deals' or 'sqft'
    const leads = state.filteredLeads;

    const hubMap = {};
    leads.forEach(l => {
      const hub = l.submarket || l.city || 'Regional';
      if (!hubMap[hub]) hubMap[hub] = { deals: 0, sqft: 0 };
      hubMap[hub].deals += 1;
      hubMap[hub].sqft += (l.areaSqFt || 0);
    });

    const sortedHubs = Object.entries(hubMap)
      .sort((a, b) => b[1][metric] - a[1][metric])
      .slice(0, 8);

    const labels = sortedHubs.map(h => h[0]);
    const dataValues = sortedHubs.map(h => metric === 'deals' ? h[1].deals : Math.round(h[1].sqft / 1000));

    state.charts.submarket = new Chart(submarketCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: metric === 'deals' ? 'Deals Count' : 'Footprint (k sq ft)',
          data: dataValues,
          backgroundColor: '#000000',
          borderRadius: 3
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: colors.grid },
            ticks: { color: colors.text, font: { size: 10, family: 'JetBrains Mono' } }
          },
          y: {
            grid: { display: false },
            ticks: { color: colors.text, font: { size: 10.5, family: 'Inter', weight: '600' } }
          }
        }
      }
    });
  }

  function renderDealTypeChart() {
    if (!dealTypeCanvas) return;
    if (state.charts.dealType) state.charts.dealType.destroy();

    const colors = getChartColors();
    const leads = state.filteredLeads;

    const counts = {};
    leads.forEach(l => {
      const t = l.dealType || 'Unstated';
      counts[t] = (counts[t] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);
    const bgColors = labels.map(l => colors.types[l] || '#71717a');

    state.charts.dealType = new Chart(dealTypeCanvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: colors.grid
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'right',
            labels: { color: colors.text, boxWidth: 10, font: { size: 10.5, family: 'Inter' } }
          }
        }
      }
    });
  }

  function renderSizeHistogramChart() {
    if (!sizeHistogramCanvas) return;
    if (state.charts.sizeHistogram) state.charts.sizeHistogram.destroy();

    const colors = getChartColors();
    const leads = state.filteredLeads;

    const tiers = {
      'Mega (>100k)': 0,
      'Large (50k-100k)': 0,
      'Mid (20k-50k)': 0,
      'Boutique (<20k)': 0,
      'Undisclosed': 0
    };

    leads.forEach(l => {
      const tier = l.sizeTier || 'Undisclosed';
      if (tiers[tier] !== undefined) tiers[tier] += 1;
      else tiers['Undisclosed'] += 1;
    });

    state.charts.sizeHistogram = new Chart(sizeHistogramCanvas, {
      type: 'bar',
      data: {
        labels: Object.keys(tiers),
        datasets: [{
          label: 'Deals Count',
          data: Object.values(tiers),
          backgroundColor: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#d1d5db'],
          borderRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { size: 10, family: 'Inter' } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: { color: colors.text, font: { size: 10, family: 'JetBrains Mono' } }
          }
        }
      }
    });
  }

  // =========================================================
  // 8. VIEW 3: 📋 WORKING QUEUE (COMPANY TRACKER)
  // =========================================================
  function renderTrackerView() {
    const trackerData = state.tracker;
    const activeCountry = state.activeCountry;

    const relevant = activeCountry === 'ALL'
      ? trackerData
      : trackerData.filter(t => t.country.toLowerCase().includes(activeCountry.toLowerCase()) || activeCountry.toLowerCase().includes(t.country.toLowerCase()));

    // Update Ribbon Metrics
    kpiTrackerTotal.textContent = relevant.length.toLocaleString();
    const activeCount = relevant.filter(t => t.status === 'Active').length;
    const watchCount = relevant.filter(t => t.status === 'Watch').length;
    const engagedCount = relevant.filter(t => t.status === 'Engaged').length;

    kpiTrackerActive.textContent = activeCount.toLocaleString();
    kpiTrackerWatch.textContent = watchCount.toLocaleString();
    kpiTrackerEngaged.textContent = engagedCount.toLocaleString();
    tabTrackerCount.textContent = relevant.length.toLocaleString();

    // Render Weekly Delta Feed (meaningful changes)
    const changed = relevant.filter(t => t.hasChange);
    deltaFeedCount.textContent = `${changed.length} Strategic Triggers`;

    deltaFeedList.innerHTML = '';
    const feedFrag = document.createDocumentFragment();

    changed.slice(0, 6).forEach(item => {
      const card = document.createElement('div');
      card.className = 'delta-card-item';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong style="color: var(--text-primary); font-size: 13px;">${escapeHtml(item.company)}</strong>
          <span class="badge-clean active" style="font-size: 9.5px;">${item.status}</span>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">📍 ${escapeHtml(item.market || item.country)}</div>
        <div style="font-size: 11.5px; line-height: 1.4; color: var(--text-secondary); background: var(--bg-hover); padding: 6px 8px; border-radius: 4px;">
          <strong>Delta:</strong> ${escapeHtml(item.change)}
        </div>
      `;
      card.addEventListener('click', () => openCompanyDossier(item.company));
      feedFrag.appendChild(card);
    });
    deltaFeedList.appendChild(feedFrag);

    // Render Tracker Matrix Table
    trackerTableBody.innerHTML = '';
    const tableFrag = document.createDocumentFragment();

    relevant.slice(0, 150).forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <strong class="company-link" data-company="${escapeHtml(t.company)}" style="cursor: pointer; color: var(--text-primary);">
            ${escapeHtml(t.company)}
          </strong>
        </td>
        <td>${escapeHtml(t.country)}</td>
        <td>${escapeHtml(t.market)}</td>
        <td>
          <select class="card-status-select" data-company="${escapeHtml(t.company)}">
            <option value="Active" ${t.status === 'Active' ? 'selected' : ''}>Active</option>
            <option value="Watch" ${t.status === 'Watch' ? 'selected' : ''}>Watch</option>
            <option value="Engaged" ${t.status === 'Engaged' ? 'selected' : ''}>Engaged</option>
          </select>
        </td>
        <td style="font-size: 11.5px; max-width: 180px;">${escapeHtml(t.trend)}</td>
        <td style="font-size: 11.5px; max-width: 200px; color: ${t.hasChange ? 'var(--accent-blue)' : 'var(--text-muted)'}; font-weight: ${t.hasChange ? '700' : '400'};">
          ${escapeHtml(t.change)}
        </td>
        <td style="font-size: 11.5px; max-width: 240px;">
          ${escapeHtml(t.currentSnapshot)}
        </td>
        <td style="font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--text-muted);">
          ${escapeHtml(t.lastChecked)}
        </td>
        <td>
          <button class="btn-card-action btn-open-dossier" data-company="${escapeHtml(t.company)}" style="padding: 2px 6px; font-size: 11px;">
            360 ↗
          </button>
        </td>
      `;
      tableFrag.appendChild(tr);
    });

    trackerTableBody.appendChild(tableFrag);

    // Attach listeners
    attachCardListeners(trackerTableBody);
  }

  // =========================================================
  // 9. VIEW 4: 🏢 MULTI-TENANT HUBS (BUILDING CLUSTERS)
  // =========================================================
  function renderHubsView() {
    const leads = state.activeCountry === 'ALL'
      ? state.leads
      : state.leads.filter(l => l.country === state.activeCountry);

    // Group leads by building
    const clusters = {};
    leads.forEach(l => {
      if (l.building) {
        if (!clusters[l.building]) {
          clusters[l.building] = {
            building: l.building,
            submarket: l.submarket || l.city,
            country: l.country,
            flag: l.flag,
            tenants: [],
            totalSqFt: 0
          };
        }
        clusters[l.building].tenants.push(l);
        clusters[l.building].totalSqFt += (l.areaSqFt || 0);
      }
    });

    // Filter buildings with >= 2 moving tenants
    const multiClusters = Object.values(clusters).filter(c => c.tenants.length >= 2);
    multiClusters.sort((a, b) => b.tenants.length - a.tenants.length);

    hubsCountPill.textContent = `${multiClusters.length} Target Buildings Identified`;
    tabHubsCount.textContent = multiClusters.length.toString();

    hubsCatalogGrid.innerHTML = '';
    const frag = document.createDocumentFragment();

    multiClusters.forEach(cluster => {
      const card = document.createElement('article');
      card.className = 'hub-cluster-card';

      const sqftFormatted = cluster.totalSqFt > 0
        ? (cluster.totalSqFt >= 1000000 ? `${(cluster.totalSqFt / 1000000).toFixed(2)}M sq ft` : `${cluster.totalSqFt.toLocaleString()} sq ft`)
        : 'Disclosed area partial';

      card.innerHTML = `
        <div class="hub-card-header">
          <div>
            <h4>🏢 ${escapeHtml(cluster.building)}</h4>
            <span>📍 ${escapeHtml(cluster.submarket)} · ${cluster.flag} ${cluster.country}</span>
          </div>
          <span class="hub-cluster-pill" style="font-size: 11.5px; padding: 3px 8px;">
            ${cluster.tenants.length} Moving Tenants
          </span>
        </div>

        <div style="display: flex; gap: 8px; align-items: center; font-size: 12px; margin-top: 2px;">
          <span style="font-weight: 700; color: var(--text-primary);">Total Disclosed:</span>
          <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--accent-blue);">${sqftFormatted}</span>
        </div>

        <div class="hub-tenants-list">
          ${cluster.tenants.map(t => `
            <div class="hub-tenant-row">
              <div>
                <strong class="company-link" data-company="${escapeHtml(t.company)}" style="cursor: pointer; font-size: 12.5px;">
                  ${escapeHtml(t.company)}
                </strong>
                <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(t.dealType)} · ${t.areaFormatted}</div>
              </div>
              <span class="window-pill ${getFitoutWindowClass(t.fitoutWindow)}" style="font-size: 10px;">
                ${t.fitoutWindow}
              </span>
            </div>
          `).join('')}
        </div>

        <div class="hub-playbook-box">
          <strong>Strategic Playbook:</strong> Multiple concurrent moves in this tower provide massive trip leverage. Book back-to-back meetings with facility leads to pitch Steelcase agile workstations and common-area FF&E in one trip.
        </div>
      `;

      frag.appendChild(card);
    });

    hubsCatalogGrid.appendChild(frag);

    // Attach listeners
    hubsCatalogGrid.querySelectorAll('.company-link').forEach(el => {
      el.addEventListener('click', () => {
        openCompanyDossier(el.getAttribute('data-company'));
      });
    });
  }

  // =========================================================
  // 10. VIEW 5: ℹ️ COVERAGE & DATA TRUST
  // =========================================================
  function renderCoverageView() {
    const metrics = state.metrics;
    if (metrics.buildingDisclosureRate) {
      gaugeBuildingRate.textContent = `${metrics.buildingDisclosureRate}%`;
      gaugeBuildingBar.style.width = `${metrics.buildingDisclosureRate}%`;
    }
    if (metrics.sizeDisclosureRate) {
      gaugeSizeRate.textContent = `${metrics.sizeDisclosureRate}%`;
      gaugeSizeBar.style.width = `${metrics.sizeDisclosureRate}%`;
    }
    if (metrics.typeDisclosureRate) {
      gaugeTypeRate.textContent = `${metrics.typeDisclosureRate}%`;
      gaugeTypeBar.style.width = `${metrics.typeDisclosureRate}%`;
    }
    if (state.sources) {
      gaugeSourcesCount.textContent = `${state.sources.length} Sources`;
    }

    renderSourcesTable();
  }

  function renderSourcesTable() {
    const q = state.sourcesSearch.toLowerCase().trim();
    const filtered = state.sources.filter(s => {
      if (!q) return true;
      const hay = `${s.country} ${s.source} ${s.whatItCovers} ${s.tier} ${s.normalPrice} ${s.trustLevel} ${s.howToUse}`.toLowerCase();
      return hay.includes(q);
    });

    sourcesTableBody.innerHTML = '';
    const frag = document.createDocumentFragment();

    filtered.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="badge-clean">${escapeHtml(s.country)}</span></td>
        <td>
          <span class="badge-clean ${s.isPaid ? 'active' : ''}" style="font-weight: 700;">
            ${escapeHtml(s.tier)}
          </span>
        </td>
        <td><strong style="color: var(--text-primary);">${escapeHtml(s.source)}</strong></td>
        <td style="font-size: 11.5px; max-width: 240px;">${escapeHtml(s.whatItCovers)}</td>
        <td style="font-family: 'JetBrains Mono', monospace; font-size: 11px; max-width: 140px;">${escapeHtml(s.normalPrice || 'Free')}</td>
        <td>
          <span style="font-size: 11px; font-weight: 600;">
            ${escapeHtml(s.trustLevel)}
          </span>
        </td>
        <td style="font-size: 11.5px; max-width: 280px; line-height: 1.4;">${escapeHtml(s.howToUse)}</td>
        <td>
          <a href="${escapeHtml(s.sourceUrl || '#')}" target="_blank" rel="noopener noreferrer" class="btn-card-action" style="padding: 2px 6px; font-size: 11px;">
            Visit ↗
          </a>
        </td>
      `;
      frag.appendChild(tr);
    });

    sourcesTableBody.appendChild(frag);
  }

  if (sourcesSearchInput) {
    sourcesSearchInput.addEventListener('input', (e) => {
      state.sourcesSearch = e.target.value;
      renderSourcesTable();
    });
  }

  // =========================================================
  // 11. SLIDE-OVER DRAWER / MODAL: COMPANY 360 DOSSIER
  // =========================================================
  function openCompanyDossier(companyName) {
    state.activeDossierCompany = companyName;

    // Find all cross-market deals for this company
    const matchingDeals = state.leads.filter(l => l.company.toLowerCase() === companyName.toLowerCase());
    const primaryDeal = matchingDeals[0] || {};

    // Find tracker record
    const trackerRec = state.tracker.find(t => t.company.toLowerCase() === companyName.toLowerCase()) || {};

    // Find snapshots
    const matchingSnapshots = state.snapshots.filter(s => s.company.toLowerCase() === companyName.toLowerCase());

    dossierCompanyTitle.textContent = companyName;
    dossierMarketSub.textContent = `${primaryDeal.submarket || primaryDeal.city || trackerRec.market || 'Regional'} · ${primaryDeal.building || 'Building undisclosed'} (${primaryDeal.country || trackerRec.country})`;

    // Status Badge
    const status = trackerRec.status || primaryDeal.trackerStatus || 'Watch';
    dossierStatusBadge.textContent = status;
    dossierStatusBadge.className = `badge-clean ${status === 'Active' ? 'active' : ''}`;
    dossierStatusSelect.value = status;

    // Country & Sector
    dossierCountryBadge.textContent = `${primaryDeal.flag || '🌐'} ${primaryDeal.country || trackerRec.country || 'APAC'}`;
    dossierSectorBadge.textContent = primaryDeal.sector || 'Corporate';

    // Heat score badge
    const heat = primaryDeal.heatScore || 65;
    dossierHeatScoreBadge.textContent = `🔥 Heat Score: ${heat}/100`;

    // Tailored Pitch
    const pitch = primaryDeal.suggestedOpeningLine || `Hi [Name], congratulations on ${companyName}'s commercial momentum. Steelcase APAC provides premium ergonomic furniture and high-collaboration workspace design. Would you be open to an introductory conversation?`;
    dossierPitchText.textContent = `"${pitch}"`;

    // Notes
    dossierNotesInput.value = state.userNotes[companyName] || trackerRec.notes || '';

    // Render Cross-Market Deals
    dossierDealsCount.textContent = matchingDeals.length.toString();
    dossierDealsList.innerHTML = '';
    if (matchingDeals.length > 0) {
      matchingDeals.forEach(deal => {
        const item = document.createElement('div');
        item.style.padding = '8px 10px';
        item.style.marginBottom = '6px';
        item.style.background = 'var(--bg-card)';
        item.style.border = '1px solid var(--border-light)';
        item.style.borderRadius = '4px';
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <strong style="font-size: 12.5px;">${deal.flag} ${deal.country} — ${escapeHtml(deal.market)}</strong>
            <span class="chip-tag tag-deal-type" style="font-size: 10px;">${escapeHtml(deal.dealType)}</span>
          </div>
          <div style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 4px;">
            ${escapeHtml(deal.signal)}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted);">
            <span>Disclosed: <strong style="color: var(--accent-blue);">${deal.areaFormatted}</strong></span>
            <a href="${escapeHtml(deal.sourceUrl || '#')}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); text-decoration: none;">Verify Source ↗</a>
          </div>
        `;
        dossierDealsList.appendChild(item);
      });
    } else {
      dossierDealsList.innerHTML = '<p style="font-size: 12px; color: var(--text-muted);">No transaction rows found for this account.</p>';
    }

    // Render Historical Snapshots
    dossierSnapshotsCount.textContent = matchingSnapshots.length.toString();
    dossierSnapshotsList.innerHTML = '';
    if (matchingSnapshots.length > 0) {
      matchingSnapshots.forEach(snap => {
        const item = document.createElement('div');
        item.style.padding = '8px 10px';
        item.style.marginBottom = '6px';
        item.style.background = 'var(--bg-card)';
        item.style.border = '1px solid var(--border-light)';
        item.style.borderRadius = '4px';
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-bottom: 2px;">
            <span>Week: <strong style="font-family: 'JetBrains Mono', monospace;">${escapeHtml(snap.week)}</strong></span>
            <span>${escapeHtml(snap.source)}</span>
          </div>
          <div style="font-size: 12px; line-height: 1.4; color: var(--text-primary);">
            ${escapeHtml(snap.snapshot)}
          </div>
        `;
        dossierSnapshotsList.appendChild(item);
      });
    } else {
      dossierSnapshotsList.innerHTML = '<p style="font-size: 12px; color: var(--text-muted);">No snapshot history recorded for this account.</p>';
    }

    company360Modal.classList.add('open');
  }

  // Copy Dossier Pitch
  if (btnCopyDossierPitch) {
    btnCopyDossierPitch.addEventListener('click', () => {
      const pitch = dossierPitchText.textContent.replace(/^"|"$/g, '');
      navigator.clipboard.writeText(pitch).then(() => {
        showToast('Tailored pitch copied to clipboard!', '📋');
      });
    });
  }

  // Save Dossier Notes
  if (btnSaveDossierNotes) {
    btnSaveDossierNotes.addEventListener('click', () => {
      const comp = state.activeDossierCompany;
      if (!comp) return;
      const note = dossierNotesInput.value.trim();
      const status = dossierStatusSelect.value;

      state.userNotes[comp] = note;
      state.userStatuses[comp] = status;

      localStorage.setItem('cre_user_notes', JSON.stringify(state.userNotes));
      localStorage.setItem('cre_user_statuses', JSON.stringify(state.userStatuses));

      applyUserOverrides();
      showToast(`Saved triage notes and status for ${comp}`, '✓');
      filterAndSortLeads();
      company360Modal.classList.remove('open');
    });
  }

  if (modal360CloseBtn) {
    modal360CloseBtn.addEventListener('click', () => {
      company360Modal.classList.remove('open');
    });
  }

  company360Modal.addEventListener('click', (e) => {
    if (e.target === company360Modal) {
      company360Modal.classList.remove('open');
    }
  });

  // =========================================================
  // 12. NAVIGATION & VIEW SWITCHING
  // =========================================================
  function switchView(viewName) {
    state.activeView = viewName;

    // Update Nav buttons
    [tabAnalyticsBtn, tabRadarDropdownBtn, tabTrackerBtn, tabHubsBtn, tabCoverageBtn].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    // Hide all view panels
    [viewRadar, viewAnalytics, viewTracker, viewHubs, viewCoverage].forEach(view => {
      if (view) view.style.display = 'none';
    });

    if (viewName === 'analytics') {
      if (tabAnalyticsBtn) tabAnalyticsBtn.classList.add('active');
      viewAnalytics.style.display = 'block';
      renderAllCharts();
    } else if (viewName === 'radar') {
      if (tabRadarDropdownBtn) tabRadarDropdownBtn.classList.add('active');
      viewRadar.style.display = 'block';
      renderRadarView();
    } else if (viewName === 'tracker') {
      if (tabTrackerBtn) tabTrackerBtn.classList.add('active');
      viewTracker.style.display = 'block';
      renderTrackerView();
    } else if (viewName === 'hubs') {
      if (tabHubsBtn) tabHubsBtn.classList.add('active');
      viewHubs.style.display = 'block';
      renderHubsView();
    } else if (viewName === 'coverage') {
      if (tabCoverageBtn) tabCoverageBtn.classList.add('active');
      viewCoverage.style.display = 'block';
      renderCoverageView();
    }
  }

  function updateRadarDropdownUI(horizon, counts) {
    if (!counts) {
      const relevantTotalLeads = state.activeCountry === 'ALL'
        ? state.leads
        : state.leads.filter(l => l.country === state.activeCountry);
      counts = {
        countAll: relevantTotalLeads.length,
        count060: relevantTotalLeads.filter(l => l.fitoutWindow === '0–60 Days' || l.fitoutWindow === 'Prime (0-60d)').length,
        count1Yr: relevantTotalLeads.filter(l => l.fitoutWindow === '1 Year' || l.fitoutWindow === '1-Year: Scoping & Probing').length,
        count2Yr: relevantTotalLeads.filter(l => l.fitoutWindow === '2 Years' || l.fitoutWindow === '2-Year: Relationship Building').length,
        count3Yr: relevantTotalLeads.filter(l => l.fitoutWindow === '3 Years & Above' || l.fitoutWindow === 'Pre-Lease Pipeline').length
      };
    }

    const horizonConfig = {
      'ALL': { icon: '🔥', label: 'Sales Radar', count: counts.countAll, heading: 'Who to Call This Week' },
      '0–60 Days': { icon: '⚡', label: '0–60 Days', count: counts.count060, heading: '⚡ 0–60 Days Prime Fit-Out Execution Window' },
      '1 Year': { icon: '🎯', label: '1 Year', count: counts.count1Yr, heading: '🎯 1-Year Scoping & Probing Pipeline' },
      '2 Years': { icon: '🤝', label: '2 Years', count: counts.count2Yr, heading: '🤝 2-Year Relationship Building Pipeline' },
      '3 Years & Above': { icon: '🔮', label: '3 Years & Above', count: counts.count3Yr, heading: '🔮 3+ Years Strategic & Pre-Lease Pipeline' }
    };

    const cfg = horizonConfig[horizon] || horizonConfig['ALL'];
    if (radarDropdownIcon) radarDropdownIcon.textContent = cfg.icon;
    if (radarDropdownLabel) radarDropdownLabel.textContent = cfg.label;
    if (radarDropdownBadge) radarDropdownBadge.textContent = cfg.count.toLocaleString();
    if (radarViewHeading) radarViewHeading.textContent = cfg.heading;

    // Highlight active item in dropdown menu
    const items = document.querySelectorAll('#navRadarDropdownMenu .nav-dropdown-item');
    items.forEach(btn => {
      if (btn.getAttribute('data-horizon') === horizon) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Analytics Button
  if (tabAnalyticsBtn) tabAnalyticsBtn.addEventListener('click', () => switchView('analytics'));

  // Sales Radar Dropdown Trigger Button
  if (tabRadarDropdownBtn) {
    tabRadarDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navRadarDropdownWrap && navRadarDropdownWrap.classList.contains('open');
      if (isOpen) {
        navRadarDropdownWrap.classList.remove('open');
        tabRadarDropdownBtn.setAttribute('aria-expanded', 'false');
      } else {
        if (navRadarDropdownWrap) navRadarDropdownWrap.classList.add('open');
        tabRadarDropdownBtn.setAttribute('aria-expanded', 'true');
      }
      if (state.activeView !== 'radar') {
        switchView('radar');
      }
    });
  }

  // Dropdown Items selection
  document.querySelectorAll('#navRadarDropdownMenu .nav-dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const horizon = item.getAttribute('data-horizon');
      state.filters.window = horizon;
      if (filterWindow) filterWindow.value = horizon;
      updateRadarDropdownUI(horizon);
      filterAndSortLeads();
      switchView('radar');
      if (navRadarDropdownWrap) navRadarDropdownWrap.classList.remove('open');
      if (tabRadarDropdownBtn) tabRadarDropdownBtn.setAttribute('aria-expanded', 'false');
    });
  });

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (navRadarDropdownWrap && !navRadarDropdownWrap.contains(e.target)) {
      navRadarDropdownWrap.classList.remove('open');
      if (tabRadarDropdownBtn) tabRadarDropdownBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // Close dropdown on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navRadarDropdownWrap && navRadarDropdownWrap.classList.contains('open')) {
      navRadarDropdownWrap.classList.remove('open');
      if (tabRadarDropdownBtn) tabRadarDropdownBtn.setAttribute('aria-expanded', 'false');
    }
  });

  if (tabTrackerBtn) tabTrackerBtn.addEventListener('click', () => switchView('tracker'));
  if (tabHubsBtn) tabHubsBtn.addEventListener('click', () => switchView('hubs'));
  if (tabCoverageBtn) tabCoverageBtn.addEventListener('click', () => switchView('coverage'));

  // Country Market Select
  countrySelect.addEventListener('change', (e) => {
    state.activeCountry = e.target.value;
    headerMarketFlag.textContent = COUNTRY_FLAGS[state.activeCountry] || '🌐';
    populateSubmarketsDropdown();
    filterAndSortLeads();
  });

  // Radar View Mode Toggles
  btnRadarCardView.addEventListener('click', () => {
    state.radarViewMode = 'card';
    btnRadarCardView.classList.add('active');
    btnRadarTableView.classList.remove('active');
    renderRadarView();
  });

  btnRadarTableView.addEventListener('click', () => {
    state.radarViewMode = 'table';
    btnRadarTableView.classList.add('active');
    btnRadarCardView.classList.remove('active');
    renderRadarView();
  });

  // Radar Sort Select
  radarSortSelect.addEventListener('change', (e) => {
    state.radarSort = e.target.value;
    filterAndSortLeads();
  });

  // Analytics Toggles
  if (btnTimelineDealDate && btnTimelineFoundDate) {
    btnTimelineDealDate.addEventListener('click', () => {
      state.analyticsTimelineMode = 'deal';
      btnTimelineDealDate.classList.add('active');
      btnTimelineFoundDate.classList.remove('active');
      renderTimelineChart();
    });
    btnTimelineFoundDate.addEventListener('click', () => {
      state.analyticsTimelineMode = 'found';
      btnTimelineFoundDate.classList.add('active');
      btnTimelineDealDate.classList.remove('active');
      renderTimelineChart();
    });
  }

  if (btnHubDeals && btnHubSqft) {
    btnHubDeals.addEventListener('click', () => {
      state.analyticsHubMetric = 'deals';
      btnHubDeals.classList.add('active');
      btnHubSqft.classList.remove('active');
      renderSubmarketChart();
    });
    btnHubSqft.addEventListener('click', () => {
      state.analyticsHubMetric = 'sqft';
      btnHubSqft.classList.add('active');
      btnHubDeals.classList.remove('active');
      renderSubmarketChart();
    });
  }

  // Filter Input Listeners
  globalSearchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    filterAndSortLeads();
  });

  filterSubmarket.addEventListener('change', (e) => {
    state.filters.submarket = e.target.value;
    filterAndSortLeads();
  });

  filterDealType.addEventListener('change', (e) => {
    state.filters.dealType = e.target.value;
    filterAndSortLeads();
  });

  filterWindow.addEventListener('change', (e) => {
    state.filters.window = e.target.value;
    updateRadarDropdownUI(e.target.value);
    filterAndSortLeads();
  });

  filterSizeTier.addEventListener('change', (e) => {
    state.filters.sizeTier = e.target.value;
    filterAndSortLeads();
  });

  filterStatus.addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    filterAndSortLeads();
  });

  btnResetFilters.addEventListener('click', () => {
    state.filters = {
      search: '',
      submarket: 'ALL',
      dealType: 'ALL',
      window: 'ALL',
      sizeTier: 'ALL',
      status: 'ALL'
    };
    globalSearchInput.value = '';
    filterSubmarket.value = 'ALL';
    filterDealType.value = 'ALL';
    filterWindow.value = 'ALL';
    filterSizeTier.value = 'ALL';
    filterStatus.value = 'ALL';
    updateRadarDropdownUI('ALL');
    filterAndSortLeads();
  });

  // =========================================================
  // 13. LIVE GOOGLE SHEET SYNC
  // =========================================================
  btnSyncRefresh.addEventListener('click', () => {
    syncIcon.style.animation = 'spin 0.8s linear infinite';
    syncTimestamp.textContent = 'Syncing...';

    fetch('/api/sync')
      .then(res => res.json())
      .then(data => {
        syncIcon.style.animation = 'none';
        if (data.leads && data.leads.length > 0) {
          state.leads = data.leads;
          state.tracker = data.tracker || state.tracker;
          state.snapshots = data.snapshots || state.snapshots;
          state.sources = data.sources || state.sources;
          state.metrics = data.metrics || state.metrics;
          applyUserOverrides();
          populateSubmarketsDropdown();
          filterAndSortLeads();
          syncTimestamp.textContent = `Synced: ${data.lastSynced || 'Just now'}`;
          showToast(`Synced ${data.leads.length} leads across ${data.markets.length} markets!`, '🔄');
        } else {
          syncTimestamp.textContent = 'Synced';
          showToast('Live sync completed', '✓');
        }
      })
      .catch(err => {
        syncIcon.style.animation = 'none';
        syncTimestamp.textContent = 'Offline / Cached';
        console.warn('Sync error:', err);
        showToast('Sync server offline, running from cached data.js', '⚠️');
      });
  });

  // Add CSS spin animation
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
  if (document.head) document.head.appendChild(styleSheet);

  // =========================================================
  // 14. EXPORT TO CSV
  // =========================================================
  btnExportCsv.addEventListener('click', () => {
    const data = state.filteredLeads;
    if (!data.length) {
      showToast('No leads to export', '⚠️');
      return;
    }

    const headers = ['Heat Score', 'Company', 'Country', 'Market', 'Submarket', 'Building', 'Deal Type', 'Size (sq ft)', 'Disclosed Size Formatted', 'Deal Value', 'Deal Date / Quarter', 'Fit-out Window', 'Signal', 'Timing Strategy', 'Sales Status', 'Source', 'Source URL'];
    const rows = data.map(l => [
      l.heatScore,
      `"${(l.company || '').replace(/"/g, '""')}"`,
      `"${(l.country || '').replace(/"/g, '""')}"`,
      `"${(l.market || '').replace(/"/g, '""')}"`,
      `"${(l.submarket || '').replace(/"/g, '""')}"`,
      `"${(l.building || '').replace(/"/g, '""')}"`,
      `"${(l.dealType || '').replace(/"/g, '""')}"`,
      l.areaSqFt !== null ? l.areaSqFt : 'Not disclosed',
      `"${(l.areaFormatted || '').replace(/"/g, '""')}"`,
      `"${(l.dealValue || '').replace(/"/g, '""')}"`,
      `"${(l.dealQuarter || l.dealDate || '').replace(/"/g, '""')}"`,
      `"${(l.fitoutWindow || '').replace(/"/g, '""')}"`,
      `"${(l.signal || '').replace(/"/g, '""')}"`,
      `"${(l.timing || '').replace(/"/g, '""')}"`,
      `"${(l.trackerStatus || '').replace(/"/g, '""')}"`,
      `"${(l.source || '').replace(/"/g, '""')}"`,
      `"${(l.sourceUrl || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `steelcase_lease_iq_${state.activeCountry.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${data.length} records to CSV!`, '📥');
  });

  // Helper function to escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================
  // INITIALIZATION
  // =========================================================
  populateSubmarketsDropdown();
  filterAndSortLeads();
  switchView('analytics');
});
