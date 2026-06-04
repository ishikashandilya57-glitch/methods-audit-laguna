import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { auditsAPI, operatorUploadsAPI } from '../services/api';
import { operationData } from '../data/operationData';

const auditReasonOptions = [
  'Work aid not available',
  'Operator not following',
  'Other operation mc',
  'Std video not available',
  'Other',
];

const normalizeHeader = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const readMappedValue = (row, aliases) => {
  const entries = Object.entries(row);
  const match = entries.find(([key]) => aliases.includes(normalizeHeader(key)));
  return match ? String(match[1] ?? '').trim() : '';
};

const normalizeOperationText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\bneckband\b/g, 'neck band')
    .replace(/\btopstitch\b/g, 'top stitch')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const operationAliases = {
  'sleeve tacking': 'sleeve under placket tacking uhs',
};

const buildTokenSignature = (value) => (
  [...new Set(
    normalizeOperationText(value)
      .split(' ')
      .filter(Boolean)
  )]
    .sort()
    .join(' ')
);

const scoreOperationMatch = (queryTokens, candidateTokens) => {
  if (!queryTokens.length || !candidateTokens.length) return 0;

  const querySet = new Set(queryTokens);
  const candidateSet = new Set(candidateTokens);
  const overlap = queryTokens.filter((token) => candidateSet.has(token)).length;

  if (!overlap) return 0;

  const queryCoverage = overlap / querySet.size;
  const candidateCoverage = overlap / candidateSet.size;
  return (queryCoverage * 0.75) + (candidateCoverage * 0.25);
};

const toInputDate = (isoString) => new Date(isoString).toISOString().slice(0, 10);

const getWeekInfo = (isoString) => {
  const date = new Date(isoString);
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

export default function AuditListPage() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingOperators, setUploadingOperators] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [selectedUploadDate, setSelectedUploadDate] = useState('');
  const [selectedWeekKey, setSelectedWeekKey] = useState('');
  const [activeLine, setActiveLine] = useState('All');
  const [activeSection, setActiveSection] = useState('All');
  const [editingAuditStatusRows, setEditingAuditStatusRows] = useState({});
  const [filters, setFilters] = useState({ status: '', area: '' });
  const fileInputRef = useRef(null);
  const operationMatcher = useMemo(() => {
    const entries = operationData.map((item) => ({
      operationCode: String(item.operationCode || '').trim().toUpperCase(),
      normalizedName: normalizeOperationText(item.operationName),
      signature: buildTokenSignature(item.operationName),
      sectionKey: normalizeOperationText(item.section),
      speedType: item.speedType,
      tokens: normalizeOperationText(item.operationName).split(' ').filter(Boolean),
    }));

    const exactLookup = new Map();
    const signatureLookup = new Map();
    const codeLookup = new Map();

    entries.forEach((entry) => {
      const exactKey = `${entry.sectionKey}::${entry.normalizedName}`;
      const globalExactKey = `all::${entry.normalizedName}`;
      const signatureKey = `${entry.sectionKey}::${entry.signature}`;
      const globalSignatureKey = `all::${entry.signature}`;

      if (entry.operationCode && !codeLookup.has(entry.operationCode)) codeLookup.set(entry.operationCode, entry);
      if (!exactLookup.has(exactKey)) exactLookup.set(exactKey, entry);
      if (!exactLookup.has(globalExactKey)) exactLookup.set(globalExactKey, entry);
      if (!signatureLookup.has(signatureKey)) signatureLookup.set(signatureKey, entry);
      if (!signatureLookup.has(globalSignatureKey)) signatureLookup.set(globalSignatureKey, entry);
    });

    return { entries, exactLookup, signatureLookup, codeLookup };
  }, []);

  const matchOperationSpeedType = (operationCode, operationName, sectionName) => {
    const normalizedCode = String(operationCode || '').trim().toUpperCase();
    const normalizedOperation = normalizeOperationText(operationName);
    const normalizedSection = normalizeOperationText(sectionName);
    const aliasOperation = operationAliases[normalizedOperation] || normalizedOperation;

    if (normalizedCode) {
      const codeMatch = operationMatcher.codeLookup.get(normalizedCode);
      if (codeMatch) return codeMatch.speedType;
    }

    if (!aliasOperation) return '—';

    const exactMatch = operationMatcher.exactLookup.get(`${normalizedSection}::${aliasOperation}`)
      || operationMatcher.exactLookup.get(`all::${aliasOperation}`);

    if (exactMatch) return exactMatch.speedType;

    const signature = buildTokenSignature(aliasOperation);
    const signatureMatch = operationMatcher.signatureLookup.get(`${normalizedSection}::${signature}`)
      || operationMatcher.signatureLookup.get(`all::${signature}`);

    if (signatureMatch) return signatureMatch.speedType;

    const queryTokens = aliasOperation.split(' ').filter(Boolean);
    const scopedEntries = operationMatcher.entries.filter((entry) => (
      !normalizedSection || entry.sectionKey === normalizedSection
    ));
    const candidates = scopedEntries.length ? scopedEntries : operationMatcher.entries;

    let bestMatch = null;
    let bestScore = 0;

    candidates.forEach((entry) => {
      const score = scoreOperationMatch(queryTokens, entry.tokens);
      const aliasContainsEntry = aliasOperation.includes(entry.normalizedName);
      const entryContainsAlias = entry.normalizedName.includes(aliasOperation);
      const adjustedScore = score
        + (aliasContainsEntry || entryContainsAlias ? 0.2 : 0);

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestMatch = entry;
      }
    });

    return bestScore >= 0.7 ? bestMatch.speedType : '—';
  };

  const buildOperatorRow = (row, index) => {
    const operation = readMappedValue(row, ['operation', 'operation name']);
    const operationCode = readMappedValue(row, ['operation code', 'code', 'operationcode']);
    const section = readMappedValue(row, ['section']);

    return {
      id: `audit-list-operator-row-${index + 1}`,
      line: readMappedValue(row, ['line', 'line no', 'line number']),
      section,
      operator: readMappedValue(row, ['operator', 'operator name']),
      employeeId: readMappedValue(row, [
        'employee',
        'employee no',
        'employee number',
        'employee id',
        'employee token',
        'employee token number',
        'empl',
        'emp id',
        'token number',
      ]),
      operationCode,
      operation,
      speedType: matchOperationSpeedType(operationCode, operation, section),
      picture: '',
      auditDone: '',
      auditReason: '',
      auditReasonOther: '',
    };
  };

  const hydrateUploadHistory = (history) => (
    history.map((upload) => ({
      ...upload,
      id: upload.id || upload._id,
      rows: (upload.rows || []).map((row, index) => ({
        ...row,
        id: row.id || `audit-list-operator-row-${index + 1}`,
        employeeId: row.employeeId || row.employee || '',
        operationCode: row.operationCode || '',
        picture: row.picture || '',
        auditDone: row.auditDone || '',
        auditReason: row.auditReason || '',
        auditReasonOther: row.auditReasonOther || '',
        speedType: row.speedType === 'S' || row.speedType === 'NS'
          ? row.speedType
          : matchOperationSpeedType(row.operationCode, row.operation, row.section),
      })),
    }))
  );

  const fetchAudits = () => {
    setLoading(true);
    auditsAPI.getAll(filters)
      .then(({ data }) => setAudits(data.audits || []))
      .catch(() => setAudits([]))
      .finally(() => setLoading(false));
  };

  const fetchUploadHistory = () => {
    operatorUploadsAPI.getAll()
      .then(({ data }) => setUploadHistory(hydrateUploadHistory(data || [])))
      .catch(() => setUploadHistory([]));
  };

  useEffect(() => { fetchAudits(); }, [filters]);

  useEffect(() => {
    fetchUploadHistory();
  }, [operationMatcher]);

  const visibleUploads = useMemo(() => (
    uploadHistory.filter((item) => {
      const matchesDate = selectedUploadDate ? toInputDate(item.importedAt) === selectedUploadDate : true;
      const matchesWeek = selectedWeekKey ? getWeekInfo(item.importedAt).key === selectedWeekKey : true;
      return matchesDate && matchesWeek;
    })
  ), [uploadHistory, selectedUploadDate, selectedWeekKey]);

  const selectedImport = useMemo(() => visibleUploads[0] || null, [visibleUploads]);

  useEffect(() => {
    setActiveLine('All');
    setActiveSection('All');
    setEditingAuditStatusRows({});
  }, [selectedImport]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this audit?')) return;
    try {
      await auditsAPI.delete(id);
      toast.success('Audit deleted');
      fetchAudits();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleOperatorUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingOperators(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const targetSheetName = workbook.SheetNames.find((name) => /detail/i.test(name))
        || workbook.SheetNames.find((name) => /daily|operator/i.test(name))
        || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[targetSheetName];

      if (!worksheet) {
        throw new Error('No readable worksheet found in the uploaded file');
      }

      const rawRows = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        range: 4,
      });

      const rows = rawRows
        .map(buildOperatorRow)
        .filter((row) => row.line || row.section || row.operator || row.employeeId || row.operation || row.operationCode);

      if (!rows.length) {
        toast.error('No operator rows were found in the uploaded file');
        return;
      }

      const importedAt = new Date().toISOString();
      const upload = {
        fileName: file.name,
        importedAt,
        week: getWeekInfo(importedAt),
        rows,
      };

      const { data } = await operatorUploadsAPI.create(upload);
      setUploadHistory((current) => hydrateUploadHistory([data, ...current]));
      setSelectedUploadDate('');
      setSelectedWeekKey('');
      toast.success(`Imported ${rows.length} operator rows`);
    } catch (error) {
      toast.error(
        error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || 'Failed to read the Excel file'
      );
    } finally {
      setUploadingOperators(false);
      event.target.value = '';
    }
  };

  const clearSelectedUpload = () => {
    if (!selectedImport) return;
    operatorUploadsAPI.delete(selectedImport._id || selectedImport.id)
      .then(() => {
        setUploadHistory((current) => current.filter((item) => item.id !== selectedImport.id));
        toast.success('Selected uploaded sheet removed');
      })
      .catch(() => toast.error('Failed to remove selected sheet'));
  };

  const clearAllUploads = () => {
    operatorUploadsAPI.clearAll()
      .then(() => {
        setUploadHistory([]);
        setSelectedUploadDate('');
        setSelectedWeekKey('');
        toast.success('All uploaded sheets removed');
      })
      .catch(() => toast.error('Failed to remove uploaded sheets'));
  };

  const updateUploadHistoryRows = (uploadId, rowId, updates) => {
    const nextHistory = uploadHistory.map((upload) => {
      if (upload.id !== uploadId) return upload;

      return {
        ...upload,
        rows: (upload.rows || []).map((row) => (
          row.id === rowId ? { ...row, ...updates } : row
        )),
      };
    });
    setUploadHistory(nextHistory);

    const updatedUpload = nextHistory.find((upload) => upload.id === uploadId);
    if (updatedUpload) {
      operatorUploadsAPI.update(updatedUpload._id || updatedUpload.id, updatedUpload).catch(() => {});
    }
  };

  const handleSpeedTypeChange = (rowId, value) => {
    if (!selectedImport) return;
    updateUploadHistoryRows(selectedImport.id, rowId, { speedType: value });
  };

  const handlePictureChange = (rowId, file) => {
    if (!selectedImport || !file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateUploadHistoryRows(selectedImport.id, rowId, { picture: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const clearPicture = (rowId) => {
    if (!selectedImport) return;
    updateUploadHistoryRows(selectedImport.id, rowId, { picture: '' });
  };

  const handleAuditDoneChange = (rowId, value) => {
    if (!selectedImport) return;
    updateUploadHistoryRows(selectedImport.id, rowId, {
      auditDone: value,
      auditReason: value === 'No' ? '' : '',
      auditReasonOther: value === 'No' ? '' : '',
    });
    setEditingAuditStatusRows((current) => ({ ...current, [rowId]: false }));
  };

  const openAuditStatusEdit = (rowId) => {
    setEditingAuditStatusRows((current) => ({ ...current, [rowId]: true }));
  };

  const handleAuditReasonChange = (rowId, value) => {
    if (!selectedImport) return;
    updateUploadHistoryRows(selectedImport.id, rowId, {
      auditReason: value,
      auditReasonOther: value === 'Other' ? '' : '',
    });
  };

  const handleAuditReasonOtherChange = (rowId, value) => {
    if (!selectedImport) return;
    updateUploadHistoryRows(selectedImport.id, rowId, { auditReasonOther: value });
  };

  const operatorRows = selectedImport?.rows || [];
  const lineOptions = ['All', ...new Set(operatorRows.map((row) => row.line).filter(Boolean))];
  const sectionOptions = [
    'All',
    ...new Set(
      operatorRows
        .filter((row) => activeLine === 'All' || row.line === activeLine)
        .map((row) => row.section)
        .filter(Boolean)
    ),
  ];
  const filteredOperatorRows = operatorRows.filter((row) => {
    const matchesLine = activeLine === 'All' || row.line === activeLine;
    const matchesSection = activeSection === 'All' || row.section === activeSection;
    return matchesLine && matchesSection;
  });

  const uploadDates = [...new Set(uploadHistory.map((item) => toInputDate(item.importedAt)))].sort().reverse();
  const uploadWeeks = [...new Map(uploadHistory.map((item) => [item.week.key, item.week])).values()];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Audits</h1>
      </div>

      <div className="card">
        <div className="audit-upload-head">
          <div>
            <h3 style={{ marginBottom: 8, fontSize: 16 }}>Operator Excel Upload</h3>
            <p className="audit-upload-note">
              Upload the report from the audits page. The importer reads headings from row 5 and keeps only Line, Section, Operator, Employee ID, Operation, and matched S / NS by operation code.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary audit-upload-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingOperators}
          >
            {uploadingOperators ? 'Uploading...' : 'Choose Excel File'}
          </button>
        </div>

        <div className="audit-file-input-row">
          <input
            ref={fileInputRef}
            className="audit-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleOperatorUpload}
            disabled={uploadingOperators}
          />
        </div>

        {!uploadHistory.length ? (
          <div className="audit-upload-empty">
            No operator report uploaded yet.
          </div>
        ) : (
          <>
            <div className="audit-history-filters">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Uploaded Date</label>
                <select value={selectedUploadDate} onChange={(e) => setSelectedUploadDate(e.target.value)}>
                  <option value="">All Dates</option>
                  {uploadDates.map((date) => (
                    <option key={date} value={date}>{date}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Week</label>
                <select value={selectedWeekKey} onChange={(e) => setSelectedWeekKey(e.target.value)}>
                  <option value="">All Weeks</option>
                  {uploadWeeks.map((week) => (
                    <option key={week.key} value={week.key}>{week.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedImport ? (
              <div className="audit-upload-empty">
                No uploaded sheet matches the selected date or week.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 12 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Uploaded Operator Rows</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-secondary" onClick={clearSelectedUpload}>Clear Selected Sheet</button>
                    <button type="button" className="btn btn-secondary" onClick={clearAllUploads}>Clear All Sheets</button>
                  </div>
                </div>

                <div className="audit-history-filters" style={{ marginTop: 0 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Line</label>
                    <select
                      value={activeLine}
                      onChange={(e) => {
                        setActiveLine(e.target.value);
                        setActiveSection('All');
                      }}
                    >
                      {lineOptions.map((line) => (
                        <option key={line} value={line}>{line}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Section</label>
                    <select value={activeSection} onChange={(e) => setActiveSection(e.target.value)}>
                      {sectionOptions.map((section) => (
                        <option key={section} value={section}>{section}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="operations-table-wrap" style={{ marginTop: 16 }}>
                  <table className="table audit-operator-table">
                    <thead>
                      <tr>
                        <th>Line</th>
                        <th>Section</th>
                        <th>Operator</th>
                        <th>Employee ID</th>
                        <th>Operation</th>
                        <th>S / NS</th>
                        <th>Picture</th>
                        <th>Audit Status</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOperatorRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.line || '—'}</td>
                          <td>{row.section || '—'}</td>
                          <td>{row.operator || '—'}</td>
                          <td>{row.employeeId || '—'}</td>
                          <td>{row.operation || '—'}</td>
                          <td className="audit-cell-compact">
                            <select
                              className="audit-inline-select"
                              value={row.speedType === '—' ? '' : row.speedType}
                              onChange={(e) => handleSpeedTypeChange(row.id, e.target.value || '—')}
                            >
                              <option value="">Select</option>
                              <option value="S">S</option>
                              <option value="NS">NS</option>
                            </select>
                          </td>
                          <td className="audit-cell-picture">
                            <div className="audit-picture-field">
                              {row.picture ? (
                                <img
                                  src={row.picture}
                                  alt={`${row.operator || 'Operator'} reference`}
                                  className="audit-picture-preview"
                                />
                              ) : (
                                <span className="audit-picture-empty">No image</span>
                              )}
                              <label className="audit-picture-label">
                                <span>{row.picture ? 'Change' : 'Add'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handlePictureChange(row.id, file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                              {row.picture ? (
                                <button
                                  type="button"
                                  className="audit-picture-clear"
                                  onClick={() => clearPicture(row.id)}
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td className="audit-cell-status">
                            {row.auditDone && !editingAuditStatusRows[row.id] ? (
                              <div className="audit-status-selected">
                                <button
                                  type="button"
                                  className={`audit-status-option ${row.auditDone === 'Yes' ? 'audit-status-option-yes' : 'audit-status-option-no'} active`}
                                >
                                  {row.auditDone}
                                </button>
                                <button
                                  type="button"
                                  className="audit-status-edit"
                                  onClick={() => openAuditStatusEdit(row.id)}
                                >
                                  Edit
                                </button>
                              </div>
                            ) : (
                              <div className="audit-status-toggle">
                                <button
                                  type="button"
                                  className={`audit-status-option audit-status-option-yes${row.auditDone === 'Yes' ? ' active' : ''}`}
                                  onClick={() => handleAuditDoneChange(row.id, 'Yes')}
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  className={`audit-status-option audit-status-option-no${row.auditDone === 'No' ? ' active' : ''}`}
                                  onClick={() => handleAuditDoneChange(row.id, 'No')}
                                >
                                  No
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="audit-cell-reason">
                            {row.auditDone === 'No' ? (
                              <div className="audit-reason-field">
                                <select
                                  className="audit-inline-select audit-reason-select"
                                  value={row.auditReason}
                                  onChange={(e) => handleAuditReasonChange(row.id, e.target.value)}
                                >
                                  <option value="">Select reason</option>
                                  {auditReasonOptions.map((reason) => (
                                    <option key={reason} value={reason}>{reason}</option>
                                  ))}
                                </select>
                                {row.auditReason === 'Other' ? (
                                  <input
                                    className="audit-reason-input"
                                    type="text"
                                    placeholder="Write reason"
                                    value={row.auditReasonOther}
                                    onChange={(e) => handleAuditReasonOtherChange(row.id, e.target.value)}
                                  />
                                ) : null}
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="card" style={{ padding: '14px 20px' }}>
        <div className="grid-2">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Filter by Status</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Filter by Area</label>
            <input
              placeholder="Search area..."
              value={filters.area}
              onChange={(e) => setFilters({ ...filters, area: e.target.value })}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="loading">Loading audits...</div>
        </div>
      ) : audits.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>
          No audits found.
        </p>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Audit #</th>
                <th>Title</th>
                <th>Type</th>
                <th>Area</th>
                <th>Auditor</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit._id}>
                  <td><code style={{ fontSize: 12 }}>{audit.auditNumber}</code></td>
                  <td style={{ fontWeight: 500 }}>{audit.title}</td>
                  <td style={{ textTransform: 'capitalize' }}>{audit.type}</td>
                  <td>{audit.area}</td>
                  <td>{audit.auditor?.name || '—'}</td>
                  <td>{new Date(audit.scheduledDate).toLocaleDateString()}</td>
                  <td><span className={`badge badge-${audit.status.replace(' ', '-')}`}>{audit.status}</span></td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <Link to={`/audits/${audit._id}`} className="btn btn-sm btn-primary">View</Link>
                    <button onClick={() => handleDelete(audit._id)} className="btn btn-sm btn-danger">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
