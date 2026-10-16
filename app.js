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
    sourcesSearch: '',
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

  // Fallback data ground-truth enforcement (IN-003, CN-013, MY-046, IWG, WORQ)
  state.leads.forEach(lead => {
    if (lead.id === 'IN-003') {
      lead.areaSqFt = null;
      lead.areaFormatted = 'Not disclosed';
      lead.dealType = 'Unstated';
      lead.heatScore = 50;
      if (lead.heatScoreBreakdown) {
        lead.heatScoreBreakdown.sizePts = 0;
        lead.heatScoreBreakdown.size = 0;
        lead.heatScoreBreakdown.typePts = 5;
        lead.heatScoreBreakdown.dealType = 5;
        lead.heatScoreBreakdown.totalScore = 50;
        lead.heatScoreBreakdown.summary = 'R:40 + S:0 + T:5 + St:5 = 50';
      }
    } else if (lead.id === 'CN-013') {
      lead.areaSqFt = null;
      lead.areaFormatted = 'Not disclosed';
      lead.dealType = 'Pre-commitment';
      lead.heatScore = 65;
      if (lead.heatScoreBreakdown) {
        lead.heatScoreBreakdown.sizePts = 0;
        lead.heatScoreBreakdown.size = 0;
        lead.heatScoreBreakdown.typePts = 20;
        lead.heatScoreBreakdown.dealType = 20;
        lead.heatScoreBreakdown.totalScore = 65;
        lead.heatScoreBreakdown.summary = 'R:40 + S:0 + T:20 + St:5 = 65';
      }
    } else if (lead.id === 'MY-046') {
      lead.dealType = 'Unstated';
      if (lead.heatScoreBreakdown) {
        lead.heatScoreBreakdown.typePts = 5;
        lead.heatScoreBreakdown.dealType = 5;
        lead.heatScore = (lead.heatScoreBreakdown.recencyPts || 40) + (lead.heatScoreBreakdown.sizePts || 25) + 5 + (lead.heatScoreBreakdown.statusPts || 5);
        lead.heatScoreBreakdown.totalScore = lead.heatScore;
        lead.heatScoreBreakdown.summary = `R:${lead.heatScoreBreakdown.recencyPts || 40} + S:${lead.heatScoreBreakdown.sizePts || 25} + T:5 + St:${lead.heatScoreBreakdown.statusPts || 5} = ${lead.heatScore}`;
      }
    } else if (lead.company && (lead.company.includes('IWG') || lead.company.includes('WORQ'))) {
      lead.areaSqFt = null;
      lead.areaFormatted = 'Not disclosed';
      if (lead.heatScoreBreakdown) {
        lead.heatScoreBreakdown.sizePts = 0;
        lead.heatScoreBreakdown.size = 0;
      }
    }
  });

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
  const dropCountUnknown = document.getElementById('dropCountUnknown');
  const tabTrackerBtn = document.getElementById('tabTrackerBtn');
  const tabHubsBtn = document.getElementById('tabHubsBtn');
  const tabCoverageBtn = document.getElementById('tabCoverageBtn');
  const tabTrackerCount = document.getElementById('tabTrackerCount');
  const tabHubsCount = document.getElementById('tabHubsCount');
  const appVersionBadge = document.getElementById('appVersionBadge');

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
  const radarRawCount = document.getElementById('radarRawCount');
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

  // App Version Badge
  if (appVersionBadge) {
    const ver = (state.metrics && state.metrics.version) || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '2.23');
    appVersionBadge.textContent = `v${ver}`;
  }

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

  const COUNTRY_METADATA = {
    'China': { code: 'CN', flag: '🇨🇳', currency: 'CNY', symbol: '¥' },
    'India': { code: 'IN', flag: '🇮🇳', currency: 'INR', symbol: '₹' },
    'Japan': { code: 'JP', flag: '🇯🇵', currency: 'JPY', symbol: '¥' },
    'Korea': { code: 'KR', flag: '🇰🇷', currency: 'KRW', symbol: '₩' },
    'South Korea': { code: 'KR', flag: '🇰🇷', currency: 'KRW', symbol: '₩' },
    'Malaysia': { code: 'MY', flag: '🇲🇾', currency: 'MYR', symbol: 'RM' },
    'Sri Lanka': { code: 'LK', flag: '🇱🇰', currency: 'LKR', symbol: 'SL Rs' }
  };

  // =========================================================
  // 4. FILTERING & SEARCH ENGINE
  // =========================================================
  // CANONICAL SUBMARKET NORMALIZATION & DEDUPLICATION
  // =========================================================
  function canonicalSubmarket(subm) {
    if (!subm) return '';
    let s = subm.trim();
    const sLower = s.toLowerCase();
    if (['not stated', 'market not stated', 'same', '~53', 'floors 5-6', 'b7/15f', 'district not stated; cited in ybd section'].includes(sLower)) {
      return '';
    }
    if (sLower.includes('kyobashi') || (sLower.includes('yaesu') && sLower.includes('nihonbashi'))) {
      return 'Kyobashi/Yaesu/Nihonbashi';
    }
    if (sLower.includes('marunouchi')) {
      return 'Marunouchi/Otemachi';
    }
    if (sLower.includes('toranomon')) {
      return 'Toranomon/Kamiyacho';
    }
    if (sLower.includes('shinagawa konanguchi')) {
      return 'Shinagawa Konanguchi';
    }
    if (sLower.includes('osaki')) {
      return 'Osaki/Gotanda';
    }
    if (sLower.includes('shibaura') || sLower.includes('shibadaimon')) {
      return 'Shibaura/Hamamatsucho';
    }
    if (sLower.includes('hamamatsucho') && sLower.includes('onarimon')) {
      return 'Hamamatsucho/Onarimon';
    }
    if (sLower.includes('bayan lepas')) {
      return 'Bayan Lepas';
    }
    if (sLower.includes('george town')) {
      return 'George Town';
    }
    if (sLower.includes('whitefield')) {
      return 'Whitefield';
    }
    if (sLower.includes('salt lake')) {
      return 'Salt Lake';
    }
    if (sLower.includes('umeda')) {
      return 'Umeda';
    }
    if (sLower.includes('magok')) {
      return 'Magok';
    }
    if (sLower.includes('ybd')) {
      return 'YBD';
    }
    if (sLower.includes('kl city')) {
      return 'KL City';
    }
    if (sLower.includes('bancho') || sLower.includes('kojimachi')) {
      return 'Bancho/Kojimachi';
    }
    if (sLower.includes('mita') || sLower.includes('tamachi')) {
      return 'Mita/Tamachi';
    }
    if (sLower.includes('harumi') || sLower.includes('kachidoki')) {
      return 'Harumi/Kachidoki';
    }
    if (sLower.includes('kita-shinagawa')) {
      return 'Kita-Shinagawa';
    }
    return s.replace(/\s*\/\s*/g, '/');
  }

  function updateCountrySelectCounts() {
    if (!countrySelect) return;
    const rawCounts = state.metrics && state.metrics.perCountryRows ? state.metrics.perCountryRows : {
      'China': 56, 'India': 134, 'Japan': 91, 'Korea': 153, 'Malaysia': 80, 'Sri Lanka': 31
    };
    const totalRaw = state.metrics && state.metrics.totalTrackedRows ? state.metrics.totalTrackedRows : 545;
    const totalDeals = state.leads ? state.leads.length : 537;

    for (let i = 0; i < countrySelect.options.length; i++) {
      const opt = countrySelect.options[i];
      if (opt.value === 'ALL') {
        opt.textContent = `🌐 All Markets (${totalRaw} rows · ${totalDeals} deals)`;
      } else if (rawCounts[opt.value] !== undefined) {
        const flag = COUNTRY_FLAGS[opt.value] || '';
        const displayName = opt.value === 'Korea' ? 'South Korea' : opt.value;
        opt.textContent = `${flag} ${displayName} (${rawCounts[opt.value]} rows)`;
      }
    }
  }

  function populateSubmarketsDropdown() {
    const marketLeads = state.activeCountry === 'ALL'
      ? state.leads
      : state.leads.filter(l => l.country === state.activeCountry);

    const submarkets = new Set();
    marketLeads.forEach(l => {
      const mkt = (l.market || l.submarket || '').trim();
      if (mkt && mkt !== 'ALL') submarkets.add(mkt);
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
        const leadMkt = (lead.market || lead.submarket || '').trim();
        if (leadMkt.toLowerCase() !== selSubmarket.toLowerCase()) {
          return false;
        }
      }

      // 4. Deal Type Filter
      if (selDealType !== 'ALL' && lead.dealType !== selDealType) {
        return false;
      }

      // 5. Fit-out Window Filter
      if (selWindow !== 'ALL') {
        const matchesWindow = (lead.fitoutWindow === selWindow) ||
                              (selWindow === '0–1 Year' && (lead.fitoutWindow === '1 Year' || lead.fitoutWindow === '0–1 Year')) ||
                              (selWindow === '1–2 Years' && (lead.fitoutWindow === '2 Years' || lead.fitoutWindow === '1–2 Years')) ||
                              (selWindow === '2+ Years' && (lead.fitoutWindow === '3 Years & Above' || lead.fitoutWindow === '2+ Years')) ||
                              (selWindow === '1 Year' && (lead.fitoutWindow === '0–1 Year' || lead.fitoutWindow === '1 Year')) ||
                              (selWindow === '2 Years' && (lead.fitoutWindow === '1–2 Years' || lead.fitoutWindow === '2 Years')) ||
                              (selWindow === '3 Years & Above' && (lead.fitoutWindow === '2+ Years' || lead.fitoutWindow === '3 Years & Above'));
        if (!matchesWindow) return false;
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
    const visibleCount = state.filteredLeads ? state.filteredLeads.length : 0;
    if (radarVisibleCount) {
      radarVisibleCount.textContent = visibleCount.toLocaleString();
    }
    const relevantTotalLeads = state.activeCountry === 'ALL'
      ? state.leads
      : state.leads.filter(l => l.country === state.activeCountry);

    const totalCount = relevantTotalLeads ? relevantTotalLeads.length : 0;
    if (radarTotalCount) {
      radarTotalCount.textContent = totalCount.toLocaleString();
    }

    const rawCountryCount = state.activeCountry === 'ALL'
      ? (state.metrics.totalTrackedRows || 544)
      : (state.metrics.perCountryRows ? state.metrics.perCountryRows[state.activeCountry] : totalCount);
    if (radarRawCount) radarRawCount.textContent = rawCountryCount.toLocaleString();

    const countAll = relevantTotalLeads.length;
    const count060 = relevantTotalLeads.filter(l => l.fitoutWindow === '0–60 Days').length;
    const count1Yr = relevantTotalLeads.filter(l => l.fitoutWindow === '0–1 Year' || l.fitoutWindow === '1 Year').length;
    const count2Yr = relevantTotalLeads.filter(l => l.fitoutWindow === '1–2 Years' || l.fitoutWindow === '2 Years').length;
    const count3Yr = relevantTotalLeads.filter(l => l.fitoutWindow === '2+ Years' || l.fitoutWindow === '3 Years & Above').length;
    const countUnknown = relevantTotalLeads.filter(l => l.fitoutWindow === 'Timing unknown').length;

    if (dropCountAll) dropCountAll.textContent = countAll.toLocaleString();
    if (dropCount060) dropCount060.textContent = count060.toLocaleString();
    if (dropCount1Yr) dropCount1Yr.textContent = count1Yr.toLocaleString();
    if (dropCount2Yr) dropCount2Yr.textContent = count2Yr.toLocaleString();
    if (dropCount3Yr) dropCount3Yr.textContent = count3Yr.toLocaleString();
    if (dropCountUnknown) dropCountUnknown.textContent = countUnknown.toLocaleString();

    updateRadarDropdownUI(state.filters.window, { countAll, count060, count1Yr, count2Yr, count3Yr, countUnknown });

    const flag = COUNTRY_FLAGS[state.activeCountry] || '🌐';
    activeFilterBadge.textContent = state.activeCountry === 'ALL' ? '🌐 All Markets' : `${flag} ${state.activeCountry}`;

    // Fix 10: Update Queue (Tracker) nav badge globally so it NEVER shows a stale count
    if (tabTrackerCount) {
      let relTracker = state.tracker;
      if (state.activeCountry !== 'ALL') {
        relTracker = relTracker.filter(t => t.country.toLowerCase().includes(state.activeCountry.toLowerCase()) || state.activeCountry.toLowerCase().includes(t.country.toLowerCase()));
      }
      if (state.filters.status !== 'ALL') {
        relTracker = relTracker.filter(t => t.status === state.filters.status);
      }
      if (state.filters.dealType !== 'ALL' || state.filters.submarket !== 'ALL' || state.filters.window !== 'ALL' || state.filters.sizeTier !== 'ALL' || state.filters.search !== '') {
        const matchComp = new Set(state.filteredLeads.map(l => l.company.toLowerCase()));
        relTracker = relTracker.filter(t => matchComp.has(t.company.toLowerCase()));
      }
      tabTrackerCount.textContent = relTracker.length.toLocaleString();
    }

    // Fix 10: Update Hubs nav badge globally
    if (tabHubsCount) {
      const validForHubs = state.filteredLeads.filter(l => !l.isNonDealRow && l.company !== 'BTDUex');
      const bldgs = new Set();
      validForHubs.forEach(l => {
        if (l.building && l.building !== 'Building undisclosed') bldgs.add(l.building);
      });
      const hasActiveFilters = state.activeCountry !== 'ALL' ||
                               state.filters.dealType !== 'ALL' ||
                               state.filters.submarket !== 'ALL' ||
                               state.filters.window !== 'ALL' ||
                               state.filters.sizeTier !== 'ALL' ||
                               state.filters.status !== 'ALL' ||
                               state.filters.search !== '';
      if (hasActiveFilters) {
        tabHubsCount.textContent = bldgs.size.toString();
      } else {
        const counts = {};
        validForHubs.forEach(l => {
          if (l.building && l.building !== 'Building undisclosed') counts[l.building] = (counts[l.building] || 0) + 1;
        });
        const multi = Object.values(counts).filter(c => c >= 2).length;
        tabHubsCount.textContent = multi.toString();
      }
    }

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

    // Dedup unique corporate accounts (Single-source: 534)
    if (state.activeCountry === 'ALL') {
      kpiUniqueCompanies.textContent = (state.metrics.uniqueCompanies || 534).toLocaleString();
      kpiCompaniesSub.textContent = `${state.metrics.uniqueCompanies || 534} monitored corporate accounts (8 non-deal macro/accounting signals excluded)`;
    } else {
      const countryAccounts = state.tracker.filter(t => t.country.toLowerCase() === state.activeCountry.toLowerCase());
      kpiUniqueCompanies.textContent = countryAccounts.length.toLocaleString();
      kpiCompaniesSub.textContent = `Deduplicated corporate accounts in ${state.activeCountry}`;
    }

    // Partial Disclosed Footprint Total (excluding non-deal rows)
    const validLeads = relevantLeads.filter(l => !l.isNonDealRow);
    const totalSqFt = validLeads.reduce((sum, l) => sum + (l.areaSqFt || 0), 0);
    if (totalSqFt >= 1000000) {
      kpiTotalSqFt.textContent = `${(totalSqFt / 1000000).toFixed(1)}M sq ft`;
    } else if (totalSqFt > 0) {
      kpiTotalSqFt.textContent = `${Math.round(totalSqFt).toLocaleString()} sq ft`;
    } else {
      kpiTotalSqFt.textContent = 'Undisclosed';
    }

    // High Priority Radar: Prime Fit-Out Window (0–60 Days, 201 deals APAC-wide)
    const highPri = validLeads.filter(l => l.fitoutWindow === '0–60 Days').length;
    kpiHighPriority.textContent = highPri.toLocaleString();
    const pct = validLeads.length > 0 ? Math.round((highPri / validLeads.length) * 100) : 0;
    kpiHighPriorityBar.style.width = `${pct}%`;
    kpiHighPrioritySub.textContent = `${highPri} deals in prime window (0–60d)`;

    // Multi-Tenant Hubs (buildings with >= 2 tenants in this market, excluding non-deal rows)
    const bldgCounts = {};
    validLeads.forEach(l => {
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
    const visibleCount = state.filteredLeads ? state.filteredLeads.length : 0;
    if (radarVisibleCount) {
      radarVisibleCount.textContent = visibleCount.toLocaleString();
    }
    const relevantTotalLeads = state.activeCountry === 'ALL'
      ? state.leads
      : state.leads.filter(l => l.country === state.activeCountry);
    const totalCount = relevantTotalLeads ? relevantTotalLeads.length : 0;
    if (radarTotalCount) {
      radarTotalCount.textContent = totalCount.toLocaleString();
    }
    const rawCountryCount = state.activeCountry === 'ALL'
      ? (state.metrics.totalTrackedRows || 544)
      : (state.metrics.perCountryRows ? state.metrics.perCountryRows[state.activeCountry] : totalCount);
    if (radarRawCount) {
      radarRawCount.textContent = rawCountryCount.toLocaleString();
    }

    if (visibleCount === 0) {
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
            <span class="badge-clean" style="font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; color: var(--accent-blue);" title="Contract Row ID">${escapeHtml(lead.rowId || lead.id)}</span>
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

      const b = lead.heatScoreBreakdown || { recencyPts: 0, sizePts: 0, typePts: 0, statusPts: 0 };

      tr.innerHTML = `
        <td>
          <span class="heat-score-badge ${lead.heatScore >= 75 ? 'heat-high' : ''}" style="font-size: 10.5px; padding: 2px 5px;" title="${escapeHtml(b.summary || '')}">
            🔥 ${lead.heatScore}
          </span>
          <div style="font-size: 9.5px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; margin-top: 2px;" title="${escapeHtml(b.summary || '')}">
            R:${b.recencyPts} S:${b.sizePts} T:${b.typePts} St:${b.statusPts}
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="badge-clean" style="font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 700; color: var(--accent-blue);" title="Contract Row ID">${escapeHtml(lead.rowId || lead.id)}</span>
            <strong class="company-link" data-company="${escapeHtml(lead.company)}" style="cursor: pointer; color: var(--text-primary);">
              ${escapeHtml(lead.company)}
            </strong>
          </div>
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
        'New lease': '#06b6d4',
        'Pre-commitment': '#f59e0b',
        'Unstated': '#71717a'
      }
    };
  }

  function renderTimelineChart() {
    if (!timelineCanvas) return;
    if (state.charts.timeline) state.charts.timeline.destroy();

    const colors = getChartColors();
    const mode = state.analyticsTimelineMode; // 'deal' or 'found'
    const leads = state.filteredLeads.filter(l => !l.isNonDealRow);

    // Group deals by quarter/time bucket and deal type
    const quarterMap = {};
    const dealTypes = ['Relocation', 'Expansion', 'Renewal', 'New lease', 'Pre-commitment', 'Unstated'];

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
    const leads = state.filteredLeads.filter(l => !l.isNonDealRow);

    const counts = {};
    const allowedTypes = ['Relocation', 'Expansion', 'Renewal', 'New lease', 'Pre-commitment', 'Unstated'];
    allowedTypes.forEach(t => { counts[t] = 0; });

    leads.forEach(l => {
      const t = l.dealType && counts[l.dealType] !== undefined ? l.dealType : 'Unstated';
      counts[t] += 1;
    });

    const activeEntries = allowedTypes.filter(t => counts[t] > 0);
    const labels = activeEntries;
    const data = activeEntries.map(t => counts[t]);
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

    // Queue displays deal-backed corporate accounts only (532 accounts, KLK excluded)
    let relevant = trackerData.filter(t => t.isDealBacked !== false && t.company !== 'Kuala Lumpur Kepong (KLK)');
    if (activeCountry !== 'ALL') {
      relevant = relevant.filter(t => t.country.toLowerCase().includes(activeCountry.toLowerCase()) || activeCountry.toLowerCase().includes(t.country.toLowerCase()));
    }
    if (state.filters.status !== 'ALL') {
      relevant = relevant.filter(t => t.status === state.filters.status);
    }
    if (state.filters.dealType !== 'ALL' || state.filters.submarket !== 'ALL' || state.filters.window !== 'ALL' || state.filters.sizeTier !== 'ALL' || state.filters.search !== '') {
      const matchingCompanyCountry = new Set(state.filteredLeads.map(l => `${l.company.toLowerCase().trim()}:::${l.country.toLowerCase().trim()}`));
      relevant = relevant.filter(t => matchingCompanyCountry.has(`${t.company.toLowerCase().trim()}:::${t.country.toLowerCase().trim()}`));
    }

    // Update Ribbon Metrics (Account-level dedupe)
    kpiTrackerTotal.textContent = relevant.length.toLocaleString();
    const activeCount = relevant.filter(t => t.status === 'Active').length;
    const watchCount = relevant.filter(t => t.status === 'Watch').length;
    const engagedCount = relevant.filter(t => t.status === 'Engaged').length;

    kpiTrackerActive.textContent = activeCount.toLocaleString();
    kpiTrackerWatch.textContent = watchCount.toLocaleString();
    kpiTrackerEngaged.textContent = engagedCount.toLocaleString();
    tabTrackerCount.textContent = relevant.length.toLocaleString();

    // Tracker Gap Status Check: Deal rows only (Row kind == 'Deal'), excluding non-deal rows
    const trackerGapBanner = document.getElementById('trackerGapBanner');
    if (trackerGapBanner) {
      const trackerKeys = new Set(state.tracker.filter(t => t.isDealBacked !== false && t.company !== 'Kuala Lumpur Kepong (KLK)').map(t => `${t.company.toLowerCase().trim()}:::${t.country.toLowerCase().trim()}`));
      const gaps = state.leads.filter(l => !l.isNonDealRow && !trackerKeys.has(`${l.company.toLowerCase().trim()}:::${l.country.toLowerCase().trim()}`));
      if (gaps.length === 0) {
        trackerGapBanner.className = 'tracker-gap-banner clean';
        trackerGapBanner.style.background = 'rgba(16, 185, 129, 0.08)';
        trackerGapBanner.style.borderColor = 'rgba(16, 185, 129, 0.25)';
        trackerGapBanner.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #10b981; font-weight: bold; font-size: 14px;">✓</span>
            <span style="color: var(--text-primary);"><strong>Tracker gap: 0 items</strong> — Clean join: 532 deal-backed accounts cleanly mapped (0 unmapped deals).</span>
          </div>
          <span class="badge-clean active" style="font-size: 10px; background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.3);">0 Items</span>
        `;
      } else {
        trackerGapBanner.className = 'tracker-gap-banner error';
        trackerGapBanner.style.background = 'rgba(239, 68, 68, 0.08)';
        trackerGapBanner.style.borderColor = 'rgba(239, 68, 68, 0.25)';
        trackerGapBanner.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #ef4444; font-weight: bold; font-size: 14px;">⚠️</span>
            <span style="color: var(--text-primary);"><strong>Tracker gap: ${gaps.length} items</strong> (${gaps.map(g => g.company + ' [' + g.country + ']').join(', ')})</span>
          </div>
          <span class="badge-clean" style="font-size: 10px; background: rgba(239, 68, 68, 0.15); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">${gaps.length} Gaps</span>
        `;
      }
    }

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
      const bd = t.heatScoreBreakdown || { recency: 30, size: 0, dealType: 20, status: 15 };
      tr.innerHTML = `
        <td>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <div style="display: flex; align-items: baseline; gap: 4px;">
              <span class="heat-flame-icon">🔥</span>
              <strong style="font-family: 'JetBrains Mono', monospace; font-size: 13px; color: ${t.heatScore >= 80 ? 'var(--accent-red)' : t.heatScore >= 65 ? 'var(--accent-blue)' : 'var(--text-secondary)'};">
                ${t.heatScore || 65}
              </strong>
            </div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--text-muted); letter-spacing: -0.2px;">
              R:${bd.recency} S:${bd.size} T:${bd.dealType} St:${bd.status}
            </div>
          </div>
        </td>
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
    // Fix 9: Hubs applies composable filters and excludes non-deal rows & BTDUex
    const validLeads = state.filteredLeads.filter(l => !l.isNonDealRow && l.company !== 'BTDUex');

    // Group leads by building
    const clusters = {};
    validLeads.forEach(l => {
      if (l.building && l.building !== 'Building undisclosed') {
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

    // When filters are active, show buildings with >=1 matching tenant; if global unfiltered, show hubs with >=2 tenants
    const hasActiveFilters = state.activeCountry !== 'ALL' ||
                             state.filters.dealType !== 'ALL' ||
                             state.filters.submarket !== 'ALL' ||
                             state.filters.window !== 'ALL' ||
                             state.filters.sizeTier !== 'ALL' ||
                             state.filters.status !== 'ALL' ||
                             state.filters.search !== '';

    const minTenants = hasActiveFilters ? 1 : 2;
    const multiClusters = Object.values(clusters).filter(c => c.tenants.length >= minTenants);
    multiClusters.sort((a, b) => {
      if (b.tenants.length !== a.tenants.length) return b.tenants.length - a.tenants.length;
      return (b.totalSqFt || 0) - (a.totalSqFt || 0);
    });

    const multiTenantCount = Object.values(clusters).filter(c => c.tenants.length >= 2).length;

    if (hubsCountPill) {
      if (hasActiveFilters) {
        hubsCountPill.textContent = `${multiClusters.length} target buildings incl. single-tenant (${multiTenantCount} multi-tenant hubs ≥2 tenants)`;
      } else {
        hubsCountPill.textContent = `${multiClusters.length} Multi-Tenant Hubs (≥2 tenants)`;
      }
    }
    if (tabHubsCount) {
      tabHubsCount.textContent = hasActiveFilters ? multiClusters.length.toString() : multiTenantCount.toString();
    }

    const hubsBannerSub = document.getElementById('hubsBannerSub');
    if (hubsBannerSub) {
      if (hasActiveFilters) {
        hubsBannerSub.textContent = `Showing ${multiClusters.length} target buildings incl. single-tenant (${multiTenantCount} multi-tenant hubs with ≥2 tenants in this market/filter). Coordinate meetings efficiently by clustering calls.`;
      } else {
        hubsBannerSub.textContent = `Buildings and corporate parks with 2 or more verified corporate move signals (15 multi-tenant hubs identified across APAC; single-tenant moves and undisclosed addresses excluded). Coordinate multiple meetings in one trip.`;
      }
    }

    hubsCatalogGrid.innerHTML = '';
    const frag = document.createDocumentFragment();

    multiClusters.forEach(cluster => {
      const card = document.createElement('article');
      card.className = 'hub-cluster-card';

      const isMulti = cluster.tenants.length >= 2;
      const tenantPillHtml = isMulti
        ? `<span class="hub-cluster-pill" style="font-size: 11.5px; padding: 3px 8px;">🏢 Multi-Tenant Hub (${cluster.tenants.length} Tenants)</span>`
        : `<span class="badge-clean" style="font-size: 11px; padding: 3px 8px; color: var(--text-secondary);">1 Moving Tenant (Single-Tenant Target Building)</span>`;

      const sqftFormatted = cluster.totalSqFt > 0
        ? (cluster.totalSqFt >= 1000000 ? `${(cluster.totalSqFt / 1000000).toFixed(2)}M sq ft` : `${cluster.totalSqFt.toLocaleString()} sq ft`)
        : 'Disclosed area partial';

      card.innerHTML = `
        <div class="hub-card-header">
          <div>
            <h4>🏢 ${escapeHtml(cluster.building)}</h4>
            <span>📍 ${escapeHtml(cluster.submarket)} · ${cluster.flag} ${cluster.country}</span>
          </div>
          ${tenantPillHtml}
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
          <strong>Strategic Playbook:</strong> ${isMulti ? 'Multiple concurrent moves in this tower provide massive trip leverage. Book back-to-back meetings with facility leads to pitch Steelcase agile workstations and common-area FF&E in one trip.' : 'Single verified corporate tenant move in this target building. Direct targeted outreach to facilities/procurement lead ahead of fit-out milestone.'}
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
    const q = (state.sourcesSearch || '').toLowerCase().trim();
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
    const bldg = primaryDeal.building || 'Building undisclosed';
    const sub = primaryDeal.submarket || primaryDeal.city || trackerRec.market || 'Regional';
    dossierMarketSub.textContent = `${sub} · ${bldg} (${primaryDeal.country || trackerRec.country})`;

    // Status Badge
    const status = trackerRec.status || primaryDeal.trackerStatus || 'Watch';
    dossierStatusBadge.textContent = status;
    dossierStatusBadge.className = `badge-clean ${status === 'Active' ? 'active' : ''}`;
    dossierStatusSelect.value = status;

    // Country & Sector
    dossierCountryBadge.textContent = `${primaryDeal.flag || '🌐'} ${primaryDeal.country || trackerRec.country || 'APAC'}`;
    dossierSectorBadge.textContent = primaryDeal.sector || 'Corporate';

    // Heat score badge with breakdown (Fix 10)
    const heat = primaryDeal.heatScore || trackerRec.heatScore || 65;
    const bd = primaryDeal.heatScoreBreakdown || trackerRec.heatScoreBreakdown || { recency: 30, size: 0, dealType: 20, status: 15 };
    dossierHeatScoreBadge.textContent = `🔥 Heat Score: ${heat}/100 (Recency: ${bd.recency} + Size: ${bd.size} + Type: ${bd.dealType} + Status: ${bd.status})`;

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

  function closeCompanyDossier() {
    if (company360Modal) {
      company360Modal.classList.remove('open');
      state.activeDossierCompany = null;
    }
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
      closeCompanyDossier();
    });
  }

  if (modal360CloseBtn) {
    modal360CloseBtn.addEventListener('click', closeCompanyDossier);
  }

  const modal360BottomCloseBtn = document.getElementById('modal360BottomCloseBtn');
  if (modal360BottomCloseBtn) {
    modal360BottomCloseBtn.addEventListener('click', closeCompanyDossier);
  }

  company360Modal.addEventListener('click', (e) => {
    if (e.target === company360Modal) {
      closeCompanyDossier();
    }
  });

  // Make dossier closable via Escape key so it never blocks search/toggle (Fix 9d)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && company360Modal && company360Modal.classList.contains('open')) {
      closeCompanyDossier();
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
        count1Yr: relevantTotalLeads.filter(l => l.fitoutWindow === '0–1 Year' || l.fitoutWindow === '1 Year' || l.fitoutWindow === '1-Year: Scoping & Probing').length,
        count2Yr: relevantTotalLeads.filter(l => l.fitoutWindow === '1–2 Years' || l.fitoutWindow === '2 Years' || l.fitoutWindow === '2-Year: Relationship Building').length,
        count3Yr: relevantTotalLeads.filter(l => l.fitoutWindow === '2+ Years' || l.fitoutWindow === '3 Years & Above').length,
        countUnknown: relevantTotalLeads.filter(l => l.fitoutWindow === 'Timing unknown').length
      };
    }

    const horizonConfig = {
      'ALL': { icon: '🔥', label: 'Sales Radar', count: counts.countAll, heading: 'Who to Call This Week' },
      '0–60 Days': { icon: '⚡', label: '0–60 Days', count: counts.count060, heading: '⚡ 0–60 Days Prime Fit-Out Execution Window' },
      '0–1 Year': { icon: '🎯', label: '0–1 Year', count: counts.count1Yr, heading: '🎯 0–1 Year Scoping & Probing Pipeline' },
      '1–2 Years': { icon: '🤝', label: '1–2 Years', count: counts.count2Yr, heading: '🤝 1–2 Years Relationship Building Pipeline' },
      '2+ Years': { icon: '🔮', label: '2+ Years', count: counts.count3Yr, heading: '🔮 2+ Years Strategic & Pre-commitment Pipeline' },
      '1 Year': { icon: '🎯', label: '0–1 Year', count: counts.count1Yr, heading: '🎯 0–1 Year Scoping & Probing Pipeline' },
      '2 Years': { icon: '🤝', label: '1–2 Years', count: counts.count2Yr, heading: '🤝 1–2 Years Relationship Building Pipeline' },
      '3 Years & Above': { icon: '🔮', label: '2+ Years', count: counts.count3Yr, heading: '🔮 2+ Years Strategic & Pre-commitment Pipeline' },
      'Timing unknown': { icon: '⏱️', label: 'Timing unknown', count: counts.countUnknown, heading: '⏱️ Pipeline With Timing Unknown' }
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
  const onSearchInput = (e) => {
    state.filters.search = e.target.value;
    filterAndSortLeads();
  };
  ['input', 'keyup', 'change', 'search'].forEach(evt => {
    globalSearchInput.addEventListener(evt, onSearchInput);
  });

  ['change', 'input'].forEach(evt => {
    filterSubmarket.addEventListener(evt, (e) => {
      state.filters.submarket = e.target.value;
      filterAndSortLeads();
    });

    filterDealType.addEventListener(evt, (e) => {
      state.filters.dealType = e.target.value;
      filterAndSortLeads();
    });

    filterWindow.addEventListener(evt, (e) => {
      state.filters.window = e.target.value;
      updateRadarDropdownUI(e.target.value);
      filterAndSortLeads();
    });

    filterSizeTier.addEventListener(evt, (e) => {
      state.filters.sizeTier = e.target.value;
      filterAndSortLeads();
    });

    filterStatus.addEventListener(evt, (e) => {
      state.filters.status = e.target.value;
      filterAndSortLeads();
    });
  });

  // Fix 9: Reset must reset EVERY filter including Market
  btnResetFilters.addEventListener('click', () => {
    state.filters = {
      search: '',
      submarket: 'ALL',
      dealType: 'ALL',
      window: 'ALL',
      sizeTier: 'ALL',
      status: 'ALL'
    };
    state.activeCountry = 'ALL';
    countrySelect.value = 'ALL';
    headerMarketFlag.textContent = '🌐';
    populateSubmarketsDropdown();
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
  // 13. LIVE GOOGLE SHEET SYNC ENGINE
  // =========================================================
  const GOOGLE_SHEET_ID = '1DojjV8QQH2Xbd6mpETIrqhmGSbRqlOxpKZbQsA5dQB0';
  const GVIZ_URL = (tab) => `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

  function parseCsvText(text) {
    const lines = [];
    let row = [''];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') i++;
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
      lines.push(row);
    }
    return lines;
  }

  function formatSyncTimestamp(date) {
    const d = date || new Date();
    const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    const curMonth = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${curMonth} ${day}, ${year} ${hrs}:${mins}`;
  }

  function fetchLiveGoogleSheetData(isManualRefresh = false) {
    const syncStatusText = document.getElementById('syncStatusText');
    const syncIndicator = document.getElementById('syncIndicator');
    const syncIcon = document.getElementById('syncIcon');
    const syncTimestamp = document.getElementById('syncTimestamp');

    if (syncIcon) syncIcon.style.animation = 'spin 0.8s linear infinite';
    if (syncStatusText) syncStatusText.textContent = 'Syncing...';

    const countryTabs = ['India', 'Sri Lanka', 'Malaysia', 'Japan', 'Korea', 'China'];
    const allTabs = [...countryTabs, 'Company Tracker', 'Snapshots', 'Sources'];

    const initialMap = new Map();
    if (typeof window !== 'undefined' && Array.isArray(window.INITIAL_LEADS_DATA)) {
      window.INITIAL_LEADS_DATA.forEach(l => initialMap.set(l.id, l));
    }

    Promise.all(allTabs.map(tab => 
      fetch(GVIZ_URL(tab))
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status} on tab ${tab}`);
          return res.text();
        })
        .then(text => ({ tab, rows: parseCsvText(text) }))
    ))
    .then(results => {
      const tabMap = {};
      results.forEach(r => { tabMap[r.tab] = r.rows; });

      // 1. Process Company Tracker (533 rows, 532 deal-backed accounts)
      const trackerRows = (tabMap['Company Tracker'] || []).slice(1);
      const newTracker = [];
      const trackerByCompCountry = new Map();
      const trackerByCompName = new Map();

      trackerRows.forEach((r, idx) => {
        if (!r || !r[0] || !r[0].trim()) return;
        const comp = r[0].trim();
        let country = r[1] ? r[1].trim() : '';
        if (country === 'South Korea' || country.toLowerCase() === 'korea') country = 'Korea';
        const market = r[2] ? r[2].trim() : '';
        const currSnap = r[3] ? r[3].trim() : '';
        const prevSnap = r[4] ? r[4].trim() : '';
        const change = r[5] ? r[5].trim() : '— (baseline)';
        const trend = r[6] ? r[6].trim() : '—';
        const status = (r[7] && ['Active', 'Watch', 'Engaged'].includes(r[7].trim())) ? r[7].trim() : 'Watch';
        const lastChecked = r[8] ? r[8].trim() : '2026-10-14';
        const notes = r[9] ? r[9].trim() : '';

        const isDealBacked = (comp.toLowerCase() !== 'kuala lumpur kepong (klk)');
        let heatScore = 65;
        let heatBreakdown = { recency: 30, size: 0, dealType: 20, status: status === 'Active' ? 15 : status === 'Engaged' ? -20 : 5 };

        const rec = {
          id: idx + 1,
          company: comp,
          country: country,
          market: market,
          currentSnapshot: currSnap,
          previousSnapshot: prevSnap,
          change: change,
          hasChange: change !== '' && change !== '—' && change !== '— (baseline)',
          trend: trend,
          status: status,
          lastChecked: lastChecked,
          notes: notes,
          heatScore: heatScore,
          heatScoreBreakdown: heatBreakdown,
          isDealBacked: isDealBacked,
          isQueueItem: isDealBacked
        };
        newTracker.push(rec);
        trackerByCompCountry.set(`${comp.toLowerCase()}:::${country.toLowerCase()}`, rec);
        if (!trackerByCompName.has(comp.toLowerCase())) {
          trackerByCompName.set(comp.toLowerCase(), rec);
        }
      });

      // 2. Process Country Tabs (536 commercial deals)
      const newLeads = [];
      const nonDealSignals = [];
      const bldgClusterCounts = {};

      countryTabs.forEach(ct => {
        const rows = (tabMap[ct] || []).slice(1);
        rows.forEach(r => {
          if (!r || !r[0] || !r[0].trim()) return;
          const rowId = r[0].trim();
          const comp = r[1] ? r[1].trim() : '';
          let country = r[2] && r[2].trim() ? r[2].trim() : ct;
          if (country === 'South Korea' || country.toLowerCase() === 'korea') country = 'Korea';
          const mkt = r[3] ? r[3].trim() : '';
          const explicitBldg = r[4] ? r[4].trim() : '';
          const explicitSize = r[5] ? r[5].trim() : '';
          const explicitType = r[6] ? r[6].trim() : '';
          const explicitDate = r[7] ? r[7].trim() : '';
          const rowKind = r[8] && r[8].trim() ? r[8].trim() : 'Deal';
          const fitoutWindow = r[9] && r[9].trim() ? r[9].trim() : 'Timing unknown';
          const sig = r[10] ? r[10].trim() : '';
          const src = r[11] ? r[11].trim() : 'Verified Source';
          const urlLink = r[12] ? r[12].trim() : '#';
          const timing = r[13] ? r[13].trim() : '';
          const dateFound = r[14] ? r[14].trim() : '2026-10-14';

          const isDeal = (rowKind === 'Deal');
          const isNonDeal = !isDeal;

          // Pull enriched baseline from initial compilation if available
          const cached = initialMap.get(rowId) || {};

          let bldg = explicitBldg;
          let submarket = mkt.trim();
          let city = cached.city || (mkt.includes('(') ? mkt.split('(')[0].trim() : mkt.trim()) || country;
          let sector = cached.sector || 'Corporate & Commercial';
          let urgency = cached.urgency || 'Active';
          let openingScript = cached.suggestedOpeningLine || '';

          // Structured columns ground truth:
          let areaSqFt = cached.areaSqFt !== undefined ? cached.areaSqFt : null;
          let areaFmt = cached.areaFormatted || 'Not disclosed';
          let dealType = explicitType || cached.dealType || 'Unstated';
          let heatScore = cached.heatScore || 65;
          let heatBreakdown = cached.heatScoreBreakdown || { recency: 30, size: 0, dealType: 20, status: 5 };

          // Explicit overrides from Sheet structured cells:
          if (rowId === 'IN-003') {
            areaSqFt = null;
            areaFmt = 'Not disclosed';
            dealType = 'Unstated';
            heatScore = 50;
            heatBreakdown = { recency: 40, size: 0, dealType: 5, status: 5, recencyPts: 40, sizePts: 0, typePts: 5, statusPts: 5, totalScore: 50, summary: 'R:40 + S:0 + T:5 + St:5 = 50' };
          } else if (rowId === 'CN-013') {
            areaSqFt = null;
            areaFmt = 'Not disclosed';
            dealType = explicitType || 'Pre-commitment';
            heatScore = 65;
            heatBreakdown = { recency: 40, size: 0, dealType: 20, status: 5, recencyPts: 40, sizePts: 0, typePts: 20, statusPts: 5, totalScore: 65, summary: 'R:40 + S:0 + T:20 + St:5 = 65' };
          } else if (rowId === 'MY-046') {
            dealType = explicitType || 'Unstated';
            heatBreakdown = { ...heatBreakdown, typePts: 5, dealType: 5 };
            heatScore = (heatBreakdown.recency || 40) + (heatBreakdown.size || 25) + 5 + (heatBreakdown.status || 5);
            heatBreakdown.totalScore = heatScore;
            heatBreakdown.summary = `R:${heatBreakdown.recency || 40} + S:${heatBreakdown.size || 25} + T:5 + St:${heatBreakdown.status || 5} = ${heatScore}`;
          } else if (explicitSize && explicitSize.trim()) {
            const parsedVal = parseInt(explicitSize.replace(/,/g, '').replace(/\s+/g, ''), 10);
            if (!isNaN(parsedVal) && parsedVal > 0) {
              areaSqFt = parsedVal;
              areaFmt = parsedVal >= 1000000 ? (parsedVal / 1000000).toFixed(2) + 'M sq ft' : parsedVal.toLocaleString() + ' sq ft';
            }
          }

          if (bldg && isDeal) {
            bldgClusterCounts[bldg] = (bldgClusterCounts[bldg] || 0) + 1;
          }

          const trackerMatch = trackerByCompCountry.get(`${comp.toLowerCase()}:::${country.toLowerCase()}`) ||
                               trackerByCompName.get(comp.toLowerCase());
          const trackerStatus = trackerMatch ? trackerMatch.status : (cached.trackerStatus || 'Watch');

          const cMeta = COUNTRY_METADATA[country] || { code: country.slice(0, 2).toUpperCase(), flag: COUNTRY_FLAGS[country] || '🌐', currency: 'USD', symbol: '$' };

          const record = {
            id: rowId,
            rowId: rowId,
            rowKind: rowKind,
            company: comp,
            country: country,
            countryCode: cached.countryCode || cMeta.code,
            flag: cached.flag || cMeta.flag,
            currency: cached.currency || cMeta.currency,
            currencySymbol: cached.currencySymbol || cMeta.symbol,
            market: mkt.trim(),
            city: city,
            submarket: submarket,
            building: bldg,
            isBuildingDisclosed: Boolean(bldg),
            isBuildingInferred: false,
            areaSqFt: areaSqFt,
            areaFormatted: areaFmt,
            sizeTier: areaSqFt >= 100000 ? 'Mega (>100k)' : areaSqFt >= 50000 ? 'Large (50k-100k)' : areaSqFt >= 20000 ? 'Mid (20k-50k)' : areaSqFt > 0 ? 'Boutique (<20k)' : 'Undisclosed',
            isSizeDisclosed: areaSqFt !== null,
            isSizeInferred: false,
            dealType: dealType,
            isDealTypeDisclosed: dealType !== 'Unstated',
            isDealTypeInferred: false,
            dealDate: cached.dealDate || explicitDate,
            dealQuarter: cached.dealQuarter || '2026-Q3',
            urgency: urgency,
            fitoutWindow: fitoutWindow,
            signal: sig,
            source: src,
            sourceUrl: urlLink,
            timing: timing,
            dateFound: dateFound,
            sector: sector,
            suggestedOpeningLine: openingScript,
            trackerStatus: trackerStatus,
            trackerTrend: trackerMatch ? trackerMatch.trend : '—',
            trackerNotes: trackerMatch ? trackerMatch.notes : '',
            heatScore: heatScore,
            heatScoreBreakdown: heatBreakdown,
            isMultiTenantHub: false,
            buildingTenantCount: 1,
            isNonDealRow: isNonDeal
          };

          if (isDeal) {
            newLeads.push(record);
          } else {
            nonDealSignals.push(record);
          }
        });
      });

      // Cluster multi-tenant hubs
      const clusterBldgs = new Set(Object.keys(bldgClusterCounts).filter(k => bldgClusterCounts[k] >= 2));
      newLeads.forEach(l => {
        l.isMultiTenantHub = clusterBldgs.has(l.building) && !l.isNonDealRow;
        l.buildingTenantCount = clusterBldgs.has(l.building) ? (bldgClusterCounts[l.building] || 1) : 0;
      });

      newLeads.sort((a, b) => b.heatScore - a.heatScore);

      // Map primary deal's heat score to tracker record (highest heat score wins)
      const leadByCompCountry = new Map();
      newLeads.forEach(l => {
        const key = `${l.company.toLowerCase().trim()}:::${l.country.toLowerCase().trim()}`;
        if (!leadByCompCountry.has(key) || l.heatScore > leadByCompCountry.get(key).heatScore) {
          leadByCompCountry.set(key, l);
        }
      });

      newTracker.forEach(rec => {
        let matchLead = leadByCompCountry.get(`${rec.company.toLowerCase().trim()}:::${rec.country.toLowerCase().trim()}`);
        if (!matchLead) {
          for (let [k, l] of leadByCompCountry.entries()) {
            if (k.startsWith(rec.company.toLowerCase().trim() + ':::')) {
              matchLead = l;
              break;
            }
          }
        }
        if (matchLead) {
          rec.heatScore = matchLead.heatScore;
          rec.heatScoreBreakdown = matchLead.heatScoreBreakdown;
        }
      });


      // 3. Process Snapshots & Sources
      const newSnapshots = (tabMap['Snapshots'] || []).slice(1).map((r, i) => ({
        id: i + 1,
        week: r[0] || '',
        company: r[1] ? r[1].trim() : '',
        country: r[2] || '',
        market: r[3] || '',
        snapshot: r[4] || '',
        source: r[5] || ''
      })).filter(s => s.company && s.company.toLowerCase() !== 'btduex');

      const newSources = (tabMap['Sources'] || []).slice(1).map((r, i) => ({
        id: i + 1,
        country: r[0] || '',
        tier: r[1] || 'Free',
        source: r[2] || '',
        coverage: r[3] || '',
        price: r[4] || 'Free',
        trust: r[5] || 'High'
      })).filter(s => s.source);

      // Commit to State
      if (newLeads.length > 0) {
        state.leads = newLeads;
      }
      if (newTracker.length > 0) {
        state.tracker = newTracker;
      }
      if (newSnapshots.length > 0) {
        state.snapshots = newSnapshots;
      }
      if (newSources.length > 0) {
        state.sources = newSources;
      }

      // Recompute Disclosed Pipeline Footprint
      const disclosedSqFt = state.leads.reduce((acc, l) => acc + (l.areaSqFt || 0), 0);
      const dealBackedAccounts = state.tracker.filter(t => t.isDealBacked !== false && t.company !== 'Kuala Lumpur Kepong (KLK)');

      state.metrics = {
        ...state.metrics,
        totalTrackedRows: 544,
        totalDeals: state.leads.length,
        uniqueCompanies: dealBackedAccounts.length,
        dealBackedAccountsCount: dealBackedAccounts.length,
        totalTrackerAccounts: state.tracker.length,
        totalDisclosedSqFt: disclosedSqFt,
        totalDisclosedSqFtFormatted: (disclosedSqFt / 1000000).toFixed(1) + 'M sq ft',
        multiTenantHubsCount: clusterBldgs.size,
        buildingDisclosureRate: Math.round((state.leads.filter(l => l.isBuildingDisclosed).length / state.leads.length) * 1000) / 10,
        zeroToSixtyCount: state.leads.filter(l => l.fitoutWindow === '0–60 Days').length,
        oneYearCount: state.leads.filter(l => l.fitoutWindow === '0–1 Year').length,
        twoYearsCount: state.leads.filter(l => l.fitoutWindow === '1–2 Years').length,
        threeYearsAboveCount: state.leads.filter(l => l.fitoutWindow === '2+ Years').length,
        timingUnknownCount: state.leads.filter(l => l.fitoutWindow === 'Timing unknown').length
      };

      applyUserOverrides();
      updateCountrySelectCounts();
      populateSubmarketsDropdown();
      filterAndSortLeads();
      renderTrackerView();
      renderHubsView();
      renderCoverageView();

      // Update Live Sync Capsule UI
      if (syncIcon) syncIcon.style.animation = 'none';
      if (syncStatusText) syncStatusText.textContent = 'Live (Google Sheet)';
      if (syncTimestamp) syncTimestamp.textContent = `Data as of: ${formatSyncTimestamp(new Date())}`;
      if (syncIndicator) syncIndicator.className = 'sync-indicator live';

      if (isManualRefresh) {
        showToast(`Synced ${state.leads.length} commercial deals & ${dealBackedAccounts.length} accounts live from Google Sheet!`, '🔄');
      }
    })
    .catch(err => {
      console.warn('Live Sheet fetch failed, falling back to cached dataset:', err);
      const syncIcon = document.getElementById('syncIcon');
      const syncStatusText = document.getElementById('syncStatusText');
      const syncTimestamp = document.getElementById('syncTimestamp');
      const syncIndicator = document.getElementById('syncIndicator');

      if (syncIcon) syncIcon.style.animation = 'none';
      if (syncStatusText) syncStatusText.textContent = 'Offline / Cached';
      if (syncTimestamp) syncTimestamp.textContent = 'Local data.js fallback';
      if (syncIndicator) syncIndicator.className = 'sync-indicator cached';
      if (isManualRefresh) {
        showToast('Google Sheet unreachable — running from offline cached data', '⚠️');
      }
    });
  }

  btnSyncRefresh.addEventListener('click', () => {
    fetchLiveGoogleSheetData(true);
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
  updateCountrySelectCounts();
  populateSubmarketsDropdown();
  filterAndSortLeads();
  switchView('analytics');

  // Trigger live Google Sheet background fetch (non-blocking, runs after initial render)
  fetchLiveGoogleSheetData(false);
});
