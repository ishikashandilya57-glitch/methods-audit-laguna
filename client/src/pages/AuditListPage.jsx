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

const writeCachedJson = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore cache write failures.
  }
};

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
  const [uploadDetailsLoading, setUploadDetailsLoading] = useState(false);
  const [uploadingOperators, setUploadingOperators] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadHistory, setUploadHistory] = useState([]);
  const [uploadDetailsById, setUploadDetailsById] = useState({});
  const [uploadDetailErrors, setUploadDetailErrors] = useState({});
  const [selectedUploadDate, setSelectedUploadDate] = useState('');
  const [selectedWeekKey, setSelectedWeekKey] = useState('');
  const [activeLine, setActiveLine] = useState('All');
  const [activeSection, setActiveSection] = useState('All');
  const [showAuditActions, setShowAuditActions] = useState(false);
  const [editingAuditStatusRows, setEditingAuditStatusRows] = useState({});
  const [savingUploads, setSavingUploads] = useState({});
  const [openPictureMenuRowId, setOpenPictureMenuRowId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [filters, setFilters] = useState({ status: '', area: '' });
  const fileInputRef = useRef(null);
  const uploadSaveTimersRef = useRef({});
  const uploadPendingPayloadsRef = useRef({});
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
    history.map((upload) => {
      const hasRows = Array.isArray(upload.rows);
      const hasLineRemarks = Array.isArray(upload.lineRemarks);

      return {
        ...upload,
        id: upload.id || upload._id,
        hasFullDetails: hasRows,
        rowCount: upload.rowCount ?? (hasRows ? upload.rows.length : 0),
        lineCount: upload.lineCount ?? (hasRows ? new Set(upload.rows.map((row) => row.line).filter(Boolean)).size : 0),
        sectionCount: upload.sectionCount ?? (hasRows ? new Set(upload.rows.map((row) => row.section).filter(Boolean)).size : 0),
        yesCount: upload.yesCount ?? (hasRows ? upload.rows.filter((row) => row.auditDone === 'Yes').length : 0),
        noCount: upload.noCount ?? (hasRows ? upload.rows.filter((row) => row.auditDone === 'No').length : 0),
        pendingCount: upload.pendingCount ?? (hasRows
          ? Math.max(upload.rows.length - upload.rows.filter((row) => row.auditDone === 'Yes').length - upload.rows.filter((row) => row.auditDone === 'No').length, 0)
          : 0),
        lineRemarksCount: upload.lineRemarksCount ?? (hasLineRemarks ? upload.lineRemarks.length : 0),
        lineRemarks: hasLineRemarks ? upload.lineRemarks.map((remark, index) => ({
          id: remark.id || `line-remark-${index + 1}`,
          line: remark.line || '',
          remark: remark.remark || '',
          status: remark.status || 'Pending',
        })) : undefined,
        rows: hasRows ? upload.rows.map((row, index) => ({
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
        })) : undefined,
      };
    })
  );

  const summarizeUpload = (upload) => {
    const rows = upload.rows || [];
    const yesCount = rows.filter((row) => row.auditDone === 'Yes').length;
    const noCount = rows.filter((row) => row.auditDone === 'No').length;

    return {
      ...upload,
      id: upload.id || upload._id,
      rowCount: rows.length,
      lineCount: new Set(rows.map((row) => row.line).filter(Boolean)).size,
      sectionCount: new Set(rows.map((row) => row.section).filter(Boolean)).size,
      yesCount,
      noCount,
      pendingCount: Math.max(rows.length - yesCount - noCount, 0),
      lineRemarksCount: (upload.lineRemarks || []).length,
    };
  };

  const fetchAudits = () => {
    setLoading(true);
    auditsAPI.getAll(filters)
      .then(({ data }) => setAudits(data.audits || []))
      .catch(() => setAudits([]))
      .finally(() => setLoading(false));
  };

  const fetchUploadHistory = () => {
    operatorUploadsAPI.getAll()
      .then(({ data }) => {
        const hydrated = hydrateUploadHistory(data || []);
        setUploadHistory(hydrated);
        writeCachedJson(UPLOAD_HISTORY_CACHE_KEY, data || []);
      })
      .catch(() => setUploadHistory([]));
  };

  useEffect(() => { fetchAudits(); }, [filters]);

  useEffect(() => {
    const cachedHistory = readCachedJson(UPLOAD_HISTORY_CACHE_KEY, []);
    if (cachedHistory.length) {
      setUploadHistory(hydrateUploadHistory(cachedHistory));
    }
    fetchUploadHistory();
  }, [operationMatcher]);

  useEffect(() => () => {
    Object.values(uploadSaveTimersRef.current).forEach((timer) => clearTimeout(timer));
  }, []);

  useEffect(() => {
    writeCachedJson(
      UPLOAD_HISTORY_CACHE_KEY,
      uploadHistory.map(({ rows, lineRemarks, hasFullDetails, ...upload }) => upload),
    );
  }, [uploadHistory]);

  const visibleUploads = useMemo(() => (
    uploadHistory.filter((item) => {
      const matchesDate = selectedUploadDate ? toInputDate(item.importedAt) === selectedUploadDate : true;
      const matchesWeek = selectedWeekKey ? getWeekInfo(item.importedAt).key === selectedWeekKey : true;
      return matchesDate && matchesWeek;
    })
  ), [uploadHistory, selectedUploadDate, selectedWeekKey]);

  const selectedImport = useMemo(() => visibleUploads[0] || null, [visibleUploads]);
  const selectedImportDetails = selectedImport
    ? uploadDetailsById[selectedImport.id] || (selectedImport.hasFullDetails ? selectedImport : null)
    : null;
  const activeUpload = selectedImportDetails || (selectedImport?.hasFullDetails ? selectedImport : null);

  useEffect(() => {
    setActiveLine('All');
    setActiveSection('All');
    setEditingAuditStatusRows({});
    setShowAuditActions(false);
    setOpenPictureMenuRowId(null);
  }, [selectedImport?.id]);

  useEffect(() => {
    if (!selectedImport?.id || uploadDetailsById[selectedImport.id] || selectedImport.hasFullDetails) return;

    const cachedUpload = readCachedJson(uploadDetailCacheKey(selectedImport.id), null);
    if (cachedUpload) {
      const [hydrated] = hydrateUploadHistory([cachedUpload]);
      setUploadDetailsById((current) => ({ ...current, [hydrated.id]: hydrated }));
      setUploadDetailErrors((current) => ({ ...current, [hydrated.id]: false }));
    } else {
      setUploadDetailsLoading(true);
    }

    operatorUploadsAPI.getOne(selectedImport.id)
      .then(({ data }) => {
        const [hydrated] = hydrateUploadHistory([data]);
        setUploadDetailsById((current) => ({ ...current, [hydrated.id]: hydrated }));
        setUploadDetailErrors((current) => ({ ...current, [hydrated.id]: false }));
        writeCachedJson(uploadDetailCacheKey(hydrated.id), data);
      })
      .catch(() => {
        setUploadDetailErrors((current) => ({ ...current, [selectedImport.id]: true }));
        toast.error('Failed to load uploaded sheet details');
      })
      .finally(() => setUploadDetailsLoading(false));
  }, [selectedImport?.id, selectedImport?.hasFullDetails, uploadDetailsById]);

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

    setUploadFileName(file.name);
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
      const [hydrated] = hydrateUploadHistory([data]);
      setUploadHistory((current) => [summarizeUpload(hydrated), ...current]);
      setUploadDetailsById((current) => ({ ...current, [hydrated.id]: hydrated }));
      writeCachedJson(uploadDetailCacheKey(hydrated.id), data);
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
    if (uploadSaveTimersRef.current[selectedImport.id]) {
      clearTimeout(uploadSaveTimersRef.current[selectedImport.id]);
      delete uploadSaveTimersRef.current[selectedImport.id];
      delete uploadPendingPayloadsRef.current[selectedImport.id];
    }
    operatorUploadsAPI.delete(selectedImport._id || selectedImport.id)
      .then(() => {
        setUploadHistory((current) => current.filter((item) => item.id !== selectedImport.id));
        setUploadDetailsById((current) => {
          const next = { ...current };
          delete next[selectedImport.id];
          return next;
        });
        window.localStorage.removeItem(uploadDetailCacheKey(selectedImport.id));
        toast.success('Selected uploaded sheet removed');
      })
      .catch(() => toast.error('Failed to remove selected sheet'));
  };

  const clearAllUploads = () => {
    Object.values(uploadSaveTimersRef.current).forEach((timer) => clearTimeout(timer));
    uploadSaveTimersRef.current = {};
    uploadPendingPayloadsRef.current = {};
    operatorUploadsAPI.clearAll()
      .then(() => {
        uploadHistory.forEach((upload) => window.localStorage.removeItem(uploadDetailCacheKey(upload.id)));
        setUploadHistory([]);
        setUploadDetailsById({});
        setSelectedUploadDate('');
        setSelectedWeekKey('');
        window.localStorage.removeItem(UPLOAD_HISTORY_CACHE_KEY);
        toast.success('All uploaded sheets removed');
      })
      .catch(() => toast.error('Failed to remove uploaded sheets'));
  };

  const scheduleUploadSave = (upload) => {
    const uploadId = upload.id;
    if (!uploadId) return;

    uploadPendingPayloadsRef.current[uploadId] = upload;
    setSavingUploads((current) => ({ ...current, [uploadId]: true }));

    if (uploadSaveTimersRef.current[uploadId]) {
      clearTimeout(uploadSaveTimersRef.current[uploadId]);
    }

    uploadSaveTimersRef.current[uploadId] = setTimeout(async () => {
      const payload = uploadPendingPayloadsRef.current[uploadId];

      try {
        await operatorUploadsAPI.update(payload._id || payload.id, payload);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to save audit changes');
      } finally {
        delete uploadSaveTimersRef.current[uploadId];
        delete uploadPendingPayloadsRef.current[uploadId];
        setSavingUploads((current) => ({ ...current, [uploadId]: false }));
      }
    }, 500);
  };

  const updateUploadHistoryRows = (uploadId, rowId, updates) => {
    let updatedUpload = null;

    setUploadDetailsById((current) => {
      const currentUpload = current[uploadId];
      if (!currentUpload) return current;

      updatedUpload = {
        ...currentUpload,
        rows: (currentUpload.rows || []).map((row) => (
          row.id === rowId ? { ...row, ...updates } : row
        )),
      };

      return { ...current, [uploadId]: updatedUpload };
    });

    if (!updatedUpload) return;

    setUploadHistory((current) => current.map((upload) => (
      upload.id === uploadId ? summarizeUpload(updatedUpload) : upload
    )));

    writeCachedJson(uploadDetailCacheKey(uploadId), updatedUpload);
    scheduleUploadSave(updatedUpload);
  };

  const updateUploadHistoryUpload = (uploadId, updates) => {
    let updatedUpload = null;

    setUploadDetailsById((current) => {
      const currentUpload = current[uploadId];
      if (!currentUpload) return current;

      updatedUpload = { ...currentUpload, ...updates };
      return { ...current, [uploadId]: updatedUpload };
    });

    if (!updatedUpload) return;

    setUploadHistory((current) => current.map((upload) => (
      upload.id === uploadId ? summarizeUpload(updatedUpload) : upload
    )));

    writeCachedJson(uploadDetailCacheKey(uploadId), updatedUpload);
    scheduleUploadSave(updatedUpload);
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

  const addLineRemark = () => {
    if (!selectedImport || !activeUpload) return;
    const nextRemarks = [
      ...(activeUpload.lineRemarks || []),
      {
        id: `line-remark-${Date.now()}`,
        line: lineOptions[1] || '',
        remark: '',
        status: 'Pending',
      },
    ];
    updateUploadHistoryUpload(selectedImport.id, { lineRemarks: nextRemarks });
  };

  const updateLineRemark = (remarkId, updates) => {
    if (!selectedImport || !activeUpload) return;
    const nextRemarks = (activeUpload.lineRemarks || []).map((entry) => (
      entry.id === remarkId ? { ...entry, ...updates } : entry
    ));
    updateUploadHistoryUpload(selectedImport.id, { lineRemarks: nextRemarks });
  };

  const removeLineRemark = (remarkId) => {
    if (!selectedImport || !activeUpload) return;
    const nextRemarks = (activeUpload.lineRemarks || []).filter((entry) => entry.id !== remarkId);
    updateUploadHistoryUpload(selectedImport.id, { lineRemarks: nextRemarks });
  };

  const operatorRows = selectedImportDetails?.rows || [];
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
  const completedAuditRows = operatorRows.filter((row) => row.auditDone === 'Yes').length;
  const noAuditRows = operatorRows.filter((row) => row.auditDone === 'No').length;
  const pendingAuditRows = operatorRows.filter((row) => !row.auditDone).length;
  const lineRemarks = selectedImportDetails?.lineRemarks || [];

  return (
    <div className="audit-page">
      <div className="page-header">
        <h1 className="page-title">Audits</h1>
      </div>

      <div className="card audit-upload-card">
        <div className="audit-upload-head">
          <div>
            <h3 className="audit-section-title">Operator Audit Sheet</h3>
          </div>
          <div className="audit-upload-controls">
            <button
              type="button"
              className="btn btn-primary audit-upload-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingOperators}
            >
              {uploadingOperators ? 'Uploading...' : 'Choose Excel File'}
            </button>
            <input
              ref={fileInputRef}
              className="audit-file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleOperatorUpload}
              disabled={uploadingOperators}
              tabIndex="-1"
              aria-hidden="true"
            />
            <span className="audit-file-name">
              {uploadFileName || 'No file selected'}
            </span>
          </div>
        </div>

        {!uploadHistory.length || !selectedImport ? (
          <>
            <div className="audit-history-filters audit-history-filters-compact">
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
            <div className="audit-upload-empty">
              {uploadHistory.length ? 'No uploaded sheet matches the selected date or week.' : 'No operator report uploaded yet.'}
            </div>
          </>
        ) : (
          <>
            <div className="audit-compact-summary">
              <div className="audit-summary-chips">
                <span className="audit-summary-chip">{selectedImport.rowCount || 0} rows</span>
                <span className="audit-summary-chip">{selectedImport.lineCount || 0} lines</span>
                <span className="audit-summary-chip">{selectedImport.sectionCount || 0} sections</span>
                <span className="audit-summary-chip audit-summary-chip-success">{selectedImport.yesCount || 0} yes</span>
                <span className="audit-summary-chip audit-summary-chip-danger">{selectedImport.noCount || 0} no</span>
                <span className="audit-summary-chip">{selectedImport.pendingCount || 0} pending</span>
                {savingUploads[selectedImport.id] ? (
                  <span className="audit-summary-chip">Saving changes...</span>
                ) : null}
              </div>
            </div>

            <div className="audit-history-filters audit-history-filters-compact">
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
              <div className="form-group audit-actions-field" style={{ marginBottom: 0 }}>
                <label>Actions</label>
                <div className="audit-actions-menu-wrap">
                  <button
                    type="button"
                    className="btn btn-secondary audit-actions-menu-trigger"
                    onClick={() => setShowAuditActions((current) => !current)}
                  >
                    More
                  </button>
                  {showAuditActions ? (
                    <div className="audit-actions-menu">
                      <button type="button" className="audit-actions-menu-item" onClick={clearSelectedUpload}>Clear selected sheet</button>
                      <button type="button" className="audit-actions-menu-item" onClick={clearAllUploads}>Clear all sheets</button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

                <div className="audit-rows-head">
                  <div>
                    <h3 className="audit-section-title">Uploaded Operator Rows</h3>
                  </div>
                </div>

                {uploadDetailsLoading && !selectedImportDetails ? (
                  <div className="audit-upload-empty">Loading uploaded sheet...</div>
                ) : uploadDetailErrors[selectedImport.id] && !selectedImportDetails ? (
                  <div className="audit-upload-empty">
                    Sheet summary is loaded, but full row details could not be loaded from the backend.
                  </div>
                ) : (
                  <>
                <div className="audit-line-remarks-card">
                  <div className="audit-line-remarks-head">
                    <div>
                      <h4 className="audit-line-remarks-title">Line-wise Remarks</h4>
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={addLineRemark}>
                      Add Remark
                    </button>
                  </div>
                  {!lineRemarks.length ? (
                    <div className="audit-line-remarks-empty">No line remarks added yet.</div>
                  ) : (
                    <div className="audit-line-remarks-list">
                      {lineRemarks.map((entry) => (
                        <div key={entry.id} className="audit-line-remark-row">
                          <select
                            className="audit-inline-select"
                            value={entry.line}
                            onChange={(e) => updateLineRemark(entry.id, { line: e.target.value })}
                          >
                            <option value="">Select line</option>
                            {lineOptions.filter((line) => line !== 'All').map((line) => (
                              <option key={line} value={line}>{line}</option>
                            ))}
                          </select>
                          <input
                            className="audit-reason-input"
                            type="text"
                            placeholder="Write line remark"
                            value={entry.remark}
                            onChange={(e) => updateLineRemark(entry.id, { remark: e.target.value })}
                          />
                          <select
                            className="audit-inline-select"
                            value={entry.status}
                            onChange={(e) => updateLineRemark(entry.id, { status: e.target.value })}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Completed">Completed</option>
                          </select>
                          <button
                            type="button"
                            className="audit-line-remark-remove"
                            onClick={() => removeLineRemark(entry.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="operations-table-wrap audit-table-wrap">
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
                                  onClick={() => setPreviewImage({
                                    src: row.picture,
                                    title: row.operator || 'Operator image',
                                  })}
                                />
                              ) : (
                                <span className="audit-picture-empty">No image</span>
                              )}
                              <div className="audit-picture-actions">
                                <button
                                  type="button"
                                  className="audit-picture-trigger"
                                  aria-label="Add or change picture"
                                  onClick={() => setOpenPictureMenuRowId((current) => (
                                    current === row.id ? null : row.id
                                  ))}
                                >
                                  +
                                </button>
                                {openPictureMenuRowId === row.id ? (
                                  <div className="audit-picture-menu">
                                    <label className="audit-picture-menu-item">
                                      <span>Upload</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handlePictureChange(row.id, file);
                                          e.target.value = '';
                                          setOpenPictureMenuRowId(null);
                                        }}
                                      />
                                    </label>
                                    <label className="audit-picture-menu-item">
                                      <span>Camera</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handlePictureChange(row.id, file);
                                          e.target.value = '';
                                          setOpenPictureMenuRowId(null);
                                        }}
                                      />
                                    </label>
                                  </div>
                                ) : null}
                              </div>
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

      <div className="card audit-list-card">
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
        <p className="audit-empty-list">
          No audits found.
        </p>
      ) : (
        <div className="card audit-list-table-card">
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

      {previewImage ? (
        <div className="audit-image-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="audit-image-backdrop"
            aria-label="Close image preview"
            onClick={() => setPreviewImage(null)}
          />
          <div className="audit-image-dialog">
            <div className="audit-image-dialog-head">
              <strong>{previewImage.title}</strong>
              <button
                type="button"
                className="audit-image-close"
                onClick={() => setPreviewImage(null)}
              >
                Close
              </button>
            </div>
            <img src={previewImage.src} alt={previewImage.title} className="audit-image-full" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
