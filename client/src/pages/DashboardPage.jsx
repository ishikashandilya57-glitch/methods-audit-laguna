import React, { useEffect, useMemo, useState } from 'react';
import { auditsAPI, operatorUploadsAPI, roadmapAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { operationSections } from '../data/operationData';
import { createInitialRoadmapRows, roadmapMonthKeys } from '../data/roadmapData';
import { Link } from 'react-router-dom';

const UPLOAD_HISTORY_CACHE_KEY = 'method360-upload-history-cache-v1';
const uploadDetailCacheKey = (id) => `method360-upload-detail-cache-v1:${id}`;

const readCachedJson = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getUploadActivityDate = (upload) => upload.updatedAt || upload.importedAt;

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
  const centerX = 360;
  const centerY = 190;
  const radius = 102;

  if (!total) {
    return <div className="dashboard-pie-empty">No reason data</div>;
  }

  return (
    <div className="dashboard-pie-wrap">
      <svg viewBox="0 0 820 380" className="dashboard-pie-chart" role="img" aria-label="Reason distribution pie chart">
        <defs>
          <marker
            id="dashboard-pie-arrow"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#8c96a8" />
          </marker>
        </defs>
        {data.map((item) => {
          const startAngle = currentAngle;
          const sliceAngle = (item.count / total) * 360;
          const endAngle = currentAngle + sliceAngle;
          const path = describeArc(centerX, centerY, radius, startAngle, endAngle);
          const midAngle = startAngle + (sliceAngle / 2);
          const innerPoint = polarToCartesian(centerX, centerY, 118, midAngle);
          const outerPoint = polarToCartesian(centerX, centerY, 156, midAngle);
          const isRightSide = outerPoint.x >= centerX;
          const labelX = isRightSide ? 640 : 180;
          const labelY = outerPoint.y;
          const elbowX = isRightSide ? labelX - 44 : labelX + 44;
          const textAnchor = isRightSide ? 'start' : 'end';
          const slice = (
            <g key={item.label}>
              <path
                d={path}
                fill={item.color}
                stroke="#ffffff"
                strokeWidth="2"
              />
              <path
                d={`M ${labelX} ${labelY} L ${elbowX} ${labelY} L ${outerPoint.x} ${outerPoint.y} L ${innerPoint.x} ${innerPoint.y}`}
                className="dashboard-pie-callout"
                markerEnd="url(#dashboard-pie-arrow)"
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
        <circle cx={centerX} cy={centerY} r="56" fill="#ffffff" />
        <text x={centerX} y={centerY - 8} textAnchor="middle" className="dashboard-pie-total">{total}</text>
        <text x={centerX} y={centerY + 16} textAnchor="middle" className="dashboard-pie-caption">No Reasons</text>
      </svg>
    </div>
  );
};

const MetricIcon = ({ type }) => {
  if (type === 'audits') {
    return (
      <svg viewBox="0 0 24 24" className="dashboard-metric-icon" aria-hidden="true">
        <path d="M7 4.75h10a2.25 2.25 0 0 1 2.25 2.25v10A2.25 2.25 0 0 1 17 19.25H7A2.25 2.25 0 0 1 4.75 17V7A2.25 2.25 0 0 1 7 4.75Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 9h8M8 12h5M8 15h8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'lines') {
    return (
      <svg viewBox="0 0 24 24" className="dashboard-metric-icon" aria-hidden="true">
        <path d="M5 18.25V5.75M12 18.25V9.5M19 18.25V12.25" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="5" cy="5.75" r="1.4" fill="currentColor" />
        <circle cx="12" cy="9.5" r="1.4" fill="currentColor" />
        <circle cx="19" cy="12.25" r="1.4" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="dashboard-metric-icon" aria-hidden="true">
      <path d="M6.75 12.25 10.1 15.6 17.25 8.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
};

const DashboardMetricCard = ({ icon, label, value, hint, tone }) => (
  <div className={`dashboard-metric-card${tone ? ` ${tone}` : ''}`}>
    <div className="dashboard-metric-head">
      <div className="dashboard-metric-label">{label}</div>
      <span className="dashboard-metric-accent"><MetricIcon type={icon} /></span>
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
  const [uploadDetailsById, setUploadDetailsById] = useState({});
  const [roadmapRows, setRoadmapRows] = useState([]);
  const [periodMode, setPeriodMode] = useState('year');
  const [periodValue, setPeriodValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadDetailsLoading, setUploadDetailsLoading] = useState(false);

  useEffect(() => {
    const cachedUploads = readCachedJson(UPLOAD_HISTORY_CACHE_KEY, []);
    if (cachedUploads.length) {
      setUploadHistory(cachedUploads);
    }

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
    [...uploadHistory].sort((a, b) => new Date(getUploadActivityDate(b)) - new Date(getUploadActivityDate(a)))
  ), [uploadHistory]);

  useEffect(() => {
    setPeriodValue('');
  }, [periodMode]);

  const periodOptions = useMemo(() => {
    if (periodMode === 'year') {
      return [...new Set(sortedUploads.map((item) => new Date(getUploadActivityDate(item)).getFullYear().toString()))]
        .sort()
        .reverse()
        .map((value) => ({ value, label: value }));
    }

    if (periodMode === 'month') {
      return [...new Set(sortedUploads.map((item) => {
        const date = new Date(getUploadActivityDate(item));
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }))]
        .sort()
        .reverse()
        .map((value) => ({ value, label: formatMonthLabel(value) }));
    }

    if (periodMode === 'week') {
      return [...new Map(sortedUploads.map((item) => {
        const week = getWeekInfo(getUploadActivityDate(item));
        return [week.key, week];
      })).values()]
        .sort((a, b) => b.key.localeCompare(a.key))
        .map((week) => ({ value: week.key, label: week.label }));
    }

    return [...new Set(sortedUploads.map((item) => toInputDate(getUploadActivityDate(item))))]
      .sort()
      .reverse()
      .map((value) => ({ value, label: formatDate(value) }));
  }, [periodMode, sortedUploads]);

  const filteredUploads = useMemo(() => (
    sortedUploads.filter((item) => {
      if (!periodValue) return true;

      const activityDate = getUploadActivityDate(item);
      const date = new Date(activityDate);
      if (periodMode === 'year') return date.getFullYear().toString() === periodValue;
      if (periodMode === 'month') {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === periodValue;
      }
      if (periodMode === 'week') return getWeekInfo(activityDate).key === periodValue;
      return toInputDate(activityDate) === periodValue;
    })
  ), [periodMode, periodValue, sortedUploads]);

  const latestUpload = filteredUploads[0] || null;

  useEffect(() => {
    const pendingIds = filteredUploads
      .map((upload) => upload.id || upload._id)
      .filter((id) => id && !uploadDetailsById[id]);

    if (!pendingIds.length) return;

    let cancelled = false;
    setUploadDetailsLoading(true);

    const cachedEntries = pendingIds
      .map((id) => [id, readCachedJson(uploadDetailCacheKey(id), null)])
      .filter(([, upload]) => upload);

    if (cachedEntries.length) {
      setUploadDetailsById((current) => ({
        ...current,
        ...Object.fromEntries(cachedEntries),
      }));
    }

    Promise.all(
      pendingIds.map((id) => operatorUploadsAPI.getOne(id).then(({ data }) => [id, data]))
    )
      .then((results) => {
        if (cancelled) return;
        results.forEach(([id, data]) => {
          try {
            window.localStorage.setItem(uploadDetailCacheKey(id), JSON.stringify(data));
          } catch (error) {
            // Ignore cache write failures.
          }
        });
        setUploadDetailsById((current) => ({
          ...current,
          ...Object.fromEntries(results),
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setUploadDetailsById((current) => ({ ...current }));
        }
      })
      .finally(() => {
        if (!cancelled) setUploadDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filteredUploads, uploadDetailsById]);

  const detailedUploads = useMemo(() => (
    filteredUploads
      .map((upload) => uploadDetailsById[upload.id || upload._id] || null)
      .filter(Boolean)
  ), [filteredUploads, uploadDetailsById]);

  const dashboardRows = detailedUploads.flatMap((item) => item.rows || []);

  const auditCounts = useMemo(() => ({
    total: audits.length,
    scheduled: audits.filter((audit) => audit.status === 'scheduled').length,
    inProgress: audits.filter((audit) => audit.status === 'in-progress').length,
    completed: audits.filter((audit) => audit.status === 'completed').length,
  }), [audits]);

  const auditSheetCounts = useMemo(() => ({
    total: filteredUploads.length,
    rows: dashboardRows.length,
  }), [dashboardRows.length, filteredUploads.length]);

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

    const palette = ['#0f766e', '#14b8a6', '#2563eb', '#38bdf8', '#22c55e', '#84cc16', '#64748b'];

    return Object.entries(reasonCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([label, count], index) => ({
        label,
        count,
        color: palette[index % palette.length],
      }));
  }, [dashboardRows]);

  const lineRemarksSummary = useMemo(() => {
    const remarks = detailedUploads.flatMap((upload) => (
      (upload.lineRemarks || [])
        .filter((item) => item.line || item.remark)
        .map((item) => ({
          id: `${upload.id || upload._id}-${item.id}`,
          line: item.line || '—',
          remark: item.remark || '—',
          importedAt: upload.importedAt,
          week: upload.week?.label || '',
          fileName: upload.fileName || '',
        }))
    ));

    const linesCovered = new Set(remarks.map((item) => item.line).filter((line) => line && line !== '—')).size;

    return {
      total: remarks.length,
      linesCovered,
      remarks,
    };
  }, [detailedUploads]);

  const isDashboardDetailsPending = filteredUploads.length > 0 && detailedUploads.length < filteredUploads.length;

  const recentAuditSheets = sortedUploads.slice(0, 5);

  const getCoverageTone = (item) => {
    const yesPercent = item.total ? item.yes / item.total : 0;
    const pendingPercent = item.total ? item.pending / item.total : 0;

    if (yesPercent >= 0.7 && pendingPercent <= 0.2) return 'good';
    if (pendingPercent >= 0.6) return 'risk';
    return 'mid';
  };

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
              icon="audits"
              label="Audit Sheets Till Now"
              value={auditSheetCounts.total}
              hint={auditSheetCounts.total
                ? `${auditSheetCounts.rows} rows in selected period`
                : `${auditCounts.total} audit records created`}
              tone="dashboard-tone-amber"
            />
            <DashboardMetricCard
              icon="lines"
              label="Lines Covered"
              value={lineSummary.length}
              hint={`${dashboardSections.length} sections in selected period`}
              tone="dashboard-tone-emerald"
            />
            <DashboardMetricCard
              icon="implementation"
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
              {isDashboardDetailsPending ? (
                <p className="dashboard-empty-copy">Loading uploaded sheet details...</p>
              ) : dashboardLines.length && dashboardSections.length ? (
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
              {isDashboardDetailsPending ? (
                <p className="dashboard-empty-copy">Loading uploaded sheet details...</p>
              ) : reasonChartData.length ? (
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
              <h3>Line-wise Remarks</h3>
              {lineRemarksSummary.total ? (
                <span className="dashboard-panel-chip">{lineRemarksSummary.total} remarks</span>
              ) : null}
            </div>
            {isDashboardDetailsPending ? (
              <p className="dashboard-empty-copy">Loading uploaded sheet details...</p>
            ) : lineRemarksSummary.total ? (
              <>
                <div className="dashboard-remarks-summary">
                  <span className="dashboard-panel-chip">{lineRemarksSummary.linesCovered} lines covered</span>
                  {latestUpload ? <span className="dashboard-panel-chip">Latest {formatDate(latestUpload.importedAt)}</span> : null}
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>Remark</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineRemarksSummary.remarks.map((item) => (
                      <tr key={item.id}>
                        <td>{item.line}</td>
                        <td>{item.remark}</td>
                        <td>{formatDate(item.importedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="dashboard-empty-copy">Line-wise remarks will appear here after adding them in the audits page.</p>
            )}
          </div>

          <div className="card dashboard-panel dashboard-panel-sky">
            <div className="dashboard-panel-head">
              <h3>Section Coverage</h3>
              {sectionSummary.length ? <span className="dashboard-panel-chip">{sectionSummary.length} sections</span> : null}
            </div>
            {isDashboardDetailsPending ? (
              <p className="dashboard-empty-copy">Loading uploaded sheet details...</p>
            ) : sectionSummary.length ? (
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
                      <td><span className={`dashboard-coverage-pill ${getCoverageTone(item) === 'good' ? 'is-good' : getCoverageTone(item) === 'mid' ? 'is-mid' : 'is-risk'}`}>{item.yes}</span></td>
                      <td><span className="dashboard-coverage-pill is-neutral">{item.no}</span></td>
                      <td><span className={`dashboard-coverage-pill ${getCoverageTone(item) === 'risk' ? 'is-risk' : getCoverageTone(item) === 'mid' ? 'is-mid' : 'is-good'}`}>{item.pending}</span></td>
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
              <h3>Recent Audit Sheets</h3>
              <span className="dashboard-panel-chip">{sortedUploads.length} total</span>
            </div>
            {recentAuditSheets.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Sheet</th>
                    <th>Activity Date</th>
                    <th>Yes</th>
                    <th>No</th>
                    <th>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAuditSheets.map((upload) => (
                    <tr key={upload.id || upload._id}>
                      <td><code>{upload.fileName}</code></td>
                      <td>{formatDate(getUploadActivityDate(upload))}</td>
                      <td><span className="dashboard-coverage-pill is-good">{upload.yesCount || 0}</span></td>
                      <td><span className="dashboard-coverage-pill is-neutral">{upload.noCount || 0}</span></td>
                      <td><span className="dashboard-coverage-pill is-mid">{upload.pendingCount || 0}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="dashboard-empty-state">
                <strong>No audit sheets yet</strong>
                <span>Uploaded operator audit sheets will appear here.</span>
                <div>
                  <Link to="/audits" className="btn btn-primary btn-sm">Go to Audits</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
