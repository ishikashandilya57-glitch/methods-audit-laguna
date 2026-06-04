import React, { useEffect, useMemo, useState } from 'react';
import {
  createInitialRoadmapRows,
  quarterColumns,
  roadmapMonthKeys as monthKeys,
  roadmapMonths,
} from '../data/roadmapData';
import { roadmapAPI } from '../services/api';

const statusOptions = ['PENDING', 'ON GOING', 'COMPLETED'];

const getRowSpans = (rows, key) => {
  const spans = {};
  let index = 0;

  while (index < rows.length) {
    const currentValue = rows[index][key];
    let span = 1;

    while (index + span < rows.length && rows[index + span][key] === currentValue) {
      span += 1;
    }

    spans[index] = span;
    index += span;
  }

  return spans;
};

const getQuarterCellClass = (row, quarterKey) => {
  if (!row[quarterKey]) return 'is-pending';
  if (row.status === 'COMPLETED') return 'is-done';
  if (row.status === 'ON GOING') return 'is-active';
  return 'is-pending';
};

const getStatusClass = (status) => {
  if (status === 'COMPLETED') return 'is-done';
  if (status === 'ON GOING') return 'is-active';
  return 'is-pending';
};

const currentRoadmapMonthKey = roadmapMonths[0].key;

export default function RoadmapPage() {
  const [rows, setRows] = useState(() => createInitialRoadmapRows());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    roadmapAPI.get()
      .then(({ data }) => {
        setRows(Array.isArray(data.rows) && data.rows.length ? data.rows : createInitialRoadmapRows());
      })
      .catch(() => {
        setRows(createInitialRoadmapRows());
      })
      .finally(() => setLoading(false));
  }, []);

  const departmentSpans = useMemo(() => getRowSpans(rows, 'department'), [rows]);
  const typeSpans = useMemo(() => {
    const spans = {};
    let index = 0;

    while (index < rows.length) {
      const { department, standardType } = rows[index];
      let span = 1;

      while (
        index + span < rows.length
        && rows[index + span].department === department
        && rows[index + span].standardType === standardType
      ) {
        span += 1;
      }

      spans[index] = span;
      index += span;
    }

    return spans;
  }, [rows]);

  const updateRow = (sno, field, value) => {
    setRows((currentRows) => {
      const nextRows = currentRows.map((row) => (
        row.sno === sno
          ? field === 'status'
            ? {
              ...row,
              status: value,
              ...(value === 'PENDING'
                ? Object.fromEntries(monthKeys.map((key) => [key, false]))
                : monthKeys.some((key) => row[key])
                  ? {}
                  : { [currentRoadmapMonthKey]: true }),
            }
            : { ...row, [field]: value }
          : row
      ));

      roadmapAPI.save(nextRows).catch(() => {});
      return nextRows;
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title roadmap-title">Method Standardization Roadmap</h1>
          <p className="dashboard-subtitle">
            Month-wise manual gantt roadmap with pending status by default.
          </p>
        </div>
      </div>

      <div className="card roadmap-card">
        {loading ? (
          <div className="loading" style={{ padding: 24 }}>Loading roadmap...</div>
        ) : (
        <div className="roadmap-table-wrap">
          <table className="roadmap-table">
            <thead>
              <tr>
                <th rowSpan="2">S.NO.</th>
                <th rowSpan="2">DEPARTMENT</th>
                <th rowSpan="2">STANDARD/NON-STANDARD</th>
                <th rowSpan="2">SECTION</th>
                <th rowSpan="2">STATUS</th>
                {quarterColumns.map((quarter) => (
                  <th key={quarter.key} colSpan="3">{quarter.label}</th>
                ))}
              </tr>
              <tr>
                {roadmapMonths.map((month) => (
                  <th key={month.key} className="roadmap-period-head">
                    {month.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.department}-${row.sno}-${row.section}`}>
                  <td className="roadmap-sno">{row.sno}</td>
                  {departmentSpans[index] ? (
                    <td rowSpan={departmentSpans[index]} className="roadmap-merge roadmap-department">
                      {row.department}
                    </td>
                  ) : null}
                  {typeSpans[index] ? (
                    <td rowSpan={typeSpans[index]} className="roadmap-merge roadmap-standard">
                      {row.standardType}
                    </td>
                  ) : null}
                  <td>{row.section}</td>
                  <td className="roadmap-control-cell">
                    <select
                      className={`roadmap-select ${getStatusClass(row.status)}`}
                      value={row.status}
                      onChange={(e) => updateRow(row.sno, 'status', e.target.value)}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  {roadmapMonths.map((month) => (
                    <td
                      key={`${row.sno}-${month.key}`}
                      className={`roadmap-timeline-cell ${getQuarterCellClass(row, month.key)}`}
                    >
                      <button
                        type="button"
                        className={`roadmap-quarter-button ${getQuarterCellClass(row, month.key)}`}
                        aria-label={`${row.section} ${month.label} ${row.status}`}
                        onClick={() => {
                          if (row.status === 'PENDING') return;
                          updateRow(row.sno, month.key, !row[month.key]);
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}
