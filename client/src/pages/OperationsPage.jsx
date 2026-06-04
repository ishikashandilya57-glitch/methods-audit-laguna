import React, { useDeferredValue, useState } from 'react';
import { operationData, operationSections } from '../data/operationData';

export default function OperationsPage() {
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('');
  const [speedType, setSpeedType] = useState('');
  const [category, setCategory] = useState('');

  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const filteredOperations = operationData.filter((item) => {
    const matchesSearch = deferredSearch
      ? [
          item.operationCode,
          item.slNo,
          item.operationName,
          item.section,
        ].some((value) => value.toLowerCase().includes(deferredSearch))
      : true;

    const matchesSection = section ? item.section === section : true;
    const matchesSpeed = speedType ? item.speedType === speedType : true;
    const matchesCategory = category ? item.category === category : true;

    return matchesSearch && matchesSection && matchesSpeed && matchesCategory;
  });

  const machineCount = filteredOperations.filter((item) => item.category === 'M').length;
  const needleCount = filteredOperations.filter((item) => item.category === 'N').length;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Operation Codes</h1>
      </div>

      <div className="card">
        <div className="grid-4">
          <div className="operations-stat">
            <span className="operations-stat-label">Total Operations</span>
            <strong className="operations-stat-value">{filteredOperations.length}</strong>
          </div>
          <div className="operations-stat">
            <span className="operations-stat-label">Sections</span>
            <strong className="operations-stat-value">{section || operationSections.length}</strong>
          </div>
          <div className="operations-stat">
            <span className="operations-stat-label">Machine Category</span>
            <strong className="operations-stat-value">{machineCount}</strong>
          </div>
          <div className="operations-stat">
            <span className="operations-stat-label">Non-Machine Category</span>
            <strong className="operations-stat-value">{needleCount}</strong>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '14px 20px' }}>
        <div className="grid-4">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code, serial no, name, or section"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Section</label>
            <select value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">All Sections</option>
              {operationSections.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>S / NS</label>
            <select value={speedType} onChange={(e) => setSpeedType(e.target.value)}>
              <option value="">All</option>
              <option value="S">S</option>
              <option value="NS">NS</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All</option>
              <option value="M">M</option>
              <option value="N">N</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="operations-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Operation Code</th>
                <th>SL No</th>
                <th>Operation Name</th>
                <th>Section</th>
                <th>SMV</th>
                <th>100%</th>
                <th>S / NS</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {filteredOperations.map((item) => (
                <tr key={item.id}>
                  <td><code>{item.operationCode}</code></td>
                  <td>{item.slNo}</td>
                  <td style={{ minWidth: 280 }}>{item.operationName}</td>
                  <td>{item.section}</td>
                  <td>{item.smv}</td>
                  <td>{item.hundredPercent}</td>
                  <td>{item.speedType}</td>
                  <td>{item.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
