// Lease-IQ - Executive Overview Controller
// Preserves all scorecards, 4 charts, country tabs, and Company Tracker
// Adopts the clean black-and-white minimalist design language

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    theme: localStorage.getItem('cre_theme') || 'light',
    activeTab: 'deals', // 'deals' or 'tracker'
    activeCountry: 'Malaysia',
    leads: Array.isArray(INITIAL_LEADS_DATA) ? [...INITIAL_LEADS_DATA] : [],
    filteredLeads: [],
    tracker: Array.isArray(INITIAL_TRACKER_DATA) ? [...INITIAL_TRACKER_DATA] : [],
    filteredTracker: [],
    dealsViewMode: 'table', // 'table' or 'card'
    dealsFilters: {
      search: '',
      city: 'ALL',
      sector: 'ALL',
      urgency: 'ALL'
    },
    trackerFilters: {
      search: '',
      country: 'ALL',
      status: 'ALL',
      change: 'ALL'
    },
    charts: {}
  };

  // Restore cached sync if available
  const cachedSync = localStorage.getItem('cre_cached_sync');
  if (cachedSync) {
    try {
      const parsed = JSON.parse(cachedSync);
      if (parsed && parsed.leads && parsed.tracker) {
        state.leads = parsed.leads;
        state.tracker = parsed.tracker;
        if (parsed.lastSynced) {
          const syncEl = document.getElementById('syncTimestamp');
          if (syncEl) syncEl.textContent = `Synced: ${parsed.lastSynced}`;
        }
      }
    } catch (e) {
      console.warn('Cache warning:', e);
    }
  }

  // DOM Elements - Navigation & Actions
  const tabDealsBtn = document.getElementById('tabDealsBtn');
  const tabTrackerBtn = document.getElementById('tabTrackerBtn');
  const tabDealsCount = document.getElementById('tabDealsCount');
  const tabTrackerCount = document.getElementById('tabTrackerCount');
  const viewDeals = document.getElementById('viewDeals');
  const viewTracker = document.getElementById('viewTracker');

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const btnSyncRefresh = document.getElementById('btnSyncRefresh');
  const syncIcon = document.getElementById('syncIcon');
  const syncTimestamp = document.getElementById('syncTimestamp');
  const btnExportCsv = document.getElementById('btnExportCsv');

  // Country Selector (Header Dropdown)
  const countrySelect = document.getElementById('countrySelect');
  const headerMarketFlag = document.getElementById('headerMarketFlag');
  const activeCountryBadge = document.getElementById('activeCountryBadge');

  // Deals Scorecards
  const kpiTotalDeals = document.getElementById('kpiTotalDeals');
  const kpiDealsSubtitle = document.getElementById('kpiDealsSubtitle');
  const kpiTotalSqFt = document.getElementById('kpiTotalSqFt');
  const kpiImmediate = document.getElementById('kpiImmediate');
  const kpiImmediateBar = document.getElementById('kpiImmediateBar');
  const kpiDealValue = document.getElementById('kpiDealValue');
  const kpiCurrencySubtitle = document.getElementById('kpiCurrencySubtitle');
  const chartCityTitle = document.getElementById('chartCityTitle');

  // Deals Filters & Controls
  const dealsSearchInput = document.getElementById('dealsSearchInput');
  const dealsCityFilter = document.getElementById('dealsCityFilter');
  const dealsSectorFilter = document.getElementById('dealsSectorFilter');
  const dealsUrgencyFilter = document.getElementById('dealsUrgencyFilter');
  const btnResetDealsFilters = document.getElementById('btnResetDealsFilters');
  const dealsVisibleCount = document.getElementById('dealsVisibleCount');
  const dealsTotalCount = document.getElementById('dealsTotalCount');

  const btnTableView = document.getElementById('btnTableView');
  const btnCardView = document.getElementById('btnCardView');
  const tableViewContainer = document.getElementById('tableViewContainer');
  const cardViewContainer = document.getElementById('cardViewContainer');
  const dealsTableBody = document.getElementById('dealsTableBody');
  const dealsEmptyState = document.getElementById('dealsEmptyState');

  // Tracker Elements
  const kpiTrackerTotal = document.getElementById('kpiTrackerTotal');
  const kpiTrackerActive = document.getElementById('kpiTrackerActive');
  const kpiTrackerWatch = document.getElementById('kpiTrackerWatch');
  const deltaFeedList = document.getElementById('deltaFeedList');
  const deltaFeedCount = document.getElementById('deltaFeedCount');

  const trackerSearchInput = document.getElementById('trackerSearchInput');
  const trackerCountryFilter = document.getElementById('trackerCountryFilter');
  const trackerStatusFilter = document.getElementById('trackerStatusFilter');
  const trackerChangeFilter = document.getElementById('trackerChangeFilter');
  const btnResetTrackerFilters = document.getElementById('btnResetTrackerFilters');
  const trackerTableBody = document.getElementById('trackerTableBody');

  // Modals
  const dealModal = document.getElementById('dealModal');
  const dealModalCloseBtn = document.getElementById('dealModalCloseBtn');
  const trackerModal = document.getElementById('trackerModal');
  const trackerModalCloseBtn = document.getElementById('trackerModalCloseBtn');

  // Initialize Theme
  applyTheme(state.theme);

  // Initialize All 4 Charts
  initializeCharts();

  // Populate dynamic city dropdown
  populateCityFilter();

  // Initial Filter & Render
  applyDealsFilters();
  applyTrackerFilters();
  renderDeltaFeed();
  updateTabCounts();

  // -------------------------------------------------------------
  // THEME MANAGEMENT (Black & White Minimalist Theme)
  // -------------------------------------------------------------
  themeToggleBtn.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('cre_theme', state.theme);
    applyTheme(state.theme);
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    updateChartsTheme();
  }

  function updateChartsTheme() {
    const isLight = state.theme === 'light';
    const textColor = isLight ? '#64748b' : '#94a3b8';
    const gridColor = isLight ? '#e2e8f0' : '#1e293b';

    Object.values(state.charts).forEach(chart => {
      if (!chart) return;
      if (chart.options.scales) {
        if (chart.options.scales.x) {
          if (chart.options.scales.x.ticks) chart.options.scales.x.ticks.color = textColor;
          if (chart.options.scales.x.grid) chart.options.scales.x.grid.color = gridColor;
        }
        if (chart.options.scales.y) {
          if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = textColor;
          if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = gridColor;
        }
        if (chart.options.scales.y1) {
          if (chart.options.scales.y1.ticks) chart.options.scales.y1.ticks.color = '#2563eb';
        }
      }
      if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
        chart.options.plugins.legend.labels.color = textColor;
      }
      chart.update();
    });
  }

  // -------------------------------------------------------------
  // MAIN VIEW TABS: Deals vs Tracker
  // -------------------------------------------------------------
  tabDealsBtn.addEventListener('click', () => {
    state.activeTab = 'deals';
    tabDealsBtn.classList.add('active');
    tabTrackerBtn.classList.remove('active');
    viewDeals.style.display = 'block';
    viewTracker.style.display = 'none';
  });

  tabTrackerBtn.addEventListener('click', () => {
    state.activeTab = 'tracker';
    tabTrackerBtn.classList.add('active');
    tabDealsBtn.classList.remove('active');
    viewDeals.style.display = 'none';
    viewTracker.style.display = 'block';
  });

  function updateTabCounts() {
    tabDealsCount.textContent = state.leads.length;
    tabTrackerCount.textContent = state.tracker.length;
    dealsTotalCount.textContent = state.leads.length;
  }

  // -------------------------------------------------------------
  // MARKET SELECTION (Header Dropdown)
  // -------------------------------------------------------------
  if (countrySelect) {
    state.activeCountry = countrySelect.value || 'Malaysia';
    if (headerMarketFlag) {
      headerMarketFlag.textContent = getCountryFlag(state.activeCountry);
    }
    if (activeCountryBadge) {
      activeCountryBadge.textContent = state.activeCountry === 'ALL' ? '🌐 All Markets' : `${getCountryFlag(state.activeCountry)} ${state.activeCountry}`;
    }

    countrySelect.addEventListener('change', (e) => {
      const country = e.target.value;
      state.activeCountry = country;

      if (headerMarketFlag) {
        headerMarketFlag.textContent = getCountryFlag(country);
      }

      if (activeCountryBadge) {
        activeCountryBadge.textContent = country === 'ALL' ? '🌐 All Markets' : `${getCountryFlag(country)} ${country}`;
      }

      if (trackerCountryFilter) {
        trackerCountryFilter.value = country;
        state.trackerFilters.country = country;
      }

      populateCityFilter();
      state.dealsFilters.city = 'ALL';

      applyDealsFilters();
      applyTrackerFilters();
    });
  }

  function getCountryFlag(country) {
    const flags = { 'India': '🇮🇳', 'Malaysia': '🇲🇾', 'Korea': '🇰🇷', 'Japan': '🇯🇵', 'Sri Lanka': '🇱🇰' };
    return flags[country] || '🌐';
  }

  // -------------------------------------------------------------
  // DEALS FILTERING & SCORECARDS
  // -------------------------------------------------------------
  function populateCityFilter() {
    const country = state.activeCountry;
    let relevantLeads = state.leads;
    if (country !== 'ALL') {
      relevantLeads = state.leads.filter(l => l.country === country);
    }
    const cities = Array.from(new Set(relevantLeads.map(l => l.city).filter(Boolean))).sort();
    dealsCityFilter.innerHTML = `<option value="ALL">All Cities / Submarkets (${cities.length})</option>` +
      cities.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  dealsSearchInput.addEventListener('input', (e) => {
    state.dealsFilters.search = e.target.value.toLowerCase().trim();
    applyDealsFilters();
  });

  dealsCityFilter.addEventListener('change', (e) => {
    state.dealsFilters.city = e.target.value;
    applyDealsFilters();
  });

  dealsSectorFilter.addEventListener('change', (e) => {
    state.dealsFilters.sector = e.target.value;
    applyDealsFilters();
  });

  dealsUrgencyFilter.addEventListener('change', (e) => {
    state.dealsFilters.urgency = e.target.value;
    applyDealsFilters();
  });

  btnResetDealsFilters.addEventListener('click', () => {
    dealsSearchInput.value = '';
    dealsCityFilter.value = 'ALL';
    dealsSectorFilter.value = 'ALL';
    dealsUrgencyFilter.value = 'ALL';
    state.dealsFilters = { search: '', city: 'ALL', sector: 'ALL', urgency: 'ALL' };
    applyDealsFilters();
  });

  btnTableView.addEventListener('click', () => {
    state.dealsViewMode = 'table';
    btnTableView.classList.add('active');
    btnCardView.classList.remove('active');
    tableViewContainer.style.display = 'block';
    cardViewContainer.style.display = 'none';
  });

  btnCardView.addEventListener('click', () => {
    state.dealsViewMode = 'card';
    btnCardView.classList.add('active');
    btnTableView.classList.remove('active');
    tableViewContainer.style.display = 'none';
    cardViewContainer.style.display = 'grid';
  });

  function applyDealsFilters() {
    const { search, city, sector, urgency } = state.dealsFilters;
    const country = state.activeCountry;

    state.filteredLeads = state.leads.filter(lead => {
      if (country !== 'ALL' && lead.country !== country) return false;
      if (search) {
        const text = `${lead.company} ${lead.country} ${lead.market} ${lead.city} ${lead.signal} ${lead.sector} ${lead.source}`.toLowerCase();
        if (!text.includes(search)) return false;
      }
      if (city !== 'ALL' && lead.city !== city) return false;
      if (sector !== 'ALL' && lead.sector !== sector) return false;
      if (urgency !== 'ALL' && lead.urgency !== urgency) return false;
      return true;
    });

    updateDealsKPIs();
    renderDealsDisplays();
    updateDealsCharts();
  }

  function updateDealsKPIs() {
    const total = state.filteredLeads.length;
    dealsVisibleCount.textContent = total;
    kpiTotalDeals.textContent = total;
    kpiDealsSubtitle.textContent = state.activeCountry === 'ALL' ? 'Across 5 active APAC markets' : `Across ${state.activeCountry} market`;

    const totalSqFt = state.filteredLeads.reduce((acc, curr) => {
      if ((curr.areaSqFt || 0) < 10000000) return acc + (curr.areaSqFt || 0);
      return acc;
    }, 0);
    const millions = (totalSqFt / 1000000).toFixed(2);
    kpiTotalSqFt.textContent = `${millions}M sq ft`;

    const immediate = state.filteredLeads.filter(l => l.urgency === 'Immediate').length;
    kpiImmediate.textContent = immediate;
    const immPct = total > 0 ? Math.round((immediate / total) * 100) : 0;
    kpiImmediateBar.style.width = `${immPct}%`;

    const country = state.activeCountry;
    if (country === 'India') {
      kpiDealValue.textContent = '₹10,500+ Cr';
      kpiCurrencySubtitle.textContent = 'INR lease commitments';
    } else if (country === 'Malaysia') {
      kpiDealValue.textContent = 'RM 3.5+ Bn';
      kpiCurrencySubtitle.textContent = 'MYR lease commitments';
    } else if (country === 'Korea') {
      kpiDealValue.textContent = '₩8.2+ Trillion';
      kpiCurrencySubtitle.textContent = 'KRW lease commitments';
    } else if (country === 'Japan') {
      kpiDealValue.textContent = '¥25+ Billion';
      kpiCurrencySubtitle.textContent = 'JPY lease commitments';
    } else if (country === 'Sri Lanka') {
      kpiDealValue.textContent = 'SL Rs 48+ Bn';
      kpiCurrencySubtitle.textContent = 'LKR lease commitments';
    } else {
      kpiDealValue.textContent = '5 Currencies';
      kpiCurrencySubtitle.textContent = 'Multi-currency APAC commitments';
    }
  }

  function renderDealsDisplays() {
    if (state.filteredLeads.length === 0) {
      tableViewContainer.style.display = 'none';
      cardViewContainer.style.display = 'none';
      dealsEmptyState.style.display = 'block';
      return;
    }

    dealsEmptyState.style.display = 'none';
    if (state.dealsViewMode === 'table') {
      tableViewContainer.style.display = 'block';
      cardViewContainer.style.display = 'none';
    } else {
      tableViewContainer.style.display = 'none';
      cardViewContainer.style.display = 'grid';
    }

    // Render Table
    dealsTableBody.innerHTML = state.filteredLeads.map(lead => {
      const urgencyClass = lead.urgency.toLowerCase().replace(/[^a-z]/g, '');
      return `
        <tr onclick="window.openDealModal(${lead.id})">
          <td style="font-weight: 700;">${lead.company}</td>
          <td><span class="badge-clean">${lead.flag || ''} ${lead.country}</span></td>
          <td style="color: var(--text-secondary);">${lead.market}</td>
          <td><span class="badge-clean">${lead.sector}</span></td>
          <td style="font-family: 'JetBrains Mono', monospace; font-weight: 600;">${lead.areaFormatted}</td>
          <td style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: var(--accent-blue);">${lead.dealValue}</td>
          <td style="max-width: 240px; font-size: 11.5px; color: var(--text-secondary);">${lead.timing}</td>
          <td><span class="badge-clean ${urgencyClass}">${lead.urgency}</span></td>
          <td>
            <a href="${lead.sourceUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); font-size: 11.5px; text-decoration: none;" onclick="event.stopPropagation()">
              ${lead.source} ↗
            </a>
          </td>
        </tr>
      `;
    }).join('');

    // Render Card Grid View
    cardViewContainer.innerHTML = state.filteredLeads.map(lead => {
      const urgencyClass = lead.urgency.toLowerCase().replace(/[^a-z]/g, '');
      return `
        <div class="lead-catalog-card" onclick="window.openDealModal(${lead.id})">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <div>
              <strong style="font-size: 14px; display: block;">${lead.company}</strong>
              <span style="font-size: 11px; color: var(--text-muted);">${lead.flag || ''} ${lead.market}</span>
            </div>
            <span class="badge-clean ${urgencyClass}">${lead.urgency}</span>
          </div>

          <div style="background: var(--bg-card-subtle); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light); font-size: 11.5px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.45;">
            ${lead.signal}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11.5px; margin-bottom: 12px;">
            <div><span style="color: var(--text-muted);">Area:</span> <strong style="font-family: 'JetBrains Mono', monospace;">${lead.areaFormatted}</strong></div>
            <div><span style="color: var(--text-muted);">Value:</span> <strong style="font-family: 'JetBrains Mono', monospace; color: var(--accent-blue);">${lead.dealValue}</strong></div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-light); padding-top: 8px;">
            <span class="badge-clean">${lead.sector}</span>
            <a href="${lead.sourceUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); font-size: 11px; text-decoration: none;" onclick="event.stopPropagation()">
              ${lead.source} ↗
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  // -------------------------------------------------------------
  // ALL 4 CHARTS (Black & White Minimalist Design)
  // -------------------------------------------------------------
  function initializeCharts() {
    const isLight = state.theme === 'light';
    const textColor = isLight ? '#64748b' : '#94a3b8';
    const gridColor = isLight ? '#e2e8f0' : '#1e293b';
    const darkBarColor = isLight ? '#0f172a' : '#f8fafc';

    // Chart 1: Market Distribution
    const cityCtx = document.getElementById('cityChart').getContext('2d');
    state.charts.cityChart = new Chart(cityCtx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Leased Area',
            data: [],
            backgroundColor: darkBarColor,
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            label: 'Deals Count',
            data: [],
            type: 'line',
            borderColor: '#2563eb',
            backgroundColor: '#2563eb',
            borderWidth: 2,
            pointRadius: 4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, font: { family: 'Inter', size: 11 } } },
          tooltip: { borderWidth: 1 }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
          y1: { position: 'right', grid: { display: false }, ticks: { color: '#2563eb', font: { size: 11 }, stepSize: 1 } }
        }
      }
    });

    // Chart 2: Sector Doughnut
    const sectorCtx = document.getElementById('sectorChart').getContext('2d');
    state.charts.sectorChart = new Chart(sectorCtx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [
            '#0f172a', '#2563eb', '#475569', '#64748b',
            '#94a3b8', '#0891b2', '#10b981', '#f59e0b', '#cbd5e1'
          ],
          borderWidth: 2,
          borderColor: isLight ? '#ffffff' : '#111726'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: textColor, font: { size: 10.5 }, boxWidth: 10 } }
        },
        cutout: '65%'
      }
    });

    // Chart 3: Deal Size Classification
    const sizeCtx = document.getElementById('sizeChart').getContext('2d');
    state.charts.sizeChart = new Chart(sizeCtx, {
      type: 'bar',
      data: {
        labels: ['Boutique (<50k)', 'Mid (50k-150k)', 'Large (150k-500k)', 'Mega (500k+)'],
        datasets: [{
          label: 'Deals',
          data: [0, 0, 0, 0],
          backgroundColor: [
            '#94a3b8',
            '#475569',
            '#2563eb',
            '#0f172a'
          ],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, stepSize: 1 } }
        }
      }
    });

    // Chart 4: Timing Urgency Pipeline
    const urgencyCtx = document.getElementById('urgencyChart').getContext('2d');
    state.charts.urgencyChart = new Chart(urgencyCtx, {
      type: 'bar',
      data: {
        labels: ['Immediate (NOW)', 'Near-Term (Q4 26 - Q1 27)', 'Active Occupancy', 'Pre-Lease Pipeline'],
        datasets: [{
          label: 'Count',
          data: [0, 0, 0, 0],
          backgroundColor: [
            '#ef4444',
            '#f59e0b',
            '#10b981',
            '#2563eb'
          ],
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, stepSize: 1 } },
          y: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } }
        }
      }
    });
  }

  function updateDealsCharts() {
    const data = state.filteredLeads;
    const country = state.activeCountry;

    // 1. City / Market
    if (country === 'ALL') {
      chartCityTitle.textContent = 'Market Share by Country (Pan-APAC)';
      const countryMap = {};
      data.forEach(l => {
        const c = l.country || 'Other';
        if (!countryMap[c]) countryMap[c] = { count: 0, sqft: 0 };
        countryMap[c].count++;
        if ((l.areaSqFt || 0) < 10000000) countryMap[c].sqft += (l.areaSqFt || 0);
      });
      const labels = Object.keys(countryMap).sort((a, b) => countryMap[b].sqft - countryMap[a].sqft);
      state.charts.cityChart.data.labels = labels.map(c => `${getCountryFlag(c)} ${c}`);
      state.charts.cityChart.data.datasets[0].data = labels.map(c => +(countryMap[c].sqft / 100000).toFixed(1));
      state.charts.cityChart.data.datasets[1].data = labels.map(c => countryMap[c].count);
      state.charts.cityChart.data.datasets[0].label = 'Disclosed Sq Ft (Lakhs)';
    } else {
      chartCityTitle.textContent = `${country} Hub Distribution`;
      const cityMap = {};
      data.forEach(l => {
        const city = l.city || 'Other';
        if (!cityMap[city]) cityMap[city] = { count: 0, sqft: 0 };
        cityMap[city].count++;
        if ((l.areaSqFt || 0) < 10000000) cityMap[city].sqft += (l.areaSqFt || 0);
      });
      const labels = Object.keys(cityMap).sort((a, b) => cityMap[b].count - cityMap[a].count).slice(0, 8);
      state.charts.cityChart.data.labels = labels;
      state.charts.cityChart.data.datasets[0].data = labels.map(c => +(cityMap[c].sqft / 10000).toFixed(1));
      state.charts.cityChart.data.datasets[1].data = labels.map(c => cityMap[c].count);
      state.charts.cityChart.data.datasets[0].label = 'Area (10k sq ft)';
    }
    state.charts.cityChart.update();

    // 2. Sector
    const sectorMap = {};
    data.forEach(l => {
      const sec = l.sector || 'Other';
      sectorMap[sec] = (sectorMap[sec] || 0) + 1;
    });
    const sectorLabels = Object.keys(sectorMap);
    state.charts.sectorChart.data.labels = sectorLabels;
    state.charts.sectorChart.data.datasets[0].data = sectorLabels.map(s => sectorMap[s]);
    state.charts.sectorChart.update();

    // 3. Size
    let boutique = 0, mid = 0, large = 0, mega = 0;
    data.forEach(l => {
      const s = l.areaSqFt || 0;
      if (s <= 0) return;
      if (s < 50000) boutique++;
      else if (s < 150000) mid++;
      else if (s < 500000) large++;
      else mega++;
    });
    state.charts.sizeChart.data.datasets[0].data = [boutique, mid, large, mega];
    state.charts.sizeChart.update();

    // 4. Urgency
    let imm = 0, near = 0, act = 0, pipe = 0;
    data.forEach(l => {
      if (l.urgency === 'Immediate') imm++;
      else if (l.urgency === 'Near-Term') near++;
      else if (l.urgency === 'Active') act++;
      else pipe++;
    });
    state.charts.urgencyChart.data.datasets[0].data = [imm, near, act, pipe];
    state.charts.urgencyChart.update();
  }

  // -------------------------------------------------------------
  // COMPANY TRACKER VIEW
  // -------------------------------------------------------------
  trackerSearchInput.addEventListener('input', (e) => {
    state.trackerFilters.search = e.target.value.toLowerCase().trim();
    applyTrackerFilters();
  });

  trackerCountryFilter.addEventListener('change', (e) => {
    state.trackerFilters.country = e.target.value;
    applyTrackerFilters();
  });

  trackerStatusFilter.addEventListener('change', (e) => {
    state.trackerFilters.status = e.target.value;
    applyTrackerFilters();
  });

  trackerChangeFilter.addEventListener('change', (e) => {
    state.trackerFilters.change = e.target.value;
    applyTrackerFilters();
  });

  btnResetTrackerFilters.addEventListener('click', () => {
    trackerSearchInput.value = '';
    trackerCountryFilter.value = 'ALL';
    trackerStatusFilter.value = 'ALL';
    trackerChangeFilter.value = 'ALL';
    state.trackerFilters = { search: '', country: 'ALL', status: 'ALL', change: 'ALL' };
    applyTrackerFilters();
  });

  function applyTrackerFilters() {
    const { search, country, status, change } = state.trackerFilters;
    const globalCountry = state.activeCountry;

    state.filteredTracker = state.tracker.filter(item => {
      const targetCountry = country !== 'ALL' ? country : globalCountry;
      if (targetCountry !== 'ALL' && item.country !== targetCountry) return false;
      if (status !== 'ALL' && item.status !== status) return false;
      if (change === 'CHANGED' && !item.hasChange) return false;
      if (change === 'BASELINE' && item.hasChange) return false;
      if (search) {
        const text = `${item.company} ${item.country} ${item.market} ${item.trend} ${item.change} ${item.currentSnapshot} ${item.notes}`.toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });

    updateTrackerKPIs();
    renderTrackerTable();
  }

  function updateTrackerKPIs() {
    kpiTrackerTotal.textContent = state.filteredTracker.length;
    kpiTrackerActive.textContent = state.filteredTracker.filter(t => t.status === 'Active').length;
    kpiTrackerWatch.textContent = state.filteredTracker.filter(t => t.status === 'Watch').length;
  }

  function renderDeltaFeed() {
    const deltaItems = state.tracker.filter(t => t.hasChange || t.status === 'Active').slice(0, 3);
    deltaFeedCount.textContent = `${state.tracker.filter(t => t.hasChange).length} Meaningful Changes This Cycle`;

    deltaFeedList.innerHTML = deltaItems.map(item => `
      <div class="delta-feed-card-item" onclick="window.openTrackerModal(${item.id})">
        <strong style="font-size: 13px; display: block; margin-bottom: 2px;">${item.company} (${getCountryFlag(item.country)} ${item.country})</strong>
        <p style="margin-bottom: 4px; color: var(--accent-blue); font-weight: 600; font-size: 11.5px;">
          Trend: ${item.trend || item.status}
        </p>
        <p style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.4;">${item.change || item.currentSnapshot.slice(0, 95) + '...'}</p>
      </div>
    `).join('');
  }

  function renderTrackerTable() {
    trackerTableBody.innerHTML = state.filteredTracker.map(item => {
      const statusClass = item.status === 'Active' ? 'active' : 'watch';
      const changeStyle = item.hasChange ? 'style="color: var(--accent-green); font-weight: 700;"' : 'style="color: var(--text-muted);"';
      return `
        <tr onclick="window.openTrackerModal(${item.id})">
          <td style="font-weight: 700;">${item.company}</td>
          <td><span class="badge-clean">${item.country}</span></td>
          <td style="color: var(--text-secondary);">${item.market || item.country}</td>
          <td><span class="badge-clean ${statusClass}">${item.status}</span></td>
          <td style="color: var(--accent-blue); font-weight: 600; font-size: 11.5px;">${item.trend}</td>
          <td ${changeStyle} style="font-size: 11.5px;">${item.change}</td>
          <td style="max-width: 240px; font-size: 11.5px; color: var(--text-secondary); line-height: 1.4;">${item.currentSnapshot.slice(0, 85)}...</td>
          <td style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-muted);">${item.lastChecked}</td>
          <td>
            <button class="btn-action-outline" style="padding: 3px 8px; font-size: 11px;" onclick="event.stopPropagation(); window.openTrackerModal(${item.id})">
              Compare
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // -------------------------------------------------------------
  // MODALS
  // -------------------------------------------------------------
  window.openDealModal = function(id) {
    const lead = state.leads.find(l => l.id === id);
    if (!lead) return;

    document.getElementById('dealModalCompany').textContent = lead.company;
    document.getElementById('dealModalMarket').textContent = `📍 ${lead.market} • ${lead.country}`;
    document.getElementById('dealModalArea').textContent = `${lead.areaFormatted} (${(lead.areaSqFt || 0).toLocaleString()} sq ft)`;
    document.getElementById('dealModalValue').textContent = lead.dealValue;
    document.getElementById('dealModalSignal').textContent = lead.signal;
    document.getElementById('dealModalTiming').textContent = lead.timing;

    const urgencyBadge = document.getElementById('dealModalUrgency');
    urgencyBadge.className = `badge-clean ${lead.urgency.toLowerCase().replace(/[^a-z]/g, '')}`;
    urgencyBadge.textContent = lead.urgency;

    document.getElementById('dealModalCountry').textContent = `${lead.flag || ''} ${lead.country}`;
    document.getElementById('dealModalSector').textContent = lead.sector;

    const sourceLink = document.getElementById('dealModalSourceLink');
    sourceLink.href = lead.sourceUrl;
    sourceLink.textContent = `Verify on ${lead.source} ↗`;

    dealModal.classList.add('open');
  };

  dealModalCloseBtn.addEventListener('click', () => dealModal.classList.remove('open'));
  dealModal.addEventListener('click', (e) => {
    if (e.target === dealModal) dealModal.classList.remove('open');
  });

  window.openTrackerModal = function(id) {
    const item = state.tracker.find(t => t.id === id);
    if (!item) return;

    document.getElementById('trackerModalCompany').textContent = item.company;
    document.getElementById('trackerModalMarket').textContent = `📍 ${item.market || item.country} • ${item.country}`;

    const statusBadge = document.getElementById('trackerModalStatus');
    statusBadge.className = `badge-clean ${item.status === 'Active' ? 'active' : 'watch'}`;
    statusBadge.textContent = item.status;

    document.getElementById('trackerModalCountry').textContent = item.country;
    document.getElementById('trackerModalDate').textContent = `Audited: ${item.lastChecked}`;

    document.getElementById('trackerModalPrevSnapshot').textContent = item.previousSnapshot || 'No prior snapshot logged (Initial Baseline)';
    document.getElementById('trackerModalCurrSnapshot').textContent = item.currentSnapshot || 'No snapshot data';
    document.getElementById('trackerModalChange').textContent = item.change;
    document.getElementById('trackerModalTrend').textContent = `Trend Velocity: ${item.trend}`;
    document.getElementById('trackerModalNotes').textContent = item.notes ? `Internal Notes: ${item.notes}` : '';

    trackerModal.classList.add('open');
  };

  trackerModalCloseBtn.addEventListener('click', () => trackerModal.classList.remove('open'));
  trackerModal.addEventListener('click', (e) => {
    if (e.target === trackerModal) trackerModal.classList.remove('open');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dealModal.classList.remove('open');
      trackerModal.classList.remove('open');
    }
  });

  // -------------------------------------------------------------
  // SYNC & EXPORT
  // -------------------------------------------------------------
  btnSyncRefresh.addEventListener('click', async () => {
    syncIcon.style.animation = 'spin 1s linear infinite';
    try {
      const resp = await fetch('http://localhost:8089/api/sync', { cache: 'no-store' });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.leads && data.tracker) {
          state.leads = data.leads;
          state.tracker = data.tracker;
          const now = new Date().toLocaleTimeString();
          syncTimestamp.textContent = `Synced: ${now}`;
          localStorage.setItem('cre_cached_sync', JSON.stringify({
            leads: data.leads,
            tracker: data.tracker,
            lastSynced: now
          }));
        }
      }
      applyDealsFilters();
      applyTrackerFilters();
      renderDeltaFeed();
      updateTabCounts();
    } catch (e) {
      console.warn('Sync notice:', e);
    } finally {
      syncIcon.style.animation = 'none';
    }
  });

  btnExportCsv.addEventListener('click', () => {
    const isTracker = state.activeTab === 'tracker';
    if (!isTracker) {
      const headers = ['Company', 'Country', 'Market', 'Sector', 'Area_Sq_Ft', 'Deal_Value', 'Signal', 'Timing', 'Urgency', 'Source'];
      const rows = state.filteredLeads.map(l => [
        `"${(l.company || '').replace(/"/g, '""')}"`,
        `"${(l.country || '').replace(/"/g, '""')}"`,
        `"${(l.market || '').replace(/"/g, '""')}"`,
        `"${(l.sector || '').replace(/"/g, '""')}"`,
        l.areaSqFt || 0,
        `"${(l.dealValue || '').replace(/"/g, '""')}"`,
        `"${(l.signal || '').replace(/"/g, '""')}"`,
        `"${(l.timing || '').replace(/"/g, '""')}"`,
        `"${(l.urgency || '').replace(/"/g, '""')}"`,
        `"${(l.source || '').replace(/"/g, '""')}"`
      ]);
      downloadCsv('Lease_IQ_Deals_Export.csv', headers, rows);
    } else {
      const headers = ['Company', 'Country', 'Market', 'Status', 'Trend', 'Change', 'Current_Snapshot', 'Previous_Snapshot', 'Last_Checked'];
      const rows = state.filteredTracker.map(t => [
        `"${(t.company || '').replace(/"/g, '""')}"`,
        `"${(t.country || '').replace(/"/g, '""')}"`,
        `"${(t.market || '').replace(/"/g, '""')}"`,
        `"${(t.status || '').replace(/"/g, '""')}"`,
        `"${(t.trend || '').replace(/"/g, '""')}"`,
        `"${(t.change || '').replace(/"/g, '""')}"`,
        `"${(t.currentSnapshot || '').replace(/"/g, '""')}"`,
        `"${(t.previousSnapshot || '').replace(/"/g, '""')}"`,
        `"${(t.lastChecked || '').replace(/"/g, '""')}"`
      ]);
      downloadCsv('Lease_IQ_Company_Tracker_Export.csv', headers, rows);
    }
  });

  function downloadCsv(filename, headers, rows) {
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});
