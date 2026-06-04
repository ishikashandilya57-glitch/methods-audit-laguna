import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { auditsAPI, checklistsAPI } from '../services/api';

const STATUS_OPTIONS = ['scheduled', 'in-progress', 'completed', 'cancelled'];
const DEMO_AUDIT = {
  _id: 'demo-audit',
  title: 'Daily Operator Audit Demo',
  auditNumber: 'DEMO-001',
  type: 'routine',
  area: 'Line 1',
  auditor: { name: 'IE Department' },
  scheduledDate: new Date().toISOString(),
  status: 'in-progress',
  scope: 'Demo audit page for operator report upload and review.',
  objectives: 'Review uploaded operator line and operation details from the daily Excel report.',
};

const getOperatorStorageKey = (auditId) => `audit-operator-report:${auditId}`;

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

const mapOperatorRow = (row, index) => ({
  id: `operator-row-${index + 1}`,
  line: readMappedValue(row, ['line', 'line no', 'line number']),
  section: readMappedValue(row, ['section']),
  operator: readMappedValue(row, ['operator', 'operator name']),
  employeeTokenNumber: readMappedValue(row, [
    'employee token number',
    'employee token no',
    'employee token',
    'employee no',
    'empl',
    'emp',
    'token no',
    'token number',
  ]),
  operation: readMappedValue(row, ['operation', 'operation name']),
});

export default function AuditDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [audit, setAudit] = useState(null);
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChecklistForm, setShowChecklistForm] = useState(false);
  const [uploadingOperators, setUploadingOperators] = useState(false);
  const [operatorImport, setOperatorImport] = useState(null);
  const [newChecklist, setNewChecklist] = useState({ name: '', category: 'process', items: '' });
  const [activeLine, setActiveLine] = useState('All');
  const [activeSection, setActiveSection] = useState('All');
  const fileInputRef = useRef(null);

  const fetchData = async () => {
    if (id === 'demo') {
      setAudit(DEMO_AUDIT);
      setChecklists([]);
      setLoading(false);
      return;
    }

    try {
      const [auditRes, clRes] = await Promise.all([
        auditsAPI.getOne(id),
        checklistsAPI.getAll(id),
      ]);
      setAudit(auditRes.data);
      setChecklists(clRes.data);
    } catch {
      toast.error('Failed to load audit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  useEffect(() => {
    const stored = localStorage.getItem(getOperatorStorageKey(id));
    if (!stored) {
      setOperatorImport(null);
      return;
    }

    try {
      setOperatorImport(JSON.parse(stored));
    } catch {
      localStorage.removeItem(getOperatorStorageKey(id));
      setOperatorImport(null);
    }
  }, [id]);

  useEffect(() => {
    setActiveLine('All');
    setActiveSection('All');
  }, [operatorImport]);

  const updateStatus = async (status) => {
    if (id === 'demo') {
      setAudit((current) => ({ ...current, status }));
      toast.success(`Status updated to ${status}`);
      return;
    }

    try {
      const { data } = await auditsAPI.update(id, { status });
      setAudit(data);
      toast.success(`Status updated to ${status}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleCreateChecklist = async (e) => {
    e.preventDefault();

    if (id === 'demo') {
      toast.success('Checklist creation is disabled on the demo audit');
      return;
    }

    try {
      const itemLines = newChecklist.items.split('\n').filter(Boolean);
      const items = itemLines.map((question, index) => ({
        itemNumber: `${index + 1}`,
        question: question.trim(),
        response: 'pending',
      }));

      await checklistsAPI.create({
        name: newChecklist.name,
        category: newChecklist.category,
        audit: id,
        items,
      });

      toast.success('Checklist created');
      setShowChecklistForm(false);
      setNewChecklist({ name: '', category: 'process', items: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create checklist');
    }
  };

  const handleDeleteChecklist = async (checklistId) => {
    if (id === 'demo') {
      toast.success('Checklist deletion is disabled on the demo audit');
      return;
    }

    if (!window.confirm('Delete this checklist?')) return;
    try {
      await checklistsAPI.delete(checklistId);
      toast.success('Checklist deleted');
      fetchData();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleOperatorUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingOperators(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        range: 2,
      });

      const rows = rawRows
        .map(mapOperatorRow)
        .filter((row) =>
          row.line ||
          row.section ||
          row.operator ||
          row.employeeTokenNumber ||
          row.operation
        );

      if (!rows.length) {
        toast.error('No operator rows were found in the uploaded file');
        return;
      }

      const payload = {
        fileName: file.name,
        importedAt: new Date().toISOString(),
        rows,
      };

      localStorage.setItem(getOperatorStorageKey(id), JSON.stringify(payload));
      setOperatorImport(payload);
      toast.success(`Imported ${rows.length} operator rows`);
    } catch (error) {
      toast.error('Failed to read the Excel file');
    } finally {
      setUploadingOperators(false);
      event.target.value = '';
    }
  };

  const clearOperatorUpload = () => {
    localStorage.removeItem(getOperatorStorageKey(id));
    setOperatorImport(null);
    toast.success('Uploaded operator report removed');
  };

  if (loading) return <div className="loading">Loading audit...</div>;
  if (!audit) return <div className="loading">Audit not found</div>;

  const operatorRows = operatorImport?.rows || [];
  const linesCovered = new Set(operatorRows.map((row) => row.line).filter(Boolean)).size;
  const sectionsCovered = new Set(operatorRows.map((row) => row.section).filter(Boolean)).size;
  const lineTabs = ['All', ...new Set(operatorRows.map((row) => row.line).filter(Boolean))];
  const sectionTabs = [
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{audit.title}</h1>
          <code style={{ fontSize: 13, color: '#6b7280' }}>{audit.auditNumber}</code>
        </div>
        <Link to="/audits" className="btn btn-secondary">Back</Link>
      </div>

      <div className="page-header" style={{ marginTop: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Operator Audit Upload</h2>
      </div>

      <div className="card">
        <div className="audit-upload-head">
          <div>
            <h3 style={{ marginBottom: 8, fontSize: 16 }}>Daily Operator Report Import</h3>
            <p className="audit-upload-note">
              Upload the Excel sheet. The importer reads the headings from row 3 and keeps only Line, Section, Operator, Employee, and Operation.
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

        {!operatorImport ? (
          <div className="audit-upload-empty">
            No operator report uploaded yet for this audit.
          </div>
        ) : (
          <>
            <div className="grid-4" style={{ marginTop: 20 }}>
              <div className="operations-stat">
                <span className="operations-stat-label">Uploaded File</span>
                <strong className="operations-stat-value" style={{ fontSize: 16 }}>{operatorImport.fileName}</strong>
              </div>
              <div className="operations-stat">
                <span className="operations-stat-label">Rows Imported</span>
                <strong className="operations-stat-value">{operatorRows.length}</strong>
              </div>
              <div className="operations-stat">
                <span className="operations-stat-label">Lines Covered</span>
                <strong className="operations-stat-value">{linesCovered}</strong>
              </div>
              <div className="operations-stat">
                <span className="operations-stat-label">Sections Covered</span>
                <strong className="operations-stat-value">{sectionsCovered}</strong>
              </div>
            </div>

            <div className="grid-4" style={{ marginTop: 16 }}>
              <div className="operations-stat">
                <span className="operations-stat-label">Visible Rows</span>
                <strong className="operations-stat-value">{filteredOperatorRows.length}</strong>
              </div>
              <div className="operations-stat">
                <span className="operations-stat-label">Imported On</span>
                <strong className="operations-stat-value" style={{ fontSize: 16 }}>
                  {new Date(operatorImport.importedAt).toLocaleString()}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Uploaded Operator Rows</h3>
              <button type="button" className="btn btn-secondary" onClick={clearOperatorUpload}>Clear Upload</button>
            </div>

            <div className="audit-tab-group">
              <span className="audit-tab-label">Line</span>
              <div className="audit-tab-list">
                {lineTabs.map((line) => (
                  <button
                    key={line}
                    type="button"
                    className={`audit-tab ${activeLine === line ? 'active' : ''}`}
                    onClick={() => {
                      setActiveLine(line);
                      setActiveSection('All');
                    }}
                  >
                    {line}
                  </button>
                ))}
              </div>
            </div>

            <div className="audit-tab-group" style={{ marginTop: 12 }}>
              <span className="audit-tab-label">Section</span>
              <div className="audit-tab-list">
                {sectionTabs.map((section) => (
                  <button
                    key={section}
                    type="button"
                    className={`audit-tab ${activeSection === section ? 'active' : ''}`}
                    onClick={() => setActiveSection(section)}
                  >
                    {section}
                  </button>
                ))}
              </div>
            </div>

            <div className="operations-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Section</th>
                    <th>Operator</th>
                    <th>Employee Token No</th>
                    <th>Operation</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOperatorRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.line || '—'}</td>
                      <td>{row.section || '—'}</td>
                      <td>{row.operator || '—'}</td>
                      <td>{row.employeeTokenNumber || '—'}</td>
                      <td>{row.operation || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="page-header" style={{ marginTop: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Checklists ({checklists.length})</h2>
        <button className="btn btn-primary" onClick={() => setShowChecklistForm(!showChecklistForm)}>
          {showChecklistForm ? 'Cancel' : 'Add Checklist'}
        </button>
      </div>

      {showChecklistForm && (
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>New Checklist</h3>
          <form onSubmit={handleCreateChecklist}>
            <div className="grid-2">
              <div className="form-group">
                <label>Checklist Name *</label>
                <input
                  required
                  value={newChecklist.name}
                  onChange={(e) => setNewChecklist({ ...newChecklist, name: e.target.value })}
                  placeholder="e.g. Safety Compliance Check"
                />
              </div>
              <div className="form-group">
                <label>Category *</label>
                <select
                  value={newChecklist.category}
                  onChange={(e) => setNewChecklist({ ...newChecklist, category: e.target.value })}
                >
                  <option value="safety">Safety</option>
                  <option value="quality">Quality</option>
                  <option value="process">Process</option>
                  <option value="equipment">Equipment</option>
                  <option value="documentation">Documentation</option>
                  <option value="environment">Environment</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Checklist Items (one question per line) *</label>
              <textarea
                rows={6}
                required
                value={newChecklist.items}
                onChange={(e) => setNewChecklist({ ...newChecklist, items: e.target.value })}
                placeholder={'Are PPE requirements posted and followed?\nAre machine guards in place?\nIs the work area clean and organized?'}
              />
            </div>
            <button type="submit" className="btn btn-success">Create Checklist</button>
          </form>
        </div>
      )}

      {checklists.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#6b7280', padding: '32px' }}>
          No checklists yet. Add one to start the audit.
        </div>
      ) : (
        checklists.map((checklist) => (
          <div key={checklist._id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>{checklist.name}</h3>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, textTransform: 'capitalize' }}>
                  {checklist.category} · {checklist.items?.length || 0} items · {checklist.completionPercentage}% complete
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to={`/audits/${id}/checklists/${checklist._id}`} className="btn btn-sm btn-primary">
                  Fill Checklist
                </Link>
                <button onClick={() => handleDeleteChecklist(checklist._id)} className="btn btn-sm btn-danger">Del</button>
              </div>
            </div>
            <div style={{ marginTop: 10, background: '#e5e7eb', borderRadius: 4, height: 6 }}>
              <div
                style={{
                  width: `${checklist.completionPercentage}%`,
                  background: '#16a34a',
                  height: '100%',
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
