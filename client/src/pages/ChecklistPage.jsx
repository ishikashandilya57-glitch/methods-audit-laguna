import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { checklistsAPI } from '../services/api';

const RESPONSE_OPTIONS = [
  { value: 'pass', label: 'Pass', color: '#16a34a' },
  { value: 'fail', label: 'Fail', color: '#dc2626' },
  { value: 'na', label: 'N/A', color: '#6b7280' },
];

export default function ChecklistPage() {
  const { auditId, checklistId } = useParams();
  const [checklist, setChecklist] = useState(null);
  const [saving, setSaving] = useState(null); // itemId being saved

  useEffect(() => {
    checklistsAPI.getOne(checklistId)
      .then(({ data }) => setChecklist(data))
      .catch(() => toast.error('Failed to load checklist'));
  }, [checklistId]);

  const handleResponseChange = async (item, response) => {
    setSaving(item._id);
    try {
      const { data } = await checklistsAPI.updateItem(checklistId, item._id, { response });
      setChecklist(data);
    } catch {
      toast.error('Failed to save response');
    } finally {
      setSaving(null);
    }
  };

  const handleRemarkChange = async (item, remarks) => {
    try {
      const { data } = await checklistsAPI.updateItem(checklistId, item._id, { remarks });
      setChecklist(data);
    } catch {
      toast.error('Failed to save remark');
    }
  };

  if (!checklist) return <div className="loading">Loading checklist...</div>;

  const passCount = checklist.items.filter(i => i.response === 'pass').length;
  const failCount = checklist.items.filter(i => i.response === 'fail').length;
  const pendingCount = checklist.items.filter(i => i.response === 'pending').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{checklist.name}</h1>
          <span style={{ fontSize: 13, color: '#6b7280', textTransform: 'capitalize' }}>
            {checklist.category} · {checklist.completionPercentage}% complete
          </span>
        </div>
        <Link to={`/audits/${auditId}`} className="btn btn-secondary">← Back to Audit</Link>
      </div>

      {/* Summary bar */}
      <div className="card">
        <div style={{ display: 'flex', gap: 20 }}>
          <span style={{ color: '#16a34a', fontWeight: 700 }}>Pass: {passCount}</span>
          <span style={{ color: '#dc2626', fontWeight: 700 }}>Fail: {failCount}</span>
          <span style={{ color: '#6b7280', fontWeight: 700 }}>⏳ Pending: {pendingCount}</span>
        </div>
        <div style={{ marginTop: 10, background: '#e5e7eb', borderRadius: 4, height: 8 }}>
          <div style={{ width: `${checklist.completionPercentage}%`, background: '#2563eb', height: '100%', borderRadius: 4 }} />
        </div>
      </div>

      {/* Checklist items */}
      {checklist.items.map((item, index) => (
        <div key={item._id} className="card" style={{ borderLeft: `4px solid ${item.response === 'pass' ? '#16a34a' : item.response === 'fail' ? '#dc2626' : '#d1d5db'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                <span style={{ color: '#6b7280', marginRight: 8 }}>#{index + 1}</span>
                {item.question}
              </div>
              {item.methodReference && (
                <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: 10 }}>
                  Ref: {item.methodReference}
                </span>
              )}
            </div>

            {/* Response buttons */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {RESPONSE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleResponseChange(item, opt.value)}
                  disabled={saving === item._id}
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: '2px solid',
                    borderColor: item.response === opt.value ? opt.color : '#d1d5db',
                    background: item.response === opt.value ? opt.color : '#fff',
                    color: item.response === opt.value ? '#fff' : '#555',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    opacity: saving === item._id ? 0.5 : 1,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Remarks */}
          <div style={{ marginTop: 10 }}>
            <input
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
              placeholder="Add remarks or observations..."
              defaultValue={item.remarks || ''}
              onBlur={e => {
                if (e.target.value !== (item.remarks || '')) {
                  handleRemarkChange(item, e.target.value);
                }
              }}
            />
          </div>
        </div>
      ))}

      {checklist.completionPercentage === 100 && (
        <div className="card" style={{ background: '#d1fae5', border: '1px solid #6ee7b7', textAlign: 'center' }}>
          <p style={{ color: '#065f46', fontWeight: 700, fontSize: 15 }}>
            Checklist complete. All items have been reviewed.
          </p>
        </div>
      )}
    </div>
  );
}
