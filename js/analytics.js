(function() {
  // Store chart instances
  let instances = {
    dailyLine: null,
    growthBar: null,
    genderDonut: null,
    ageBar: null
  };

  // Helper: Get past 7 dates
  function getPast7Days() {
    const dates = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      dates.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
    }
    return dates;
  }

  // Helper: Format date for label
  function formatLabelDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // Helper: Get weekly ranges (last 4 weeks)
  function getPast4Weeks() {
    const weeks = [];
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const start = new Date();
      start.setDate(now.getDate() - (i * 7 + 6));
      start.setHours(0,0,0,0);
      const end = new Date();
      end.setDate(now.getDate() - (i * 7));
      end.setHours(23,59,59,999);
      weeks.push({ start, end, label: i === 0 ? 'This Week' : `${i}w Ago` });
    }
    return weeks;
  }

  // Set global Chart.js defaults for dark theme
  function setChartDefaults() {
    if (!window.Chart) return;
    
    Chart.defaults.color = '#9CA3AF'; // text-secondary
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 11;
    
    Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.05)';
    Chart.defaults.scale.grid.borderColor = 'rgba(255, 255, 255, 0.05)';
  }

  const AnalyticsController = {
    init: function() {
      setChartDefaults();
      this.renderAllCharts();
      
      // Update charts on database updates
      window.addEventListener('leads_db_update', () => {
        this.renderAllCharts();
      });
    },

    renderAllCharts: async function() {
      if (!window.Chart) return;

      try {
        const leads = await window.API.getLeads();

        this.renderDailySubmissions(leads);
        this.renderGrowthBar(leads);
        this.renderGenderDonut(leads);
        this.renderAgeBar(leads);
      } catch (err) {
        console.error('Failed to load leads for charts rendering:', err);
      }
    },

    renderDailySubmissions: function(leads) {
      const canvas = document.getElementById('chart-daily-submissions');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const dates = getPast7Days();
      
      const dataValues = dates.map(date => {
        return leads.filter(l => l.submittedOn && l.submittedOn.slice(0, 10) === date).length;
      });

      const labels = dates.map(formatLabelDate);

      const gradient = ctx.createLinearGradient(0, 0, 0, 220);
      gradient.addColorStop(0, 'rgba(0, 87, 255, 0.35)');
      gradient.addColorStop(1, 'rgba(0, 87, 255, 0.0)');

      if (instances.dailyLine) {
        instances.dailyLine.data.labels = labels;
        instances.dailyLine.data.datasets[0].data = dataValues;
        instances.dailyLine.data.datasets[0].backgroundColor = gradient;
        instances.dailyLine.update();
      } else {
        instances.dailyLine = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Submissions',
              data: dataValues,
              borderColor: '#00A3FF',
              borderWidth: 2,
              pointBackgroundColor: '#0057FF',
              pointBorderColor: 'rgba(255,255,255,0.2)',
              pointHoverRadius: 6,
              pointRadius: 4,
              backgroundColor: gradient,
              fill: true,
              tension: 0.35
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
              }
            }
          }
        });
      }
    },

    renderGrowthBar: function(leads) {
      const canvas = document.getElementById('chart-weekly-growth');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const weeks = getPast4Weeks();

      const dataValues = weeks.map(week => {
        return leads.filter(l => {
          if (!l.submittedOn) return false;
          const d = new Date(l.submittedOn);
          return d >= week.start && d <= week.end;
        }).length;
      });

      const labels = weeks.map(w => w.label);

      const gradient = ctx.createLinearGradient(0, 0, 0, 220);
      gradient.addColorStop(0, '#00A3FF');
      gradient.addColorStop(1, '#0057FF');

      if (instances.growthBar) {
        instances.growthBar.data.labels = labels;
        instances.growthBar.data.datasets[0].data = dataValues;
        instances.growthBar.data.datasets[0].backgroundColor = gradient;
        instances.growthBar.update();
      } else {
        instances.growthBar = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              data: dataValues,
              backgroundColor: gradient,
              borderRadius: 4,
              barThickness: 24
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
              }
            }
          }
        });
      }
    },

    renderGenderDonut: function(leads) {
      const canvas = document.getElementById('chart-gender-donut');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      
      const maleCount = leads.filter(l => l.gender && l.gender.toLowerCase() === 'male').length;
      const femaleCount = leads.filter(l => l.gender && l.gender.toLowerCase() === 'female').length;
      const otherCount = leads.filter(l => l.gender && l.gender.toLowerCase() === 'other').length;

      const dataValues = [maleCount, femaleCount, otherCount];

      if (instances.genderDonut) {
        instances.genderDonut.data.datasets[0].data = dataValues;
        instances.genderDonut.update();
      } else {
        instances.genderDonut = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Male', 'Female', 'Other'],
            datasets: [{
              data: dataValues,
              backgroundColor: [
                '#0057FF', // Royal
                '#00A3FF', // Neon
                '#6B7280'  // Muted Gray
              ],
              borderWidth: 2,
              borderColor: '#0d1220',
              hoverOffset: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  boxWidth: 12,
                  padding: 15,
                  color: '#F3F4F6'
                }
              }
            }
          }
        });
      }
    },

    renderAgeBar: function(leads) {
      const canvas = document.getElementById('chart-age-bracket');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      
      const brackets = {
        '18-25': leads.filter(l => l.age >= 18 && l.age <= 25).length,
        '26-35': leads.filter(l => l.age >= 26 && l.age <= 35).length,
        '36-45': leads.filter(l => l.age >= 36 && l.age <= 45).length,
        '46-55': leads.filter(l => l.age >= 46 && l.age <= 55).length,
        '56+': leads.filter(l => l.age >= 56).length
      };

      const labels = Object.keys(brackets);
      const dataValues = Object.values(brackets);

      const gradient = ctx.createLinearGradient(0, 0, 300, 0);
      gradient.addColorStop(0, 'rgba(0, 87, 255, 0.4)');
      gradient.addColorStop(1, '#00A3FF');

      if (instances.ageBar) {
        instances.ageBar.data.labels = labels;
        instances.ageBar.data.datasets[0].data = dataValues;
        instances.ageBar.data.datasets[0].backgroundColor = gradient;
        instances.ageBar.update();
      } else {
        instances.ageBar = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              data: dataValues,
              backgroundColor: gradient,
              borderRadius: 4,
              barThickness: 16
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
                beginAtZero: true,
                ticks: { stepSize: 1 }
              }
            }
          }
        });
      }
    }
  };

  window.AnalyticsController = AnalyticsController;
})();
