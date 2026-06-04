import React, { useEffect, useMemo, useState } from 'react';
import { auditsAPI, operatorUploadsAPI, roadmapAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { operationSections } from '../data/operationData';
import { createInitialRoadmapRows, roadmapMonthKeys } from '../data/roadmapData';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const toInputDate = (value) => new Date(value).toISOString().slice(0, 10);

const getWeekInfo = (value) => {
  const date = new Date(value);
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNumber = (local.getDay() + 6) % 7;

  const thursday = new Date(local);
  thursday.setDate(local.getDate() + (3 - dayNumber));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const firstThursdayDayNumber = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() + (3 - firstThursdayDayNumber));
  const weekNumber = 1 + Math.round((thursday - firstThursday) / 604800000);

  return {
    key: `${thursday.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`,
    label: `Week ${weekNumber}`,
  };
};

const formatMonthLabel = (value) => {
  const [year, month] = value.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
};

const parseLineOrder = (value) => {
  const match = String(value || '').match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians)),
  };
};

const describeArc = (x, y, radius, startAngle, endAngle) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M', x, y,
    'L', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    'Z',
  ].join(' ');
};

const DashboardPieChart = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let currentAngle = 0;

  if (!total) {
    return <div className="dashboard-pie-empty">No reason data</div>;
  }

  return (
    <div className="dashboard-pie-wrap">
      <svg viewBox="0 0 680 340" className="dashboard-pie-chart" role="img" aria-label="Reason distribution pie chart">
        {data.map((item) => {
          const centerX = 300;
          const centerY = 170;
          const startAngle = currentAngle;
          const sliceAngle = (item.count / total) * 360;
          const endAngle = currentAngle + sliceAngle;
          const path = describeArc(centerX, centerY, 102, startAngle, endAngle);
          const midAngle = startAngle + (sliceAngle / 2);
          const innerPoint = polarToCartesian(centerX, centerY, 114, midAngle);
          const outerPoint = polarToCartesian(centerX, centerY, 150, midAngle);
          const labelX = outerPoint.x >= centerX
            ? outerPoint.x + 44
            : Math.max(180, outerPoint.x - 44);
          const labelY = outerPoint.y;
          const textAnchor = outerPoint.x >= centerX ? 'start' : 'end';
          const slice = (
            <g key={item.label}>
              <path
                d={path}
                fill={item.color}
                stroke="#ffffff"
                strokeWidth="2"
              />
              <path
                d={`M ${innerPoint.x} ${innerPoint.y} L ${outerPoint.x} ${outerPoint.y} L ${labelX} ${labelY}`}
                className="dashboard-pie-callout"
              />
              <circle cx={labelX} cy={labelY} r="3" fill={item.color} />
              <text
                x={labelX + (textAnchor === 'start' ? 10 : -10)}
                y={labelY - 6}
                textAnchor={textAnchor}
                className="dashboard-pie-callout-label"
              >
                {item.label}
              </text>
              <text
                x={labelX + (textAnchor === 'start' ? 10 : -10)}
                y={labelY + 16}
                textAnchor={textAnchor}
                className="dashboard-pie-callout-value"
              >
                {`${Math.round((item.count / total) * 100)}%`}
              </text>
            </g>
          );
          currentAngle = endAngle;
          return slice;
        })}
        <circle cx="300" cy="170" r="56" fill="#ffffff" />
        <text x="300" y="162" textAnchor="middle" className="dashboard-pie-total">{total}</text>
        <text x="300" y="186" textAnchor="middle" className="dashboard-pie-caption">No Reasons</text>
      </svg>
    </div>
  );
};

const DashboardMetricCard = ({ accent, label, value, hint, tone }) => (
  <div className={`dashboard-metric-card${tone ? ` ${tone}` : ''}`}>
    <div className="dashboard-metric-head">
      <div className="dashboard-metric-label">{label}</div>
      <span className="dashboard-metric-accent">{accent}</span>
    </div>
    <div className="dashboard-metric-body">
      <div className="dashboard-metric-value">{value}</div>
      {hint ? <div className="dashboard-metric-hint">{hint}</div> : null}
    </div>
  </div>
);

export default function DashboardPage() {
  const { user } = useAuth();
  const [audits, setAudits] = useState([]);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [roadmapRows, setRoadmapRows] = useState([]);
  const [periodMode, setPeriodMode] = useState('year');
  const [periodValue, setPeriodValue] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auditsAPI.getAll({ limit: 100 })
      .then(({ data }) => setAudits(data.audits || []))
      .catch(() => setAudits([]))
      .finally(() => setLoading(false));

    operatorUploadsAPI.getAll()
      .then(({ data }) => setUploadHistory(data || []))
      .catch(() => setUploadHistory([]));

    roadmapAPI.get()
      .then(({ data }) => setRoadmapRows(Array.isArray(data.rows) && data.rows.length ? data.rows : createInitialRoadmapRows()))
      .catch(() => setRoadmapRows(createInitialRoadmapRows()));
  }, []);

  const sortedUploads = useMemo(() => (
    [...uploadHistory].sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt))
  ), [uploadHistory]);

  useEffect(() => {
    setPeriodValue('');
  }, [periodMode]);

  const periodOptions = useMemo(() => {
    if (periodMode === 'year') {
      return [...new Set(sortedUploads.map((item) => new Date(item.importedAt).getFullYear().toString()))]
        .sort()
        .reverse()
        .map((value) => ({ value, label: value }));
    }

    if (periodMode === 'month') {
      return [...new Set(sortedUploads.map((item) => {
        const date = new Date(item.importedAt);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }))]
        .sort()
        .reverse()
        .map((value) => ({ value, label: formatMonthLabel(value) }));
    }

    if (periodMode === 'week') {
      return [...new Map(sortedUploads.map((item) => {
        const week = getWeekInfo(item.importedAt);
        return [week.key, week];
      })).values()]
        .sort((a, b) => b.key.localeCompare(a.key))
        .map((week) => ({ value: week.key, label: week.label }));
    }

    return [...new Set(sortedUploads.map((item) => toInputDate(item.importedAt)))]
      .sort()
      .reverse()
      .map((value) => ({ value, label: formatDate(value) }));
  }, [periodMode, sortedUploads]);

  const filteredUploads = useMemo(() => (
    sortedUploads.filter((item) => {
      if (!periodValue) return true;

      const date = new Date(item.importedAt);
      if (periodMode === 'year') return date.getFullYear().toString() === periodValue;
      if (periodMode === 'month') {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === periodValue;
      }
      if (periodMode === 'week') return getWeekInfo(item.importedAt).key === periodValue;
      return toInputDate(item.importedAt) === periodValue;
    })
  ), [periodMode, periodValue, sortedUploads]);

  const latestUpload = filteredUploads[0] || null;
  const dashboardRows = filteredUploads.flatMap((item) => item.rows || []);

  const auditCounts = useMemo(() => ({
    total: audits.length,
    scheduled: audits.filter((audit) => audit.status === 'scheduled').length,
    inProgress: audits.filter((audit) => audit.status === 'in-progress').length,
    completed: audits.filter((audit) => audit.status === 'completed').length,
  }), [audits]);

  const sectionSummary = useMemo(() => (
    Object.values(dashboardRows.reduce((summary, row) => {
      const key = row.section || 'Unassigned';
      if (!summary[key]) {
        summary[key] = { section: key, total: 0, yes: 0, no: 0, pending: 0 };
      }

      summary[key].total += 1;
      if (row.auditDone === 'Yes') summary[key].yes += 1;
      else if (row.auditDone === 'No') summary[key].no += 1;
      else summary[key].pending += 1;

      return summary;
    }, {})).sort((a, b) => b.total - a.total)
  ), [dashboardRows]);

  const lineSummary = useMemo(() => (
    Object.values(dashboardRows.reduce((summary, row) => {
      const key = row.line || 'Unassigned';
      if (!summary[key]) {
        summary[key] = { line: key, total: 0 };
      }

      summary[key].total += 1;
      return summary;
    }, {})).sort((a, b) => b.total - a.total)
  ), [dashboardRows]);

  const dashboardLines = useMemo(() => (
    [...new Set(dashboardRows.map((row) => row.line).filter(Boolean))]
      .sort((a, b) => parseLineOrder(a) - parseLineOrder(b) || a.localeCompare(b))
  ), [dashboardRows]);

  const dashboardSections = useMemo(() => {
    const rowSections = new Set(dashboardRows.map((row) => row.section).filter(Boolean));
    return operationSections.filter((section) => rowSections.has(section))
      .concat([...rowSections].filter((section) => !operationSections.includes(section)).sort());
  }, [dashboardRows]);

  const statusMatrix = useMemo(() => {
    const buildStats = (rows) => {
      const total = rows.length;
      const yes = rows.filter((row) => row.auditDone === 'Yes').length;
      const percent = total ? Math.round((yes / total) * 100) : 0;
      return { total, yes, percent };
    };

    const rows = dashboardSections.map((section) => ({
      section,
      lineStats: dashboardLines.map((line) => buildStats(
        dashboardRows.filter((row) => row.section === section && row.line === line)
      )),
    }));

    const totalRow = {
      section: 'Total',
      lineStats: dashboardLines.map((line) => buildStats(
        dashboardRows.filter((row) => row.line === line)
      )),
    };

    return { rows, totalRow };
  }, [dashboardLines, dashboardSections, dashboardRows]);

  const reasonChartData = useMemo(() => {
    const reasonCounts = dashboardRows.reduce((summary, row) => {
      if (row.auditDone !== 'No') return summary;

      const reason = row.auditReason === 'Other'
        ? (row.auditReasonOther || 'Other')
        : (row.auditReason || 'No reason selected');

      summary[reason] = (summary[reason] || 0) + 1;
      return summary;
    }, {});

    const palette = ['#b91c1c', '#ef4444', '#f59e0b', '#0f766e', '#2563eb', '#6d28d9', '#525252'];

    return Object.entries(reasonCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([label, count], index) => ({
        label,
        count,
        color: palette[index % palette.length],
      }));
  }, [dashboardRows]);

  const recentAudits = audits.slice(0, 5);
  const roadmapImplementation = useMemo(() => {
    const total = roadmapRows.length;
    const completed = roadmapRows.filter((row) => row.status === 'COMPLETED').length;
    const inProgress = roadmapRows.filter((row) => row.status === 'ON GOING').length;
    const activeMonths = roadmapRows.reduce(
      (sum, row) => sum + roadmapMonthKeys.filter((key) => row[key]).length,
      0,
    );
    const percent = total ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      activeMonths,
      percent,
    };
  }, [roadmapRows]);

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Method360 Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome, {user?.name}. Track operator audit progress, latest uploads, and section-wise coverage from one place.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading dashboard...</div>
      ) : (
        <div className="dashboard-stack">
          <div className="card dashboard-filter-card">
            <div className="dashboard-filter-modes">
              {[
                { key: 'year', short: 'Y', label: 'Year' },
                { key: 'month', short: 'M', label: 'Month' },
                { key: 'week', short: 'W', label: 'Week' },
                { key: 'day', short: 'D', label: 'Daily' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`dashboard-filter-mode${periodMode === item.key ? ' active' : ''}`}
                  onClick={() => setPeriodMode(item.key)}
                >
                  <span>{item.short}</span>
                  <small>{item.label}</small>
                </button>
              ))}
            </div>

            <div className="dashboard-filter-select">
              <label>
                {periodMode === 'year' ? 'Year' : periodMode === 'month' ? 'Month' : periodMode === 'week' ? 'Week' : 'Date'}
              </label>
              <select value={periodValue} onChange={(e) => setPeriodValue(e.target.value)}>
                <option value="">All</option>
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-3 dashboard-metric-grid">
            <DashboardMetricCard
              accent="AU"
              label="Audits Till Now"
              value={auditCounts.total}
              hint={`${auditCounts.completed} completed, ${auditCounts.inProgress} in progress`}
              tone="dashboard-tone-amber"
            />
            <DashboardMetricCard
              accent="LN"
              label="Lines Covered"
              value={lineSummary.length}
              hint={`${dashboardSections.length} sections in selected period`}
              tone="dashboard-tone-emerald"
            />
            <DashboardMetricCard
              accent="MS"
              label="Method Std. Implementation"
              value={`${roadmapImplementation.percent}%`}
              hint={`${roadmapImplementation.completed}/${roadmapImplementation.total} completed, ${roadmapImplementation.inProgress} on going`}
              tone="dashboard-tone-sky"
            />
          </div>

          <div className="grid-2 dashboard-reason-grid">
            <div className="card dashboard-panel dashboard-panel-gradient">
              <div className="dashboard-panel-head">
                <h3>Method Standardisation Status</h3>
                {dashboardLines.length ? <span className="dashboard-panel-chip">{dashboardLines.length} lines</span> : null}
              </div>
              {dashboardLines.length && dashboardSections.length ? (
                <div className="dashboard-matrix-wrap">
                  <table className="table dashboard-matrix-table">
                    <thead>
                      <tr>
                        <th>Section</th>
                        {dashboardLines.map((line) => (
                          <th key={line}>{line}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {statusMatrix.rows.map((row) => (
                        <tr key={row.section}>
                          <td>{row.section}</td>
                          {row.lineStats.map((item, index) => (
                            <td key={`${row.section}-${dashboardLines[index]}`}>
                              <span
                                className={`dashboard-matrix-pill ${
                                  item.percent >= 90
                                    ? 'is-good'
                                    : item.percent >= 80
                                      ? 'is-mid'
                                      : 'is-low'
                                }`}
                              >
                                {item.total ? `${item.percent}%` : '—'}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr>
                        <td><strong>{statusMatrix.totalRow.section}</strong></td>
                        {statusMatrix.totalRow.lineStats.map((item, index) => (
                          <td key={`total-${dashboardLines[index]}`}>
                            <span
                              className={`dashboard-matrix-pill ${
                                item.percent >= 90
                                  ? 'is-good'
                                  : item.percent >= 80
                                    ? 'is-mid'
                                    : 'is-low'
                              }`}
                            >
                              {item.total ? `${item.percent}%` : '—'}
                            </span>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="dashboard-empty-copy">Upload audit status data to view the line-wise standardisation matrix.</p>
              )}
            </div>

            <div className="card dashboard-panel dashboard-panel-rose">
              <div className="dashboard-panel-head">
                <h3>Reason Analysis</h3>
                {reasonChartData.length ? <span className="dashboard-panel-chip">{reasonChartData.length} reasons</span> : null}
              </div>
              {reasonChartData.length ? (
                <div className="dashboard-reason-panel">
                  <DashboardPieChart data={reasonChartData} />
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Reason</th>
                        <th>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reasonChartData.map((item) => (
                        <tr key={item.label}>
                          <td>{item.label}</td>
                          <td>{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="dashboard-empty-copy">Reason counts will appear after marking rows as `No`.</p>
              )}
            </div>
          </div>

          <div className="card dashboard-panel dashboard-panel-sky">
            <div className="dashboard-panel-head">
              <h3>Section Coverage</h3>
              {sectionSummary.length ? <span className="dashboard-panel-chip">{sectionSummary.length} sections</span> : null}
            </div>
            {sectionSummary.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Total</th>
                    <th>Yes</th>
                    <th>No</th>
                    <th>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionSummary.map((item) => (
                    <tr key={item.section}>
                      <td>{item.section}</td>
                      <td>{item.total}</td>
                      <td>{item.yes}</td>
                      <td>{item.no}</td>
                      <td>{item.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="dashboard-empty-copy">No section coverage available yet.</p>
            )}
          </div>

          <div className="card dashboard-panel dashboard-panel-violet">
            <div className="dashboard-panel-head">
              <h3>Recent Audits</h3>
              <span className="dashboard-panel-chip">{auditCounts.total} total</span>
            </div>
            {recentAudits.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Audit #</th>
                    <th>Area</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAudits.map((audit) => (
                    <tr key={audit._id}>
                      <td><code>{audit.auditNumber}</code></td>
                      <td>{audit.area}</td>
                      <td>{formatDate(audit.scheduledDate)}</td>
                      <td><span className={`badge badge-${audit.status.replace(' ', '-')}`}>{audit.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="dashboard-empty-state">
                <strong>No audits yet</strong>
                <span>Audit records will appear here once methods audits are created.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
