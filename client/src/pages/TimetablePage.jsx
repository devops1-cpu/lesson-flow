import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';

const API = '/api';

const COLORS = [
    '#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01', '#46bdc6', '#7baaf7',
    '#f07b72', '#fdd663', '#57bb8a', '#e8710a', '#af5cf7', '#24c1e0', '#f439a0',
    '#1a73e8', '#d93025', '#f9ab00', '#1e8e3e', '#e37400', '#009688', '#673ab7',
];
function hc(s) { let h = 0; for (let i = 0; i < s.length; i++)h = s.charCodeAt(i) + ((h << 5) - h); return COLORS[Math.abs(h) % COLORS.length] }

const ALL_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_SHORT = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat' };
const DEFAULT_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

function apiFetch(p, o = {}) {
    const t = localStorage.getItem('token');
    return fetch(`${API}${p}`, {
        ...o,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...o.headers }
    }).then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'API Error');
        return d;
    });
}

// ── Load/save per-grade working days from localStorage ──
function loadGradeDays() { try { return JSON.parse(localStorage.getItem('tt_grade_days')) || {} } catch { return {} } }
function saveGradeDays(gd) { localStorage.setItem('tt_grade_days', JSON.stringify(gd)) }

/* ══════════════════ MODAL ══════════════════ */
function Modal({ open, onClose, title, wide, children }) {
    if (!open) return null;
    return (<div style={MS.ov} onClick={onClose}><div style={{ ...MS.m, maxWidth: wide ? 900 : 560 }} onClick={e => e.stopPropagation()}>
        <div style={MS.mh}><h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3><button style={MS.x} onClick={onClose}>✕</button></div>
        <div style={MS.mb}>{children}</div>
    </div></div>);
}
const MS = {
    ov: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' },
    m: { background: '#fff', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,.2)', width: '92vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    mh: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' },
    mb: { padding: 16, overflow: 'auto', flex: 1 }, x: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#64748b', padding: 4 }
};

/* ══════════════════ LESSONS DIALOG ══════════════════ */
function LessonsDialog({ open, onClose, onRefresh }) {
    const [lessons, setLessons] = useState([]); const [classes, setClasses] = useState([]); const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]); const [loading, setLoading] = useState(true); const [form, setForm] = useState(null);
    const [filterClass, setFilterClass] = useState('');
    const RT = ['REGULAR', 'LAB', 'PE', 'SPECIALTY', 'LIBRARY', 'COMPUTER_LAB'];
    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [ls, cl, sb, tc] = await Promise.all([apiFetch('/lesson-config'), apiFetch('/classes'), apiFetch('/admin/subjects'), apiFetch('/users?role=TEACHER')]);
        setLessons(Array.isArray(ls) ? ls : []); setClasses(Array.isArray(cl) ? cl : []); setSubjects(Array.isArray(sb) ? sb : []);
        setTeachers(Array.isArray(tc) ? tc : tc.users || []); setLoading(false);
    }, []);
    useEffect(() => { if (open) fetchAll() }, [open, fetchAll]);
    const filtered = filterClass ? lessons.filter(l => l.classes?.some(c => c.classId === filterClass)) : lessons;
    const save = async () => {
        if (!form.isMeeting && (!form.subjectId || form.classIds.length === 0 || form.teacherIds.length === 0)) return;
        if (form.isMeeting && (!form.title || form.teacherIds.length === 0)) return;
        const body = { ...form, roomType: form.roomType || null };
        try {
            if (form.id) await apiFetch(`/lesson-config/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });
            else await apiFetch('/lesson-config', { method: 'POST', body: JSON.stringify(body) });
            setForm(null); fetchAll(); onRefresh?.();
        } catch (e) {
            alert(e.message);
        }
    };
    const del = async (id) => { if (!confirm('Delete?')) return; await apiFetch(`/lesson-config/${id}`, { method: 'DELETE' }); fetchAll(); onRefresh?.(); };
    const imp = async () => { await apiFetch('/lesson-config/from-assignments', { method: 'POST' }); fetchAll(); onRefresh?.(); };
    const tog = (tid) => setForm(f => ({ ...f, teacherIds: f.teacherIds.includes(tid) ? f.teacherIds.filter(t => t !== tid) : [...f.teacherIds, tid] }));
    const togC = (cid) => setForm(f => ({ ...f, classIds: f.classIds.includes(cid) ? f.classIds.filter(c => c !== cid) : [...f.classIds, cid] }));
    return (
        <Modal open={open} onClose={onClose} title="📅 Lessons" wide>
            {form ? (<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={FS.sec}><span style={FS.ico}>👨‍🏫</span><div style={{ flex: 1 }}><label style={FS.lb}>Teacher(s)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>{teachers.map(t => (
                        <button key={t.id} style={{ ...FS.chip, background: form.teacherIds.includes(t.id) ? '#4f46e5' : '#f1f5f9', color: form.teacherIds.includes(t.id) ? '#fff' : '#475569' }} onClick={() => tog(t.id)}>{t.name}</button>
                    ))}</div>{form.teacherIds.length > 1 && <div style={{ fontSize: 10, color: '#6366f1', marginTop: 2 }}>🔗 {form.teacherIds.length} teachers</div>}</div></div>
                <div style={FS.sec}><span style={FS.ico}>🤝</span><div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="isMtg" checked={form.isMeeting} onChange={e => setForm({ ...form, isMeeting: e.target.checked })} />
                    <label htmlFor="isMtg" style={{ ...FS.lb, margin: 0, cursor: 'pointer' }}>Is this a Meeting/Event? (No specific subject/class)</label>
                </div></div>

                {form.isMeeting ? (
                    <div style={FS.sec}><span style={FS.ico}>📝</span><div style={{ flex: 1 }}><label style={FS.lb}>Meeting Title</label>
                        <input style={FS.inp} value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g Staff Alignment" /></div></div>
                ) : (
                    <>
                        <div style={FS.sec}><span style={FS.ico}>📘</span><div style={{ flex: 1 }}><label style={FS.lb}>Subject</label>
                            <select style={FS.sel} value={form.subjectId || ''} onChange={e => setForm({ ...form, subjectId: e.target.value })}><option value="">Select...</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div>
                        <div style={FS.sec}><span style={FS.ico}>🏫</span><div style={{ flex: 1 }}><label style={FS.lb}>Class(es)</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>{classes.map(c => (
                                <button key={c.id} style={{ ...FS.chip, background: form.classIds.includes(c.id) ? '#4f46e5' : '#f1f5f9', color: form.classIds.includes(c.id) ? '#fff' : '#475569' }} onClick={() => togC(c.id)}>{c.name}{c.section ? ' ' + c.section : ''}</button>
                            ))}</div></div></div>
                    </>
                )}
                <div style={FS.sec}><span style={FS.ico}>📊</span><div style={{ flex: 1, display: 'flex', gap: 12 }}>
                    <label style={{ ...FS.lb, flex: 1 }}>Count/wk<input style={FS.inp} type="number" min={1} max={10} value={form.count} onChange={e => setForm({ ...form, count: +e.target.value || 1 })} /></label>
                    <label style={{ ...FS.lb, flex: 1 }}>Length<select style={FS.sel} value={form.length} onChange={e => setForm({ ...form, length: +e.target.value || 1 })}><option value={1}>Single</option><option value={2}>Double</option><option value={3}>Triple</option></select></label>
                </div></div>
                <div style={FS.sec}><span style={FS.ico}>🚪</span><div style={{ flex: 1 }}><label style={FS.lb}>Room Type</label>
                    <select style={FS.sel} value={form.roomType || ''} onChange={e => setForm({ ...form, roomType: e.target.value })}><option value="">Auto</option>{RT.map(r => <option key={r} value={r}>{r}</option>)}</select></div></div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button style={FS.btnP} onClick={save}>Save</button><button style={FS.btnS} onClick={() => setForm(null)}>Cancel</button></div>
            </div>) : (<>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select style={{ ...FS.sel, maxWidth: 180 }} value={filterClass} onChange={e => setFilterClass(e.target.value)}><option value="">All Classes</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <div style={{ flex: 1 }} /><button style={FS.btnS} onClick={imp}>📥 Import</button><button style={FS.btnG} onClick={() => setForm({ subjectId: '', classIds: [], teacherIds: [], count: 1, length: 1, roomType: '', isMeeting: false, title: '' })}>＋ New</button>
                </div>
                {loading ? <div style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div> :
                    <table style={FS.tbl}><thead><tr><th style={FS.th}></th><th style={FS.th}>Subject</th><th style={FS.th}>Teacher</th><th style={FS.th}>Class</th><th style={FS.th}>Cnt</th><th style={FS.th}>Len</th><th style={FS.th}></th></tr></thead>
                        <tbody>{filtered.map(l => <tr key={l.id}><td style={FS.td}><div style={{ width: 10, height: 10, borderRadius: 2, background: l.subject?.color || hc(l.subject?.name || l.title || '') }} /></td>
                            <td style={FS.td}><strong>{l.subject?.name || l.title || 'Meeting'}</strong></td><td style={FS.td}>{l.teachers?.map(t => t.teacher?.name).join(', ')}</td>
                            <td style={FS.td}>{l.classes?.map(c => c.class?.name).join(', ') || '-'}</td><td style={FS.td}>{l.count}</td><td style={FS.td}>{l.length === 1 ? 'S' : l.length === 2 ? 'D' : 'T'}</td>
                            <td style={FS.td}><button style={FS.sm} onClick={() => setForm({ ...l, teacherIds: l.teachers?.map(t => t.teacherId) || [], classIds: l.classes?.map(c => c.classId) || [], isMeeting: !l.subjectId })}>✏️</button><button style={{ ...FS.sm, color: '#dc2626' }} onClick={() => del(l.id)}>🗑</button></td>
                        </tr>)}{filtered.length === 0 && <tr><td colSpan={7} style={{ ...FS.td, textAlign: 'center', color: '#94a3b8' }}>No lessons</td></tr>}</tbody></table>}
            </>)}
        </Modal>);
}
const FS = {
    sec: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' },
    ico: { fontSize: 24, flexShrink: 0, width: 32, textAlign: 'center' }, lb: { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 },
    inp: { padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, width: '100%', boxSizing: 'border-box' },
    sel: { padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, width: '100%', boxSizing: 'border-box', background: '#fff' },
    chip: { padding: '4px 8px', borderRadius: 5, border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 600, fontSize: 10 },
    btnP: { padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: '#4f46e5', color: '#fff' },
    btnS: { padding: '7px 14px', borderRadius: 7, border: '1px solid #d1d5db', cursor: 'pointer', fontWeight: 600, fontSize: 12, background: '#fff', color: '#374151' },
    btnG: { padding: '7px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: '#059669', color: '#fff' },
    tbl: { width: '100%', borderCollapse: 'collapse', fontSize: 12 }, th: { textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', fontSize: 11 },
    td: { padding: '5px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }, sm: { padding: '2px 6px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13 }
};

/* ══════════════════ TIME OFF DIALOG ══════════════════ */
function TimeOffDialog({ config, onClose, days, periods }) {
    // config = { type: 'class'|'teacher'|'subject', item: {id, name} }
    const [matrix, setMatrix] = useState([]); const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!config) return;
        apiFetch(`/timeoff/${config.type}/${config.item.id}`).then(d => {
            setMatrix(d || []); setLoading(false);
        }).catch(() => setLoading(false));
    }, [config]);

    const getState = (d, p) => matrix.find(m => m.dayOfWeek === d && m.periodId === p)?.state || 'AVAILABLE';
    const cycle = (d, p) => {
        const cur = getState(d, p);
        const next = cur === 'AVAILABLE' ? 'CONDITIONAL' : cur === 'CONDITIONAL' ? 'UNAVAILABLE' : 'AVAILABLE';
        setMatrix(prev => {
            const filtered = prev.filter(m => !(m.dayOfWeek === d && m.periodId === p));
            return [...filtered, { dayOfWeek: d, periodId: p, state: next }];
        });
    };

    const save = async () => {
        setLoading(true);
        try {
            await apiFetch(`/timeoff/${config.type}/${config.item.id}`, { method: 'POST', body: JSON.stringify({ matrix }) });
            onClose();
        } catch { alert('Failed to save time off'); setLoading(false) }
    };

    if (!config) return null;
    const icons = { AVAILABLE: '✔️', CONDITIONAL: '❓', UNAVAILABLE: '❌' };
    const colors = { AVAILABLE: '#dcfce7', CONDITIONAL: '#fef3c7', UNAVAILABLE: '#fee2e2' };

    return (<Modal open={!!config} onClose={onClose} title={`Time Off: ${config.item.name}`} wide>
        {loading ? <div style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div> : <>
            <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                <table style={{ ...FS.tbl, border: '1px solid #e2e8f0' }}>
                    <thead><tr>
                        <th style={{ ...FS.th, width: 80 }}>Day</th>
                        {periods.map(p => <th key={p.id} style={{ ...FS.th, textAlign: 'center' }}>P{p.number}</th>)}
                    </tr></thead>
                    <tbody>
                        {days.map(d => <tr key={d}>
                            <td style={{ ...FS.td, fontWeight: 700, background: '#f8fafc' }}>{DAY_SHORT[d] || d.slice(0, 3)}</td>
                            {periods.map(p => {
                                const st = getState(d, p.id);
                                return <td key={p.id} style={{ ...FS.td, textAlign: 'center', background: colors[st], cursor: 'pointer', userSelect: 'none' }} onClick={() => cycle(d, p.id)} title="Click to change availability">
                                    {icons[st]}
                                </td>
                            })}
                        </tr>)}
                    </tbody>
                </table>
            </div>
            <div style={{ display: 'flex', gap: 15, fontSize: 11, background: '#f8fafc', padding: 8, borderRadius: 6, marginBottom: 15 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>✔️ Available</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>❓ Conditional (Avoid if possible)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>❌ Not Available</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button style={FS.btnP} onClick={save}>Save Changes</button>
                <button style={FS.btnS} onClick={onClose}>Cancel</button>
            </div>
        </>}
    </Modal>);
}

/* ══════════════════ EXPORT DIALOG ══════════════════ */
function ExportDialog({ open, onClose, classes, teachers, rooms, slots, activeDays, periods, defaultDays, gradeDays }) {
    const [reportType, setReportType] = useState('class');
    const [generating, setGenerating] = useState(false);

    const isDayActiveForGrade = (grade, day) => {
        if (!grade) return defaultDays.includes(day);
        const rowDays = gradeDays[grade] || defaultDays;
        return rowDays.includes(day);
    };

    const handleExport = async (format) => {
        setGenerating(true);
        setTimeout(() => {
            const el = document.getElementById('export-render-container');
            if (format === 'pdf') {
                const opt = {
                    margin: 0.3,
                    filename: `Timetable_${reportType}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
                };
                html2pdf().set(opt).from(el).save().then(() => setGenerating(false));
            } else {
                // Excel export basically flattens it
                const ws = XLSX.utils.table_to_sheet(el);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
                XLSX.writeFile(wb, `Timetable_${reportType}.xlsx`);
                setGenerating(false);
            }
        }, 100);
    };

    // Build the grid mapping easily
    const slotMap = useMemo(() => { const m = {}; for (const s of slots) { m[`c-${s.classId}-${s.dayOfWeek}-${s.periodId}`] = s; m[`t-${s.teacherId}-${s.dayOfWeek}-${s.periodId}`] = s; if (s.roomId) m[`r-${s.roomId}-${s.dayOfWeek}-${s.periodId}`] = s; } return m }, [slots]);

    const renderEntityTables = () => {
        let entities = [];
        let pk = '';
        if (reportType === 'class') { entities = classes; pk = 'c'; }
        else if (reportType === 'teacher') { entities = teachers; pk = 't'; }
        else if (reportType === 'room') { entities = rooms; pk = 'r'; }

        return entities.map((ent, idx) => {
            const activeDaysForEnt = reportType === 'class' ? ALL_DAYS.filter(d => isDayActiveForGrade(ent.grade, d)) : activeDays;

            return (
                <div key={ent.id} style={{ pageBreakAfter: idx < entities.length - 1 ? 'always' : 'auto', marginBottom: 40, fontFamily: 'sans-serif' }}>
                    <div style={{ textAlign: 'center', fontSize: 28, fontWeight: 'bold', marginBottom: 10 }}>{ent.name} {ent.section || ''}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                        <span>The Vels Academy</span>
                        <span>{reportType === 'class' ? 'Timetable for class' : reportType === 'teacher' ? 'Timetable for teacher' : 'Timetable for room'}: {ent.name}</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid #000', padding: 4, width: 60 }}></th>
                                {periods.map(p => <th key={p.id} style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>
                                    <div style={{ fontSize: 14, fontWeight: 'bold' }}>{p.number}</div>
                                    <div style={{ fontSize: 8, fontWeight: 'normal' }}>{p.startTime.substring(0, 5)} - {p.endTime.substring(0, 5)}</div>
                                </th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {activeDaysForEnt.map(d => (
                                <tr key={d}>
                                    <th style={{ border: '1px solid #000', padding: 4, fontSize: 18, textAlign: 'center' }}>{DAY_SHORT[d]}</th>
                                    {periods.map(p => {
                                        const slot = slotMap[`${pk}-${ent.id}-${d}-${p.id}`];
                                        return (
                                            <td key={p.id} style={{ border: '1px solid #000', padding: 4, textAlign: 'center', height: 60, verticalAlign: 'middle' }}>
                                                {slot ? <>
                                                    <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>{slot.subject?.abbreviation || slot.subject?.name || slot.title || 'Meeting'}</div>
                                                    <div style={{ fontSize: 10 }}>
                                                        {reportType !== 'teacher' && <span>{slot.teachers?.map(t => t.teacher?.name).join(', ') || ''} </span>}
                                                        {reportType !== 'room' && <span>{slot.room?.name || ''} </span>}
                                                        {reportType !== 'class' && <span>{slot.classes?.map(c => `${c.class?.name}${c.class?.section ? ' ' + c.class.section : ''}`).join(', ') || ''}</span>}
                                                    </div>
                                                </> : null}
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        });
    };

    return (
        <Modal open={open} onClose={generating ? undefined : onClose} title="🖨️ Export Reports" wide>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                <label style={FS.lb}>Select Report Type
                    <select style={FS.sel} value={reportType} onChange={e => setReportType(e.target.value)}>
                        <option value="class">Timetable for each class</option>
                        <option value="teacher">Timetable for each teacher</option>
                        <option value="room">Timetable for each classroom</option>
                    </select>
                </label>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                    <button style={{ ...FS.btnP, background: '#ef4444' }} onClick={() => handleExport('pdf')} disabled={generating}>
                        {generating ? 'Exporting...' : 'Export to PDF'}
                    </button>
                    <button style={{ ...FS.btnP, background: '#10b981' }} onClick={() => handleExport('excel')} disabled={generating}>
                        {generating ? 'Exporting...' : 'Export to Excel'}
                    </button>
                    <button style={FS.btnS} onClick={onClose} disabled={generating}>Cancel</button>
                </div>

                {/* Hidden container to render export HTML */}
                <div style={{ position: 'absolute', top: -10000, left: -10000, width: 1100, zIndex: -1000 }}>
                    <div id="export-render-container" style={{ width: 1100, padding: 20, background: '#fff', color: '#000' }}>
                        {renderEntityTables()}
                    </div>
                </div>
            </div>
        </Modal>
    );
}

/* ══════════════════ CLASSES DIALOG ══════════════════ */
function ClassesDialog({ open, onClose, summary, onCreate, onTimeOff }) {
    const [classes, setClasses] = useState([]); const [loading, setLoading] = useState(true); const [form, setForm] = useState(null);
    const fetch_ = useCallback(async () => { setLoading(true); const d = await apiFetch('/classes'); setClasses(Array.isArray(d) ? d : []); setLoading(false) }, []);
    useEffect(() => { if (open) fetch_() }, [open, fetch_]);
    const cc = useMemo(() => { const m = {}; for (const c of (summary?.byClass || [])) m[c.classId] = c; return m }, [summary]);
    const save = async () => {
        if (!form?.name) return; if (form.id) await apiFetch(`/admin/classes/${form.id}`, { method: 'PUT', body: JSON.stringify(form) });
        else await apiFetch('/admin/classes', { method: 'POST', body: JSON.stringify(form) }); setForm(null); fetch_(); onCreate?.()
    };
    const del = async (id) => { if (!confirm('Delete?')) return; await apiFetch(`/admin/classes/${id}`, { method: 'DELETE' }); fetch_() };
    return (<Modal open={open} onClose={onClose} title="📚 Classes" wide>
        {form ? (<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={FS.lb}>Name *<input style={FS.inp} value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <div style={{ display: 'flex', gap: 8 }}><label style={{ ...FS.lb, flex: 1 }}>Section<input style={FS.inp} value={form.section || ''} onChange={e => setForm({ ...form, section: e.target.value })} /></label>
                <label style={{ ...FS.lb, flex: 1 }}>Grade<input style={FS.inp} value={form.grade || ''} onChange={e => setForm({ ...form, grade: e.target.value })} /></label>
                <label style={{ ...FS.lb, flex: 1 }}>Capacity<input style={FS.inp} type="number" value={form.capacity || 45} onChange={e => setForm({ ...form, capacity: +e.target.value || 45 })} /></label></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button style={FS.btnP} onClick={save}>Save</button><button style={FS.btnS} onClick={() => setForm(null)}>Cancel</button></div>
        </div>) : (<>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><button style={FS.btnG} onClick={() => setForm({ name: '', section: '', grade: '', capacity: 45 })}>＋ New</button></div>
            {loading ? <div style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div> : <table style={FS.tbl}><thead><tr><th style={FS.th}>Name</th><th style={FS.th}>Sec</th><th style={FS.th}>Grade</th><th style={FS.th}>Cap</th><th style={FS.th}>Lessons</th><th style={FS.th}>Per/wk</th><th style={FS.th}></th></tr></thead>
                <tbody>{classes.map(c => {
                    const i = cc[c.id]; return (<tr key={c.id}><td style={FS.td}><strong>{c.name}</strong></td><td style={FS.td}>{c.section || '—'}</td><td style={FS.td}>{c.grade || '—'}</td><td style={FS.td}>{c.capacity || 45}</td>
                        <td style={FS.td}><span style={{ background: '#eef2ff', color: '#4f46e5', borderRadius: 8, padding: '1px 6px', fontWeight: 700, fontSize: 11 }}>{i?.totalLessons || 0}</span></td>
                        <td style={FS.td}>{i?.totalPeriods || 0}</td><td style={FS.td}><button style={FS.sm} onClick={() => onTimeOff({ type: 'class', item: c })} title="Time Off">⏱️</button><button style={FS.sm} onClick={() => setForm(c)}>✏️</button><button style={{ ...FS.sm, color: '#dc2626' }} onClick={() => del(c.id)}>🗑</button></td></tr>)
                })}</tbody></table>}
        </>)}
    </Modal>);
}

/* ══════════════════ SUBJECTS DIALOG ══════════════════ */
function SubjectsDialog({ open, onClose, summary, onTimeOff }) {
    const [subjects, setSubjects] = useState([]); const [loading, setLoading] = useState(true); const [form, setForm] = useState(null);
    const fetch_ = useCallback(async () => { setLoading(true); const d = await apiFetch('/admin/subjects'); setSubjects(Array.isArray(d) ? d : []); setLoading(false) }, []);
    useEffect(() => { if (open) fetch_() }, [open, fetch_]);
    const sc = useMemo(() => { const m = {}; for (const s of (summary?.bySubject || [])) m[s.subjectId] = s; return m }, [summary]);
    const save = async () => {
        if (!form?.name) return; if (form.id) await apiFetch(`/admin/subjects/${form.id}`, { method: 'PUT', body: JSON.stringify(form) });
        else await apiFetch('/admin/subjects', { method: 'POST', body: JSON.stringify(form) }); setForm(null); fetch_()
    };
    const del = async (id) => { if (!confirm('Delete?')) return; await apiFetch(`/admin/subjects/${id}`, { method: 'DELETE' }); fetch_() };
    return (<Modal open={open} onClose={onClose} title="📘 Subjects" wide>
        {form ? (<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={FS.lb}>Name *<input style={FS.inp} value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <div style={{ display: 'flex', gap: 8 }}><label style={{ ...FS.lb, flex: 1 }}>Abbreviation<input style={FS.inp} placeholder="M, Eng, PE" value={form.abbreviation || ''} onChange={e => setForm({ ...form, abbreviation: e.target.value })} /></label>
                <label style={{ ...FS.lb, flex: 1 }}>Color<input type="color" value={form.color || '#4285f4'} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: 40, height: 28, border: 'none', cursor: 'pointer' }} /></label></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button style={FS.btnP} onClick={save}>Save</button><button style={FS.btnS} onClick={() => setForm(null)}>Cancel</button></div>
        </div>) : (<>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><button style={FS.btnG} onClick={() => setForm({ name: '', abbreviation: '', color: '#4285f4' })}>＋ New</button></div>
            {loading ? <div style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div> : <table style={FS.tbl}><thead><tr><th style={FS.th}></th><th style={FS.th}>Name</th><th style={FS.th}>Abbr</th><th style={FS.th}>Count</th><th style={FS.th}></th></tr></thead>
                <tbody>{subjects.map(s => <tr key={s.id}><td style={FS.td}><div style={{ width: 12, height: 12, borderRadius: 3, background: s.color || hc(s.name) }} /></td>
                    <td style={FS.td}><strong>{s.name}</strong></td><td style={FS.td}>{s.abbreviation || s.code || '—'}</td>
                    <td style={FS.td}><span style={{ background: '#eef2ff', color: '#4f46e5', borderRadius: 8, padding: '1px 6px', fontWeight: 700, fontSize: 11 }}>{sc[s.id]?.totalLessons || 0}</span></td>
                    <td style={FS.td}><button style={FS.sm} onClick={() => onTimeOff({ type: 'subject', item: s })} title="Time Off">⏱️</button><button style={FS.sm} onClick={() => setForm(s)}>✏️</button><button style={{ ...FS.sm, color: '#dc2626' }} onClick={() => del(s.id)}>🗑</button></td></tr>)}</tbody></table>}
        </>)}
    </Modal>);
}

/* ══════════════════ TEACHERS DIALOG ══════════════════ */
function TeachersDialog({ open, onClose, onTimeOff }) {
    const [teachers, setTeachers] = useState([]); const [loading, setLoading] = useState(true);
    const fetch_ = useCallback(async () => { setLoading(true); const d = await apiFetch('/users?role=TEACHER'); setTeachers(Array.isArray(d) ? d : []); setLoading(false) }, []);
    useEffect(() => { if (open) fetch_() }, [open, fetch_]);

    return (<Modal open={open} onClose={onClose} title="🎓 Teachers" wide>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><button style={FS.btnG} onClick={() => window.location.href = '/admin'}>Manage in Admin</button></div>
        {loading ? <div style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div> : <table style={FS.tbl}><thead><tr><th style={FS.th}>Name</th><th style={FS.th}>Email</th><th style={FS.th}></th></tr></thead>
            <tbody>{teachers.map(t => <tr key={t.id}>
                <td style={FS.td}><strong>{t.name}</strong></td><td style={FS.td}>{t.email}</td>
                <td style={FS.td}><button style={FS.sm} onClick={() => onTimeOff({ type: 'teacher', item: t })} title="Time Off">⏱️</button></td></tr>)}</tbody></table>}
    </Modal>);
}

/* ══════════════════ SETTINGS DIALOG — Per-Grade Working Days ══════════════════ */
function SettingsDialog({ open, onClose, gradeDays, setGradeDays, grades, defaultDays, setDefaultDays }) {
    const [localDefault, setLocalDefault] = useState(defaultDays);
    const [localGrade, setLocalGrade] = useState(gradeDays);
    useEffect(() => { if (open) { setLocalDefault(defaultDays); setLocalGrade({ ...gradeDays }) } }, [open, defaultDays, gradeDays]);

    const toggleDefault = (d) => setLocalDefault(l => l.includes(d) ? l.filter(x => x !== d) : [...l, d]);
    const toggleGrade = (grade, d) => {
        const current = localGrade[grade] || [...localDefault];
        const updated = current.includes(d) ? current.filter(x => x !== d) : [...current, d];
        setLocalGrade({ ...localGrade, [grade]: updated });
    };
    const resetGrade = (grade) => { const g = { ...localGrade }; delete g[grade]; setLocalGrade(g) };
    const applyAll = () => {
        setDefaultDays(localDefault); localStorage.setItem('tt_default_days', JSON.stringify(localDefault));
        setGradeDays(localGrade); saveGradeDays(localGrade);
        onClose();
    };

    return (<Modal open={open} onClose={onClose} title="⚙️ Timetable Settings" wide>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Default working days */}
            <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Default Working Days</div>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 8px' }}>Applies to all grades unless overridden below.</p>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {ALL_DAYS.map(d => <button key={d} onClick={() => toggleDefault(d)} style={{
                        padding: '7px 12px', borderRadius: 7, border: '1px solid', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                        ...(localDefault.includes(d) ? { background: '#4f46e5', color: '#fff', borderColor: '#4f46e5' } : { background: '#f8fafc', color: '#94a3b8', borderColor: '#e2e8f0' })
                    }}>{DAY_SHORT[d]}</button>)}
                </div>
            </div>

            {/* Per-grade overrides */}
            {grades.length > 0 && <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Per-Grade Overrides</div>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 10px' }}>Set different working days for specific grades (e.g., primary school Mon–Fri, senior school Mon–Sat).</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {grades.map(g => {
                        const hasOverride = localGrade[g] !== undefined;
                        const activeDaysForGrade = localGrade[g] || localDefault;
                        return (<div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: hasOverride ? '#faf5ff' : '#f8fafc', borderRadius: 8, border: `1px solid ${hasOverride ? '#c084fc' : '#e2e8f0'}` }}>
                            <div style={{ minWidth: 60, fontWeight: 700, fontSize: 12, color: '#1e293b' }}>Grade {g}</div>
                            <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                                {ALL_DAYS.map(d => <button key={d} onClick={() => toggleGrade(g, d)} style={{
                                    padding: '4px 8px', borderRadius: 5, border: '1px solid', fontWeight: 700, fontSize: 10, cursor: 'pointer',
                                    ...(activeDaysForGrade.includes(d) ? { background: hasOverride ? '#7c3aed' : '#4f46e5', color: '#fff', borderColor: hasOverride ? '#7c3aed' : '#4f46e5' } : { background: '#fff', color: '#cbd5e1', borderColor: '#e2e8f0' })
                                }}>{DAY_SHORT[d]}</button>)}
                            </div>
                            {hasOverride ? <button onClick={() => resetGrade(g)} style={{ fontSize: 10, background: 'none', border: 'none', color: '#9333ea', cursor: 'pointer', fontWeight: 600 }}>Reset</button>
                                : <span style={{ fontSize: 10, color: '#94a3b8' }}>Default</span>}
                        </div>);
                    })}
                </div>
            </div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                <button style={FS.btnP} onClick={applyAll}>Apply</button>
                <button style={FS.btnS} onClick={onClose}>Cancel</button>
            </div>
        </div>
    </Modal>);
}

/* ══════════════════ GENERATE MODAL ══════════════════ */
function GenModal({ open, onClose, result, generating }) {
    return (<Modal open={open} onClose={generating ? undefined : onClose} title="⚡ Generating Timetable">
        <div style={{ minHeight: 180, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#e2e8f0', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{ width: result ? '100%' : generating ? '60%' : '0%', height: '100%', background: result?.success ? '#10b981' : '#6366f1', transition: 'width .5s', borderRadius: 6 }} />
            </div>
            {generating && !result && <div style={{ textAlign: 'center', color: '#6366f1' }}><div className="spinner" /><div style={{ fontWeight: 600, marginTop: 8 }}>Scheduling...</div></div>}
            {result && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <div style={GS.box}><div style={GS.n}>{result.totalPlaced}</div><div style={GS.l}>Slots</div></div>
                    <div style={GS.box}><div style={{ ...GS.n, color: result.totalConflicts > 0 ? '#f59e0b' : '#10b981' }}>{result.totalConflicts}</div><div style={GS.l}>Conflicts</div></div>
                    <div style={GS.box}><div style={GS.n}>{result.summary?.lessons || 0}</div><div style={GS.l}>Lessons</div></div>
                </div>
                {result.steps && <div style={{ maxHeight: 140, overflow: 'auto', fontSize: 11, background: '#f8fafc', borderRadius: 6, padding: 8 }}>
                    {result.steps.map((s, i) => <div key={i} style={{ marginBottom: 2 }}><span style={{ color: '#10b981' }}>✓</span> {s.message}</div>)}
                </div>}
                {result.conflicts?.length > 0 && <div style={{ background: '#fef3c7', padding: 8, borderRadius: 6, fontSize: 11 }}>
                    <strong style={{ color: '#92400e' }}>⚠️ Conflicts:</strong>
                    {result.conflicts.slice(0, 4).map((c, i) => <div key={i} style={{ color: '#78350f' }}>{c.lesson?.subject}→{c.lesson?.class}: {c.placed}/{c.needed}</div>)}
                </div>}
                <button style={FS.btnP} onClick={onClose}>Close</button>
            </div>}
        </div>
    </Modal>);
}
const GS = { box: { textAlign: 'center', background: '#f8fafc', borderRadius: 8, padding: '10px 16px', minWidth: 70 }, n: { fontSize: 22, fontWeight: 800, color: '#1e293b' }, l: { fontSize: 10, color: '#64748b', fontWeight: 600 } };

/* ═══════════════════════════════════════════════════
   MAIN TIMETABLE PAGE
   ═══════════════════════════════════════════════════ */
export default function TimetablePage() {
    const { user } = useAuth(); const navigate = useNavigate();
    const isAdmin = user?.role === 'ADMIN', isHod = user?.role === 'HOD', isTeacher = user?.role === 'TEACHER';

    const [activeTab, setActiveTab] = useState(isAdmin || isHod ? 'classes' : 'my');
    const [slots, setSlots] = useState([]); const [periods, setPeriods] = useState([]); const [days, setDays] = useState([]);
    const [classes, setClasses] = useState([]); const [teachers, setTeachers] = useState([]); const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);

    // Per-grade working days
    const [defaultDays, setDefaultDays] = useState(() => { try { return JSON.parse(localStorage.getItem('tt_default_days')) || DEFAULT_DAYS } catch { return DEFAULT_DAYS } });
    const [gradeDays, setGradeDays] = useState(() => loadGradeDays());

    // Dialogs
    const [showClasses, setShowClasses] = useState(false); const [showSubjects, setShowSubjects] = useState(false); const [showTeachers, setShowTeachers] = useState(false);
    const [showLessons, setShowLessons] = useState(false); const [showSettings, setShowSettings] = useState(false);
    const [showGen, setShowGen] = useState(false); const [generating, setGenerating] = useState(false); const [genResult, setGenResult] = useState(null);
    const [timeOffConfig, setTimeOffConfig] = useState(null); // { type, item }
    const [showExport, setShowExport] = useState(false);
    const [summary, setSummary] = useState(null); const [toast, setToast] = useState(null);

    const showToast = useCallback((m, t = 'success') => { setToast({ m, t }); setTimeout(() => setToast(null), 3000) }, []);

    const fetchData = useCallback(async () => {
        setLoading(true); try {
            if (isAdmin || isHod) { const d = await apiFetch('/timetable/all'); setSlots(d.slots || []); setPeriods(d.periods || []); setDays(d.days || []); setClasses(d.classes || []); setTeachers(d.teachers || []); setRooms(d.rooms || []); }
            else { const d = await apiFetch('/timetable/my'); setSlots(d.slots || []); setPeriods(d.periods || []); setDays(d.days || []); }
        } catch { showToast('Failed to load', 'error') } setLoading(false)
    }, [isAdmin, isHod, showToast]);
    const fetchSummary = useCallback(async () => { try { setSummary(await apiFetch('/lesson-config/summary')) } catch { } }, []);
    useEffect(() => { fetchData(); fetchSummary() }, [fetchData, fetchSummary]);

    const handleGen = async () => {
        setShowGen(true); setGenerating(true); setGenResult(null);
        try { const r = await apiFetch('/timetable/auto-generate', { method: 'POST', body: JSON.stringify({ clearExisting: true, activeDays: defaultDays }) }); setGenResult(r); if (r.success) fetchData(); }
        catch { setGenResult({ success: false, error: 'Failed' }) } setGenerating(false)
    };

    const exportToPDF = () => { setShowExport(true); };
    const exportToExcel = () => { setShowExport(true); };

    // Unique grades from classes
    const grades = useMemo(() => { const s = new Set(); classes.forEach(c => { if (c.grade) s.add(c.grade) }); return [...s].sort() }, [classes]);

    // For the active view, compute which days to show (union of all relevant grades, or default)
    const activeDays = useMemo(() => {
        if (activeTab === 'classes') {
            // Show union of all grade days
            const allDays = new Set();
            if (grades.length === 0) defaultDays.forEach(d => allDays.add(d));
            else grades.forEach(g => (gradeDays[g] || defaultDays).forEach(d => allDays.add(d)));
            return ALL_DAYS.filter(d => allDays.has(d));
        }
        // For teachers/rooms/my, show union of all configured days
        const allDays = new Set();
        defaultDays.forEach(d => allDays.add(d));
        Object.values(gradeDays).forEach(arr => arr.forEach(d => allDays.add(d)));
        return ALL_DAYS.filter(d => allDays.has(d));
    }, [activeTab, grades, gradeDays, defaultDays]);

    // Get working days for a specific class (by its grade)
    const getClassDays = useCallback((cls) => {
        const grade = cls?.grade || classes.find(c => c.id === cls?.id)?.grade;
        if (grade && gradeDays[grade]) return gradeDays[grade];
        return defaultDays;
    }, [classes, gradeDays, defaultDays]);

    // Grid
    const nonBreak = useMemo(() => [...periods].filter(p => !p.isBreak).sort((a, b) => a.number - b.number), [periods]);
    const slotMap = useMemo(() => {
        const m = {};
        for (const s of slots) {
            if (s.classes) s.classes.forEach(c => m[`c-${c.classId}-${s.dayOfWeek}-${s.periodId}`] = s);
            if (s.teachers) s.teachers.forEach(t => m[`t-${t.teacherId}-${s.dayOfWeek}-${s.periodId}`] = s);
            if (s.roomId) m[`r-${s.roomId}-${s.dayOfWeek}-${s.periodId}`] = s;
        }
        return m;
    }, [slots]);
    const gridRows = useMemo(() => {
        if (activeTab === 'classes') return classes.map(c => ({ id: c.id, label: `${c.name}${c.section ? ' ' + c.section : ''}`, pk: 'c', grade: c.grade }));
        if (activeTab === 'teachers') return teachers.map(t => ({ id: t.id, label: t.name, pk: 't' }));
        if (activeTab === 'rooms') return rooms.map(r => ({ id: r.id, label: r.name, pk: 'r' }));
        if (activeTab === 'my' && isTeacher) return [{ id: user.id, label: 'My Schedule', pk: 't' }];
        const seen = new Set(); const rows = [];
        for (const s of slots) {
            if (s.classes) s.classes.forEach(c => {
                if (!seen.has(c.classId)) {
                    seen.add(c.classId);
                    rows.push({ id: c.classId, label: c.class?.name || 'Class', pk: 'c', grade: c.class?.grade });
                }
            });
        }
        return rows.length > 0 ? rows : [{ id: user.id, label: 'My Schedule', pk: 'c' }];
    }, [activeTab, classes, teachers, rooms, user, isTeacher, slots]);

    const totalCols = activeDays.length * nonBreak.length;

    // Classes view: check if a day is a working day for a particular row's grade
    const isDayActiveForRow = (row, day) => {
        if (activeTab !== 'classes') return true;
        if (!row.grade) return defaultDays.includes(day);
        const rowDays = gradeDays[row.grade] || defaultDays;
        return rowDays.includes(day);
    };

    // Side panel view items
    const viewItems = (isAdmin || isHod) ? [
        { key: 'classes', icon: 'school', label: 'Classes', count: classes.length },
        { key: 'teachers', icon: 'person', label: 'Teachers', count: teachers.length },
        { key: 'rooms', icon: 'meeting_room', label: 'Rooms', count: rooms.length },
        { key: 'my', icon: 'calendar_today', label: 'My Schedule' },
    ] : [{ key: 'my', icon: 'calendar_today', label: 'My Schedule' }];

    return (<div style={P.wrap}>
        {toast && <div style={P.toast(toast.t)}>{toast.m}</div>}

        {/* ═══ TOP HEADER BAR — Manage buttons ═══ */}
        <div style={P.header}>
            <div style={P.headerLeft}>
                <span className="material-icons-outlined" style={{ fontSize: 20, color: '#4f46e5' }}>calendar_month</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>Timetable</span>
                <div style={P.headerDivider} />
                <span style={{ fontSize: 11, color: '#64748b' }}><strong style={{ color: '#475569' }}>{slots.length}</strong> slots</span>
            </div>
            {isAdmin && <div style={P.headerRight}>
                <button style={{ ...P.hdrBtn, background: '#f8fafc' }} onClick={() => setShowExport(true)} title="Export Reports">
                    <span className="material-icons-outlined" style={{ fontSize: 16 }}>print</span> Print & Export
                </button>
                <div style={P.headerDivider} />
                <button style={P.hdrBtn} onClick={() => setShowClasses(true)}>
                    <span className="material-icons-outlined" style={{ fontSize: 15 }}>school</span>Classes
                </button>
                <button style={P.hdrBtn} onClick={() => setShowTeachers(true)}>
                    <span className="material-icons-outlined" style={{ fontSize: 15 }}>person</span>Teachers
                </button>
                <button style={P.hdrBtn} onClick={() => setShowSubjects(true)}>
                    <span className="material-icons-outlined" style={{ fontSize: 15 }}>menu_book</span>Subjects
                </button>
                <button style={P.hdrBtn} onClick={() => setShowLessons(true)}>
                    <span className="material-icons-outlined" style={{ fontSize: 15 }}>event_note</span>Lessons
                </button>
                <button style={P.hdrBtn} onClick={() => setShowSettings(true)}>
                    <span className="material-icons-outlined" style={{ fontSize: 15 }}>settings</span>Settings
                </button>
                <div style={P.headerDivider} />
                <button style={P.genBtn} onClick={handleGen} disabled={generating}>
                    <span className="material-icons-outlined" style={{ fontSize: 15 }}>auto_fix_high</span>
                    {generating ? 'Working...' : 'Generate'}
                </button>
            </div>}
        </div>

        <div style={P.bodyWrap}>
            {/* ═══ LEFT SIDE — View tabs ═══ */}
            <div style={P.side}>
                {viewItems.map(v => <button key={v.key} style={P.sideBtn(activeTab === v.key)} onClick={() => setActiveTab(v.key)}>
                    <span className="material-icons-outlined" style={{ fontSize: 15 }}>{v.icon}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{v.label}</span>
                    {v.count !== undefined && <span style={P.sideBadge(activeTab === v.key)}>{v.count}</span>}
                </button>)}
            </div>

            {/* ═══ GRID ═══ */}
            <div style={P.main}>
                {loading ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}><div className="spinner" /></div>
                    : gridRows.length === 0 || nonBreak.length === 0 ?
                        <div style={P.empty}><span className="material-icons-outlined" style={{ fontSize: 52, color: '#c7d2fe' }}>event_busy</span><h3 style={{ margin: 0, color: '#64748b', fontSize: 15 }}>No timetable data</h3>
                            {isAdmin && <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Open <strong>Lessons</strong> → Import → then <strong>Generate</strong></p>}</div>
                        : <div style={P.gridWrap}>
                            <table style={P.table} id="timetable-grid">
                                <colgroup>
                                    <col style={{ width: 72, minWidth: 50 }} />
                                    {activeDays.flatMap(() => nonBreak.map((_, i) => <col key={Math.random()} style={{}} />))}
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th style={{ ...P.thCorner, position: 'sticky', left: 0, top: 0, zIndex: 6 }}></th>
                                        {activeDays.map(d => <th key={d} colSpan={nonBreak.length} style={P.thDay}>{DAY_SHORT[d]}</th>)}
                                    </tr>
                                    <tr>
                                        <th style={{ ...P.thPer, position: 'sticky', left: 0, top: 22, zIndex: 6 }}></th>
                                        {activeDays.flatMap(d => nonBreak.map(p => <th key={`${d}-${p.id}`} style={P.thPer}>{p.number}</th>))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {gridRows.map(row => <tr key={row.id}>
                                        <td style={P.rowLabel} title={row.label}>{row.label}</td>
                                        {activeDays.flatMap(d => nonBreak.map(p => {
                                            const dayActive = isDayActiveForRow(row, d);
                                            if (!dayActive) return <td key={`${d}-${p.id}`} style={P.cellOff}><div style={{ background: '#f1f5f9', height: '100%', borderRadius: 2 }} /></td>;
                                            const slot = slotMap[`${row.pk}-${row.id}-${d}-${p.id}`];
                                            const bg = slot ? (slot.subject?.color || hc(slot.subject?.name || slot.title || '')) : undefined;
                                            return <td key={`${d}-${p.id}`} style={P.cell}>
                                                {slot ? <div className="tt-tooltip" style={P.chip(bg)}
                                                    onClick={() => slot.lessonPlan?.id && navigate(`/lesson-plans/${slot.lessonPlan.id}`)}>
                                                    <span style={{ fontWeight: 800, fontSize: 9, lineHeight: '11px' }}>{(slot.subject?.abbreviation || slot.subject?.code || slot.subject?.name || slot.title || '').substring(0, 4)}</span>

                                                    <div className="tt-tooltip-content">
                                                        <div className="tt-detail-row">
                                                            <span className="material-icons-outlined tt-detail-icon">schedule</span>
                                                            <div>
                                                                <div className="tt-detail-label">Time</div>
                                                                <div className="tt-detail-value">{p.startTime} - {p.endTime}</div>
                                                            </div>
                                                        </div>
                                                        <div className="tt-detail-row">
                                                            <span className="material-icons-outlined tt-detail-icon">subject</span>
                                                            <div>
                                                                <div className="tt-detail-label">Subject / Title</div>
                                                                <div className="tt-detail-value">{slot.subject?.name || slot.title || 'Meeting'}</div>
                                                            </div>
                                                        </div>
                                                        <div className="tt-detail-row">
                                                            <span className="material-icons-outlined tt-detail-icon">person</span>
                                                            <div>
                                                                <div className="tt-detail-label">Teacher(s)</div>
                                                                <div className="tt-detail-value">{slot.teachers?.map(t => t.teacher?.name).join(', ') || 'None'}</div>
                                                            </div>
                                                        </div>
                                                        <div className="tt-detail-row">
                                                            <span className="material-icons-outlined tt-detail-icon">room</span>
                                                            <div>
                                                                <div className="tt-detail-label">Room</div>
                                                                <div className="tt-detail-value">{slot.room?.name || 'Not assigned'}</div>
                                                            </div>
                                                        </div>
                                                        <div className="tt-detail-row">
                                                            <span className="material-icons-outlined tt-detail-icon">groups</span>
                                                            <div>
                                                                <div className="tt-detail-label">Class(es)</div>
                                                                <div className="tt-detail-value">{slot.classes?.map(c => `${c.class?.name}${c.class?.section ? ' ' + c.class.section : ''}`).join(', ') || 'None'}</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                </div> : null}
                                            </td>
                                        }))}
                                    </tr>)}
                                </tbody>
                            </table>
                        </div>}

                {/* Legend */}
                {slots.length > 0 && <div style={P.legend}>
                    {[...new Map(slots.filter(s => s.subject).map(s => [s.subject.id, { name: s.subject.name, color: s.subject.color || hc(s.subject.name) }])).values()].map(s =>
                        <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />{s.name}
                        </div>
                    )}
                </div>}
            </div>
        </div>

        {/* Dialogs */}
        <ClassesDialog open={showClasses} onClose={() => setShowClasses(false)} summary={summary} onCreate={fetchSummary} onTimeOff={setTimeOffConfig} />
        <TeachersDialog open={showTeachers} onClose={() => setShowTeachers(false)} onTimeOff={setTimeOffConfig} />
        <SubjectsDialog open={showSubjects} onClose={() => setShowSubjects(false)} summary={summary} onTimeOff={setTimeOffConfig} />
        <LessonsDialog open={showLessons} onClose={() => setShowLessons(false)} onRefresh={() => { fetchSummary(); fetchData() }} />
        <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} gradeDays={gradeDays} setGradeDays={setGradeDays}
            grades={grades} defaultDays={defaultDays} setDefaultDays={setDefaultDays} />
        <GenModal open={showGen} onClose={() => { setShowGen(false); setGenResult(null) }} result={genResult} generating={generating} />
        {timeOffConfig && <TimeOffDialog config={timeOffConfig} onClose={() => setTimeOffConfig(null)} days={activeDays} periods={nonBreak} />}
        {showExport && <ExportDialog open={showExport} onClose={() => setShowExport(false)}
            classes={classes} teachers={teachers} rooms={rooms} slots={slots}
            activeDays={activeDays} periods={nonBreak} defaultDays={defaultDays} gradeDays={gradeDays} />}
    </div>);
}

/* ═══════════════════ STYLES ═══════════════════ */
const P = {
    wrap: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' },

    // Top header
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px',
        background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0, gap: 8, flexWrap: 'wrap', minHeight: 40
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
    headerRight: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
    headerDivider: { width: 1, height: 20, background: '#e2e8f0' },
    hdrBtn: {
        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
        background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 11, color: '#475569', transition: 'all .12s', whiteSpace: 'nowrap'
    },
    genBtn: {
        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, border: 'none',
        cursor: 'pointer', fontWeight: 700, fontSize: 11, background: '#4f46e5', color: '#fff', whiteSpace: 'nowrap'
    },

    // Body with side + grid
    bodyWrap: { display: 'flex', flex: 1, overflow: 'hidden' },

    // Side panel — views only
    side: { width: 140, minWidth: 110, background: '#f8fafc', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', padding: '8px 6px', gap: 2, overflowY: 'auto', flexShrink: 0 },
    sideBtn: (a) => ({
        display: 'flex', alignItems: 'center', gap: 5, padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
        fontWeight: 600, fontSize: 11, width: '100%', textAlign: 'left', transition: 'all .12s',
        background: a ? '#4f46e5' : 'transparent', color: a ? '#fff' : '#475569'
    }),
    sideBadge: (a) => ({ background: a ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.06)', borderRadius: 8, padding: '1px 5px', fontSize: 10, fontWeight: 700 }),

    // Grid area
    main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
    gridWrap: { flex: 1, overflow: 'auto', position: 'relative' },
    table: { borderCollapse: 'separate', borderSpacing: 0, borderTop: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', width: '100%', tableLayout: 'fixed', fontSize: 10 },

    thCorner: { background: '#f1f5f9', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: 2, fontSize: 9 },
    thDay: { padding: '5px 1px', height: 22, boxSizing: 'border-box', background: '#eef2ff', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', fontWeight: 800, color: '#3730a3', textAlign: 'center', fontSize: 10, position: 'sticky', top: 0, zIndex: 3 },
    thPer: { padding: '2px 1px', height: 20, boxSizing: 'border-box', background: '#f8fafc', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', fontWeight: 800, color: '#64748b', textAlign: 'center', fontSize: 9, position: 'sticky', top: 22, zIndex: 2 },
    rowLabel: {
        padding: '2px 4px', background: '#f8fafc', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#1e293b', fontSize: 10,
        position: 'sticky', left: 0, zIndex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 72
    },
    cell: { borderRight: '1px solid #e8ecf0', borderBottom: '1px solid #e8ecf0', padding: 1, height: 28, textAlign: 'center', verticalAlign: 'middle' },
    cellOff: { borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: 1, height: 28, background: '#f8fafc' },
    chip: (c) => ({
        background: c, color: '#fff', borderRadius: 3, padding: '1px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24,
        textShadow: '0 1px 1px rgba(0,0,0,.25)', overflow: 'hidden'
    }),
    legend: { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '5px 10px', borderTop: '1px solid #e2e8f0', background: '#fafbfc', flexShrink: 0 },
    empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, color: '#94a3b8' },

    toast: (t) => ({
        position: 'fixed', top: 14, right: 14, zIndex: 9999, background: t === 'error' ? '#dc2626' : '#059669',
        color: '#fff', padding: '8px 16px', borderRadius: 7, boxShadow: '0 4px 16px rgba(0,0,0,.15)', fontWeight: 500, fontSize: 12
    }),
};
